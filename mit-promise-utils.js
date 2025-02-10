
"use strict";

/**
   debian 12.9 の node.js は v18.19.0 なのでそれが無い。
   そのための alt-implementation 
 */
const withResolvers = Promise.withResolvers ? Promise.withResolvers : function () {
  let resolve = undefined , reject = undefined  ;
  const promise = new Promise( (res,rej)=>{
    resolve = res ;
    reject = rej;
  });
  return { "promise": promise , "resolve": resolve , "reject": reject };
};

/**
   ハンドル済みの、rejectされるPromise を返す。
   Promise.reject() とほぼ 等価であると考える。
   Promise.reject() を使いたいが、 Promise.reject() をそのまま使おうとすると
   UnhandledRejection エラーが発生して、これは node.js を終了させてしまう。
   
   本来、Reject済みの Promise は、Reject済みの Promise としてそのまま使えれば良いのだが、
   async function を await する時の例外を受け持つという役割があり、例外の無視はもっと良くないとの事だろうけど
   ここは reject() を遅延させる手法をとる。
   
   殆どの場合は、これを使う必要は無い。
   reject済みのPromise をタスクキューに積む必要がある等 宙ぶらりんの rejected promise が必要な時に使う。
*/

const rejectedPromise = function( reason ){
  // これをそのまま使おうとすると unhandledRejection が発生させられる場合がある。
  // const rejected = Promise.reject( error );
  
  // 本来はPromise.withResolvers を使うべき debian 12.9 の node.js は v18.19.0 なのでそれが無い。
  const {promise, reject} = withResolvers();
  
  // すぐさまreject() をしたいところだが、 reject() と await で間が開くのは良くないので、
  // async functionの中で reject() と await を行うことにする。
  
  // node.js の Unhandled rejection は catch() もしくは await がされていないまま taskQueue が空になると発生するので
  // 即座に await させて ハンドル済みにマークする
  (async function (rejected) {
    // this is rejectProc 
    console.assert( this != null && (typeof this) === "function" );
    this( reason ); // この時点で、reject になる。
    try{
      await rejected; // await rejected-promise は、例外を発生させる
    }catch(error_of_reject){
      // が、この例外は発生するのが「正しく」、そしてそれを握りつぶすのが正しい。
      console.assert( reason === error_of_reject );
    }
  }.bind( rejectProc ) )(rejected);
  
  // この時点ではrejected は、恐らく pending 。そして 近い将来必ずrejected になる。
  return rejected; 
};

module.exports = {
  "withResolvers" : withResolvers,
  "rejectedPromise" : rejectedPromise
};
