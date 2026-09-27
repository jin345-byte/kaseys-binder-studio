/* Binder Studio set browsing enhancements.
   - Search button + selected set shows the full set in collector-number order.
   - Card-result scroll position is preserved while dragging/placing cards.
   - Supplements the eight 30th Celebration MEE 009-016 holo Basic Energies
     while the legacy PokemonTCG data source remains incomplete. */
(()=>{
  'use strict';

  const CELEBRATION_SET_ID='me55';
  const ENERGY_SET_ID='mee';
  const ENERGY_SET_NAME='30th Celebration — Holo Basic Energy';
  const ENERGY_TYPES=[
    ['9','Basic Grass Energy','Grass'],
    ['10','Basic Fire Energy','Fire'],
    ['11','Basic Water Energy','Water'],
    ['12','Basic Lightning Energy','Lightning'],
    ['13','Basic Psychic Energy','Psychic'],
    ['14','Basic Fighting Energy','Fighting'],
    ['15','Basic Darkness Energy','Darkness'],
    ['16','Basic Metal Energy','Metal']
  ];

  const ENERGY_ROWS=ENERGY_TYPES.map(([number,name,energyType])=>({
    id:`ptcg:mee-${number}`,
    primaryId:`mee-${number}`,
    tcgdexId:'',
    sourceKey:`ptcg:mee-${number}`,
    language:'en',
    source:'binder-studio-30th-energy-supplement',
    name,
    localId:number.padStart(3,'0'),
    setId:ENERGY_SET_ID,
    rawSetId:ENERGY_SET_ID,
    setName:ENERGY_SET_NAME,
    series:'Mega Evolution',
    releaseDate:'2026/09/16',
    illustrator:'YOSHIROTTEN',
    artist:'YOSHIROTTEN',
    rarity:'Holofoil',
    supertype:'Energy',
    subtypes:['Basic'],
    types:[energyType],
    energyType,
    pokedexNumbers:[],
    imageHigh:`https://images.pokemontcg.io/mee/${number}_hires.png`,
    imageLow:`https://images.pokemontcg.io/mee/${number}.png`,
    kind:'card',
    celebrationEnergy:true
  }));

  let supplementPersisted=false;
  let savedDragScroll=null;

  function collectorNumber(value){
    const raw=String(value??'').trim();
    const first=raw.match(/\d+/);
    return first?Number(first[0]):Number.POSITIVE_INFINITY;
  }

  function collectorSort(a,b){
    const an=collectorNumber(a?.localId),bn=collectorNumber(b?.localId);
    if(an!==bn)return an-bn;
    const av=String(a?.localId||''),bv=String(b?.localId||'');
    const natural=av.localeCompare(bv,undefined,{numeric:true,sensitivity:'base'});
    if(natural)return natural;
    return String(a?.name||'').localeCompare(String(b?.name||''),undefined,{numeric:true,sensitivity:'base'});
  }

  function energyRowsFresh(){
    try{return ENERGY_ROWS.map(row=>typeof withSearchKeys==='function'?withSearchKeys({...row}):({...row}))}
    catch{return ENERGY_ROWS.map(row=>({...row}))}
  }

  function ensureSetOption(){
    try{
      if(typeof masterSetOptions==='undefined'||!Array.isArray(masterSetOptions))return;
      const existing=masterSetOptions.find(x=>x?.id===ENERGY_SET_ID);
      if(existing)existing.name=ENERGY_SET_NAME;
      else masterSetOptions.push({id:ENERGY_SET_ID,name:ENERGY_SET_NAME});
      masterSetOptions.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true,sensitivity:'base'}));
      if(typeof renderSetFilter==='function')renderSetFilter();
    }catch(e){console.warn('Could not expose 30th Celebration Energy set',e)}
  }

  async function ensureEnergySupplement(){
    try{
      if(typeof masterCards==='undefined'||!Array.isArray(masterCards))return;
      const present=new Set(masterCards.map(c=>String(c?.primaryId||c?.id||'').replace(/^ptcg:/,'')));
      const missing=energyRowsFresh().filter(c=>!present.has(c.primaryId));
      if(missing.length){
        for(const row of missing){
          if(typeof masterCardIndex!=='undefined'&&masterCardIndex instanceof Map)masterCardIndex.set(row.id,masterCards.length);
          masterCards.push(row);
        }
      }
      ensureSetOption();

      if(!supplementPersisted&&typeof masterDb!=='undefined'&&masterDb&&typeof upsertMasterRows==='function'){
        supplementPersisted=true;
        await upsertMasterRows(energyRowsFresh(),{refreshHealth:true}).catch(e=>{
          supplementPersisted=false;
          console.warn('Could not persist 30th Celebration Energy supplement',e);
        });
      }
    }catch(e){console.warn('Could not install 30th Celebration Energy supplement',e)}
  }

  function dedupe(rows){
    const map=new Map();
    for(const row of rows||[]){
      if(!row)return;
      const key=row.primaryId||row.id||`${row.setId}:${row.localId}:${row.name}`;
      if(!map.has(key))map.set(key,row);
      else map.set(key,{...map.get(key),...row});
    }
    return [...map.values()];
  }

  function localSetRows(setId){
    try{
      if(typeof masterCards==='undefined'||!Array.isArray(masterCards))return [];
      return masterCards.filter(c=>c?.setId===setId||c?.rawSetId===setId);
    }catch{return []}
  }

  async function fetchAllSetRows(setId,signal){
    if(typeof fetchPokemonTcgPage!=='function')return [];
    try{
      const q=`set.id:${typeof escapeLuceneValue==='function'?escapeLuceneValue(setId):setId}`;
      const first=await fetchPokemonTcgPage(1,{q,signal,pageSize:250});
      const rows=[...(first?.rows||[])];
      const total=Math.max(0,Number(first?.totalCount)||rows.length);
      const pageSize=Math.max(1,Number(first?.pageSize)||250);
      const pages=Math.ceil(total/pageSize);
      for(let page=2;page<=pages;page++){
        if(signal?.aborted)break;
        const part=await fetchPokemonTcgPage(page,{q,signal,pageSize:250});
        rows.push(...(part?.rows||[]));
      }
      return rows;
    }catch(e){
      if(e?.name!=='AbortError')console.warn('Full set live lookup failed; using local catalog',e);
      return [];
    }
  }

  function setCountLabel(total){
    const el=document.getElementById('count');
    if(!el)return;
    el.textContent=Number(total||0).toLocaleString();
    el.title=`Showing all ${Number(total||0).toLocaleString()} cards in this set`;
  }

  function selectedSetLabel(){
    const select=document.getElementById('setFilter');
    return select?.options?.[select.selectedIndex]?.textContent?.trim()||'Selected set';
  }

  async function browseSelectedSet(){
    const set=document.getElementById('setFilter');
    const setId=set?.value||'';
    if(!setId)return null;

    await ensureEnergySupplement();

    try{activeSearchController?.abort?.()}catch{}
    const controller=new AbortController();
    try{activeSearchController=controller}catch{}
    const signal=controller.signal;

    const viewport=document.getElementById('cardsViewport');
    if(viewport)viewport.scrollTop=0;

    let local=localSetRows(setId);
    const live=await fetchAllSetRows(setId,signal);
    if(signal.aborted)return;
    if(live.length&&typeof upsertMasterRows==='function')await upsertMasterRows(live).catch(console.warn);

    let normal=dedupe([...local,...live]);
    normal.sort(collectorSort);

    // The MEE 009-016 cards are a separately numbered Basic Energy sequence,
    // but they are part of the 30th Celebration product/card checklist. Keep
    // them together after the main numbered run instead of interleaving 009-016.
    let result=normal;
    if(setId===CELEBRATION_SET_ID){
      const energies=energyRowsFresh().sort(collectorSort);
      result=dedupe([...normal,...energies.filter(e=>!normal.some(c=>c.primaryId===e.primaryId))]);
    }

    try{
      cards=result;
      if(typeof renderCards==='function')renderCards();
      setCountLabel(cards.length);
      const title=document.getElementById('subjectTitle');
      if(title)title.textContent=setId===CELEBRATION_SET_ID?`${selectedSetLabel()} + Holo Energies`:selectedSetLabel();
      const health=document.getElementById('masterLibraryHealth');
      if(health)health.textContent=`${cards.length.toLocaleString()} cards · full set · collector-number order`;
    }catch(e){console.error('Could not render full set',e)}
  }

  function installFullSetSearch(){
    const btn=document.getElementById('searchBtn');
    const set=document.getElementById('setFilter');
    if(!btn||!set||btn.dataset.kbsFullSetSearch==='1')return;
    btn.dataset.kbsFullSetSearch='1';
    const originalClick=btn.onclick;

    btn.onclick=async function(event){
      if(set.value){
        event?.preventDefault?.();
        await browseSelectedSet();
        return false;
      }
      return originalClick?.call(this,event);
    };

    // Selecting a set now prepares the filter; Search performs the full-set browse.
    // Other addEventListener-based filter UI behavior remains intact.
    set.onchange=()=>{};
  }

  function restoreDragScroll(){
    if(savedDragScroll==null)return;
    const viewport=document.getElementById('cardsViewport');
    if(!viewport)return;
    const top=savedDragScroll;
    const restore=()=>{viewport.scrollTop=top};
    requestAnimationFrame(()=>{restore();requestAnimationFrame(restore)});
    setTimeout(restore,80);
    setTimeout(restore,220);
  }

  function installScrollPreservation(){
    if(document.documentElement.dataset.kbsCardScrollPreserve==='1')return;
    document.documentElement.dataset.kbsCardScrollPreserve='1';

    try{
      if(typeof renderCards==='function'&&!renderCards.__kbsPreserveScroll){
        const original=renderCards;
        const wrapped=function(...args){
          const viewport=document.getElementById('cardsViewport');
          const top=viewport?.scrollTop||0;
          const out=original.apply(this,args);
          if(viewport)requestAnimationFrame(()=>{viewport.scrollTop=top});
          return out;
        };
        wrapped.__kbsPreserveScroll=true;
        renderCards=wrapped;
      }
    }catch(e){console.warn('Could not wrap card renderer for scroll preservation',e)}

    document.addEventListener('dragstart',event=>{
      if(!event.target?.closest?.('#cards .item'))return;
      const viewport=document.getElementById('cardsViewport');
      savedDragScroll=viewport?.scrollTop??null;
    },true);
    document.addEventListener('drop',restoreDragScroll,true);
    document.addEventListener('dragend',()=>{restoreDragScroll();setTimeout(()=>{savedDragScroll=null},300)},true);
  }

  function start(){
    installScrollPreservation();
    installFullSetSearch();
    ensureEnergySupplement();
    let passes=0;
    const timer=setInterval(()=>{
      passes++;
      installFullSetSearch();
      ensureEnergySupplement();
      if((supplementPersisted&&passes>=3)||passes>=12)clearInterval(timer);
    },1000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
