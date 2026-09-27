/* Focused Binder Studio fixes: full-set browsing, collector-number sorting,
   card-tray scroll preservation, and MEE 009-016 30th Celebration energies. */
(()=>{
  'use strict';

  const ENERGY_ROWS=[
    ['009','Basic Grass Energy','Grass'],['010','Basic Fire Energy','Fire'],
    ['011','Basic Water Energy','Water'],['012','Basic Lightning Energy','Lightning'],
    ['013','Basic Psychic Energy','Psychic'],['014','Basic Fighting Energy','Fighting'],
    ['015','Basic Darkness Energy','Darkness'],['016','Basic Metal Energy','Metal']
  ].map(([number,name,type])=>({
    id:`ptcg:mee-${Number(number)}`,primaryId:`mee-${Number(number)}`,sourceKey:`ptcg:mee-${Number(number)}`,
    language:'en',source:'binder-studio-30th-energy',name,localId:number,setId:'mee',rawSetId:'mee',
    setName:'Mega Evolution Energies',series:'Mega Evolution',releaseDate:'2026/09/16',
    illustrator:'YOSHIROTTEN',artist:'YOSHIROTTEN',rarity:'Holofoil',supertype:'Energy',subtypes:['Basic'],
    types:[type],energyType:type,pokedexNumbers:[],
    imageHigh:`https://images.pokemontcg.io/mee/${Number(number)}_hires.png`,
    imageLow:`https://images.pokemontcg.io/mee/${Number(number)}.png`,kind:'card'
  }));

  function num(v){const m=String(v??'').match(/\d+/);return m?Number(m[0]):Number.POSITIVE_INFINITY}
  function sortByCollector(a,b){
    const d=num(a?.localId)-num(b?.localId);if(d)return d;
    const n=String(a?.localId||'').localeCompare(String(b?.localId||''),undefined,{numeric:true,sensitivity:'base'});if(n)return n;
    return String(a?.name||'').localeCompare(String(b?.name||''),undefined,{numeric:true,sensitivity:'base'});
  }
  function unique(rows){const m=new Map();for(const c of rows||[]){if(!c)continue;const k=c.primaryId||c.id||`${c.setId}:${c.localId}:${c.name}`;if(!m.has(k))m.set(k,c)}return [...m.values()]}

  async function installEnergyRows(){
    try{
      if(typeof masterCards==='undefined'||!Array.isArray(masterCards))return;
      const existing=new Set(masterCards.map(c=>String(c?.primaryId||c?.id||'').replace(/^ptcg:/,'')));
      const rows=ENERGY_ROWS.map(c=>typeof withSearchKeys==='function'?withSearchKeys({...c}):({...c}));
      const missing=rows.filter(c=>!existing.has(c.primaryId));
      if(missing.length){masterCards.push(...missing);if(typeof masterCardIndex!=='undefined'&&masterCardIndex instanceof Map)masterCards.forEach((c,i)=>masterCardIndex.set(c.id,i));}
      if(typeof masterSetOptions!=='undefined'&&Array.isArray(masterSetOptions)&&!masterSetOptions.some(x=>x.id==='mee')){
        masterSetOptions.push({id:'mee',name:'Mega Evolution Energies'});
        masterSetOptions.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true,sensitivity:'base'}));
        if(typeof renderSetFilter==='function')renderSetFilter();
      }
      if(missing.length&&typeof upsertMasterRows==='function'&&typeof masterDb!=='undefined'&&masterDb)await upsertMasterRows(missing,{refreshHealth:true}).catch(()=>{});
    }catch(e){console.warn('30th Celebration energy supplement skipped',e)}
  }

  async function fullSetSearch(setId){
    const controller=new AbortController();
    try{activeSearchController?.abort?.();activeSearchController=controller}catch{}
    const signal=controller.signal;
    let local=[];
    try{local=(masterCards||[]).filter(c=>c?.setId===setId||c?.rawSetId===setId)}catch{}
    let live=[];
    try{
      if(typeof fetchPokemonTcgPage==='function'){
        const q=`set.id:${typeof escapeLuceneValue==='function'?escapeLuceneValue(setId):setId}`;
        const first=await fetchPokemonTcgPage(1,{q,signal,pageSize:250});
        live.push(...(first?.rows||[]));
        const pages=Math.ceil((Number(first?.totalCount)||live.length)/(Number(first?.pageSize)||250));
        for(let p=2;p<=pages;p++){if(signal.aborted)return;const part=await fetchPokemonTcgPage(p,{q,signal,pageSize:250});live.push(...(part?.rows||[]))}
      }
    }catch(e){if(e?.name!=='AbortError')console.warn('Live full-set lookup failed; using local catalog',e)}
    if(signal.aborted)return;
    if(live.length&&typeof upsertMasterRows==='function')await upsertMasterRows(live).catch(()=>{});
    let result=unique([...local,...live]);
    if(setId==='mee')result=unique([...result,...ENERGY_ROWS.map(c=>typeof withSearchKeys==='function'?withSearchKeys({...c}):({...c}))]);
    result.sort(sortByCollector);
    cards=result;
    if(typeof renderCards==='function')renderCards();
    const count=document.getElementById('count');if(count){count.textContent=String(cards.length);count.title=`Showing all ${cards.length} cards in collector-number order`}
    const health=document.getElementById('masterLibraryHealth');if(health)health.textContent=`${cards.length.toLocaleString()} cards · full set · collector-number order`;
  }

  function installSearchFix(){
    if(typeof runCardSearch!=='function'||runCardSearch.__kbsFullSetFixed)return;
    const original=runCardSearch;
    const wrapped=async function(...args){
      const setId=document.getElementById('setFilter')?.value||'';
      if(setId){await installEnergyRows();return fullSetSearch(setId)}
      return original.apply(this,args);
    };
    wrapped.__kbsFullSetFixed=true;runCardSearch=wrapped;
  }

  function installPlaceFix(){
    if(typeof place!=='function'||place.__kbsScrollFixed)return;
    const original=place;
    const wrapped=function(...args){
      const viewport=document.getElementById('cardsViewport');
      const top=viewport?.scrollTop??0;
      const out=original.apply(this,args);
      if(viewport){viewport.scrollTop=top;requestAnimationFrame(()=>{viewport.scrollTop=top});setTimeout(()=>{viewport.scrollTop=top},80)}
      return out;
    };
    wrapped.__kbsScrollFixed=true;place=wrapped;
  }

  function start(){installSearchFix();installPlaceFix();installEnergyRows();setTimeout(()=>{installSearchFix();installPlaceFix();installEnergyRows()},1200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
