/* Kasey's Binder Studio v2.9.5 — unified Pokémon + Pocket + Union Arena library */
const KBSCatalogLab=(()=>{
  const DB_NAME='kaseyPocketCardCatalogV1';
  const DB_VERSION=1;
  const POCKET_SERIES='https://api.tcgdex.net/v2/en/series/tcgp';
  const SET_BASE='https://api.tcgdex.net/v2/en/sets/';

  let db=null,pocketCards=[],buildPromise=null,pocketState={ready:false,count:0,error:''};
  globalThis.KBSCatalogCards=[];

  const style=document.createElement('style');
  style.textContent='.pocket-source-badge,.union-source-badge{display:inline-flex;align-items:center;width:max-content;margin-top:4px;padding:2px 6px;border:1px solid currentColor;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.05em;opacity:.9}.card-item.is-pocket-card .item-copy strong,.card-item.is-union-card .item-copy strong{display:block}.multi-tcg-filterbar{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;grid-column:1/-1}.multi-tcg-filterbar label{min-width:0}.multi-tcg-filterbar select{width:100%;min-width:0}@media(max-width:760px){.multi-tcg-filterbar{grid-template-columns:repeat(2,minmax(0,1fr))}.multi-tcg-filterbar label:first-child{grid-column:1/-1}}';
  document.head.appendChild(style);

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
      id:`pocket:${c.id}`,primaryId:c.id,tcgdexId:c.id,sourceKey:`pocket:${c.id}`,language:'en',game:'pokemon-pocket',gameLabel:'Pokémon TCG Pocket',catalog:'pocket',catalogLabel:'TCG Pocket',source:'tcgdex-pocket',
      name:c.name||'Unknown card',originalName:c.name||'',localId:String(c.localId??''),setId:`pocket:${rawSet}`,rawSetId:`pocket:${rawSet}`,setName:`TCG Pocket · ${displaySet}`,series:'Pokémon TCG Pocket',releaseDate:detail?.releaseDate||'',
      illustrator:c.illustrator||'',artist:c.illustrator||'',rarity:c.rarity||'',supertype:c.category||c.type||'',subtypes:[],pokedexNumbers:[],imageHigh:imgs[0]||'',imageLow:imgs[1]||imgs[0]||'',imageFallbacks:imgs,imageSource:'TCGdex Pocket',kind:'card'
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
      const workers=Array.from({length:Math.min(3,sets.length)},async()=>{
        while(next<sets.length){
          const i=next++;
          try{chunks[i]=await fetchPocketSet(sets[i]);}
          catch(e){failed++;chunks[i]=[];console.warn('Pocket set skipped',sets[i]?.id,e?.message||e);}
          done++;
          setMasterStatus(`Adding TCG Pocket… ${done}/${sets.length} sets`,`${pokemonCards().length.toLocaleString()} Pokémon cards cached`);
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

  function pokemonCards(){return masterCards.filter(c=>c?.game==='pokemon'||c?.catalog==='english')}
  function nonPocketCards(){return masterCards.filter(c=>c?.catalog!=='pocket'&&c?.game!=='pokemon-pocket'&&c?.source!=='tcgdex-pocket')}
  function unionCards(){return masterCards.filter(c=>c?.game==='union-arena'||c?.catalog==='union-arena')}

  function rebuildUnifiedFilters(){
    const sets=new Map();
    for(const c of masterCards)if(c?.setId&&!sets.has(c.setId))sets.set(c.setId,c.setName||c.setId);
    masterSetOptions=[...sets].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
    renderSetFilter();
    loadArtists();
    globalThis.KBSMultiTCGFilters?.refresh?.();
  }

  function mergePocketIntoMaster(){
    const primary=nonPocketCards();
    masterCards=[...primary,...pocketCards];
    masterCardIndex=new Map(masterCards.map((c,i)=>[c.id,i]));
    globalThis.KBSCatalogCards=masterCards;
    masterReady=masterCards.length>0;
    rebuildUnifiedFilters();
    computeMasterHealth();
  }

  function decorateUnifiedCards(){
    document.querySelectorAll('#cards .card-item').forEach(el=>{
      const c=cards.find(x=>x.id===el.dataset.id)||masterCards.find(x=>x.id===el.dataset.id);
      if(!c)return;
      const copy=el.querySelector('.item-copy');
      if(c.catalog==='pocket'||c.game==='pokemon-pocket'){
        el.classList.add('is-pocket-card');
        if(copy&&!copy.querySelector('.pocket-source-badge')){const badge=document.createElement('span');badge.className='pocket-source-badge';badge.textContent='TCG Pocket';copy.appendChild(badge);}
      }
      if(c.catalog==='union-arena'||c.game==='union-arena'){
        el.classList.add('is-union-card');
        if(copy&&!copy.querySelector('.union-source-badge')){const badge=document.createElement('span');badge.className='union-source-badge';badge.textContent=`Union Arena${c.series?` · ${c.series}`:''}`;copy.appendChild(badge);}
      }
    });
  }

  const priorRenderCards=renderCards;
  renderCards=function(){const r=priorRenderCards.apply(this,arguments);queueMicrotask(decorateUnifiedCards);return r;};
  const priorRenderStable=renderAllCardsStable;
  renderAllCardsStable=function(){const r=priorRenderStable.apply(this,arguments);queueMicrotask(decorateUnifiedCards);return r;};

  function syncSetSymbol(){
    const id=document.querySelector('#setFilter')?.value||'';
    if(!id.startsWith('pocket:')&&!id.startsWith('union-arena:'))return;
    const frame=document.querySelector('#setSymbolFrame'),img=document.querySelector('#setSymbolPreview');
    if(frame)frame.hidden=true;if(img)img.removeAttribute('src');
  }
  document.querySelector('#setFilter')?.addEventListener('change',()=>queueMicrotask(syncSetSymbol));

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

  const coreRunCardSearch=runCardSearch;
  runCardSearch=async function(){
    const name=document.querySelector('#subject')?.value.trim()||'';
    const setId=document.querySelector('#setFilter')?.value||'';
    const artist=document.querySelector('#artistFilter')?.value||'';
    const hasFullEnglish=pokemonCards().length>5000;

    if(hasFullEnglish || setId.startsWith('pocket:') || setId.startsWith('union-arena:')){
      cards=localMasterMatches().slice(0,MASTER_PAGE_SIZE).map(c=>({...c}));
      renderCards();
      const h=document.querySelector('#masterLibraryHealth');
      if(h)h.textContent=`${masterCards.length.toLocaleString()} unified cards · ${cards.length.toLocaleString()} shown`;
      return;
    }

    await coreRunCardSearch.apply(this,arguments);
    if(pocketCards.length&&(name.length>=2||setId||artist)){
      const pocketMatches=localMasterMatches().filter(c=>c.catalog==='pocket');
      cards=mergeUniqueRows(cards,pocketMatches).slice(0,MASTER_PAGE_SIZE);
      renderCards();
    }
  };

  const coreBuildMasterLibrary=buildMasterLibrary;
  buildMasterLibrary=async function(){
    await coreBuildMasterLibrary();
    try{await buildPocket();}
    catch(e){pocketState={ready:false,count:pocketCards.length,error:e?.message||String(e)};console.warn('Pocket catalog build deferred:',pocketState.error);}
    if(pocketCards.length)mergePocketIntoMaster();
    await updateLibrarySetupButton().catch(()=>{});
  };

  const coreUpdateButton=updateLibrarySetupButton;
  updateLibrarySetupButton=async function(){
    await coreUpdateButton.apply(this,arguments);
    const label=document.querySelector('#libraryBuildLabel'),hint=document.querySelector('#libraryBuildHint');
    const pokemonCount=pokemonCards().length,unionCount=unionCards().length,total=masterCards.length;
    const pokemonReady=pokemonCount>5000,unionReady=unionCount>6000;
    if(label)label.textContent=pokemonReady&&pocketState.ready&&unionReady?'Multi-TCG Library Ready':'Build Card Library';
    if(hint){
      if(pokemonReady&&pocketState.ready&&unionReady)hint.textContent=`${total.toLocaleString()} cards · Pokémon + Pocket + Union Arena`;
      else if(pokemonReady&&pocketState.error)hint.textContent=`Pokémon ready · Union Arena ${unionCount.toLocaleString()} · Pocket retry available`;
      else hint.textContent=`Pokémon ${pokemonCount.toLocaleString()} · Pocket ${pocketCards.length.toLocaleString()} · Union Arena ${unionCount.toLocaleString()}`;
    }
  };

  globalThis.KBSIsPocketSet=id=>String(id||'').startsWith('pocket:');
  globalThis.KBSIsUnionArenaSet=id=>String(id||'').startsWith('union-arena:');
  openDb().then(loadCache).then(()=>updateLibrarySetupButton().catch(()=>{})).catch(e=>console.warn('Pocket cache unavailable',e));
  return{getCards:()=>masterCards,buildPocket,get pocketState(){return {...pocketState}}};
})();

/* Multi-TCG controls are intentionally layered on top of the proven local search. */
(function(){
  const state={game:'all',series:'',color:'',rarity:'',type:''};
  let controls=null;
  const norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function cardGame(c){if(c?.game)return c.game;if(c?.catalog==='pocket')return'pokemon-pocket';if(c?.catalog==='union-arena')return'union-arena';return'pokemon';}
  function selectedRows(){const rows=Array.isArray(masterCards)?masterCards:[];return state.game==='all'?rows:rows.filter(c=>cardGame(c)===state.game);}
  function values(rows,key){return [...new Set(rows.map(c=>String(c?.[key]??'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));}
  function optionize(select,items,label,current){if(!select)return;select.innerHTML='';select.add(new Option(label,''));items.forEach(x=>select.add(new Option(x,x)));if(items.includes(current))select.value=current;else{select.value='';}}
  function matches(c){
    if(state.game!=='all'&&cardGame(c)!==state.game)return false;
    if(state.series&&String(c.series||'')!==state.series)return false;
    if(state.color&&String(c.color||c.activationEnergy||'')!==state.color)return false;
    if(state.rarity&&String(c.rarity||'')!==state.rarity)return false;
    if(state.type&&String(c.cardType||c.supertype||'')!==state.type)return false;
    return true;
  }
  function refresh(){
    if(!controls)return;
    const rows=selectedRows();
    optionize(controls.series,values(rows,'series'),'All series',state.series);state.series=controls.series.value;
    optionize(controls.color,[...new Set(rows.map(c=>String(c.color||c.activationEnergy||'').trim()).filter(Boolean))].sort(),'All colors',state.color);state.color=controls.color.value;
    optionize(controls.rarity,values(rows,'rarity'),'All rarities',state.rarity);state.rarity=controls.rarity.value;
    optionize(controls.type,[...new Set(rows.map(c=>String(c.cardType||c.supertype||'').trim()).filter(Boolean))].sort(),'All card types',state.type);state.type=controls.type.value;
  }
  function rerun(){refresh();Promise.resolve(runCardSearch()).catch(e=>console.warn('Multi-TCG filter search failed',e));}
  function install(){
    const filters=document.querySelector('.variant-filters');if(!filters||document.querySelector('#tcgGameFilter'))return;
    const bar=document.createElement('div');bar.className='multi-tcg-filterbar';
    bar.innerHTML='<label><span>Game</span><select id="tcgGameFilter"><option value="all">All cards</option><option value="pokemon">Pokémon TCG</option><option value="pokemon-pocket">Pokémon Pocket</option><option value="union-arena">Union Arena</option></select></label><label><span>Series</span><select id="tcgSeriesFilter"><option value="">All series</option></select></label><label><span>Color</span><select id="tcgColorFilter"><option value="">All colors</option></select></label><label><span>Rarity</span><select id="tcgRarityFilter"><option value="">All rarities</option></select></label><label><span>Card type</span><select id="tcgTypeFilter"><option value="">All card types</option></select></label>';
    filters.prepend(bar);
    controls={game:bar.querySelector('#tcgGameFilter'),series:bar.querySelector('#tcgSeriesFilter'),color:bar.querySelector('#tcgColorFilter'),rarity:bar.querySelector('#tcgRarityFilter'),type:bar.querySelector('#tcgTypeFilter')};
    controls.game.addEventListener('change',()=>{state.game=controls.game.value;state.series=state.color=state.rarity=state.type='';rerun();});
    for(const [key,el] of [['series',controls.series],['color',controls.color],['rarity',controls.rarity],['type',controls.type]])el.addEventListener('change',()=>{state[key]=el.value;rerun();});
    const subject=document.querySelector('#subject');if(subject){subject.placeholder='Try Pikachu, Lillie, Ichigo, Gojo…';const span=subject.closest('label')?.querySelector(':scope > span');if(span)span.textContent='Card or character';}
    const empty=document.querySelector('#cards .empty');if(empty)empty.textContent='Search Pokémon, Trainers, Union Arena characters, card numbers, sets, or series.';
    refresh();
  }
  if(typeof localMasterMatches==='function'){
    const prior=localMasterMatches;
    localMasterMatches=function(){return prior.apply(this,arguments).filter(matches);};
  }
  globalThis.KBSMultiTCGFilters={refresh,get state(){return {...state}}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
