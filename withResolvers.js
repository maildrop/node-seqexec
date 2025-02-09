
"use strict";

const withResolvers = Promise.withResolvers ? Promise.withResolvers : function () {
  let resolve = undefined , reject = undefined  ;
  const promise = new Promise( (res,rej)=>{
    resolve = res ;
    reject = rej;
  });
  return { "promise": promise , "resolve": resolve , "reject": reject };
};

module.exports = withResolvers;
