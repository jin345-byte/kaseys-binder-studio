
const SIZES=[['1x1','1 slot · 7 × 9.5cm'],['2x1','2 horizontal · 14 × 9.5cm'],['1x2','2 vertical · 7 × 19cm'],['3x1','3 horizontal · 21 × 9.5cm'],['2x2','4 slots · 14 × 19cm'],['3x3','9 slots · 21 × 28.5cm']];
const defaults={subject:'',layout:'3x3',theme:'jolteon',binderColor:'#111827',pageColor:'#080b12',sleeveColor:'#334155',pockets:Array(12).fill(null),artworks:[]};
let state=load(),cards=[],selected=null,drag=null;
const MASTER_DB_NAME='kaseyMasterCardIndex',MASTER_DB_VERSION=6,MASTER_PAGE_SIZE=150;
let masterDb=null,masterCards=[],masterCardIndex=new Map(),masterReady=false,masterSyncing=false,masterSetOptions=[];
let masterHealth={total:0,withImages:0,missingImages:0,sets:0,lastUpdated:0};
let activeSearchController=null;

/* Binder Library state initialized before app startup. */
const BINDER_DB_NAME='michiBinderLibrary';
const BINDER_DB_VERSION=1;
const ACTIVE_BINDER_KEY='michiActiveBinderId';
const ACTIVE_PAGE_KEY='michiActivePageId';
let binderDb=null,binderLayerReady=false,binderWriteTimer=null,binderLoading=false;
let activeBinderId=localStorage.getItem(ACTIVE_BINDER_KEY)||'';
let activePageId=localStorage.getItem(ACTIVE_PAGE_KEY)||'';
let viewerPages=[],viewerIndex=0;


const isMobile=()=>window.matchMedia('(max-width:768px)').matches;
function setMobileView(view){if(!isMobile()){document.body.classList.remove('mobile-view-library','mobile-view-canvas');return}document.body.classList.toggle('mobile-view-library',view==='library');document.body.classList.toggle('mobile-view-canvas',view==='canvas');document.querySelector('#tabLibrary')?.classList.toggle('active',view==='library');document.querySelector('#tabCanvas')?.classList.toggle('active',view==='canvas');requestAnimationFrame(()=>window.scrollTo({top:Math.max(0,document.querySelector('#mobileTabs')?.offsetTop-6||0),behavior:'smooth'}))}

function load(){try{const x=JSON.parse(localStorage.getItem('michiStandaloneState')||'{}');return {...defaults,...x,pockets:Array.from({length:12},(_,i)=>x.pockets?.[i]||null),artworks:Array.isArray(x.artworks)?x.artworks:[]}}catch{return structuredClone(defaults)}}

const THEMES=new Set(['jolteon']);
function applyTheme(theme,{persist=true}={}){
  const next='jolteon';
  state.theme=next;
  document.body.classList.remove('theme-switching');
  void document.body.offsetWidth;
  document.body.dataset.theme=next;
  document.body.classList.add('theme-switching');
  clearTimeout(applyTheme._timer);
  applyTheme._timer=setTimeout(()=>document.body.classList.remove('theme-switching'),520);
  const colors={jolteon:'#111820'};
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',colors.jolteon);
  if(persist)save();
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(m){const t=document.querySelector('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2400)}

function pokemonSpeciesSlug(raw){
  let n=String(raw||'').trim().toLowerCase();
  n=n.replace(/\s+(ex|gx|vmax|vstar|v-union|v|break|lv\.?\s*x|star|δ)$/i,'').trim();
  const aliases={
    "mr. mime":"mr-mime","mime jr.":"mime-jr","farfetch'd":"farfetchd","sirfetch'd":"sirfetchd",
    "nidoran♀":"nidoran-f","nidoran♂":"nidoran-m","flabébé":"flabebe","type: null":"type-null",
    "ho-oh":"ho-oh","porygon-z":"porygon-z","jangmo-o":"jangmo-o","hakamo-o":"hakamo-o","kommo-o":"kommo-o",
    "tapu koko":"tapu-koko","tapu lele":"tapu-lele","tapu bulu":"tapu-bulu","tapu fini":"tapu-fini",
    "great tusk":"great-tusk","scream tail":"scream-tail","brute bonnet":"brute-bonnet","flutter mane":"flutter-mane",
    "slither wing":"slither-wing","sandy shocks":"sandy-shocks","iron treads":"iron-treads","iron bundle":"iron-bundle",
    "iron hands":"iron-hands","iron jugulis":"iron-jugulis","iron moth":"iron-moth","iron thorns":"iron-thorns",
    "roaring moon":"roaring-moon","iron valiant":"iron-valiant","walking wake":"walking-wake","iron leaves":"iron-leaves",
    "gouging fire":"gouging-fire","raging bolt":"raging-bolt","iron boulder":"iron-boulder","iron crown":"iron-crown"
  };
  if(aliases[n]) return aliases[n];
  return n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.'’]/g,'').replace(/[^a-z0-9♀♂]+/g,'-').replace(/^-+|-+$/g,'');
}
function currentPokemonName(){
  const q=document.querySelector('#subject')?.value.trim();
  return q||selected?.name||'';
}

async function openPokemonArtwork(){
  const raw=currentPokemonName();
  if(!raw){window.open('https://www.artofpkm.com/pokemon','_blank','noopener');return}
  const slug=pokemonSpeciesSlug(raw);
  const btn=document.querySelector('#artPokemonLink');
  const old=btn?.textContent;
  if(btn){btn.disabled=true;btn.textContent='Finding artwork…'}
  try{
    const r=await fetch('https://pokeapi.co/api/v2/pokemon-species/'+encodeURIComponent(slug),{headers:{Accept:'application/json'}});
    if(!r.ok) throw new Error('species not found');
    const data=await r.json();
    const id=Number(data.id);
    if(!Number.isFinite(id)||id<1) throw new Error('bad species id');
    window.open(`https://www.artofpkm.com/pokemon/${id}/artwork`,'_blank','noopener');
  }catch(e){
    window.open('https://www.artofpkm.com/pokemon','_blank','noopener');
    toast(`Could not match “${raw}” automatically. Opened All Pokémon instead.`)
  }finally{
    if(btn){btn.disabled=false;btn.textContent=old||'Open Pokémon artwork ↗'}
  }
}




function dims(){return state.layout==='2x2'?{columns:2,rows:2}:state.layout==='4x3'?{columns:4,rows:3}:{columns:3,rows:3}}
function count(){const d=dims();return d.columns*d.rows}
function span(item){if(!item||item.kind!=='art')return{columns:1,rows:1};const [columns,rows]=String(item.size||'1x1').split('x').map(Number);return{columns:columns||1,rows:rows||1}}
function placementMap(){const {columns,rows}=dims(),occupied=new Map();state.pockets.slice(0,count()).forEach((item,index)=>{if(!item||occupied.has(index))return;const s=span(item),c=index%columns,r=Math.floor(index/columns);if(c+s.columns>columns||r+s.rows>rows)return;for(let y=0;y<s.rows;y++)for(let x=0;x<s.columns;x++)occupied.set(index+y*columns+x,index)});return occupied}
function sizeOptions(sel='1x1'){return SIZES.map(([v,l])=>`<option value="${v}" ${v===sel?'selected':''}>${l}</option>`).join('')}
document.querySelector('#newArtSize').innerHTML=sizeOptions();
function imgUrls(card){const base=String(card.image||'').replace(/\/(high|low)\.webp$/i,'');return{high:base?base+'/high.webp':'',low:base?base+'/low.webp':''}}


function masterOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(MASTER_DB_NAME,MASTER_DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      let s;
      if(!db.objectStoreNames.contains('cards'))s=db.createObjectStore('cards',{keyPath:'id'});
      else s=req.transaction.objectStore('cards');
      if(s.indexNames.contains('sourceKey')){try{const idx=s.index('sourceKey');if(idx.unique)s.deleteIndex('sourceKey')}catch(e){console.warn('sourceKey index reset failed',e)}}
      const ensure=(name,key,options={unique:false})=>{
        try{if(!s.indexNames.contains(name))s.createIndex(name,key,options)}
        catch(e){console.warn('Index migration skipped:',name,e)}
      };
      ensure('nameLower','nameLower');
      ensure('setId','setId');
      ensure('illustratorLower','illustratorLower');
      ensure('language','language');
      ensure('sourceKey','sourceKey'); // deliberately non-unique for legacy safety
      ensure('namePrefix','namePrefix');
      ensure('pokedexKey','pokedexKey');
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
    };
    req.onblocked=()=>reject(new Error('Master Library database upgrade is blocked. Close other open copies of the extension and reload.'));
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Could not open Master Library database.'));
  });
}
function masterStore(name,mode='readonly'){return masterDb.transaction(name,mode).objectStore(name)}
function masterGetAll(name){return new Promise((res,rej)=>{const r=masterStore(name).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
function masterPut(name,value){return new Promise((res,rej)=>{const r=masterStore(name,'readwrite').put(value);r.onsuccess=()=>res(value);r.onerror=()=>rej(r.error)})}
function setMasterStatus(title,meta=''){const a=document.querySelector('#masterLibraryStatus');if(a)a.textContent=title}

function computeMasterHealth(){
  const sets=new Set();
  let withImages=0;
  for(const c of masterCards){
    if(c?.setId)sets.add(c.setId);
    if(c?.imageHigh||c?.imageLow)withImages++;
  }
  masterHealth={
    total:masterCards.length,
    withImages,
    missingImages:Math.max(0,masterCards.length-withImages),
    sets:sets.size,
    lastUpdated:Date.now()
  };
  const h=document.querySelector('#masterLibraryHealth');
  if(h)h.textContent=`${masterHealth.total.toLocaleString()} cards · ${masterHealth.sets} sets · ${masterHealth.missingImages.toLocaleString()} missing images`;
}
async function upsertMasterRows(rows,{refreshHealth=false}={}){
  if(!masterDb||!rows?.length)return;
  const tx=masterDb.transaction('cards','readwrite'),store=tx.objectStore('cards');
  for(const raw of rows){
    const row=withSearchKeys(raw);
    store.put(row);
    const idx=masterCardIndex.get(row.id);
    if(Number.isInteger(idx))masterCards[idx]=row;
    else{
      masterCardIndex.set(row.id,masterCards.length);
      masterCards.push(row);
    }
  }
  await new Promise((res,rej)=>{
    tx.oncomplete=res;
    tx.onerror=()=>rej(tx.error);
    tx.onabort=()=>rej(tx.error);
  });
  masterReady=masterCards.length>0;
  if(refreshHealth)computeMasterHealth();
}
async function loadMasterFromDb(){
  if(!masterDb)masterDb=await masterOpen();
  const loaded=await masterGetAll('cards');
  masterCards=loaded.map(c=>{
    try{return withSearchKeys(c)}
    catch{return {...c,nameLower:String(c?.name||'').toLowerCase(),illustratorLower:String(c?.illustrator||'').toLowerCase(),namePrefix:String(c?.name||'').toLowerCase().slice(0,3)}}
  });
  masterCardIndex=new Map(masterCards.map((c,i)=>[c.id,i]));
  masterReady=masterCards.length>0;
  const sets=new Map();
  for(const c of masterCards)if(c?.setId&&!sets.has(c.setId))sets.set(c.setId,c.setName||c.setId);
  masterSetOptions=[...sets].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name));
  renderSetFilter();
  loadArtists();
  computeMasterHealth();
  if(masterReady)setMasterStatus(`Pokémon TCG Master Library · ${masterCards.length.toLocaleString()} cards`,'Local-first search is ready. The raw GitHub catalog is primary; live API lookup is fallback only.');
  else setMasterStatus('Pokémon TCG Master Library · empty','Searches will populate the local cache automatically, or use Build local catalog from GitHub.');
}
function renderSetFilter(){
  const s=document.querySelector('#setFilter');if(!s)return;
  const cur=s.value;
  s.innerHTML='<option value="">All sets</option>'+masterSetOptions.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  if([...s.options].some(o=>o.value===cur))s.value=cur;
}
function normText(v=''){
  return String(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function withSearchKeys(row){
  const nameLower=normText(row.name);
  const pokedexNumbers=Array.isArray(row.pokedexNumbers)?row.pokedexNumbers.filter(Number.isFinite):[];
  return {
    ...row,
    nameLower,
    illustratorLower:normText(row.illustrator||row.artist||''),
    namePrefix:nameLower.slice(0,3),
    pokedexNumbers,
    pokedexKey:pokedexNumbers.join(','),
    searchBlob:`${nameLower} ${normText(row.illustrator||row.artist||'')} ${normText(row.setName||'')} ${normText(row.localId||'')} ${pokedexNumbers.join(' ')}`.trim()
  };
}

const RAW_DATA_BASE='https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';
async function fetchRawJson(url,{signal=null,retries=4,baseDelay=600}={}){
  let lastError=null;
  for(let attempt=0;attempt<=retries;attempt++){
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    try{
      const r=await fetch(url,{headers:{Accept:'application/json'},signal,cache:'no-cache'});
      if(r.ok)return r.json();
      lastError=new Error(`GitHub data HTTP ${r.status}`);
      if((r.status===429||r.status>=500)&&attempt<retries){
        await sleepMs(Math.min(baseDelay*Math.pow(2,attempt),6000));
        continue;
      }
      throw lastError;
    }catch(e){
      if(e?.name==='AbortError')throw e;
      lastError=e;
      if(attempt>=retries)break;
      await sleepMs(Math.min(baseDelay*Math.pow(2,attempt),6000));
    }
  }
  throw lastError||new Error('Could not download raw catalog data');
}
function rawSetCardToRow(c,setMeta={}){
  return withSearchKeys({
    id:`ptcg:${c.id}`,
    primaryId:c.id,
    tcgdexId:'',
    sourceKey:`ptcg:${c.id}`,
    language:'en',
    source:'pokemon-tcg-raw-github',
    name:c.name||'Unknown card',
    localId:c.number||'',
    setId:setMeta.id||c.set?.id||'',
    rawSetId:setMeta.id||c.set?.id||'',
    setName:setMeta.name||c.set?.name||setMeta.id||'',
    series:setMeta.series||c.set?.series||'',
    releaseDate:setMeta.releaseDate||c.set?.releaseDate||'',
    illustrator:c.artist||'',
    artist:c.artist||'',
    rarity:c.rarity||'',
    supertype:c.supertype||'',
    subtypes:Array.isArray(c.subtypes)?c.subtypes:[],
    pokedexNumbers:Array.isArray(c.nationalPokedexNumbers)?c.nationalPokedexNumbers:[],
    imageHigh:c.images?.large||c.images?.small||'',
    imageLow:c.images?.small||c.images?.large||'',
    kind:'card'
  });
}
function ptcgToRow(c){
  return withSearchKeys({
    id:`ptcg:${c.id}`,
    primaryId:c.id,
    tcgdexId:'',
    sourceKey:`ptcg:${c.id}`,
    language:'en',
    source:'pokemon-tcg-api',
    name:c.name||'Unknown card',
    localId:c.number||'',
    setId:c.set?.id||'',
    rawSetId:c.set?.id||'',
    setName:c.set?.name||c.set?.id||'',
    series:c.set?.series||'',
    releaseDate:c.set?.releaseDate||'',
    illustrator:c.artist||'',
    artist:c.artist||'',
    rarity:c.rarity||'',
    supertype:c.supertype||'',
    subtypes:Array.isArray(c.subtypes)?c.subtypes:[],
    pokedexNumbers:Array.isArray(c.nationalPokedexNumbers)?c.nationalPokedexNumbers:[],
    imageHigh:c.images?.large||c.images?.small||'',
    imageLow:c.images?.small||c.images?.large||'',
    kind:'card'
  });
}

function sleepMs(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function fetchJsonWithRetry(url,{signal=null,retries=4,baseDelay=700}={}){
  let lastError=null;
  for(let attempt=0;attempt<=retries;attempt++){
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    try{
      const r=await fetch(url,{headers:{Accept:'application/json'},signal});
      if(r.ok)return r.json();

      if(r.status===429||r.status>=500){
        const retryAfter=Number(r.headers.get('retry-after'));
        const wait=Number.isFinite(retryAfter)&&retryAfter>0
          ? retryAfter*1000
          : baseDelay*Math.pow(2,attempt);
        lastError=new Error(`HTTP ${r.status}`);
        if(attempt<retries){await sleepMs(Math.min(wait,8000));continue}
      }
      throw new Error(`HTTP ${r.status}`);
    }catch(e){
      if(e?.name==='AbortError')throw e;
      lastError=e;
      if(attempt>=retries)break;
      await sleepMs(Math.min(baseDelay*Math.pow(2,attempt),8000));
    }
  }
  throw lastError||new Error('Network request failed');
}
async function fetchPokemonTcgPage(page,{q='',signal=null,pageSize=250}={}){
  const u=new URL('https://api.pokemontcg.io/v2/cards');
  if(q)u.searchParams.set('q',q);
  u.searchParams.set('page',String(page));
  u.searchParams.set('pageSize',String(Math.min(250,pageSize)));
  u.searchParams.set('orderBy','name,set.releaseDate,number');
  const payload=await fetchJsonWithRetry(u.toString(),{signal,retries:4,baseDelay:750});
  return {
    rows:(Array.isArray(payload?.data)?payload.data:[]).map(ptcgToRow),
    totalCount:Number(payload?.totalCount||0),
    page:Number(payload?.page||page),
    pageSize:Number(payload?.pageSize||pageSize)
  };
}


function updateLibraryProgressUI({current=0,total=0,label='',active=false,ready=false}={}){
  const wrap=document.querySelector('#librarySetupProgress');
  const fill=document.querySelector('#libraryProgressFill');
  const pctEl=document.querySelector('#libraryProgressPercent');
  const txt=document.querySelector('#libraryProgressText');
  const safeTotal=Math.max(0,Number(total)||0);
  const safeCurrent=Math.max(0,Number(current)||0);
  const pct=safeTotal>0?Math.max(0,Math.min(100,Math.round((safeCurrent/safeTotal)*100))):(ready?100:0);

  if(fill)fill.style.width=`${pct}%`;
  if(pctEl)pctEl.textContent=`${pct}%`;
  if(txt)txt.textContent=label || (ready ? 'Library build complete.' : active ? 'Building local catalog…' : 'Build the library to unlock the full card catalog.');
  wrap?.classList.toggle('is-building',!!active);
  wrap?.classList.toggle('is-ready',!!ready);
}
async function updateLibrarySetupButton(){
  const btn=document.querySelector('#syncMasterLibrary');
  const card=document.querySelector('#librarySetupCard');
  const label=document.querySelector('#libraryBuildLabel');
  const hint=document.querySelector('#libraryBuildHint');
  if(!btn)return;

  let count=masterCards.length,ready=false,progressMeta=null,syncMeta=null;
  try{
    if(!masterDb)masterDb=await masterOpen();
    const meta=await masterGetAll('meta').catch(()=>[]);
    syncMeta=meta.find(x=>x?.key==='sync')||null;
    progressMeta=meta.find(x=>x?.key==='raw-sync-progress')||null;
    ready=Boolean((progressMeta?.completed||syncMeta?.source==='pokemon-tcg-raw-github')&&count>5000);
  }catch{}

  btn.classList.toggle('needs-build',!ready);
  btn.classList.toggle('library-ready',ready);
  card?.classList.toggle('library-ready',ready);

  if(ready){
    if(label)label.textContent='Library Ready';
    if(hint)hint.textContent=`${count.toLocaleString()} cards cached`;
    updateLibraryProgressUI({
      current:progressMeta?.totalSets||syncMeta?.totalSets||1,
      total:progressMeta?.totalSets||syncMeta?.totalSets||1,
      label:`Catalog ready · ${count.toLocaleString()} cards cached`,
      active:false,
      ready:true
    });
  }else{
    if(label)label.textContent='Build Card Library';
    if(hint)hint.textContent=count>0?`Resume setup · ${count.toLocaleString()} cached`:'Press this first';
    const current=Number(progressMeta?.nextIndex||0);
    const total=Number(progressMeta?.totalSets||0);
    updateLibraryProgressUI({
      current,
      total,
      label:current>0&&total>0?`Resume from set ${Math.min(current+1,total)} of ${total}`:'Build the library to unlock the full card catalog.',
      active:false,
      ready:false
    });
  }
}
async function buildMasterLibrary(){
  if(masterSyncing)return;
  masterSyncing=true;
  const btn=document.querySelector('#syncMasterLibrary');
  if(btn){
      btn.disabled=true;
      btn.classList.remove('needs-build');
      const label=document.querySelector('#libraryBuildLabel');
      const hint=document.querySelector('#libraryBuildHint');
      if(label)label.textContent='Building Library…';
      if(hint)hint.textContent='Please keep this window open';
    }
  try{
    if(!masterDb)masterDb=await masterOpen();

    setMasterStatus('Reading raw PokémonTCG set catalog…','No Pokémon TCG API bulk requests are used.');
    updateLibraryProgressUI({current:0,total:0,label:'Loading set list…',active:true,ready:false});
    const sets=await fetchRawJson(`${RAW_DATA_BASE}/sets/en.json`);
    if(!Array.isArray(sets)||!sets.length)throw new Error('Raw set catalog was empty');

    const metaRows=await masterGetAll('meta').catch(()=>[]);
    const progress=metaRows.find(x=>x?.key==='raw-sync-progress');
    let startIndex=Math.max(0,Number(progress?.nextIndex||0));
    if(startIndex>=sets.length)startIndex=0;

    if(startIndex>0){
      setMasterStatus('Resuming raw GitHub catalog build…',`Continuing at set ${startIndex+1} of ${sets.length}.`);
      updateLibraryProgressUI({current:startIndex,total:sets.length,label:`Continuing at set ${startIndex+1} of ${sets.length}`,active:true,ready:false});
    } else {
      updateLibraryProgressUI({current:0,total:sets.length,label:`Starting 0 of ${sets.length} sets`,active:true,ready:false});
    }

    let cachedThisRun=0;
    for(let i=startIndex;i<sets.length;i++){
      const set=sets[i];
      if(!set?.id)continue;

      setMasterStatus(
        `Building local catalog… ${i+1}/${sets.length} sets`,
        `${set.name||set.id} · ${masterCards.length.toLocaleString()} cards cached`
      );
      updateLibraryProgressUI({
        current:i,
        total:sets.length,
        label:`${set.name||set.id} · ${i+1} of ${sets.length} sets`,
        active:true,
        ready:false
      });

      const url=`${RAW_DATA_BASE}/cards/en/${encodeURIComponent(set.id)}.json`;
      try{
        const rawCards=await fetchRawJson(url,{retries:4,baseDelay:650});
        const rows=(Array.isArray(rawCards)?rawCards:[]).filter(c=>c?.id).map(c=>rawSetCardToRow(c,set));
        await upsertMasterRows(rows);
        cachedThisRun+=rows.length;
      }catch(e){
        console.warn('Raw set download failed',set.id,e);
        // Do not kill the entire build for a single bad/missing set file.
        await masterPut('meta',{
          key:`raw-set-error:${set.id}`,
          setId:set.id,
          name:set.name||set.id,
          error:e?.message||String(e),
          updatedAt:Date.now()
        }).catch(()=>{});
      }

      await masterPut('meta',{
        key:'raw-sync-progress',
        nextIndex:i+1,
        totalSets:sets.length,
        updatedAt:Date.now()
      });
      updateLibraryProgressUI({
        current:i+1,
        total:sets.length,
        label:`${set.name||set.id} · ${i+1} of ${sets.length} sets`,
        active:true,
        ready:false
      });

      // Gentle pacing for raw.githubusercontent.com.
      await sleepMs(90);
    }

    masterSetOptions=[...new Map(masterCards.filter(c=>c.setId).map(c=>[c.setId,c.setName||c.setId]))]
      .map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name));
    renderSetFilter();
    loadArtists();
    computeMasterHealth();

    const errors=(await masterGetAll('meta').catch(()=>[])).filter(x=>String(x?.key||'').startsWith('raw-set-error:'));
    await masterPut('meta',{
      key:'sync',
      updatedAt:Date.now(),
      count:masterCards.length,
      source:'pokemon-tcg-raw-github',
      totalSets:sets.length,
      setErrors:errors.length
    });
    await masterPut('meta',{
      key:'raw-sync-progress',
      nextIndex:0,
      totalSets:sets.length,
      completed:true,
      updatedAt:Date.now()
    });

    const errorText=errors.length?` · ${errors.length} set file${errors.length===1?'':'s'} skipped`:'';
    setMasterStatus(
      `Pokémon TCG Master Library · ${masterCards.length.toLocaleString()} cards`,
      `Raw GitHub catalog completed · ${sets.length} sets${errorText}`
    );
    updateLibraryProgressUI({
      current:sets.length,
      total:sets.length,
      label:`Catalog complete · ${masterCards.length.toLocaleString()} cards cached${errorText}`,
      active:false,
      ready:true
    });
    toast(`Local catalog ready · ${masterCards.length.toLocaleString()} cards`);await updateLibrarySetupButton();
  }catch(e){
    console.error(e);
    setMasterStatus(
      'Raw catalog build paused',
      `${e?.message||String(e)} · click Build local catalog from GitHub to resume.`
    );
    try{
      const meta=await masterGetAll('meta').catch(()=>[]);
      const progress=meta.find(x=>x?.key==='raw-sync-progress')||{};
      updateLibraryProgressUI({
        current:progress?.nextIndex||0,
        total:progress?.totalSets||0,
        label:`Paused · click Build Card Library to resume`,
        active:false,
        ready:false
      });
    }catch{}
    showRuntimeError?.(e?.message||String(e));
  }finally{
    masterSyncing=false;
    if(btn){btn.disabled=false;await updateLibrarySetupButton()}
  }
}
function localMasterMatches({pokedexNumbers=[]}={}){
  const q=normText(document.querySelector('#subject').value);
  const setId=document.querySelector('#setFilter')?.value||'';
  const artist=normText(document.querySelector('#artistFilter')?.value||'');
  const dexSet=new Set((pokedexNumbers||[]).map(Number).filter(Number.isFinite));

  let list=masterCards;
  if(setId)list=list.filter(c=>(c.setId===setId||c.rawSetId===setId));
  if(artist)list=list.filter(c=>c.illustratorLower===artist);

  if(q.length>=2||dexSet.size){
    list=list.filter(c=>{
      const nameHit=q.length>=2&&(c.nameLower||normText(c.name)).includes(q);
      const dexHit=dexSet.size&&(c.pokedexNumbers||[]).some(n=>dexSet.has(Number(n)));
      return nameHit||dexHit;
    });
  }
  return list;
}
function escapeLuceneValue(v=''){return String(v).replace(/([+\-!(){}\[\]^"~*?:\\/])/g,'\\$1')}
async function fetchPokemonNameMatches(name,{page=1,signal=null}={}){
  const clean=String(name||'').trim();
  if(!clean)return {rows:[],totalCount:0};

  const escaped=escapeLuceneValue(clean);
  let result=await fetchPokemonTcgPage(page,{q:`name:"${escaped}"`,signal,pageSize:250});

  // If exact phrase returns nothing, broaden to a normal field search.
  if(!result.rows.length){
    result=await fetchPokemonTcgPage(page,{q:`name:${escaped}`,signal,pageSize:250});
  }
  return result;
}
async function fetchPokemonDexMatches(numbers,{signal=null}={}){
  const nums=[...new Set((numbers||[]).map(Number).filter(Number.isFinite))];
  if(!nums.length)return [];
  const all=[];
  for(const n of nums.slice(0,4)){
    const q=`nationalPokedexNumbers:${n}`;
    const first=await fetchPokemonTcgPage(1,{q,signal,pageSize:250});
    all.push(...first.rows);
    if(first.totalCount>250){
      const pages=Math.ceil(first.totalCount/250);
      for(let p=2;p<=pages;p++){
        if(signal?.aborted)break;
        const part=await fetchPokemonTcgPage(p,{q,signal,pageSize:250});
        all.push(...part.rows);
      }
    }
  }
  return all;
}
function mergeUniqueRows(...groups){
  const map=new Map();
  for(const group of groups)for(const c of group||[])if(c?.id)map.set(c.id,{...(map.get(c.id)||{}),...c});
  return [...map.values()];
}

function anchoredPokedexNumbers(rows,query){
  const q=normText(query);
  if(!q)return [];
  const exactNameRows=(rows||[]).filter(c=>{
    const n=normText(c?.name||'');
    return n===q || n.startsWith(q+' ') || n.startsWith(q+'-') || n.includes(q+' & ');
  });

  // Prefer single-species cards because multi-Pokémon cards can carry several dex numbers.
  const singles=exactNameRows.filter(c=>(c.pokedexNumbers||[]).length===1);
  const source=singles.length?singles:exactNameRows;

  const counts=new Map();
  for(const c of source){
    for(const n of c.pokedexNumbers||[]){
      const num=Number(n);
      if(Number.isFinite(num))counts.set(num,(counts.get(num)||0)+1);
    }
  }
  if(!counts.size)return [];

  // Keep only the strongest anchor. This prevents Pikachu & Zekrom etc.
  // from widening a Pikachu search into the entire Zekrom catalog.
  const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
  return [ranked[0][0]];
}

function speciesScopedMatches(rows,query,anchorDex=[]){
  const q=normText(query);
  const dex=new Set((anchorDex||[]).map(Number).filter(Number.isFinite));
  return (rows||[]).filter(c=>{
    const n=normText(c?.name||'');
    const nameHit=q && n.includes(q);
    const dexHit=dex.size && (c.pokedexNumbers||[]).some(x=>dex.has(Number(x)));
    return nameHit || dexHit;
  });
}

async function runCardSearch(){
  const name=document.querySelector('#subject').value.trim();
  const illustrator=document.querySelector('#artistFilter')?.value||'';
  const setId=document.querySelector('#setFilter')?.value||'';
  state.subject=name;save();renderHeader();

  if(name.length<2&&!illustrator&&!setId){
    cards=[];
    renderCards();
    return;
  }

  activeSearchController?.abort();
  activeSearchController=new AbortController();
  const signal=activeSearchController.signal;

  // Show local matches immediately.
  cards=localMasterMatches().slice(0,MASTER_PAGE_SIZE).map(c=>({...c}));
  renderCards();

  try{
    let live=[];

    if(name.length>=2){
      const localLiteral=localMasterMatches();
      const localAnchorDex=anchoredPokedexNumbers(localLiteral,name);

      if(masterCards.length>5000&&localLiteral.length){
        // Built raw catalog: expand only from the typed Pokémon's anchor dex number.
        live=speciesScopedMatches(masterCards,name,localAnchorDex);
      }else{
        // Temporary live fallback before the full local catalog has been built.
        const nameResult=await fetchPokemonNameMatches(name,{page:1,signal});
        if(signal.aborted)return;
        live=nameResult.rows;

        const anchorDex=anchoredPokedexNumbers(live,name);
        if(anchorDex.length){
          const dexRows=await fetchPokemonDexMatches(anchorDex,{signal});
          if(signal.aborted)return;
          live=mergeUniqueRows(live,speciesScopedMatches(dexRows,name,anchorDex));
        }
      }
    }else{
      const q=[];
      if(illustrator)q.push(`artist:"${escapeLuceneValue(illustrator)}"`);
      if(setId)q.push(`set.id:${escapeLuceneValue(setId)}`);
      const result=await fetchPokemonTcgPage(1,{q:q.join(' '),signal,pageSize:250});
      live=result.rows;
    }

    if(illustrator){
      const a=normText(illustrator);
      live=live.filter(c=>normText(c.illustrator||c.artist||'')===a);
    }
    if(setId)live=live.filter(c=>c.setId===setId||c.rawSetId===setId);

    const dexNums=name.length>=2?anchoredPokedexNumbers(live,name):[];
    const local=name.length>=2
      ? speciesScopedMatches(masterCards,name,dexNums)
      : localMasterMatches({pokedexNumbers:dexNums});
    cards=mergeUniqueRows(local,live);

    await upsertMasterRows(live).catch(console.warn);
    renderCards();
    const viewport=document.querySelector('#cardsViewport');
    if(viewport){viewport.classList.remove('results-arrived');void viewport.offsetWidth;viewport.classList.add('results-arrived');setTimeout(()=>viewport.classList.remove('results-arrived'),520)}

    const h=document.querySelector('#masterLibraryHealth');
    if(h){
      const dexText=dexNums.length?` · anchored Pokédex ${dexNums[0]}`:'';
      h.textContent=`${masterCards.length.toLocaleString()} cached cards · ${cards.length.toLocaleString()} shown${dexText}`;
    }
  }catch(e){
    if(e?.name==='AbortError')return;
    console.warn('Primary card search failed',e);

    // Emergency TCGdex fallback remains intentionally isolated.
    if(!cards.length&&name.length>=2){
      try{
        const u=new URL('https://api.tcgdex.net/v2/en/cards');
        u.searchParams.set('name',name);
        u.searchParams.set('pagination:page','1');
        u.searchParams.set('pagination:itemsPerPage','150');
        const r=await fetch(u,{headers:{Accept:'application/json'},signal});
        if(r.ok){
          const raw=await r.json();
          cards=(Array.isArray(raw)?raw:[]).map(c=>{
            const im=imgUrls(c);
            return withSearchKeys({
              id:`tcgdex:${c.id}`,
              tcgdexId:c.id,
              sourceKey:`tcgdex:${c.id}`,
              language:'en',
              source:'tcgdex-fallback',
              name:c.name||'Unknown card',
              localId:c.localId||'',
              setName:'',
              setId:'',
              illustrator:'',
              imageHigh:im.high,
              imageLow:im.low,
              kind:'card',
              pokedexNumbers:[]
            });
          });
          renderCards();
        }
      }catch{}
    }

    if(!cards.length){
      const grid=document.querySelector('#cards');
      if(grid)grid.innerHTML='<div class="empty">No matches found. Build the local catalog or check the internet connection.</div>';
    }
  }finally{
  }
}
async function search(){
  const v=document.querySelector('#cardsViewport');
  if(v)v.scrollTop=0;
  return runCardSearch();
}
async function loadArtists(){
  const sel=document.querySelector('#artistFilter');if(!sel)return;
  const cur=sel.value;
  const artists=[...new Set(masterCards.map(c=>c.illustrator||c.artist).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  sel.innerHTML='<option value="">All artists</option>'+artists.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');
  if([...sel.options].some(o=>o.value===cur))sel.value=cur;
}

function itemMarkup(item,kind,index=0){
  const src=item.imageHigh||item.imageLow||item.image||'';
  if(kind==='card'){
    const setName=item.setName||item.setId||item.rawSetId||'Unknown set';
    const number=item.localId?`#${item.localId}`:'No. ?';
    const artist=item.illustrator||item.artist||'';
    return `<article class="item card-item" style="--card-index:${Math.min(Number(index)||0,18)}" draggable="true" data-kind="card" data-id="${esc(item.id)}">
      <button class="pick" data-select="${esc(item.id)}" data-kind="card">
        <span class="card-image-wrap"><img src="${esc(src)}" loading="lazy" decoding="async"></span>
        <span class="item-copy">
          <strong>${esc(item.name)}</strong>
          <span class="card-detail-row"><small class="card-number">${esc(number)}</small>${artist?`<small class="card-artist" title="${esc(artist)}">${esc(artist)}</small>`:''}</span>
        </span>
      </button>
    </article>`;
  }
  return `<article class="item" draggable="true" data-kind="art" data-id="${esc(item.id)}"><button class="pick" data-select="${esc(item.id)}" data-kind="art"><img src="${esc(src)}" loading="lazy" decoding="async"><span class="item-copy"><strong>${esc(item.name==='Linked artwork'?'Artwork':item.name)}</strong></span></button><select class="mini art-size" data-size="${esc(item.id)}">${sizeOptions(item.size)}</select><button class="remove-art" data-remove-art="${esc(item.id)}">×</button></article>`;
}
function renderAllCardsStable(){
  const grid=document.querySelector('#cards');
  if(!grid)return;

  const countEl=document.querySelector('#count');
  if(countEl)countEl.textContent=cards.length;

  if(!cards.length){
    grid.innerHTML='<div class="empty">No matching cards found.</div>';
    return;
  }

  grid.innerHTML=cards.map((c,i)=>itemMarkup(c,'card',i)).join('');
  wireItems();
}
function renderCards(){
  renderAllCardsStable();
}



function renderArts(){document.querySelector('#arts').innerHTML=state.artworks.length?state.artworks.map(a=>itemMarkup(a,'art')).join(''):'<div class="empty">Paste a direct image link or upload artwork to add it here.</div>';wireItems()}
function findArtwork(id){return state.artworks.find(x=>x.id===id)}
function wireItems(){document.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{const kind=b.dataset.kind;selected=(kind==='card'?cards.find(x=>x.id===b.dataset.select):findArtwork(b.dataset.select))||null;renderSelected();if(selected&&isMobile())setMobileView('canvas')});document.querySelectorAll('[data-remove-art]').forEach(b=>b.onclick=()=>{state.artworks=state.artworks.filter(x=>x.id!==b.dataset.removeArt);state.pockets=state.pockets.map(x=>x?.id===b.dataset.removeArt?null:x);if(selected?.id===b.dataset.removeArt)selected=null;save();renderArts();renderGrid();renderSelected()});document.querySelectorAll('[data-size]').forEach(sel=>sel.onchange=()=>{const a=findArtwork(sel.dataset.size);if(a)a.size=sel.value;state.pockets=state.pockets.map(x=>x?.id===sel.dataset.size?{...x,size:sel.value}:x);save();renderGrid()});document.querySelectorAll('.item').forEach(el=>el.ondragstart=()=>{const kind=el.dataset.kind;drag={item:kind==='card'?cards.find(x=>x.id===el.dataset.id):findArtwork(el.dataset.id),source:null}})}
function renderHeader(){document.querySelector('#subjectTitle').textContent=state.subject||'Choose a subject';document.querySelector('#canvasTitle').textContent=state.subject||'Untitled composition'}
function renderSelected(){const e=document.querySelector('#selected');if(!selected){e.className='selectedbar control-module selected-module';e.innerHTML='<span><strong>Nothing selected</strong><small>Choose a card or artwork from the tray.</small></span>';return}e.className='selectedbar control-module selected-module active';const detail=selected.kind==='card'?(selected.setName||selected.setId||selected.rawSetId||'Card selected'):'Artwork selected';e.innerHTML=`<img src="${esc(selected.imageLow||selected.imageHigh||selected.image)}"><span><strong>${esc(selected.name)}</strong><small>${esc(detail)} · choose any pocket</small></span><button class="btn" id="cancelSel">×</button>`;document.querySelector('#cancelSel').onclick=()=>{selected=null;renderSelected()}}
function place(index,item,source=null){if(!item)return;const {columns,rows}=dims(),s=span(item),c=index%columns,r=Math.floor(index/columns);if(c+s.columns>columns||r+s.rows>rows)return toast('That insert does not fit from this pocket');const targets=[];for(let y=0;y<s.rows;y++)for(let x=0;x<s.columns;x++)targets.push(index+y*columns+x);const map=placementMap(),collisions=new Set(targets.map(t=>map.get(t)).filter(o=>Number.isInteger(o)&&o!==source));collisions.forEach(o=>state.pockets[o]=null);const displaced=state.pockets[index];if(Number.isInteger(source))state.pockets[source]=displaced||null;state.pockets[index]={...item,...(item.kind==='art'?{cropX:Number.isFinite(item.cropX)?item.cropX:50,cropY:Number.isFinite(item.cropY)?item.cropY:50}:{})};selected=null;save();renderGrid();renderSelected();
  requestAnimationFrame(()=>{
    const pocket=document.querySelector(`[data-pocket="${index}"]`);
    if(pocket){pocket.classList.add('just-placed');setTimeout(()=>pocket.classList.remove('just-placed'),420)}
  })
}
function clamp(n,a,b){return Math.min(b,Math.max(a,n))}
function wireArtworkPan(p,i){const img=p.querySelector('img');if(!img)return;img.addEventListener('click',e=>e.stopPropagation());img.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;e.preventDefault();e.stopPropagation();const item=state.pockets[i];if(!item||item.kind!=='art')return;const rect=img.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,startX=Number.isFinite(item.cropX)?item.cropX:50,startY=Number.isFinite(item.cropY)?item.cropY:50;img.classList.add('adjusting');img.setPointerCapture?.(e.pointerId);const move=ev=>{const dx=ev.clientX-sx,dy=ev.clientY-sy;item.cropX=clamp(startX-dx/Math.max(1,rect.width)*100,0,100);item.cropY=clamp(startY-dy/Math.max(1,rect.height)*100,0,100);img.style.objectPosition=`${item.cropX}% ${item.cropY}%`;p.title=`Artwork position — X ${Math.round(item.cropX)}% · Y ${Math.round(item.cropY)}%`};const up=ev=>{img.classList.remove('adjusting');img.releasePointerCapture?.(ev.pointerId);img.removeEventListener('pointermove',move);img.removeEventListener('pointerup',up);img.removeEventListener('pointercancel',up);save()};img.addEventListener('pointermove',move);img.addEventListener('pointerup',up);img.addEventListener('pointercancel',up)})}
function renderGrid(){const g=document.querySelector('#grid'),map=placementMap(),{columns}=dims();g.className='grid l'+state.layout;g.style.setProperty('--binder',state.binderColor);g.style.setProperty('--page',state.pageColor);g.style.setProperty('--sleeve',state.sleeveColor);let html='';for(let i=0;i<count();i++){if(map.has(i)&&map.get(i)!==i)continue;const item=state.pockets[i],s=span(item),col=i%columns+1,row=Math.floor(i/columns)+1;if(!item){html+=`<button class="pocket" data-pocket="${i}" style="grid-column:${col};grid-row:${row}"><b>${i+1}</b><small>Drop or tap to place</small></button>`}else{const kind=item.kind||'card',pos=kind==='art'?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';html+=`<button class="pocket filled ${kind}" draggable="${kind==='art'?'false':'true'}" data-pocket="${i}" data-filled="1" style="--sc:${s.columns};--sr:${s.rows};grid-column:${col}/span ${s.columns};grid-row:${row}/span ${s.rows}"><span class="sleeve"><img src="${esc(item.imageHigh||item.imageLow||item.image)}" style="${pos}"></span><span class="x" data-remove-pocket="${i}" aria-label="Remove from pocket">×</span></button>`}}g.innerHTML=html;g.querySelectorAll('[data-pocket]').forEach(p=>{const i=Number(p.dataset.pocket);p.onclick=e=>{if(e.target.matches('[data-remove-pocket]')){state.pockets[i]=null;save();renderGrid();return}if(e.target.tagName==='IMG'&&state.pockets[i]?.kind==='art')return;if(selected)place(i,selected);else if(state.pockets[i]){selected=state.pockets[i];renderSelected()}};p.ondragover=e=>e.preventDefault();p.ondrop=e=>{e.preventDefault();if(drag?.item)place(i,drag.item,drag.source)};if(p.dataset.filled&&state.pockets[i]?.kind!=='art')p.ondragstart=()=>{drag={item:state.pockets[i],source:i}};if(state.pockets[i]?.kind==='art')wireArtworkPan(p,i)})}
function addArt(image,name,source,size){const a={id:'art-'+Date.now()+'-'+Math.random().toString(36).slice(2),name:name||'Artwork',source:source||'Uploaded image',image,kind:'art',size:size||'1x1'};state.artworks.push(a);save();renderArts()}
function wirePrintPopup(p,buttonId='doPrint'){
  if(!p||p.closed)return;
  const btn=p.document.getElementById(buttonId);
  if(!btn)return;

  const waitForImages=()=>Promise.all([...p.document.images].map(img=>{
    if(img.complete)return Promise.resolve();
    return new Promise(resolve=>{
      const done=()=>resolve();
      img.addEventListener('load',done,{once:true});
      img.addEventListener('error',done,{once:true});
      setTimeout(done,5000);
    });
  }));

  btn.addEventListener('click',async()=>{
    if(btn.disabled)return;
    const original=btn.textContent;
    btn.disabled=true;
    btn.textContent='Preparing…';
    try{
      await waitForImages();
      p.focus();
      // Small delay gives Chrome time to finish layout after final image decode.
      await new Promise(resolve=>setTimeout(resolve,120));
      p.print();
    }catch(e){
      console.error('Print dialog failed',e);
      toast('Could not open the print dialog. Try the button again.');
    }finally{
      btn.disabled=false;
      btn.textContent=original;
    }
  });
}

function cardTilePrint(){
  const map=placementMap();
  const arts=state.pockets.slice(0,count()).map((item,index)=>({item,index})).filter(({item,index})=>item&&item.kind==='art'&&map.get(index)===index);
  if(!arts.length)return toast('Place at least one artwork insert before using card-tile print');
  const tiles=[];
  for(const {item} of arts){
    const s=span(item),im=item.imageHigh||item.imageLow||item.image;
    for(let y=0;y<s.rows;y++)for(let x=0;x<s.columns;x++)tiles.push({item,im,x,y,cols:s.columns,rows:s.rows});
  }
  const pages=[];
  for(let i=0;i<tiles.length;i+=9)pages.push(tiles.slice(i,i+9));
  const tileMarkup=t=>`<figure class="tile"><div class="cutline"></div><div class="card"><div class="composite" style="width:${t.cols*63}mm;height:${t.rows*88}mm;left:${-t.x*63}mm;top:${-t.y*88}mm"><img src="${esc(t.im)}" style="object-position:${Number.isFinite(t.item.cropX)?t.item.cropX:50}% ${Number.isFinite(t.item.cropY)?t.item.cropY:50}%"></div></div></figure>`;
  const sheets=pages.map((page,i)=>`<section class="sheet">${page.map(tileMarkup).join('')}<span class="pageNo">${i+1}/${pages.length}</span></section>`).join('');
  const p=window.open('','_blank');
  if(!p)return toast('Allow pop-ups once to open the card-tile print sheet');
  p.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(state.subject||"Kasey's Binder Studio")} card tiles</title><style>
  @page{size:letter portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:white;font-family:system-ui,sans-serif}.help{max-width:900px;margin:14px auto;padding:12px 14px;border-radius:10px;background:#171b24;color:#fff;font-size:14px;line-height:1.45}.help button{float:right;margin-left:12px;padding:9px 14px;font:inherit;font-weight:800;cursor:pointer}.help button:disabled{opacity:.6;cursor:wait}.sheet{position:relative;width:215.9mm;height:279.4mm;margin:0 auto;display:grid;grid-template-columns:repeat(3,63mm);grid-auto-rows:88mm;gap:3mm;align-content:center;justify-content:center;page-break-after:always;background:#fff}.sheet:last-of-type{page-break-after:auto}.tile{position:relative;width:63mm;height:88mm;margin:0;overflow:visible}.card{position:absolute;inset:0;width:63mm;height:88mm;overflow:hidden;border-radius:3mm;background:#fff}.composite{position:absolute;overflow:hidden}.composite img{display:block;width:100%;height:100%;object-fit:cover}.cutline{position:absolute;inset:-.7mm;border:.18mm dashed #202020;border-radius:3.7mm;pointer-events:none;z-index:5}.pageNo{position:absolute;right:4mm;bottom:2mm;font-size:8pt;color:#777}@media screen{body{padding:0 12px 24px;background:#222833}.sheet{margin:12px auto;box-shadow:0 8px 35px #0008}}@media print{.help{display:none}.sheet{margin:0;box-shadow:none}.pageNo{display:none}}
  </style></head><body><div class="help"><button id="doPrint">Print / Save PDF</button><strong>Experimental card-tile mode</strong><br>Every artwork insert is split into continuous 63 × 88mm card tiles. Your saved X/Y artwork position is preserved. Print at <strong>100% / Actual size</strong> with scaling disabled. The dashed rounded line is the cut guide; the finished tile is standard card size with a 3mm corner radius. Up to nine tiles are placed on each US Letter sheet.</div>${sheets}</body></html>`);
  p.document.close();
  wirePrintPopup(p,'doPrint');
  p.focus();
}
function renderPrintPageToWindow(p){
  const {columns,rows}=dims(),map=placementMap(),includeCards=Boolean(document.querySelector('#includeCards')?.checked),
    items=state.pockets.slice(0,count()).map((item,index)=>({item,index}))
      .filter(({item,index})=>item&&map.get(index)===index&&(item.kind==='art'||includeCards));

  if(!items.length){
    toast(includeCards?'Place at least one card or artwork before printing':'Place at least one artwork insert, or check Cards to include placed cards');
    try{if(p&&!p.closed)p.close()}catch{}
    return false;
  }

  const blocks=items.map(({item,index})=>{
    const s=span(item),c=index%columns,r=Math.floor(index/columns),art=item.kind==='art',
      w=art?s.columns*70:63,h=art?s.rows*95:88,l=c*70+(art?0:3.5),t=r*95+(art?0:3.5),
      im=item.imageHigh||item.imageLow||item.image,
      pos=art?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';
    return `<figure style="left:${l}mm;top:${t}mm;width:${w}mm;height:${h}mm"><img src="${esc(im)}" style="${pos}"></figure>`;
  }).join('');

  const pw=columns*70,ph=rows*95;
  if(!p||p.closed)return false;

  p.document.open();
  p.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(state.subject||"Kasey's Binder Studio")} print inserts</title><style>
  @page{size:${pw}mm ${ph}mm;margin:0}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:white}
  .sheet{position:relative;width:${pw}mm;height:${ph}mm;overflow:hidden;background:${state.pageColor}}
  figure{position:absolute;margin:0;overflow:hidden;border:.15mm dashed #0004}
  img{display:block;width:100%;height:100%;object-fit:cover}
  @media screen{
    body{padding:16px;background:#20242c}
    .sheet{margin:auto;box-shadow:0 12px 40px #0008}
    .help{display:block;margin:0 auto 12px;max-width:720px;color:white;font:14px system-ui}
    .help button{float:right;padding:8px 14px;cursor:pointer}
    .help button:disabled{opacity:.6;cursor:wait}
  }
  @media print{.help{display:none}}
  </style></head><body>
  <div class="help"><button id="doPrint">Print / Save PDF</button>
  <strong>Exact-size binder insert sheet</strong><br>
  Your saved X/Y artwork position is preserved. Print at 100% / Actual size. Disable “Fit to page.”
  On iPhone, use the print sheet’s button or Safari Share → Print.</div>
  <main class="sheet">${blocks}</main></body></html>`);
  p.document.close();
  wirePrintPopup(p,'doPrint');
  p.focus();
  return true;
}

function printPage(){
  const p=window.open('','_blank');
  if(!p)return toast('Allow pop-ups once to open the print sheet');
  renderPrintPageToWindow(p);
}
function init(){applyTheme('jolteon',{persist:false});document.querySelector('#subject').value=state.subject;document.querySelector('#layout').value=state.layout;document.querySelector('#binderColor').value=state.binderColor;document.querySelector('#pageColor').value=state.pageColor;document.querySelector('#sleeveColor').value=state.sleeveColor;renderHeader();renderCards();renderArts();renderSelected();renderGrid();if(state.subject.length>=2)search()}
document.querySelector('#tabLibrary').onclick=()=>setMobileView('library');document.querySelector('#tabCanvas').onclick=()=>setMobileView('canvas');window.addEventListener('resize',()=>{if(!isMobile())setMobileView('desktop')});if(isMobile())setMobileView('library');
document.querySelector('#artPokemonLink').onclick=openPokemonArtwork;document.querySelector('#searchBtn').onclick=search;
document.querySelector('#syncMasterLibrary').onclick=()=>buildMasterLibrary();
document.querySelector('#setFilter').onchange=search;
document.querySelector('#artistFilter').onchange=search;
document.querySelector('#clearArtist').onclick=()=>{document.querySelector('#artistFilter').value='';search()};document.querySelector('#subject').onkeydown=e=>{if(e.key==='Enter')search()};let debounce;document.querySelector('#subject').oninput=e=>{state.subject=e.target.value;save();renderHeader();clearTimeout(debounce);debounce=setTimeout(()=>{if(e.target.value.trim().length>=2)search()},250)};document.querySelector('#layout').onchange=e=>{state.layout=e.target.value;save();renderGrid()};['binderColor','pageColor','sleeveColor'].forEach(id=>document.querySelector('#'+id).oninput=e=>{state[id]=e.target.value;save();renderGrid()});document.querySelector('#addUrl').onclick=()=>{const u=document.querySelector('#artUrl').value.trim();if(!/^https:\/\//i.test(u))return toast('Paste a direct HTTPS image link');addArt(u,'Artwork','',document.querySelector('#newArtSize').value);document.querySelector('#artUrl').value=''};document.querySelector('#upload').onchange=e=>{[...e.target.files].forEach(f=>{const r=new FileReader();r.onload=()=>addArt(r.result,f.name,'Uploaded image',document.querySelector('#newArtSize').value);r.readAsDataURL(f)});e.target.value=''};document.querySelector('#clear').onclick=()=>{state.pockets=Array(12).fill(null);selected=null;save();renderGrid();renderSelected()};document.querySelector('#print').onclick=printPage;document.querySelector('#printTiles').onclick=cardTilePrint;loadArtists();masterOpen().then(async db=>{masterDb=db;await loadMasterFromDb();await updateLibrarySetupButton()}).catch(e=>{console.error(e);setMasterStatus('Master Library unavailable',e?.message||String(e));showRuntimeError(e?.message||String(e))});init();

/* v1.4 Binder Library Beta
   Important: this layer snapshots/restores the existing editor state. It does not replace
   placement, artwork, printing, search, or rendering logic. */

function cloneEditorState(src=state){return JSON.parse(JSON.stringify({...defaults,...src,pockets:Array.from({length:12},(_,i)=>src.pockets?.[i]||null),artworks:Array.isArray(src.artworks)?src.artworks:[]}))}
function blankPageState(){const s=cloneEditorState();s.pockets=Array(12).fill(null);return s}
function id(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)}
function dbOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open(BINDER_DB_NAME,BINDER_DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('binders'))db.createObjectStore('binders',{keyPath:'id'});if(!db.objectStoreNames.contains('pages')){const ps=db.createObjectStore('pages',{keyPath:'id'});ps.createIndex('binderId','binderId',{unique:false})}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function dbStore(name,mode='readonly'){return binderDb.transaction(name,mode).objectStore(name)}
function dbGet(store,key){return new Promise((resolve,reject)=>{const r=dbStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function dbPut(store,value){return new Promise((resolve,reject)=>{const r=dbStore(store,'readwrite').put(value);r.onsuccess=()=>resolve(value);r.onerror=()=>reject(r.error)})}
function dbDelete(store,key){return new Promise((resolve,reject)=>{const r=dbStore(store,'readwrite').delete(key);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
function dbAll(store){return new Promise((resolve,reject)=>{const r=dbStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
function pagesForBinder(binderId){return new Promise((resolve,reject)=>{const tx=binderDb.transaction('pages','readonly'),idx=tx.objectStore('pages').index('binderId'),r=idx.getAll(IDBKeyRange.only(binderId));r.onsuccess=()=>resolve((r.result||[]).sort((a,b)=>a.order-b.order));r.onerror=()=>reject(r.error)})}
function persistActiveIds(){localStorage.setItem(ACTIVE_BINDER_KEY,activeBinderId);localStorage.setItem(ACTIVE_PAGE_KEY,activePageId)}

/* This intentionally replaces only the tiny persistence function from v1.3.8. */
function save(){
  try{localStorage.setItem('michiStandaloneState',JSON.stringify(state))}catch(e){toast('Local storage is full. Binder pages are still stored separately; consider removing large tray artwork.')}
  if(binderLayerReady===true&&!binderLoading&&activeBinderId&&activePageId){
    clearTimeout(binderWriteTimer);
    binderWriteTimer=setTimeout(()=>saveActivePageSnapshot().catch(()=>{}),220);
  }
}
async function saveActivePageSnapshot(){if(!binderDb||!activeBinderId||!activePageId||binderLoading)return;const existing=await dbGet('pages',activePageId);if(!existing)return;existing.state=cloneEditorState();existing.updatedAt=Date.now();existing.title=existing.title||`Page ${(existing.order||0)+1}`;await dbPut('pages',existing);const b=await dbGet('binders',activeBinderId);if(b){b.updatedAt=Date.now();await dbPut('binders',b)}updateBinderStatus('Saved')}
function updateBinderStatus(text){const e=document.querySelector('#binderStatus');if(e)e.textContent=text||''}
function rerenderEditor(){document.querySelector('#subject').value=state.subject||'';document.querySelector('#layout').value=state.layout;document.querySelector('#binderColor').value=state.binderColor;document.querySelector('#pageColor').value=state.pageColor;document.querySelector('#sleeveColor').value=state.sleeveColor;cards=[];selected=null;renderHeader();renderCards();renderArts();renderSelected();renderGrid();if(state.subject?.length>=2)search()}
async function loadPageIntoEditor(pageId,{closeLibrary=true}={}){const page=await dbGet('pages',pageId);if(!page)return toast('That saved page could not be loaded');await saveActivePageSnapshot().catch(()=>{});binderLoading=true;activeBinderId=page.binderId;activePageId=page.id;persistActiveIds();state=cloneEditorState(page.state||defaults);try{localStorage.setItem('michiStandaloneState',JSON.stringify(state))}catch{}binderLoading=false;rerenderEditor();renderEditorPageNav().catch(console.error);if(closeLibrary)closeBinderLibrary();toast(`${page.title||'Page'} loaded`)}
async function ensureBinderLibrary(){binderDb=await dbOpen();let binders=await dbAll('binders');if(!binders.length){const bid=id('binder'),pid=id('page'),now=Date.now();await dbPut('binders',{id:bid,name:'My Binder',createdAt:now,updatedAt:now});await dbPut('pages',{id:pid,binderId:bid,order:0,title:'Page 1',createdAt:now,updatedAt:now,state:cloneEditorState()});activeBinderId=bid;activePageId=pid;persistActiveIds()}else{if(!binders.some(b=>b.id===activeBinderId))activeBinderId=binders.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))[0].id;let pages=await pagesForBinder(activeBinderId);if(!pages.length){const pid=id('page'),now=Date.now();await dbPut('pages',{id:pid,binderId:activeBinderId,order:0,title:'Page 1',createdAt:now,updatedAt:now,state:cloneEditorState()});activePageId=pid}else if(!pages.some(p=>p.id===activePageId))activePageId=pages[0].id;persistActiveIds();const saved=await dbGet('pages',activePageId);if(saved?.state){binderLoading=true;state=cloneEditorState(saved.state);try{localStorage.setItem('michiStandaloneState',JSON.stringify(state))}catch{}binderLoading=false;rerenderEditor()}}
  binderLayerReady=true;updateBinderStatus('Saved');await renderEditorPageNav();
}
async function renderEditorPageNav(){const wrap=document.querySelector('#editorPageNumbers'),prev=document.querySelector('#editorPrev'),next=document.querySelector('#editorNext');if(!binderLayerReady||!activeBinderId||!wrap)return;const pages=await pagesForBinder(activeBinderId),idx=Math.max(0,pages.findIndex(p=>p.id===activePageId));wrap.innerHTML=pages.map((p,i)=>`<button type="button" class="page-number ${p.id===activePageId?'active':''}" data-editor-page="${esc(p.id)}" aria-current="${p.id===activePageId?'page':'false'}" title="${esc(p.title||`Page ${i+1}`)}">${i+1}</button>`).join('');wrap.querySelectorAll('[data-editor-page]').forEach(b=>b.onclick=()=>{if(b.dataset.editorPage!==activePageId)loadPageIntoEditor(b.dataset.editorPage,{closeLibrary:false}).catch(e=>{console.error(e);toast('Could not load that page')})});prev.disabled=idx<=0;next.disabled=idx<0||idx>=pages.length-1;prev.onclick=()=>{if(idx>0)loadPageIntoEditor(pages[idx-1].id,{closeLibrary:false}).catch(console.error)};next.onclick=()=>{if(idx>=0&&idx<pages.length-1)loadPageIntoEditor(pages[idx+1].id,{closeLibrary:false}).catch(console.error)}}
function openBinderLibrary(){document.querySelector('#binderModal').classList.add('open');document.querySelector('#binderModal').setAttribute('aria-hidden','false');renderBinderLibrary().catch(e=>{console.error(e);toast('Binder library could not be displayed')})}
function closeBinderLibrary(){document.querySelector('#binderModal').classList.remove('open');document.querySelector('#binderModal').setAttribute('aria-hidden','true')}
function previewMarkup(page){const s=page.state||defaults,d=s.layout==='2x2'?{columns:2,total:4}:s.layout==='4x3'?{columns:4,total:12}:{columns:3,total:9};let cells='';const occupied=new Set();for(let i=0;i<d.total;i++){if(occupied.has(i))continue;const item=s.pockets?.[i];let cs=1,rs=1;if(item?.kind==='art'){[cs,rs]=String(item.size||'1x1').split('x').map(Number);cs=cs||1;rs=rs||1;const c=i%d.columns,r=Math.floor(i/d.columns);if(c+cs>d.columns){cs=1;rs=1}for(let y=0;y<rs;y++)for(let x=0;x<cs;x++)occupied.add(i+y*d.columns+x)}const im=item&&(item.imageLow||item.imageHigh||item.image);const pos=item?.kind==='art'?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';cells+=`<span class="mini-pocket ${item?'filled':''} ${item?.kind||''}" style="grid-column:span ${cs};grid-row:span ${rs}">${im?`<img src="${esc(im)}" style="${pos}">`:''}</span>`}return `<div class="page-card-preview l${esc(s.layout||'3x3')}" style="--mini-binder:${esc(s.binderColor||defaults.binderColor)};--mini-page:${esc(s.pageColor||defaults.pageColor)};--mini-sleeve:${esc(s.sleeveColor||defaults.sleeveColor)}">${cells}</div>`}
async function renderBinderLibrary(){if(!binderDb)return;await saveActivePageSnapshot().catch(()=>{});const binders=(await dbAll('binders')).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));const list=document.querySelector('#binderList');const counts={};for(const b of binders)counts[b.id]=(await pagesForBinder(b.id)).length;list.innerHTML=binders.map(b=>`<button class="binder-chip ${b.id===activeBinderId?'active':''}" data-binder="${esc(b.id)}" aria-current="${b.id===activeBinderId?'true':'false'}"><strong>${esc(b.name)}</strong><small>${counts[b.id]} page${counts[b.id]===1?'':'s'}</small></button>`).join('');list.querySelectorAll('[data-binder]').forEach(el=>el.onclick=async()=>{const bid=el.dataset.binder;if(bid===activeBinderId)return;const ps=await pagesForBinder(bid);if(ps[0])await loadPageIntoEditor(ps[0].id,{closeLibrary:false});await renderBinderLibrary()});const pages=await pagesForBinder(activeBinderId);const b=binders.find(x=>x.id===activeBinderId);updateBinderStatus(`${b?.name||'Binder'} · ${pages.length} page${pages.length===1?'':'s'}`);document.querySelector('#pageBrowser').innerHTML=pages.length?pages.map((p,i)=>`<article class="page-card ${p.id===activePageId?'active':''}" data-page-card="${esc(p.id)}">${previewMarkup(p)}<div class="page-card-meta"><strong>${esc(p.title||`Page ${i+1}`)}</strong><div class="page-card-actions"><button data-view-page="${esc(p.id)}">View</button><button data-edit-page="${esc(p.id)}">Edit</button>${pages.length>1?`<button class="danger" data-delete-page="${esc(p.id)}">Delete</button>`:''}</div></div></article>`).join(''):'<div class="binder-empty">No pages in this binder.</div>';document.querySelectorAll('[data-edit-page]').forEach(x=>x.onclick=e=>{e.stopPropagation();loadPageIntoEditor(x.dataset.editPage)});document.querySelectorAll('[data-view-page]').forEach(x=>x.onclick=e=>{e.stopPropagation();openViewer(x.dataset.viewPage)});document.querySelectorAll('[data-delete-page]').forEach(x=>x.onclick=async e=>{e.stopPropagation();if(!confirm('Delete this page? This cannot be undone.'))return;const pid=x.dataset.deletePage;await dbDelete('pages',pid);const left=await pagesForBinder(activeBinderId);if(pid===activePageId&&left[0])await loadPageIntoEditor(left[0].id,{closeLibrary:false});await renderEditorPageNav();await renderBinderLibrary()})}
async function createPage(){await saveActivePageSnapshot().catch(()=>{});const pages=await pagesForBinder(activeBinderId),pid=id('page'),now=Date.now();await dbPut('pages',{id:pid,binderId:activeBinderId,order:pages.length,title:`Page ${pages.length+1}`,createdAt:now,updatedAt:now,state:blankPageState()});await loadPageIntoEditor(pid,{closeLibrary:false});await renderBinderLibrary()}
async function createBinder(){const name=(prompt('Name the new binder:','New Binder')||'').trim();if(!name)return;await saveActivePageSnapshot().catch(()=>{});const bid=id('binder'),pid=id('page'),now=Date.now();await dbPut('binders',{id:bid,name,createdAt:now,updatedAt:now});await dbPut('pages',{id:pid,binderId:bid,order:0,title:'Page 1',createdAt:now,updatedAt:now,state:blankPageState()});await loadPageIntoEditor(pid,{closeLibrary:false});await renderBinderLibrary()}
async function renameActiveBinder(){const b=await dbGet('binders',activeBinderId);if(!b)return;const name=(prompt('Rename binder:',b.name)||'').trim();if(!name)return;b.name=name;b.updatedAt=Date.now();await dbPut('binders',b);renderBinderLibrary()}
async function deleteActiveBinder(){const binders=await dbAll('binders');if(binders.length<=1)return toast('Keep at least one binder');const b=await dbGet('binders',activeBinderId);if(!confirm(`Delete “${b?.name||'this binder'}” and all of its pages?`))return;const pages=await pagesForBinder(activeBinderId);for(const p of pages)await dbDelete('pages',p.id);await dbDelete('binders',activeBinderId);const left=(await dbAll('binders')).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));const lp=await pagesForBinder(left[0].id);if(lp[0])await loadPageIntoEditor(lp[0].id,{closeLibrary:false});renderBinderLibrary()}
async function openViewer(pageId){const page=await dbGet('pages',pageId);if(!page)return;viewerPages=await pagesForBinder(page.binderId);viewerIndex=Math.max(0,viewerPages.findIndex(p=>p.id===pageId));const b=await dbGet('binders',page.binderId);document.querySelector('#viewerTitle').textContent=b?.name||'Binder';document.querySelector('#binderViewer').classList.add('open');document.querySelector('#binderViewer').setAttribute('aria-hidden','false');renderViewer()}
function closeViewer(){document.querySelector('#binderViewer').classList.remove('open');document.querySelector('#binderViewer').setAttribute('aria-hidden','true')}
function fullViewerMarkup(page){const s=page.state||defaults,d=s.layout==='2x2'?{columns:2,total:4}:s.layout==='4x3'?{columns:4,total:12}:{columns:3,total:9},occupied=new Map();for(let i=0;i<d.total;i++){const item=s.pockets?.[i];if(!item||occupied.has(i))continue;let [cs,rs]=item.kind==='art'?String(item.size||'1x1').split('x').map(Number):[1,1];cs=cs||1;rs=rs||1;const c=i%d.columns,r=Math.floor(i/d.columns);if(c+cs>d.columns){cs=1;rs=1}for(let y=0;y<rs;y++)for(let x=0;x<cs;x++)occupied.set(i+y*d.columns+x,i)}let html='';for(let i=0;i<d.total;i++){if(occupied.has(i)&&occupied.get(i)!==i)continue;const item=s.pockets?.[i];let [cs,rs]=item?.kind==='art'?String(item.size||'1x1').split('x').map(Number):[1,1];cs=cs||1;rs=rs||1;const col=i%d.columns+1,row=Math.floor(i/d.columns)+1,im=item&&(item.imageHigh||item.imageLow||item.image),pos=item?.kind==='art'?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';html+=`<span class="pocket ${item?'filled':''} ${item?.kind||''}" style="--sc:${cs};--sr:${rs};grid-column:${col}/span ${cs};grid-row:${row}/span ${rs}">${im?`<span class="sleeve"><img src="${esc(im)}" style="${pos}"></span>`:''}</span>`}return `<div class="grid l${esc(s.layout||'3x3')}" style="--binder:${esc(s.binderColor||defaults.binderColor)};--page:${esc(s.pageColor||defaults.pageColor)};--sleeve:${esc(s.sleeveColor||defaults.sleeveColor)}">${html}</div>`}
function renderViewer(){const p=viewerPages[viewerIndex];if(!p)return;document.querySelector('#viewerCounter').textContent=`${p.title||`Page ${viewerIndex+1}`} · ${viewerIndex+1} of ${viewerPages.length}`;document.querySelector('#viewerPage').innerHTML=fullViewerMarkup(p);document.querySelector('#viewerPrev').disabled=viewerIndex<=0;document.querySelector('#viewerNext').disabled=viewerIndex>=viewerPages.length-1;const nums=document.querySelector('#viewerPageNumbers');nums.innerHTML=viewerPages.map((pg,i)=>`<button type="button" class="page-number ${i===viewerIndex?'active':''}" data-viewer-page="${i}" aria-current="${i===viewerIndex?'page':'false'}">${i+1}</button>`).join('');nums.querySelectorAll('[data-viewer-page]').forEach(b=>b.onclick=()=>{viewerIndex=Number(b.dataset.viewerPage);renderViewer()})}

/* Binder layer wiring is deliberately isolated from the editor wiring above. */
document.querySelector('#openBinders').onclick=openBinderLibrary;
document.querySelector('#closeBinders').onclick=closeBinderLibrary;
document.querySelector('#newPage').onclick=()=>createPage().catch(e=>{console.error(e);toast('Could not create page')});
document.querySelector('#newBinder').onclick=()=>createBinder().catch(e=>{console.error(e);toast('Could not create binder')});
document.querySelector('#renameBinder').onclick=()=>renameActiveBinder().catch(console.error);
document.querySelector('#deleteBinder').onclick=()=>deleteActiveBinder().catch(console.error);
document.querySelector('#closeViewer').onclick=closeViewer;
document.querySelector('#viewerPrev').onclick=()=>{if(viewerIndex>0){viewerIndex--;renderViewer()}};
document.querySelector('#viewerNext').onclick=()=>{if(viewerIndex<viewerPages.length-1){viewerIndex++;renderViewer()}};
document.querySelector('#viewerEdit').onclick=()=>{const p=viewerPages[viewerIndex];if(p){closeViewer();loadPageIntoEditor(p.id)}};
document.querySelector('#binderModal').addEventListener('click',e=>{if(e.target.id==='binderModal')closeBinderLibrary()});
document.querySelector('#binderViewer').addEventListener('click',e=>{if(e.target.id==='binderViewer')closeViewer()});
window.addEventListener('beforeunload',()=>{if(binderLayerReady&&!binderLoading)saveActivePageSnapshot().catch(()=>{})});
ensureBinderLibrary().catch(e=>{console.error('Binder library init failed',e);toast('Binder library could not initialize; the page editor still works normally.')});


function showRuntimeError(message){
  const banner=document.querySelector('#runtimeErrorBanner'),text=document.querySelector('#runtimeErrorText');
  if(!banner||!text)return;
  text.textContent=String(message||'Unknown error');
  banner.hidden=false;
}
window.addEventListener('error',e=>{
  if(e?.message)showRuntimeError(e.message);
});
window.addEventListener('unhandledrejection',e=>{
  const reason=e?.reason;
  showRuntimeError(reason?.message||String(reason||'Unhandled promise rejection'));
});
document.querySelector('#runtimeErrorDismiss')?.addEventListener('click',()=>{
  const banner=document.querySelector('#runtimeErrorBanner');if(banner)banner.hidden=true;
});


/* Synchronize the left browser stack to the actual Live Binder height. */
let workspaceHeightObserver=null;
function syncWorkspaceColumnHeight(){
  const canvas=document.querySelector('.canvas');
  const library=document.querySelector('.library');
  if(!canvas||!library)return;
  if(window.matchMedia('(max-width:900px)').matches){
    library.style.removeProperty('--live-binder-height');
    return;
  }
  const h=Math.ceil(canvas.getBoundingClientRect().height);
  if(h>0)library.style.setProperty('--live-binder-height',`${h}px`);
}
function initWorkspaceHeightSync(){
  workspaceHeightObserver?.disconnect?.();
  const canvas=document.querySelector('.canvas');
  if(!canvas)return;
  workspaceHeightObserver=new ResizeObserver(()=>requestAnimationFrame(syncWorkspaceColumnHeight));
  workspaceHeightObserver.observe(canvas);
  window.addEventListener('resize',syncWorkspaceColumnHeight,{passive:true});
  requestAnimationFrame(syncWorkspaceColumnHeight);
}

/* v2.1.3 build info */
function openBuildInfo(){
  const m=document.querySelector('#buildInfoModal');
  if(m){m.hidden=false;requestAnimationFrame(()=>m.classList.add('open'))}
}
function closeBuildInfo(){
  const m=document.querySelector('#buildInfoModal');
  if(!m)return;
  m.classList.remove('open');
  setTimeout(()=>{m.hidden=true},160);
}
document.querySelector('#versionLink')?.addEventListener('click',openBuildInfo);
document.querySelector('#buildInfoClose')?.addEventListener('click',closeBuildInfo);
document.querySelector('#buildInfoModal')?.addEventListener('click',e=>{if(e.target.id==='buildInfoModal')closeBuildInfo()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('#buildInfoModal')?.hidden)closeBuildInfo()});

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initWorkspaceHeightSync,{once:true});
}else{
  initWorkspaceHeightSync();
}
