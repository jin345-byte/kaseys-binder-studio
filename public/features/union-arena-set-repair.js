/* Binder Studio staging — explicit multi-TCG set grouping and Union Arena search repair. */
(function(){
  'use strict';
  const norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const gameOf=c=>c?.game||(c?.catalog==='pocket'?'pokemon-pocket':c?.catalog==='union-arena'?'union-arena':'pokemon');
  const rows=()=>Array.isArray(globalThis.masterCards)?globalThis.masterCards:(Array.isArray(globalThis.KBSCatalogCards)?globalThis.KBSCatalogCards:[]);

  function groupedSets(){
    const groups={pokemon:new Map(),pocket:new Map(),union:new Map()};
    for(const c of rows()){
      const id=String(c?.setId||c?.rawSetId||'').trim();
      if(!id)continue;
      const game=gameOf(c);
      const name=String(c?.setName||id).trim();
      const target=game==='union-arena'?groups.union:game==='pokemon-pocket'?groups.pocket:groups.pokemon;
      if(!target.has(id))target.set(id,name);
    }
    const sort=m=>[...m].sort((a,b)=>a[1].localeCompare(b[1],undefined,{numeric:true}));
    return {pokemon:sort(groups.pokemon),pocket:sort(groups.pocket),union:sort(groups.union)};
  }

  function renderGroupedSetFilter(){
    const select=document.querySelector('#setFilter');
    if(!select)return;
    const current=select.value;
    const g=groupedSets();
    select.innerHTML='';
    select.add(new Option('All sets',''));
    const add=(label,list,prefix='')=>{
      if(!list.length)return;
      const group=document.createElement('optgroup');group.label=label;
      for(const [id,name] of list){const o=new Option(prefix+name,id);group.appendChild(o)}
      select.appendChild(group);
    };
    add('Pokémon TCG',g.pokemon);
    add('Pokémon TCG Pocket',g.pocket,'TCG Pocket · ');
    add('Union Arena',g.union,'Union Arena · ');
    if([...select.options].some(o=>o.value===current))select.value=current;
    const health=document.querySelector('#masterLibraryHealth');
    if(health&&g.union.length)health.dataset.unionSets=String(g.union.length);
  }

  function unionMatches(){
    const list=rows().filter(c=>gameOf(c)==='union-arena');
    const q=norm(document.querySelector('#subject')?.value||'');
    const setId=document.querySelector('#setFilter')?.value||'';
    const artist=norm(document.querySelector('#artistFilter')?.value||'');
    return list.filter(c=>{
      if(setId&&String(c.setId||c.rawSetId||'')!==setId)return false;
      if(artist&&norm(c.illustrator||c.artist||'')!==artist)return false;
      if(q.length>=2){
        const blob=norm(`${c.name||''} ${c.setName||''} ${c.localId||''} ${c.series||''} ${c.rarity||''} ${c.cardType||c.supertype||''}`);
        if(!blob.includes(q))return false;
      }
      return true;
    });
  }

  function installSearchRepair(){
    if(typeof globalThis.runCardSearch!=='function'||globalThis.runCardSearch.__kbsUnionRepair)return;
    const prior=globalThis.runCardSearch;
    const wrapped=async function(){
      const setId=document.querySelector('#setFilter')?.value||'';
      const gameSel=document.querySelector('#multiTcgGame,#gameFilter,[data-multi-tcg-game]');
      const unionRequested=setId.startsWith('union-arena:')||gameSel?.value==='union-arena';
      if(unionRequested){
        globalThis.cards=unionMatches().slice(0,Number(globalThis.MASTER_PAGE_SIZE||150));
        if(typeof globalThis.renderCards==='function')globalThis.renderCards();
        const h=document.querySelector('#masterLibraryHealth');if(h)h.textContent=`Union Arena · ${unionMatches().length.toLocaleString()} matches`;
        return;
      }
      return prior.apply(this,arguments);
    };
    wrapped.__kbsUnionRepair=true;
    globalThis.runCardSearch=wrapped;
  }

  function refresh(){renderGroupedSetFilter();installSearchRepair()}
  let tries=0;
  const timer=setInterval(()=>{tries++;refresh();if(rows().length>6000&&tries>8){clearInterval(timer)}if(tries>80)clearInterval(timer)},500);
  window.addEventListener('pageshow',()=>setTimeout(refresh,100));
  document.addEventListener('change',e=>{if(e.target?.id==='setFilter')setTimeout(refresh,0)},true);
  setTimeout(refresh,0);
  globalThis.KBSUnionArenaSetRepair={refresh,groupedSets,unionMatches};
})();
