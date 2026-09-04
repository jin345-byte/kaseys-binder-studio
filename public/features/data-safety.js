/* Binder Studio v2.9.0 — local persistence safety guard */
(function(){
  'use strict';
  let wrapped=false,lastNotice=0;

  function notify(error){
    console.error('Binder local save failed',error);
    document.documentElement.dataset.localSaveHealthy='false';
    const status=document.querySelector('#binderStatus');
    if(status)status.textContent='Save failed — keep this tab open';
    const now=Date.now();
    if(now-lastNotice>3500&&typeof toast==='function'){
      lastNotice=now;
      toast('Binder could not be saved locally. Keep this tab open and free browser storage.');
    }
  }

  function markHealthy(){
    document.documentElement.dataset.localSaveHealthy='true';
  }

  function wrapSave(){
    if(wrapped||typeof saveActivePageSnapshot!=='function')return false;
    const original=saveActivePageSnapshot;
    saveActivePageSnapshot=async function(){
      try{
        const result=await original.apply(this,arguments);
        markHealthy();
        return result;
      }catch(error){
        notify(error);
        throw error;
      }
    };
    wrapped=true;
    return true;
  }

  function flush(){
    if(typeof saveActivePageSnapshot!=='function')return;
    try{
      const pending=saveActivePageSnapshot();
      if(pending&&typeof pending.catch==='function')pending.catch(notify);
    }catch(error){notify(error)}
  }

  if(!wrapSave()){
    setTimeout(wrapSave,0);
    setTimeout(wrapSave,250);
    setTimeout(wrapSave,1000);
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush()},{passive:true});
  addEventListener('pagehide',flush,{passive:true});
  globalThis.KBSDataSafety={flush,wrapSave};
})();
