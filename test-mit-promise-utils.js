"use strict";

const rejected =
      true ?
      require( "./mit-promise-utils.js").rejectedPromise( "rejected" ) :
      Promise.reject( "direct rejected" ) ;

setTimeout( async ()=>{
  try{
    await rejected; // await は throw を引き起こす
  }catch( error_of_reject ){
    console.log( "try-catch 希望通り" , error_of_reject );
  }
  {
    rejected.then( (args) => args )
      .catch( (error_of_reject)=>{
        console.log( "then()-catch() 希望通り" , error_of_reject );
        return undefined;
      });
  }
} , 1000 );
