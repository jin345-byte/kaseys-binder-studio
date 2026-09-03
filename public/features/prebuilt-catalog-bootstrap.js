/* Binder Studio prebuilt catalog bootstrap — staging */
(function(){
  const MANIFEST='/catalog/manifest.json';
  const VERSION_KEY='kbsPrebuiltCatalogVersion';
  const RELOAD_KEY='kbsPrebuiltCatalogReloaded';
  const MASTER_DB='kaseyMasterCardIndex',MASTER_VERSION=6;
  const POCKET_DB='kaseyPocketCardCatalogV1',POCKET_VERSION=1;

  function progress(current,total,label,ready=false){
    try{
      if(typeof updateLibraryProgressUI==='function')updateLibraryProgressUI({current,total,label,active:!ready,ready});
      const h=document.querySelector('#masterLibraryHealth');if(h)h.textContent=label;
    }catch{}
  }
  function openDb(name,version,upgrade){
    return new Promise((resolve,reject)=>{const r=indexedDB.open(name,version);r.onupgradeneeded=()=>upgrade?.(r.result,r.transaction);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error(`${name} database is blocked by another open tab`));});
  }
  async function replaceMaster(rows,version){
    const db=await openDb(MASTER_DB,MASTER_VERSION,(d,tx)=>{
      let s;if(!d.objectStoreNames.contains('cards'))s=d.createObjectStore('cards',{keyPath:'id'});else s=tx.objectStore('cards');
      const ensure=(n,k)=>{if(!s.indexNames.contains(n))s.createIndex(n,k,{unique:false})};
      ensure('nameLower','nameLower');ensure('setId','setId');ensure('illustratorLower','illustratorLower');ensure('language','language');ensure('sourceKey','sourceKey');ensure('namePrefix','namePrefix');ensure('pokedexKey','pokedexKey');
      if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'});
    });
    await new Promise((res,rej)=>{const tx=db.transaction(['cards','meta'],'readwrite'),cards=tx.objectStore('cards'),meta=tx.objectStore('meta');cards.clear();rows.forEach(x=>cards.put(x));meta.put({key:'raw-sync-progress',completed:true,nextIndex:999999,prebuilt:true,version,updatedAt:Date.now()});tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);});
    db.close();
  }
  async function replacePocket(rows,version){
    const db=await openDb(POCKET_DB,POCKET_VERSION,(d)=>{if(!d.objectStoreNames.contains('cards')){const s=d.createObjectStore('cards',{keyPath:'id'});s.createIndex('catalog','catalog',{unique:false});s.createIndex('setId','setId',{unique:false});s.createIndex('nameLower','nameLower',{unique:false});}if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'});});
    await new Promise((res,rej)=>{const tx=db.transaction(['cards','meta'],'readwrite'),cards=tx.objectStore('cards'),meta=tx.objectStore('meta');cards.clear();rows.forEach(x=>cards.put(x));meta.put({key:'build:pocket',count:rows.length,completed:true,prebuilt:true,version,updatedAt:Date.now(),setErrors:0});tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);});
    db.close();
  }
  async function fetchJson(url){const r=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`Catalog HTTP ${r.status}`);return r.json();}
  async function boot(){
    try{
      progress(0,1,'Checking card library…');
      const manifest=await fetchJson(`${MANIFEST}?t=${Date.now()}`);
      if(!manifest?.version||!Array.isArray(manifest.chunks)||!manifest.chunks.length)throw new Error('Catalog manifest was invalid');
      const local=localStorage.getItem(VERSION_KEY)||'';
      if(local===manifest.version){progress(1,1,`Unified Library Ready · ${Number(manifest.cards||0).toLocaleString()} cards`,true);sessionStorage.removeItem(RELOAD_KEY);return;}

      progress(0,manifest.chunks.length,`Downloading unified library · 0/${manifest.chunks.length}`);
      const results=new Array(manifest.chunks.length);let next=0,done=0;
      const workers=Array.from({length:Math.min(4,manifest.chunks.length)},async()=>{while(next<manifest.chunks.length){const i=next++,entry=manifest.chunks[i];results[i]=await fetchJson(`/catalog/${entry.file}?v=${encodeURIComponent(manifest.version)}`);done++;progress(done,manifest.chunks.length,`Downloading unified library · ${done}/${manifest.chunks.length}`);}});
      await Promise.all(workers);
      const all=results.flat();
      if(all.length!==manifest.cards)throw new Error(`Catalog count mismatch (${all.length}/${manifest.cards})`);
      const english=all.filter(x=>x?.catalog!=='pocket'),pocket=all.filter(x=>x?.catalog==='pocket');
      if(english.length<15000||pocket.length<500)throw new Error('Catalog data looked incomplete');
      progress(manifest.chunks.length,manifest.chunks.length,'Installing card library…');
      await Promise.all([replaceMaster(english,manifest.version),replacePocket(pocket,manifest.version)]);
      localStorage.setItem(VERSION_KEY,manifest.version);
      progress(1,1,`Unified Library Ready · ${all.length.toLocaleString()} cards`,true);

      if(sessionStorage.getItem(RELOAD_KEY)!==manifest.version){sessionStorage.setItem(RELOAD_KEY,manifest.version);setTimeout(()=>location.reload(),180);}
    }catch(e){
      console.warn('Prebuilt catalog bootstrap unavailable; manual library build remains available.',e);
      progress(0,1,'Card library available · use Build Card Library if needed');
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
