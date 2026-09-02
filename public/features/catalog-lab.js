/* Kasey's Binder Studio v2.8.0 — unified English TCG + Pokémon TCG Pocket library */
const KBSCatalogLab=(()=>{
  const DB_NAME='kaseyPocketCardCatalogV1';
  const DB_VERSION=1;
  const POCKET_SERIES='https://api.tcgdex.net/v2/en/series/tcgp';
  const SET_BASE='https://api.tcgdex.net/v2/en/sets/';

  let db=null,pocketCards=[],buildPromise=null,pocketState={ready:false,count:0,error:''};
  globalThis.KBSCatalogCards=[];

  function openDb(){
    if(db)return Promise.resolve(db);
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const d=req.result;
        if(!d.objectStoreNames.contains('cards')){
          const s=d.createObjectStore('cards',{keyPath:'id'});
          s.createIndex('catalog','catalog',{unique:false});
          s.createIndex('setId','setId',{unique:false});
          s.createIndex('nameLower','nameLower',{unique:false});
        }
        if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'});
      };
      req.onsuccess=()=>{db=req.result;resolve(db)};
      req.onerror=()=>reject(req.error||new Error('Could not open Pocket library'));
    });
  }

  function store(name,mode='readonly'){return db.transaction(name,mode).objectStore(name)}
  function put(name,value){return new Promise((res,rej)=>{const r=store(name,'readwrite').put(value);r.onsuccess=()=>res(value);r.onerror=()=>rej(r.error)})}
  function getMeta(key){return new Promise((res,rej)=>{const r=store('meta').get(key);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
  function getAllPocket(){return new Promise((res,rej)=>{const r=store('cards').index('catalog').getAll('pocket');r.onsuccess=()=>res((r.result||[]).map(withSearchKeys));r.onerror=()=>rej(r.error)})}
  async function replacePocket(rows){
    await openDb();
    const old=await getAllPocket().catch(()=>[]);
    const tx=db.transaction('cards','readwrite'),s=tx.objectStore('cards');
    old.forEach(x=>s.delete(x.id));
    rows.forEach(x=>s.put(withSearchKeys(x)));
    await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)});
    pocketCards=rows.map(withSearchKeys);
  }

  function imageCandidates(base){
    const b=String(base||'').replace(/\/(high|low)\.(?:webp|png|jpe?g)$/i,'');
    if(!b)return [];
    return [`${b}/high.webp`,`${b}/low.webp`,`${b}/high.png`,`${b}/low.png`,`${b}/high.jpg`,`${b}/low.jpg`].filter((x,i,a)=>a.indexOf(x)===i);
  }

  function normalizePocket(c,setBrief,detail){
    const imgs=imageCandidates(c.image);
    const rawSet=String(setBrief.id||'unknown');
    const displaySet=setBrief.name||detail?.name||rawSet;
    return withSearchKeys({
      id:`pocket:${c.id}`,
      primaryId:c.id,
      tcgdexId:c.id,
      sourceKey:`pocket:${c.id}`,
      language:'en',
      catalog:'pocket',
      catalogLabel:'TCG Pocket',
      source:'tcgdex-pocket',
      name:c.name||'Unknown card',
      originalName:c.name||'',
      localId:String(c.localId??''),
      setId:`pocket:${rawSet}`,
      rawSetId:`pocket:${rawSet}`,
      setName:`TCG Pocket · ${displaySet}`,
      series:'Pokémon TCG Pocket',
      releaseDate:detail?.releaseDate||'',
      illustrator:c.illustrator||'',
      artist:c.illustrator||'',
      rarity:c.rarity||'',
      supertype:c.category||c.type||'',
      subtypes:[],
      pokedexNumbers:[],
      imageHigh:imgs[0]||'',
      imageLow:imgs[1]||imgs[0]||'',
      imageFallbacks:imgs,
      imageSource:'TCGdex Pocket',
      kind:'card'
    });
  }

  async function fetchPocketSet(setBrief){
    const detail=await fetchJsonWithRetry(SET_BASE+encodeURIComponent(setBrief.id),{retries:4,baseDelay:650});
    return (Array.isArray(detail?.cards)?detail.cards:[]).map(c=>normalizePocket(c,setBrief,detail));
  }

  async function buildPocket(){
    if(buildPromise)return buildPromise;
    buildPromise=(async()=>{
      const series=await fetchJsonWithRetry(POCKET_SERIES,{retries:4,baseDelay:700});
      const sets=Array.isArray(series?.sets)?series.sets:[];
      if(!sets.length)throw new Error('Pocket set catalog was empty');
      const chunks=new Array(sets.length);let next=0,done=0,failed=0;
      const workers=Array.from({length:Math.min(4,sets.length)},async()=>{
        while(next<sets.length){
          const i=next++;
          try{chunks[i]=await fetchPocketSet(sets[i]);}
          catch(e){failed++;chunks[i]=[];console.warn('Pocket set skipped',sets[i]?.id,e?.message||e);}
          done++;
          const health=document.querySelector('#masterLibraryHealth');
          if(health)health.textContent=`Unified library · Pocket ${done}/${sets.length} sets${failed?` · ${failed} skipped`:''}`;
        }
      });
      await Promise.all(workers);
      const rows=chunks.flat().filter(Boolean);
      if(!rows.length)throw new Error('Pocket catalog is temporarily unavailable');
      await replacePocket(rows);
      await put('meta',{key:'build:pocket',count:rows.length,completed:true,setErrors:failed,updatedAt:Date.now()});
      pocketState={ready:true,count:rows.length,error:''};
      return rows;
    })().finally(()=>{buildPromise=null});
    return buildPromise;
  }

  function rebuildUnifiedFilters(){
    const sets=new Map();
    for(const c of masterCards)if(c?.setId&&!sets.has(c.setId))sets.set(c.setId,c.setName||c.setId);
    masterSetOptions=[...sets].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
    renderSetFilter();
    loadArtists();
  }

  function mergePocketIntoMaster(){
    const english=masterCards.filter(c=>c?.catalog!=='pocket'&&c?.source!=='tcgdex-pocket');
    masterCards=[...english,...pocketCards];
    masterCardIndex=new Map(masterCards.map((c,i)=>[c.id,i]));
    globalThis.KBSCatalogCards=masterCards;
    masterReady=masterCards.length>0;
    rebuildUnifiedFilters();
    computeMasterHealth();
    renderCards();
  }

  async function loadCache(){
    await openDb();
    pocketCards=await getAllPocket().catch(()=>[]);
    const meta=await getMeta('build:pocket').catch(()=>null);
    pocketState={ready:Boolean(meta?.completed&&pocketCards.length),count:pocketCards.length,error:''};
    mergePocketIntoMaster();
  }

  const coreLoadMasterFromDb=loadMasterFromDb;
  loadMasterFromDb=async function(){
    const result=await coreLoadMasterFromDb.apply(this,arguments);
    if(pocketCards.length)mergePocketIntoMaster();
    return result;
  };

  const coreBuildMasterLibrary=buildMasterLibrary;
  buildMasterLibrary=async function(){
    await coreBuildMasterLibrary();
    try{
      await buildPocket();
    }catch(e){
      pocketState={ready:false,count:pocketCards.length,error:e?.message||String(e)};
      console.warn('Pocket catalog build deferred:',pocketState.error);
    }
    if(pocketCards.length)mergePocketIntoMaster();
    await updateLibrarySetupButton().catch(()=>{});
  };

  const coreUpdateButton=updateLibrarySetupButton;
  updateLibrarySetupButton=async function(){
    await coreUpdateButton.apply(this,arguments);
    const label=document.querySelector('#libraryBuildLabel'),hint=document.querySelector('#libraryBuildHint');
    const englishCount=masterCards.filter(c=>c?.catalog!=='pocket'&&c?.source!=='tcgdex-pocket').length;
    const total=englishCount+pocketCards.length;
    const englishReady=englishCount>5000;
    if(label)label.textContent=englishReady&&pocketState.ready?'Unified Library Ready':'Build Card Library';
    if(hint){
      if(englishReady&&pocketState.ready)hint.textContent=`${total.toLocaleString()} cards · English + Pocket`;
      else if(englishReady&&pocketState.error)hint.textContent='English ready · Pocket will retry later';
      else hint.textContent=`English ${englishCount.toLocaleString()} · Pocket ${pocketCards.length.toLocaleString()}`;
    }
  };

  globalThis.KBSIsPocketSet=id=>String(id||'').startsWith('pocket:');

  openDb().then(loadCache).then(()=>updateLibrarySetupButton().catch(()=>{})).catch(e=>console.warn('Pocket cache unavailable',e));
  return{getCards:()=>masterCards,buildPocket,get pocketState(){return {...pocketState}}};
})();
