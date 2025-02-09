#!/usr/bin/env node

"use strict";

// 今、 js で作ってるので requireの使用をする
const fs          = require( 'node:fs' );
const os          = require( 'node:os' );
const fsPromises  = require( 'node:fs/promises' );
const path        = require( 'node:path' );
const crypto      = require( 'node:crypto');
const { spawn }   = require( 'node:child_process' );
const http        = require( 'node:http' );
const querystring = require( 'node:querystring');

const debug = true;

class PromiselizedQueue extends EventTarget{
  /*
    このクラスの基本コンセプトは、キューからの取り出しを Promise にしたこと。
    参考文献
    https://stackoverflow.com/questions/47157428/how-to-implement-a-pseudo-blocking-async-queue-in-js-ts
  */
  /**
     読み取り側が居ないコンテンツはこのリストに追加される
  */
  contentList ;
  /**
     まだ、コンテンツが届いていない時には、この promiseList の中のオブジェクトプロパティ
     resolve() を使って解決すると、読み取りを待っている Promise が解決される。
     また プロパティ reject() は、shutdown() が呼び出された時に、読み取りを待機している
     ところを起こす。
  */
  promiseList ;
  
  constructor(...args){
    super(...args);
    this.contentList = new Array();
    this.promiseList = new Array();
  }

  enque( content ){
    const promise = this.promiseList.shift();
    if( promise ){
      //console.log( "promise.resolve" , promise);
      promise.resolve( content );
    }else{
      //console.log( "enter buffering" );
      this.contentList.push( content );
    }
  }

  shutdown(){
    while( this.promiseList.length ){
      const promise = this.promiseList.shift();
      promise.reject( "queue shutdown" );
    }
  }
  
  async *[Symbol.asyncIterator](){
    for(;;){
      let resolveProc = undefined;
      let rejectProc = undefined;
      const promise = new Promise( (resolve, reject)=>{
        resolveProc = resolve;
        rejectProc = reject;
      } );
      
      if( this.contentList.length ){
        resolveProc( this.contentList.shift() );
      }else{
        this.promiseList.push({ resolve: resolveProc,
                                reject: rejectProc } );
      }
      yield promise;
    }
    return;
  }
};

async function main(queue){
  // 実行ファイルへのパス
  const execPath = "pseudo-job";
  const mimeType = "text/plain; charset=utf-8";
  const child_process_path =
        await fsPromises.realpath( execPath ).catch( (err)=>{
          switch( err.code ){
          case 'ENOENT':
            console.error( err.code , "実行可能ファイルがありません", err.path );
            break;
          default:
            console.log( err );
            break;
          }
          return;
        });

  if( !child_process_path ){
    console.assert( child_process_path === undefined , "child_process_path === undefined ");
    return 1;
  }

  /*
    作ったファイルが消されずに残された場合は 
    find /tmp -maxdepth 1 -name 'seqtask-*' -delete
    消せない 
  */
  const tmp = fs.mkdtempSync( '/tmp/seqtask-' );

  /*
    exit 時に、当該のディレクトリを削除するために、 exit につなげておく
  */
  process.on("exit" , function(){
    // 同期コードしか受け付けない。ので rmSync を使用する
    fs.rmSync( tmp , { recursive: true , force: true } );
  });
  
  const do_task = async function(content, output ){
    // 出力先のファイルのパス
    const output_file_path = path.join( tmp , crypto.randomUUID() );
    const process_argv = ['-o', output_file_path ];
    if( "text" in content ){
      process_argv.push( '-s' , content.text );
    }

    const exit_code = await new Promise( (resolve, reject )=>{
      fs.stat( child_process_path , async ( err , stats ) =>{
        if( err ){
          switch( err.code ){
          case 'ENOENT':
            console.error( err.code , "実行可能ファイルがありません", err.path );
            break;
          default:
            console.log( err );
            break;
          }
          return;
        }
        const child_process =
              new Promise( (resolve, reject )=>{
                const cp = spawn( child_process_path , process_argv ,
                                  { cwd: tmp , env: process.env } );
                cp.on( 'close' , function( code ){
                  resolve( code );
                } );
                cp.on( 'error' , function( error ){
                  reject( error );
                } );
              });
        resolve( await child_process );        
      })
    } );

    if( exit_code === 0 ){ 
      // これが Promise になっているのは readFile が終わってから rmを行うため
      const data = await new Promise( (resolve, reject)=>{
        fs.readFile( output_file_path , {encoding : 'utf-8' , flag : 'r' } , 
                     (err, data)=>{
                       // 読み取りに成功しても失敗しても、 resolve() する
                       if( err ){
                         if( output && "reject" in output ){
                           output.reject( err );
                         }else{
                           console.error( err );
                         }
                         resolve( undefined );
                       }else{
                         const resolveData = {data:data, contentType: mimeType};
                         if( output ){
                           if( "resolve" in output ){
                             output.resolve( resolveData );
                           }
                         }
                         resolve(resolveData);
                       }
                     });
      }).then( ( data )=>{
        fs.rm( output_file_path,{},(err)=>{});
        return data;
      });

    }else{
      fs.rm( output_file_path );
    }
    // ログ出力用の戻り値
    return [ "exec" , child_process_path , ...process_argv , ":" , `exit_code( ${exit_code} )` ] ;
  };

  // キューからの取り出しはこれで行う
  try{
    for await (const content of queue ){

      const output = {};

      console.assert( "resolve" in content , '"resolve" in content'  );
      console.assert( "reject" in content , '"reject" in content' );
      
      // do_task の中身を簡素にするために、 一旦 Promise を中継する
      new Promise( (resolve,reject) => {
        output.resolve = resolve;
        output.reject = reject;
      }).then( (data)=>{
        if( "resolve" in content ){
          console.assert( "function" === typeof content.resolve ,
                          '"function" === typeof content.resolve' );
          content.resolve( data );
        }
      }).catch( (error)=>{
        if( "reject" in content ){
          console.assert( "function" === typeof content.reject ,
                          '"function" === typeof content.reject' );
          content.reject( error );
        }
      });
      
      const log = await do_task(content, output );

      if( debug ){
        // 一応フィルタリングしておく
        console.debug( "[DEBUG]" , ...log , {"text" : content.text} );
      }
    }
  }catch( except ){
    console.log( except );
  }
};

const queue = new PromiselizedQueue();

if( true ){
  main(queue);
  main(queue); // 2プロセス同時実行 
  const server = http.createServer( async function( request , response ){
    const url = request.url;
    if( request.method === "POST" ){
      if( url === "/" ){
        const body = [];
        request.on( "data" , (chunk)=>{
          body.push( chunk );
        });
        request.on( "end" , ()=>{
          const qs = querystring.parse( Buffer.concat( body ).toString() );
          const object = Object.assign( {} , JSON.parse( qs.content ) );

          const promise = new Promise( (resolve,reject)=>{
            object.resolve = resolve;
            object.reject = reject;
          }).then( ( result )=>{
            //console.log( result );
            response.writeHead(200, {'Content-Type': result.contentType });
            response.end(result.data );
          }).catch( ( result )=>{
            // エラーが出たのでコンソールに出す
            console.log( result );

            resonse.writeHead(500 );
            resonse.end( );
          });
          
          queue.enque( object );
        });
      }else{
        
      }
    }else if( request.method === "GET" ){
      response.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
      response.end( "" );
    }
  });
  server.listen( 3001 );
}else{
  //////// テスト用のコード

  /*
    テスト用に 10個のプロセスを立ち上げて 同時にPOST してみる
    これのシェルスクリプトが test-seqtask.sh にある
    for i in $(seq 1 10) ; do curl -X POST http://localhost:3000/ --data-urlencode 'content={ "text" : "hello world" }' &  done ; wait
    
  */

  // queue にあらかじめ詰め物をしておく
  for( let i = 0 ; i < 10 ; ++i ){
    const content = {text: `hello world ${(i+1)} ` ,
                     resolve: function(data){ console.log( data ) ; } ,
                     reject: function(){} };
    console.log( 'enque:' , content );
    queue.enque( content );
  }
  // queue の起動
  main(queue);
  // 時間差で、あとから詰める用
  for( let i = 0 ; i < 10 ; ++i ){
    setTimeout( ()=>{
      const content = {text: `hello world ${(i+1)*100}ms delay`  ,
                       resolve: function(data){ console.log( data ) ; } ,
                       reject: function(){} };
      console.log( 'enque:' , content );
      queue.enque( content );
    }, (i+1)*100 + 1000);
  }
  console.log( "leave main()" );
}
