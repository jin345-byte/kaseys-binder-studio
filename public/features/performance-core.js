/* Kasey's Binder Studio v4.0.2 — performance architecture preview
   Preview-only layer for catalog partitioning, indexed search, result virtualization,
   feature lazy-loading helpers, image optimization, and modular runtime boundaries. */
(function(){
  'use strict';

  const PERF_VERSION='4.0.2';
  const loadedGames=new Set();
  const loadingGames=new Map();
  const indexState={ready:false,building:false,version:0,grams:new Map(),byId:new Map(),set:new Map(),artist:new Map(),game:new Map()};
  let virtualLimit=60;
  let lastVirtualSignature='';
  let virtualObserver=null;

  const normalize=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const gameOf=c=>{
    if(c?.game)return c.game;
    if(c?.catalog==='pocket'||c?.source==='tcgdex-pocket')return'pokemon-pocket';
    if(c?.catalog==='union-arena')return'union-arena';
    return'pokemon';
  };
  const grams=v=>{
    const s=normalize(v).replace(/\s+/g,' ');
    if(s.length<3)return s?[s]:[];
    const out=new Set();
    for(let i=0;i<=s.length-3;i++)out.add(s.slice(i,i+3));
    return [...out];
  };
  const addMap=(map,key,id)=>{
    if(!key)return;
    let bucket=map.get(key);
    if(!bucket)map.set(key,bucket=new Set());
    bucket.add(id);
  };
  const idle=cb=>('requestIdleCallback'in window?requestIdleCallback(cb,{timeout:800}):setTimeout(()=>cb({timeRemaining:()=>8,didTimeout:true}),16));

  function getMasterRows(){return typeof masterCards!=='undefined'&&Array.isArray(masterCards)?masterCards:[]}
  function rebuildSearchIndex(rows=getMasterRows()){
    if(indexState.building)return;
    indexState.building=true;indexState.ready=false;
    indexState.grams.clear();indexState.byId.clear();indexState.set.clear();indexState.artist.clear();indexState.game.clear();
    const source=Array.isArray(rows)?rows.slice():[];
    let at=0;
    const step=deadline=>{
      const started=performance.now();
      while(at<source.length&&(deadline?.timeRemaining?.()>1||performance.now()-started<8)){
        const c=source[at++];if(!c?.id)continue;
        indexState.byId.set(c.id,c);
        addMap(indexState.set,String(c.setId||c.rawSetId||''),c.id);
        addMap(indexState.artist,normalize(c.illustrator||c.artist||''),c.id);
        addMap(indexState.game,gameOf(c),c.id);
        const blob=[c.name,c.originalName,c.setName,c.series,c.localId,c.illustrator,c.artist,c.character,c.aliases,c.searchBlob].flat().filter(Boolean).join(' ');
        for(const g of grams(blob))addMap(indexState.grams,g,c.id);
      }
      if(at<source.length){idle(step);return;}
      indexState.ready=true;indexState.building=false;indexState.version++;
      window.dispatchEvent(new CustomEvent('kbs:search-index-ready',{detail:{count:indexState.byId.size,version:indexState.version}}));
    };
    idle(step);
  }

  function indexedCandidates(query){
    const q=normalize(query);
    if(!indexState.ready||q.length<3)return null;
    const qs=grams(q);if(!qs.length)return null;
    let ids=null;
    for(const g of qs){
      const bucket=indexState.grams.get(g);if(!bucket)return [];
      if(ids===null)ids=new Set(bucket);
      else for(const id of [...ids])if(!bucket.has(id))ids.delete(id);
      if(!ids.size)return [];
    }
    return [...ids].map(id=>indexState.byId.get(id)).filter(Boolean);
  }

  if(typeof localMasterMatches==='function'){
    const originalLocalMasterMatches=localMasterMatches;
    localMasterMatches=function(opts={}){
      const q=normalize(document.querySelector('#subject')?.value||'');
      const setId=document.querySelector('#setFilter')?.value||'';
      const artist=normalize(document.querySelector('#artistFilter')?.value||'');
      const dexSet=new Set((opts?.pokedexNumbers||[]).map(Number).filter(Number.isFinite));
      let list=indexedCandidates(q);
      if(list===null)return originalLocalMasterMatches.apply(this,arguments);
      if(setId)list=list.filter(c=>c.setId===setId||c.rawSetId===setId);
      if(artist)list=list.filter(c=>normalize(c.illustrator||c.artist||'')===artist);
      if(q.length>=2||dexSet.size){
        list=list.filter(c=>{
          const blob=normalize(c.searchBlob||`${c.name||''} ${c.setName||''} ${c.series||''} ${c.localId||''} ${c.illustrator||c.artist||''}`);
          const textHit=q.length>=2&&blob.includes(q);
          const dexHit=dexSet.size&&(c.pokedexNumbers||[]).some(n=>dexSet.has(Number(n)));
          return textHit||dexHit;
        });
      }
      return list;
    };
  }

  function readGameFromMasterDb(game){
    return new Promise((resolve,reject)=>{
      try{
        if(typeof masterDb==='undefined'||!masterDb)return resolve([]);
        const tx=masterDb.transaction('cards','readonly');
        const store=tx.objectStore('cards');
        const rows=[];
        const req=store.openCursor();
        req.onsuccess=()=>{
          const cur=req.result;if(!cur)return;
          const c=cur.value;
          if(gameOf(c)===game){
            try{rows.push(typeof withSearchKeys==='function'?withSearchKeys(c):c)}catch{rows.push(c)}
          }
          cur.continue();
        };
        req.onerror=()=>reject(req.error||new Error('Catalog cursor failed'));
        tx.oncomplete=()=>resolve(rows);
        tx.onerror=()=>reject(tx.error||new Error('Catalog transaction failed'));
      }catch(e){reject(e)}
    });
  }

  function refreshCatalogUi(){
    try{
      const sets=new Map();for(const c of getMasterRows())if(c?.setId&&!sets.has(c.setId))sets.set(c.setId,c.setName||c.setId);
      masterSetOptions=[...sets].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
      renderSetFilter?.();loadArtists?.();computeMasterHealth?.();
      globalThis.KBSCatalogCards=getMasterRows();
    }catch(e){console.warn('Catalog UI refresh deferred',e)}
  }
  function mergeRows(rows){
    if(!Array.isArray(rows)||!rows.length)return 0;
    const known=new Set(getMasterRows().map(c=>c?.id));let added=0;
    for(const c of rows){if(!c?.id||known.has(c.id))continue;known.add(c.id);masterCards.push(c);added++;}
    masterCardIndex=new Map(masterCards.map((c,i)=>[c.id,i]));masterReady=masterCards.length>0;
    refreshCatalogUi();rebuildSearchIndex(masterCards);return added;
  }

  async function ensureGame(game){
    if(!game||game==='pokemon-pocket')return 0;
    if(loadedGames.has(game))return 0;
    if(loadingGames.has(game))return loadingGames.get(game);
    const p=(async()=>{const rows=await readGameFromMasterDb(game);const added=mergeRows(rows);loadedGames.add(game);return added})().finally(()=>loadingGames.delete(game));
    loadingGames.set(game,p);return p;
  }

  if(typeof loadMasterFromDb==='function'){
    loadMasterFromDb=async function(){
      if(typeof masterDb==='undefined'||!masterDb)masterDb=await masterOpen();
      const rows=await readGameFromMasterDb('pokemon');
      masterCards=rows;masterCardIndex=new Map(masterCards.map((c,i)=>[c.id,i]));masterReady=masterCards.length>0;loadedGames.add('pokemon');
      refreshCatalogUi();
      if(masterReady)setMasterStatus?.(`Pokémon TCG Library · ${masterCards.length.toLocaleString()} cards`,'Other game catalogs load only when requested.');
      rebuildSearchIndex(masterCards);return masterCards;
    };
  }

  document.addEventListener('change',async e=>{
    if(e.target?.id!=='tcgGameFilter')return;
    const game=e.target.value;
    if(game==='union-arena'||game==='all')await ensureGame('union-arena').catch(console.warn);
    globalThis.KBSMultiTCGFilters?.refresh?.();
    Promise.resolve(typeof runCardSearch==='function'?runCardSearch():null).catch(console.warn);
  });

  if(typeof renderCards==='function'){
    const originalRenderCards=renderCards;
    renderCards=function(){
      const full=typeof cards!=='undefined'&&Array.isArray(cards)?cards:[];
      const sig=[document.querySelector('#subject')?.value||'',document.querySelector('#setFilter')?.value||'',document.querySelector('#artistFilter')?.value||'',document.querySelector('#tcgGameFilter')?.value||''].join('|');
      if(sig!==lastVirtualSignature){lastVirtualSignature=sig;virtualLimit=60;}
      if(full.length<=virtualLimit)return originalRenderCards.apply(this,arguments);
      const snapshot=full;cards=snapshot.slice(0,virtualLimit);let result;
      try{result=originalRenderCards.apply(this,arguments)}finally{cards=snapshot}
      const countEl=document.querySelector('#count');if(countEl)countEl.textContent=String(snapshot.length);
      queueMicrotask(()=>{
        const host=document.querySelector('#cards');if(!host)return;
        host.querySelector('.kbs-virtual-sentinel')?.remove();
        const sentinel=document.createElement('div');sentinel.className='kbs-virtual-sentinel';sentinel.setAttribute('aria-hidden','true');sentinel.style.cssText='height:2px;grid-column:1/-1';host.appendChild(sentinel);
        virtualObserver?.disconnect?.();
        virtualObserver=new IntersectionObserver(entries=>{
          if(!entries.some(x=>x.isIntersecting)||virtualLimit>=snapshot.length)return;
          virtualLimit=Math.min(snapshot.length,virtualLimit+45);requestAnimationFrame(()=>renderCards());
        },{root:document.querySelector('#cardsViewport')||null,rootMargin:'450px'});
        virtualObserver.observe(sentinel);
      });
      return result;
    };
  }

  function dataUrlBytes(url=''){const comma=url.indexOf(',');if(comma<0)return url.length;return Math.floor((url.length-comma-1)*.75)}
  function canvasData(canvas,quality=.9){
    let data=canvas.toDataURL('image/webp',quality);
    if(!data.startsWith('data:image/webp'))data=canvas.toDataURL('image/jpeg',quality);
    return data;
  }
  async function optimizeImageFile(file){
    if(!file||!String(file.type||'').startsWith('image/'))throw new Error('Not an image');
    const bitmap=await createImageBitmap(file);
    const maxEdge=3600,scale=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,w,h);
    let quality=.93,data=canvasData(canvas,quality);
    while(dataUrlBytes(data)>1200000&&quality>.72){quality-=.05;data=canvasData(canvas,quality)}

    const thumbScale=Math.min(1,480/Math.max(bitmap.width,bitmap.height));
    const tw=Math.max(1,Math.round(bitmap.width*thumbScale)),th=Math.max(1,Math.round(bitmap.height*thumbScale));
    const thumb=document.createElement('canvas');thumb.width=tw;thumb.height=th;
    const tctx=thumb.getContext('2d',{alpha:true});tctx.imageSmoothingEnabled=true;tctx.imageSmoothingQuality='high';tctx.drawImage(bitmap,0,0,tw,th);
    const thumbnail=canvasData(thumb,.78);
    bitmap.close?.();
    return {data,thumbnail,width:w,height:h,thumbWidth:tw,thumbHeight:th,bytes:dataUrlBytes(data),thumbnailBytes:dataUrlBytes(thumbnail),quality,sourceBytes:file.size||0,name:file.name||'Uploaded image'};
  }

  async function processUploadFiles(input,files){
    const size=document.querySelector('#newArtSize')?.value||'1x1';
    for(const file of files){
      try{
        const out=await optimizeImageFile(file);
        addArt(out.data,file.name,'Uploaded image · optimized',size);
        const saved=(state.artworks||[]).at(-1);
        if(saved){
          saved.optimized=true;
          saved.sourceBytes=out.sourceBytes;
          saved.storedBytes=out.bytes;
          saved.thumbnailBytes=out.thumbnailBytes;
          saved.pixelWidth=out.width;saved.pixelHeight=out.height;
          saved.thumbnail=out.thumbnail;
          saved.thumbnailWidth=out.thumbWidth;saved.thumbnailHeight=out.thumbHeight;
          save?.();
        }
      }catch(err){
        console.warn('Image optimization fallback',err);
        const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file)}).catch(()=>null);
        if(data)addArt(data,file.name,'Uploaded image',size);
      }
    }
    input.value='';
  }

  /* Capture before app.js' legacy target listener so an upload is persisted exactly once. */
  document.addEventListener('change',e=>{
    const input=e.target;
    if(input?.id!=='upload')return;
    const files=[...(input.files||[])];
    if(!files.length)return;
    e.stopImmediatePropagation();
    processUploadFiles(input,files).catch(err=>{console.error('Optimized upload failed',err);input.value=''});
  },true);

  const lazyRegistry=new Map();
  function loadScript(src,id){
    if(id&&document.getElementById(id))return Promise.resolve();
    if(lazyRegistry.has(src))return lazyRegistry.get(src);
    const p=new Promise((resolve,reject)=>{const s=document.createElement('script');if(id)s.id=id;s.src=src;s.onload=()=>resolve();s.onerror=()=>reject(new Error(`Could not load ${src}`));document.head.appendChild(s)});
    lazyRegistry.set(src,p);return p;
  }
  function loadStyle(href,id){if(id&&document.getElementById(id))return;const l=document.createElement('link');if(id)l.id=id;l.rel='stylesheet';l.href=href;document.head.appendChild(l)}

  setTimeout(()=>rebuildSearchIndex(getMasterRows()),1200);

  globalThis.KBSModules=Object.freeze({
    version:PERF_VERSION,
    catalog:{ensureGame,get loadedGames(){return [...loadedGames]}},
    search:{rebuild:rebuildSearchIndex,get ready(){return indexState.ready},get size(){return indexState.byId.size}},
    virtualization:{reset(){virtualLimit=60},get limit(){return virtualLimit}},
    images:{optimizeImageFile},
    lazy:{script:loadScript,style:loadStyle}
  });
  globalThis.KBSPerformance={version:PERF_VERSION,ensureGame,rebuildSearchIndex,optimizeImageFile};
})();
