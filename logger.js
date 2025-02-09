
"use strict";

/**
   行番号付きの console.{log,warn,debug,error} を提供するためのクラス
   console を Proxy でラップして、返す。
*/

class Logger {
  static defaultLogger = undefined;
  
  static getLogger () {
    if( this.defaultLogger ){
      return this.defaultLogger;
    }
    
    return new Proxy ( console , {
      get: function ( target, prop, receiver ) { // これの呼び出しが [2]
        switch( prop ){
        case 'log':
        case 'warn':
        case 'debug':
        case 'error':
          {
            const proceedure = Reflect.get(...arguments );
            const stackFrame = (function(){ // ここが [1] 
              const stack = {};
              {
                const prepareStackTrace = Error.prepareStackTrace;
                Error.captureStackTrace( stack ); // ここが [0]
                Error.prepareStackTrace = function( error , structured ){
                  return { error: error , filename: structured.at(2)?.getFileName() , line: structured.at(2)?.getLineNumber() };
                };
                const stackTrace = {};
                Object.assign( stackTrace , stack.stack );
                Error.prepareStackTrace = prepareStackTrace;
                return stackTrace;
              }
            })();
            return function( ...args ){
              return proceedure.apply( target , args.concat( [`[${prop}](at ${stackFrame.filename}@L.${stackFrame.line})`]));
            };
          }
          break;
        default:
          return Reflect.get(...arguments );
        }
      }
    });
  }
};

module.exports = Logger;



