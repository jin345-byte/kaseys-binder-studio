/* Binder Studio production card-flow fixes.
   - Selected sets render the complete local set in collector-number order.
   - Card drops preserve the Matching Cards panel scroll position.
   - Card images from newer providers use a same-origin production proxy with direct fallbacks.
   - Existing binder cards with older direct image URLs are repaired at render time.
   - Adds the missing MEE 009-016 30th Celebration Basic Energy cards. */
(()=>{
  'use strict';

  const ENERGY_SET_ID='mee';
  const ENERGY_SET_LABEL='Mega Evolution Energies · 30th Celebration';
  const CARD_PROXY_HOSTS=new Set(['images.scrydex.com']);
  const ENERGY_DEFS=[
    ['009','Basic Grass Energy','grass'],
    ['010','Basic Fire Energy','fire'],
    ['011','Basic Water Energy','water'],
    ['012','Basic Lightning Energy','lightning'],
    ['013','Basic Psychic Energy','psychic'],
    ['014','Basic Fighting Energy','fighting'],
    ['015','Basic Darkness Energy','darkness'],
    ['016','Basic Metal Energy','metal']
  ];

  let supplementPersisted=false;

  function unique(values){return [...new Set(values.filter(Boolean).map(String))]}
  function proxiedCardImage(raw){
    const value=String(raw||'').trim();
    if(!value)return '';
    if(value.startsWith('/api/card-image?'))return value;
    try{
      const url=new URL(value,location.href);
      if(url.protocol==='https:'&&CARD_PROXY_HOSTS.has(url.hostname.toLowerCase()))return `/api/card-image?url=${encodeURIComponent(url.href)}`;
    }catch{}
    return value;
  }
  function imageCandidates(item){
    const fallbacks=Array.isArray(item?.imageFallbacks)?item.imageFallbacks:[];
    const raw=unique([item?.imageHigh,item?.images?.large,item?.imageLarge,item?.image,item?.imageLow,item?.images?.small,item?.imageSmall,...fallbacks]);
    const out=[];
    for(const value of raw){
      const proxy=proxiedCardImage(value);
      if(proxy&&proxy!==value)out.push(proxy);
      out.push(value);
    }
    return unique(out);
  }
  function stabilizeCardImages(item){
    if(!item||item.kind==='art')return item;
    const highRaw=String(item.imageHigh||item.images?.large||item.imageLarge||item.image||item.imageLow||item.imageFallbacks?.[0]||'');
    const lowRaw=String(item.imageLow||item.images?.small||item.imageSmall||item.image||highRaw||item.imageFallbacks?.[1]||'');
    const high=proxiedCardImage(highRaw);
    const low=proxiedCardImage(lowRaw);
    const candidates=unique([high,low,...imageCandidates(item)]);
    item.imageHigh=high||low||candidates[0]||'';
    item.imageLow=low||high||candidates[0]||'';
    item.image=item.imageHigh||item.imageLow||'';
    item.imageFallbacks=candidates;
    return item;
  }
  function attachImageFallback(img,item){
    if(!img||!item)return;
    const list=imageCandidates(item);
    if(!list.length)return;
    const current=img.getAttribute('src')||'';
    let index=Math.max(0,list.indexOf(current));
    img.onerror=()=>{
      index++;
      if(index<list.length){img.src=list[index];return}
      img.onerror=null;
      img.classList.add('image-unavailable');
    };
  }

  function energyRows(){
    return ENERGY_DEFS.map(([number,name,energyType])=>{
      const compact=String(Number(number));
      const row={
        id:`ptcg:mee-${compact}`,
        primaryId:`mee-${compact}`,
        tcgdexId:`mee-${number}`,
        sourceKey:`ptcg:mee-${compact}`,
        language:'en',
        game:'pokemon',
        gameLabel:'Pokémon TCG',
        catalog:'english',
        catalogLabel:'Pokémon TCG',
        source:'binder-studio-30th-energy-supplement',
        name,
        originalName:name,
        localId:number,
        setId:ENERGY_SET_ID,
        rawSetId:ENERGY_SET_ID,
        setName:ENERGY_SET_LABEL,
        associatedExpansion:'me55',
        series:'Mega Evolution',
        releaseDate:'2026/09/16',
        illustrator:'YOSHIROTTEN',
        artist:'YOSHIROTTEN',
        rarity:'Common',
        supertype:'Energy',
        subtypes:['Basic'],
        types:[energyType],
        energyType,
        pokedexNumbers:[],
        imageHigh:`https://images.scrydex.com/pokemon/mee-${compact}/large`,
        imageLow:`https://images.scrydex.com/pokemon/mee-${compact}/small`,
        imageFallbacks:[
          `https://images.scrydex.com/pokemon/mee-${compact}/large`,
          `https://images.scrydex.com/pokemon/mee-${compact}/small`
        ],
        imageSource:'Scrydex CDN via Binder Studio proxy',
        kind:'card',
        celebrationEnergy:true
      };
      stabilizeCardImages(row);
      try{return typeof withSearchKeys==='function'?withSearchKeys(row):row}catch{return row}
    });
  }

  function ensureEnergySupplement(){
    try{
      if(typeof masterCards==='undefined'||!Array.isArray(masterCards))return;
      const existing=new Set(masterCards.map(c=>`${c?.setId||c?.rawSetId||''}:${String(c?.localId||'').padStart(3,'0')}`));
      const missing=energyRows().filter(c=>!existing.has(`${ENERGY_SET_ID}:${c.localId}`));
      if(missing.length){
        for(const row of missing){
          if(typeof masterCardIndex!=='undefined'&&masterCardIndex instanceof Map)masterCardIndex.set(row.id,masterCards.length);
          masterCards.push(row);
        }
      }

      if(typeof masterSetOptions!=='undefined'&&Array.isArray(masterSetOptions)){
        const option=masterSetOptions.find(x=>x?.id===ENERGY_SET_ID);
        if(option)option.name=ENERGY_SET_LABEL;
        else masterSetOptions.push({id:ENERGY_SET_ID,name:ENERGY_SET_LABEL});
        masterSetOptions.sort((a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),undefined,{numeric:true,sensitivity:'base'}));
        if(typeof renderSetFilter==='function')renderSetFilter();
      }

      if(typeof globalThis.KBSCatalogCards!=='undefined')globalThis.KBSCatalogCards=masterCards;

      if(!supplementPersisted&&missing.length&&typeof masterDb!=='undefined'&&masterDb&&typeof upsertMasterRows==='function'){
        supplementPersisted=true;
        upsertMasterRows(missing,{refreshHealth:true}).catch(e=>{
          supplementPersisted=false;
          console.warn('Could not persist 30th Celebration Energy supplement',e);
        });
      }
    }catch(e){console.warn('Could not install 30th Celebration Energy supplement',e)}
  }

  function collectorSort(a,b){
    const av=String(a?.localId??'').trim();
    const bv=String(b?.localId??'').trim();
    const numberOrder=av.localeCompare(bv,undefined,{numeric:true,sensitivity:'base'});
    if(numberOrder)return numberOrder;
    return String(a?.name||'').localeCompare(String(b?.name||''),undefined,{numeric:true,sensitivity:'base'});
  }

  function setRows(setId){
    if(typeof masterCards==='undefined'||!Array.isArray(masterCards))return [];
    return masterCards
      .filter(c=>c&&(c.setId===setId||c.rawSetId===setId))
      .slice()
      .sort(collectorSort)
      .map(c=>stabilizeCardImages({...c,kind:c.kind||'card'}));
  }

  function showFullSet(setId){
    ensureEnergySupplement();
    const rows=setRows(setId);
    try{
      cards=rows;
      if(typeof renderCards==='function')renderCards();
      const count=document.getElementById('count');
      if(count){count.textContent=rows.length.toLocaleString();count.title=`Showing all ${rows.length.toLocaleString()} cards in this set`}
      const health=document.getElementById('masterLibraryHealth');
      if(health)health.textContent=`${rows.length.toLocaleString()} cards · full set · collector-number order`;
    }catch(e){console.error('Could not render complete set',e)}
    return rows;
  }

  function installSetSearch(){
    if(typeof runCardSearch!=='function'||runCardSearch.__kbsProductionFullSet)return;
    const original=runCardSearch;
    const wrapped=async function(...args){
      const setId=document.getElementById('setFilter')?.value||'';
      if(setId)return showFullSet(setId);
      return original.apply(this,args);
    };
    wrapped.__kbsProductionFullSet=true;
    wrapped.__kbsCountWrapped=original.__kbsCountWrapped||false;
    runCardSearch=wrapped;
  }

  function installCardImageRepair(){
    if(typeof renderCards==='function'&&!renderCards.__kbsStableCardImages){
      const original=renderCards;
      const wrapped=function(...args){
        try{if(typeof cards!=='undefined'&&Array.isArray(cards))cards.forEach(stabilizeCardImages)}catch(e){console.warn('Could not stabilize card tray images',e)}
        return original.apply(this,args);
      };
      wrapped.__kbsStableCardImages=true;
      renderCards=wrapped;
    }
    if(typeof renderAllCardsStable==='function'&&!renderAllCardsStable.__kbsStableCardImages){
      const original=renderAllCardsStable;
      const wrapped=function(...args){
        try{if(typeof cards!=='undefined'&&Array.isArray(cards))cards.forEach(stabilizeCardImages)}catch(e){console.warn('Could not stabilize card tray images',e)}
        return original.apply(this,args);
      };
      wrapped.__kbsStableCardImages=true;
      renderAllCardsStable=wrapped;
    }
    if(typeof renderGrid==='function'&&!renderGrid.__kbsStableCardImages){
      const original=renderGrid;
      const wrapped=function(...args){
        try{
          if(typeof state!=='undefined'&&Array.isArray(state?.pockets))state.pockets.forEach(item=>{if(item?.kind!=='art')stabilizeCardImages(item)});
        }catch(e){console.warn('Could not stabilize binder card images',e)}
        const result=original.apply(this,args);
        try{
          document.querySelectorAll('#grid [data-pocket] img').forEach(img=>{
            const pocket=img.closest('[data-pocket]');
            const index=Number(pocket?.dataset?.pocket);
            if(!Number.isInteger(index))return;
            const item=state?.pockets?.[index];
            if(item?.kind!=='art')attachImageFallback(img,item);
          });
        }catch(e){console.warn('Could not attach binder image fallback',e)}
        return result;
      };
      wrapped.__kbsStableCardImages=true;
      renderGrid=wrapped;
    }
  }

  function safeCardSnapshot(item){
    if(!item||item.kind==='art')return item;
    stabilizeCardImages(item);
    const fallbacks=Array.isArray(item.imageFallbacks)?item.imageFallbacks.filter(Boolean):[];
    const high=String(item.imageHigh||item.images?.large||item.imageLarge||item.image||item.imageLow||fallbacks[0]||'');
    const low=String(item.imageLow||item.images?.small||item.imageSmall||item.image||high||fallbacks[1]||'');
    const snapshot={
      id:String(item.id||item.primaryId||item.sourceKey||`card-${Date.now()}`),
      primaryId:item.primaryId||'',
      tcgdexId:item.tcgdexId||'',
      sourceKey:item.sourceKey||item.id||'',
      language:item.language||'en',
      game:item.game||'pokemon',
      gameLabel:item.gameLabel||'Pokémon TCG',
      catalog:item.catalog||'english',
      catalogLabel:item.catalogLabel||'Pokémon TCG',
      source:item.source||'',
      name:String(item.name||'Card'),
      originalName:item.originalName||item.name||'',
      localId:String(item.localId??''),
      setId:item.setId||'',
      rawSetId:item.rawSetId||item.setId||'',
      setName:item.setName||'',
      associatedExpansion:item.associatedExpansion||'',
      series:item.series||'',
      releaseDate:item.releaseDate||'',
      illustrator:item.illustrator||item.artist||'',
      artist:item.artist||item.illustrator||'',
      rarity:item.rarity||'',
      supertype:item.supertype||item.cardType||'',
      subtypes:Array.isArray(item.subtypes)?[...item.subtypes]:[],
      types:Array.isArray(item.types)?[...item.types]:[],
      energyType:item.energyType||'',
      pokedexNumbers:Array.isArray(item.pokedexNumbers)?[...item.pokedexNumbers]:[],
      imageHigh:high,
      imageLow:low,
      image:high||low,
      imageFallbacks:[...new Set([high,low,...fallbacks].filter(Boolean))],
      imageSource:item.imageSource||'',
      kind:'card',
      celebrationEnergy:Boolean(item.celebrationEnergy)
    };
    return stabilizeCardImages(snapshot);
  }

  function installPlacementGuard(){
    if(typeof place!=='function'||place.__kbsProductionPlacementGuard)return;
    const original=place;
    const wrapped=function(index,item,source=null){
      const viewport=document.getElementById('cardsViewport');
      const scrollTop=viewport?.scrollTop??null;
      const normalized=item?.kind==='art'?item:safeCardSnapshot(item);
      const result=original.call(this,index,normalized,source);
      if(viewport&&scrollTop!=null){
        const restore=()=>{viewport.scrollTop=scrollTop};
        requestAnimationFrame(()=>{restore();requestAnimationFrame(restore)});
        setTimeout(restore,60);
        setTimeout(restore,180);
      }
      return result;
    };
    wrapped.__kbsProductionPlacementGuard=true;
    place=wrapped;
  }

  function start(){
    ensureEnergySupplement();
    installCardImageRepair();
    installSetSearch();
    installPlacementGuard();
    try{if(typeof renderGrid==='function')renderGrid()}catch(e){console.warn('Could not refresh binder images after card image repair',e)}
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      ensureEnergySupplement();
      installCardImageRepair();
      installSetSearch();
      installPlacementGuard();
      if(attempts>=12)clearInterval(timer);
    },1000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
