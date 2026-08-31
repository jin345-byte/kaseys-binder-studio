/* Kasey's Binder Studio v2.3.1 — English + Pokémon TCG Pocket */
const KBSCatalogLab=(()=>{
  const CATALOG_KEY='kbsActiveCatalogV4';
  const DB_NAME='kaseyPocketCardCatalogV1';
  const DB_VERSION=1;
  const POCKET_SERIES='https://api.tcgdex.net/v2/en/series/tcgp';
  const SET_BASE='https://api.tcgdex.net/v2/en/sets/';

  let activeCatalog=localStorage.getItem(CATALOG_KEY)||'en';
  if(!['en','pocket'].includes(activeCatalog))activeCatalog='en';

  let db=null,pocketCards=[],buildPromise=null;
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
  function getAllPocket(){
    return new Promise((res,rej)=>{
      const r=store('cards').index('catalog').getAll('pocket');
      r.onsuccess=()=>res((r.result||[]).map(withSearchKeys));
      r.onerror=()=>rej(r.error);
    });
  }
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
    return [
      `${b}/high.webp`,
      `${b}/low.webp`,
      `${b}/high.png`,
      `${b}/low.png`,
      `${b}/high.jpg`,
      `${b}/low.jpg`
    ].filter((x,i,a)=>a.indexOf(x)===i);
  }

  function normalizePocket(c,setBrief,detail){
    const imgs=imageCandidates(c.image);
    return withSearchKeys({
      id:`pocket:${c.id}`,
      primaryId:c.id,
      tcgdexId:c.id,
      language:'pocket',
      catalog:'pocket',
      catalogLabel:'Pokémon TCG Pocket',
      source:'tcgdex-pocket',
      name:c.name||'Unknown card',
      originalName:c.name||'',
      localId:String(c.localId??''),
      setId:setBrief.id,
      rawSetId:setBrief.id,
      setName:setBrief.name||detail?.name||setBrief.id,
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
      const health=document.querySelector('#masterLibraryHealth');
      if(health)health.textContent='Pokémon TCG Pocket · loading…';
      const series=await fetchJsonWithRetry(POCKET_SERIES,{retries:4,baseDelay:700});
      const sets=Array.isArray(series?.sets)?series.sets:[];
      const chunks=new Array(sets.length);
      let next=0,done=0;
      const workers=Array.from({length:Math.min(6,sets.length)},async()=>{
        while(next<sets.length){
          const i=next++;
          chunks[i]=await fetchPocketSet(sets[i]);
          done++;
          if(health)health.textContent=`Pokémon TCG Pocket · ${done}/${sets.length} sets`;
        }
      });
      await Promise.all(workers);
      const rows=chunks.flat().filter(Boolean);
      await replacePocket(rows);
      await put('meta',{key:'build:pocket',count:rows.length,completed:true,updatedAt:Date.now()});
      return rows;
    })().finally(()=>{buildPromise=null});
    return buildPromise;
  }

  async function loadCache(){await openDb();pocketCards=await getAllPocket().catch(()=>[])}
  async function ensurePocket(){if(pocketCards.length)return pocketCards;await loadCache();return pocketCards.length?pocketCards:buildPocket()}
  async function pocketReady(){
    await openDb();
    const meta=await getMeta('build:pocket').catch(()=>null);
    return {ready:Boolean(meta?.completed&&Number(meta.count)>0),count:Number(meta?.count||pocketCards.length||0)};
  }

  function renderPocketSetFilter(rows){
    const sel=document.querySelector('#setFilter');if(!sel)return;
    const current=sel.value,map=new Map();
    rows.forEach(c=>{if(c.setId&&!map.has(c.setId))map.set(c.setId,c.setName||c.setId)});
    const opts=[...map.entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1]),undefined,{numeric:true}));
    sel.innerHTML='<option value="">All sets</option>'+opts.map(([id,n])=>`<option value="${esc(id)}">${esc(n)}</option>`).join('');
    if(opts.some(([id])=>id===current))sel.value=current;
  }

  function renderPocketArtists(){
    const sel=document.querySelector('#artistFilter'),clear=document.querySelector('#clearArtist');if(!sel)return;
    const vals=[...new Set(pocketCards.map(c=>c.illustrator||c.artist||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    sel.disabled=false;if(clear)clear.disabled=false;
    sel.innerHTML='<option value="">All artists</option>'+vals.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  }

  async function runPocketSearch(){
    const query=document.querySelector('#subject')?.value.trim()||'';
    const setId=document.querySelector('#setFilter')?.value||'';
    const artist=normText(document.querySelector('#artistFilter')?.value||'');
    state.subject=query;save();renderHeader();
    activeSearchController?.abort();
    activeSearchController=new AbortController();
    const signal=activeSearchController.signal;
    try{
      const all=await ensurePocket();if(signal.aborted)return;
      globalThis.KBSCatalogCards=all;
      let rows=all;
      if(setId)rows=rows.filter(c=>c.setId===setId);
      if(artist)rows=rows.filter(c=>normText(c.illustrator||c.artist||'')===artist);
      if(query.length>=2){
        const q=normText(query);
        rows=rows.filter(c=>(c.nameLower||normText(c.name)).includes(q)||normText(c.setName||'').includes(q)||normText(c.localId||'').includes(q));
      }
      cards=rows.slice(0,MASTER_PAGE_SIZE);
      renderCards();
      renderPocketSetFilter(all);
      renderPocketArtists();
      const count=document.querySelector('#count');if(count)count.textContent=rows.length.toLocaleString();
      const health=document.querySelector('#masterLibraryHealth');
      if(health)health.textContent=`Pokémon TCG Pocket · ${all.length.toLocaleString()} cached · ${rows.length.toLocaleString()} matching`;
    }catch(e){
      if(e?.name==='AbortError')return;
      console.error(e);cards=[];renderCards();showRuntimeError(e?.message||String(e));
    }
  }

  const coreRunCardSearch=runCardSearch;
  runCardSearch=async function(){
    if(activeCatalog==='en'){globalThis.KBSCatalogCards=[];return coreRunCardSearch.apply(this,arguments)}
    return runPocketSearch();
  };

  const coreRenderSetFilter=renderSetFilter;
  renderSetFilter=function(){
    if(activeCatalog==='en')return coreRenderSetFilter.apply(this,arguments);
    if(pocketCards.length)return renderPocketSetFilter(pocketCards);
  };

  const coreBuildMasterLibrary=buildMasterLibrary;
  buildMasterLibrary=async function(){
    const results=await Promise.allSettled([
      coreBuildMasterLibrary(),
      buildPocket().catch(e=>{showRuntimeError(e?.message||String(e));throw e})
    ]);
    await loadCache().catch(()=>{});
    await updateLibrarySetupButton().catch(()=>{});
    return results;
  };

  const coreUpdateButton=updateLibrarySetupButton;
  updateLibrarySetupButton=async function(){
    await coreUpdateButton.apply(this,arguments);
    const p=await pocketReady().catch(()=>({ready:false,count:0}));
    const label=document.querySelector('#libraryBuildLabel'),hint=document.querySelector('#libraryBuildHint');
    const enReady=masterCards.length>5000;
    if(label)label.textContent=enReady&&p.ready?'Both Libraries Ready':'Build Both Card Libraries';
    if(hint)hint.textContent=`English ${masterCards.length.toLocaleString()} · Pocket ${p.count.toLocaleString()}`;
  };

  async function switchCatalog(next){
    activeCatalog=['en','pocket'].includes(next)?next:'en';
    localStorage.setItem(CATALOG_KEY,activeCatalog);
    const selector=document.querySelector('#catalogFilter');
    if(selector&&selector.value!==activeCatalog)selector.value=activeCatalog;
    document.querySelector('#setFilter').value='';
    document.querySelector('#artistFilter').value='';
    if(activeCatalog==='en'){
      globalThis.KBSCatalogCards=[];
      coreRenderSetFilter();loadArtists();await search();return;
    }
    const rows=await ensurePocket();
    globalThis.KBSCatalogCards=rows;
    renderPocketSetFilter(rows);renderPocketArtists();await search();
  }

  const selector=document.querySelector('#catalogFilter');
  if(selector){
    selector.value=activeCatalog;
    selector.addEventListener('change',e=>switchCatalog(e.target.value).catch(err=>showRuntimeError(err?.message||String(err))));
  }

  openDb().then(loadCache).then(async()=>{
    await updateLibrarySetupButton().catch(()=>{});
    if(activeCatalog==='pocket')await switchCatalog('pocket');
  }).catch(e=>console.error('Pocket library cache load failed',e));

  return{get activeCatalog(){return activeCatalog},getCards:()=>globalThis.KBSCatalogCards||[],switchCatalog,buildPocket};
})();
