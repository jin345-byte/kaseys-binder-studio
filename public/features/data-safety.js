/* Binder Studio v2.9.0 — local persistence safety guard */
(function(){
  'use strict';

  /* One-time V1 -> V2 sync migration safety.
     Existing signed-in browsers have an owner marker but no V2 baseline hash yet.
     Clear only the owner marker for that first V2 startup so cloud-sync treats any
     meaningful local work conservatively and merges it instead of assuming clean state. */
  try{
    const owner=localStorage.getItem('kbsCloudOwnerV1');
    const v2Hash=localStorage.getItem('kbsCloudLastHashV2');
    if(owner&&!v2Hash){
      sessionStorage.setItem('kbsCloudV2MigrationGuard','1');
      localStorage.removeItem('kbsCloudOwnerV1');
    }
  }catch(e){console.warn('Could not initialize sync migration guard',e)}

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
