/* Binder Studio v2.9.1 — repair legacy external artwork URLs in saved binders. */
(function(){
  'use strict';
  const PROXY_PATH='/api/art-image';
  const PROXY_HOSTS=new Set(['cdn.artofpkm.com']);
  let migrationTimer=0,migrationRunning=false;

  function deliveredUrl(value){
    const raw=String(value||'').trim();
    if(!/^https:\/\//i.test(raw))return raw;
    try{
      const u=new URL(raw,location.href);
      if(u.origin===location.origin&&u.pathname===PROXY_PATH)return u.href;
      if(PROXY_HOSTS.has(u.hostname.toLowerCase()))return `${location.origin}${PROXY_PATH}?url=${encodeURIComponent(u.href)}`;
      return u.href;
    }catch{return raw}
  }

  function repairItem(item){
    if(!item||typeof item!=='object'||item.kind!=='art')return item;
    let changed=false;
    const next={...item};
    for(const key of ['image','imageLow','imageHigh']){
      if(!next[key])continue;
      const fixed=deliveredUrl(next[key]);
      if(fixed!==next[key]){next[key]=fixed;changed=true}
    }
    return changed?next:item;
  }

  function repairEditorState(input){
    if(!input||typeof input!=='object')return input;
    let changed=false;
    const next={...input};
    if(Array.isArray(input.artworks)){
      next.artworks=input.artworks.map(item=>{const fixed=repairItem(item);if(fixed!==item)changed=true;return fixed});
    }
    if(Array.isArray(input.pockets)){
      next.pockets=input.pockets.map(item=>{const fixed=repairItem(item);if(fixed!==item)changed=true;return fixed});
    }
    return changed?next:input;
  }

  function installCoreHooks(){
    try{
      if(typeof cloneEditorState==='function'&&!cloneEditorState.__kbsArtworkRepair){
        const original=cloneEditorState;
        const wrapped=function(src){return repairEditorState(original.apply(this,arguments))};
        wrapped.__kbsArtworkRepair=true;
        cloneEditorState=wrapped;
      }
      if(typeof addArt==='function'&&!addArt.__kbsArtworkRepair){
        const original=addArt;
        const wrapped=function(image,name,source,size){return original.call(this,deliveredUrl(image),name,source,size)};
        wrapped.__kbsArtworkRepair=true;
        addArt=wrapped;
      }
      if(typeof state!=='undefined'){
        const fixed=repairEditorState(state);
        if(fixed!==state){state=fixed;try{localStorage.setItem('michiStandaloneState',JSON.stringify(state))}catch{}}
      }
    }catch(error){console.warn('Legacy artwork hook install failed',error)}
  }

  async function migrateBinderPages(){
    if(migrationRunning)return;
    if(typeof binderDb==='undefined'||!binderDb||typeof binderLayerReady==='undefined'||!binderLayerReady)return;
    migrationRunning=true;
    try{
      const tx=binderDb.transaction('pages','readwrite');
      const store=tx.objectStore('pages');
      const req=store.getAll();
      const pages=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)});
      let changed=0;
      for(const page of pages){
        const fixed=repairEditorState(page?.state);
        if(fixed!==page?.state){store.put({...page,state:fixed});changed++}
      }
      await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
      if(changed){
        document.documentElement.dataset.legacyArtworkMigrated=String(changed);
        console.info('Repaired legacy artwork URLs on',changed,'saved binder page(s).');
      }
    }catch(error){console.warn('Legacy artwork page migration skipped',error)}
    finally{migrationRunning=false}
  }

  function scheduleMigration(delay=0){
    clearTimeout(migrationTimer);
    migrationTimer=setTimeout(()=>{installCoreHooks();migrateBinderPages()},delay);
  }

  installCoreHooks();
  scheduleMigration(500);
  scheduleMigration(1800);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleMigration(250)});

  /* Cloud restore/page navigation eventually calls rerenderEditor. Hooking it means
     freshly downloaded legacy snapshots get normalized across every saved page. */
  try{
    if(typeof rerenderEditor==='function'&&!rerenderEditor.__kbsArtworkRepair){
      const original=rerenderEditor;
      const wrapped=function(){
        installCoreHooks();
        if(typeof state!=='undefined')state=repairEditorState(state);
        const result=original.apply(this,arguments);
        scheduleMigration(50);
        return result;
      };
      wrapped.__kbsArtworkRepair=true;
      rerenderEditor=wrapped;
    }
  }catch(error){console.warn('Could not hook editor artwork repair',error)}

  globalThis.KBSArtworkRepair={deliveredUrl,repairItem,repairEditorState,migrateBinderPages,scheduleMigration};
})();
