/* Kasey's Binder Studio startup responsiveness hotfix.
   Keeps card search interactive while the large local catalog hydrates in the background. */
(function(){
  'use strict';
  const original=globalThis.loadMasterFromDb;
  if(typeof original!=='function'||globalThis.__kbsStartupPerfHotfix)return;
  globalThis.__kbsStartupPerfHotfix=true;

  let scheduled=false;
  function scheduleHydration(){
    if(scheduled)return;
    scheduled=true;
    const run=()=>Promise.resolve().then(()=>original()).catch(err=>{
      console.error('Background card-library hydration failed',err);
      try{globalThis.showRuntimeError?.(err?.message||String(err))}catch{}
    });
    if('requestIdleCallback' in globalThis){
      requestIdleCallback(()=>run(),{timeout:900});
    }else{
      setTimeout(run,220);
    }
  }

  globalThis.loadMasterFromDb=async function(){
    try{
      globalThis.setMasterStatus?.('Card search ready · loading filters in background','Search is available immediately while Sets and Artists finish loading.');
    }catch{}
    scheduleHydration();
  };

  const input=document.querySelector('#subject');
  if(input){
    const ensure=()=>scheduleHydration();
    input.addEventListener('focus',ensure,{once:true,passive:true});
    input.addEventListener('input',ensure,{once:true,passive:true});
  }
})();
