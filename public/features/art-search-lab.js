/* Kasey's Binder Studio v2.8.4 — unified tabbed artwork browser */
(function(){
  const subject=document.querySelector('#subject');
  const searchBtn=document.querySelector('#searchBtn');
  const library=document.querySelector('.library');
  const variantPane=document.querySelector('.variant-pane');
  const artworkPane=document.querySelector('.artwork-pane');
  const tabs=document.querySelector('#libraryBrowserTabs');
  const cardsTab=document.querySelector('#libraryCardsTab');
  const artworkTab=document.querySelector('#libraryArtworkTab');
  const grid=document.querySelector('#autoArtworkResults');
  const status=document.querySelector('#autoArtworkStatus');
  const count=document.querySelector('#autoArtworkCount');
  const tabCount=document.querySelector('#libraryArtworkTabCount');
  const moreBtn=document.querySelector('#autoArtworkLoadMore');
  if(!subject||!library||!variantPane||!artworkPane||!tabs||!grid)return;

  const SIZE_OPTIONS=[['1x1','1×1'],['1x2','1×2'],['2x1','2×1'],['3x1','3×1'],['2x2','2×2'],['3x3','3×3']];
  const PAGE_SIZE=20;
  const cache=new Map();
  let controller=null,debounce=null,requestSerial=0,activeTab='cards',lastQuery='';
  library.classList.add('has-browser-tabs');

  function cleanName(raw){return String(raw||'').trim().replace(/\s+(ex|gx|vmax|vstar|v-union|v|break|lv\.?\s*x|star)$/i,'').trim();}
  function booruTag(raw){return cleanName(raw).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z0-9♀♂._-]+/g,'_').replace(/^-+|-+$/g,'').replace(/^_+|_+$/g,'');}
  function cacheKey(raw){return booruTag(raw).replace(/-/g,'_');}
  function safeUrl(v){v=String(v||'').trim();return /^https:\/\//i.test(v)?v:'';}
  function safeFanUrl(v){
    const raw=safeUrl(v);if(!raw)return '';
    try{
      const u=new URL(raw),host=u.hostname.toLowerCase();
      const allowed=host==='safebooru.org'||host.endsWith('.safebooru.org')||host==='donmai.us'||host.endsWith('.donmai.us');
      if(!allowed)return '';
      if(!/\.(?:jpe?g|png|webp|gif)$/i.test(u.pathname))return '';
      return u.href;
    }catch{return ''}
  }
  function deliveredUrl(v){
    const raw=safeUrl(v);if(!raw)return '';
    try{
      const u=new URL(raw);
      if(u.origin===location.origin&&u.pathname==='/api/art-image')return u.href;
      const host=u.hostname.toLowerCase();
      if(host==='cdn.donmai.us'||host==='raw.githubusercontent.com')return `${location.origin}/api/art-image?url=${encodeURIComponent(u.href)}`;
      return u.href;
    }catch{return raw}
  }
  function html(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fitFor(w,h){w=Number(w)||1;h=Number(h)||1;const r=w/h;if(r>=2.15)return '3x1';if(r>=1.35)return '2x1';if(r<=.62)return '1x2';return '1x1';}
  function sizeOptions(selected='1x1'){return SIZE_OPTIONS.map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('');}
  function dedupe(rows){const seen=new Set();return rows.filter(x=>{const k=x.url||x.image;if(!k||seen.has(k))return false;seen.add(k);return true;});}
  function wakeArtworkImages(){requestAnimationFrame(()=>grid.querySelectorAll('img[data-art-img]').forEach(img=>{img.loading='eager';if(!img.src&&img.dataset.fallbackSrc)img.src=img.dataset.fallbackSrc;}));}

  function setTab(name,{syncMobile=true}={}){
    activeTab=name==='artwork'?'artwork':'cards';
    library.dataset.libraryTab=activeTab;
    cardsTab?.classList.toggle('active',activeTab==='cards');
    artworkTab?.classList.toggle('active',activeTab==='artwork');
    cardsTab?.setAttribute('aria-selected',activeTab==='cards'?'true':'false');
    artworkTab?.setAttribute('aria-selected',activeTab==='artwork'?'true':'false');
    if(activeTab==='artwork')wakeArtworkImages();
    if(syncMobile&&document.body.classList.contains('mobile-lab-enabled')){
      const mobileName=activeTab==='artwork'?'art':'cards';
      document.querySelectorAll('[data-mobile-lab]').forEach(b=>b.classList.toggle('active',b.dataset.mobileLab===mobileName));
      document.body.classList.toggle('mobile-lab-art',activeTab==='artwork');
      document.body.classList.toggle('mobile-lab-cards',activeTab==='cards');
      document.body.classList.remove('mobile-lab-page');
    }
  }

  tabs.addEventListener('click',e=>{const b=e.target.closest('[data-library-tab]');if(b)setTab(b.dataset.libraryTab);});
  document.querySelector('[data-mobile-lab="cards"]')?.addEventListener('click',()=>setTab('cards',{syncMobile:false}));
  document.querySelector('[data-mobile-lab="art"]')?.addEventListener('click',()=>setTab('artwork',{syncMobile:false}));

  async function fetchOfficial(raw,signal){
    const slug=(typeof pokemonSpeciesSlug==='function'?pokemonSpeciesSlug(cleanName(raw)):cleanName(raw).toLowerCase().replace(/\s+/g,'-'));
    if(!slug)return [];
    try{
      const r=await fetch('https://pokeapi.co/api/v2/pokemon/'+encodeURIComponent(slug),{signal,headers:{Accept:'application/json'},cache:'no-store'});
      if(!r.ok)return [];
      const d=await r.json();
      const official=d?.sprites?.other?.['official-artwork']||{};
      const candidates=[['Official artwork',official.front_default],['Official shiny artwork',official.front_shiny]];
      return candidates.filter(([,u])=>safeUrl(u)).map(([label,original],i)=>{const url=deliveredUrl(original);return{id:'official-'+slug+'-'+i,url,thumb:url,title:label,artist:'Official Pokémon artwork',source:'PokéAPI · Official artwork',width:475,height:475,fit:'1x1',official:true};});
    }catch(e){if(e?.name==='AbortError')throw e;return [];}
  }

  async function fetchFanCache(raw,signal){
    const key=cacheKey(raw);if(!key)return [];
    try{
      const r=await fetch('/art-cache/'+encodeURIComponent(key)+'.json',{signal,headers:{Accept:'application/json'},cache:'no-store'});
      if(r.status===404)return [];
      if(!r.ok)throw new Error('Artwork cache HTTP '+r.status);
      const payload=await r.json();
      const rows=Array.isArray(payload)?payload:(Array.isArray(payload?.results)?payload.results:[]);
      return rows.map((p,i)=>{
        const sourceFile=safeFanUrl(p.url||p.file_url||p.sample_url||p.preview_url);
        const sourceThumb=safeFanUrl(p.thumb||p.preview_url||p.sample_url||p.url)||sourceFile;
        if(!sourceFile)return null;
        const file=deliveredUrl(sourceFile),thumb=deliveredUrl(sourceThumb)||file;
        return {id:'fan-'+(p.id||`${key}-${i}`),url:file,thumb,title:cleanName(raw)+' fan art',artist:p.artist||'Community artwork',source:p.source||'Community fan art',width:Number(p.width||p.image_width)||0,height:Number(p.height||p.image_height)||0,fit:fitFor(p.width||p.image_width,p.height||p.image_height),official:false};
      }).filter(Boolean);
    }catch(e){if(e?.name==='AbortError')throw e;console.warn('Fan-art cache load failed',key,e);return [];}
  }

  function render(rows,raw){
    const total=rows.length;count.textContent=String(total);tabCount.textContent=String(total);
    status.textContent=total?`${total} results for ${cleanName(raw)} · choose a slot size, then add to Art Tray`:`No artwork found for ${cleanName(raw)}.`;
    if(!total){grid.innerHTML='<div class="auto-art-empty">No matching artwork returned.</div>';return;}
    grid.innerHTML=rows.map((a,i)=>`<article class="auto-art-card" data-auto-art="${i}"><button class="auto-art-pick" type="button" title="Add this artwork using the selected slot size"><span class="auto-art-image"><img data-art-img src="${html(a.thumb||a.url)}" data-fallback-src="${html(a.url)}" loading="eager" decoding="async" alt="${html(a.title)}"><span class="auto-art-source">${html(a.source)}</span></span></button><strong>${html(a.title)}</strong><small>${html(a.artist||a.source)}</small><label class="auto-art-size"><span>Slot</span><select data-art-size aria-label="Artwork slot size">${sizeOptions(a.fit||'1x1')}</select></label><button class="btn auto-art-add" type="button">Add</button></article>`).join('');
    grid._rows=rows;
    grid.querySelectorAll('img[data-art-img]').forEach(img=>{
      img.addEventListener('error',()=>{const fallback=img.dataset.fallbackSrc||'';if(fallback&&img.src!==fallback){img.src=fallback;return}img.classList.add('image-unavailable');},{once:true});
    });
    if(activeTab==='artwork')wakeArtworkImages();
  }

  function addResult(article){
    const rows=grid._rows||[];const a=rows[Number(article.dataset.autoArt)];if(!a)return;
    const size=article.querySelector('[data-art-size]')?.value||a.fit||'1x1';
    const urlInput=document.querySelector('#artUrl'),sizeInput=document.querySelector('#newArtSize'),addBtn=document.querySelector('#addUrl');
    if(urlInput&&sizeInput&&addBtn){urlInput.value=a.url;sizeInput.value=size;addBtn.click();article.classList.add('added');setTimeout(()=>article.classList.remove('added'),700);if(typeof toast==='function')toast(`Added artwork as ${size}`);}
  }

  grid.addEventListener('click',e=>{const add=e.target.closest('.auto-art-add,.auto-art-pick');if(!add)return;const article=e.target.closest('.auto-art-card');if(article)addResult(article);});

  async function searchArtwork({force=false,more=false}={}){
    const raw=subject.value.trim(),q=cleanName(raw).toLowerCase();
    if(q.length<2){lastQuery='';grid.innerHTML='';count.textContent='0';tabCount.textContent='0';status.textContent='Search a Pokémon to load artwork automatically.';moreBtn.disabled=true;return;}
    let entry=cache.get(q);
    if(!entry||force&&!more){entry={official:[],fan:[],visibleFan:0,loaded:false};cache.set(q,entry);}
    if(!more&&!force&&q===lastQuery&&entry.loaded){render(dedupe([...entry.official,...entry.fan.slice(0,entry.visibleFan)]),raw);return;}
    lastQuery=q;controller?.abort();controller=new AbortController();const serial=++requestSerial;
    moreBtn.disabled=true;moreBtn.textContent=more?'Loading…':'↻ More';status.textContent=more?`Loading more ${cleanName(raw)} artwork…`:'Finding official and fan artwork…';
    try{
      if(!entry.loaded){
        const [official,fan]=await Promise.all([fetchOfficial(raw,controller.signal),fetchFanCache(raw,controller.signal)]);
        if(serial!==requestSerial)return;
        entry.official=official;entry.fan=dedupe(fan);entry.visibleFan=Math.min(PAGE_SIZE,entry.fan.length);entry.loaded=true;
      }else if(more){entry.visibleFan=Math.min(entry.fan.length,entry.visibleFan+PAGE_SIZE);}
      const rows=dedupe([...entry.official,...entry.fan.slice(0,entry.visibleFan)]);
      cache.set(q,entry);render(rows,raw);
      const remaining=Math.max(0,entry.fan.length-entry.visibleFan);
      status.textContent=entry.fan.length?`${rows.length} artwork results shown${remaining?` · ${remaining} more available`:''}`:`${rows.length} official results · fan-art cache not available yet`;
      moreBtn.disabled=remaining===0;moreBtn.textContent='↻ More';
    }catch(e){if(e?.name==='AbortError')return;console.warn('Artwork search failed',e);status.textContent='Artwork search failed. Card results are unaffected.';moreBtn.disabled=false;moreBtn.textContent='↻ Retry';}
  }

  searchBtn?.addEventListener('click',()=>searchArtwork({force:true}));
  subject.addEventListener('keydown',e=>{if(e.key==='Enter')searchArtwork({force:true});});
  subject.addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>searchArtwork(),650);});
  moreBtn?.addEventListener('click',()=>searchArtwork({more:true}));
  document.querySelector('#artPokemonLink')?.addEventListener('click',()=>setTab('artwork'));
  setTab('cards',{syncMobile:false});moreBtn.disabled=true;if(subject.value.trim().length>=2)setTimeout(()=>searchArtwork(),700);
  globalThis.KBSArtworkSearch={search:searchArtwork,showCards:()=>setTab('cards'),showArtwork:()=>setTab('artwork')};
})();
