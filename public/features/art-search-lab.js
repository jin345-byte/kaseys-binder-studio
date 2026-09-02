/* Kasey's Binder Studio v2.7.6 — tabbed card/art browser + paged artwork search */
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

  const SIZE_OPTIONS=[
    ['1x1','1×1'],['1x2','1×2'],['2x1','2×1'],
    ['3x1','3×1'],['2x2','2×2'],['3x3','3×3']
  ];

  const cache=new Map();
  let controller=null;
  let debounce=null;
  let requestSerial=0;
  let activeTab='cards';
  let lastQuery='';

  library.classList.add('has-browser-tabs');

  function cleanName(raw){
    return String(raw||'').trim()
      .replace(/\s+(ex|gx|vmax|vstar|v-union|v|break|lv\.?\s*x|star)$/i,'')
      .trim();
  }
  function booruTag(raw){
    return cleanName(raw).toLowerCase().normalize('NFKD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[’']/g,'')
      .replace(/[^a-z0-9♀♂._-]+/g,'_')
      .replace(/^_+|_+$/g,'');
  }
  function safeUrl(v){
    v=String(v||'').trim();
    return /^https:\/\//i.test(v)?v:'';
  }
  function html(s){
    return String(s??'').replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function fitFor(w,h){
    w=Number(w)||1;h=Number(h)||1;
    const r=w/h;
    if(r>=2.15)return '3x1';
    if(r>=1.35)return '2x1';
    if(r<=.62)return '1x2';
    return '1x1';
  }
  function sizeOptions(selected='1x1'){
    return SIZE_OPTIONS.map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('');
  }
  function dedupe(rows){
    const seen=new Set();
    return rows.filter(x=>{
      const k=x.url||x.image;
      if(!k||seen.has(k))return false;
      seen.add(k);return true;
    });
  }

  function setTab(name,{syncMobile=true}={}){
    activeTab=name==='artwork'?'artwork':'cards';
    library.dataset.libraryTab=activeTab;
    cardsTab?.classList.toggle('active',activeTab==='cards');
    artworkTab?.classList.toggle('active',activeTab==='artwork');
    cardsTab?.setAttribute('aria-selected',activeTab==='cards'?'true':'false');
    artworkTab?.setAttribute('aria-selected',activeTab==='artwork'?'true':'false');

    if(syncMobile && document.body.classList.contains('mobile-lab-enabled')){
      const mobileName=activeTab==='artwork'?'art':'cards';
      document.querySelector(`[data-mobile-lab="${mobileName}"]`)?.classList.add('active');
      document.querySelectorAll('[data-mobile-lab]').forEach(b=>{
        b.classList.toggle('active',b.dataset.mobileLab===mobileName);
      });
      document.body.classList.toggle('mobile-lab-art',activeTab==='artwork');
      document.body.classList.toggle('mobile-lab-cards',activeTab==='cards');
      document.body.classList.remove('mobile-lab-page');
    }
  }

  tabs.addEventListener('click',e=>{
    const b=e.target.closest('[data-library-tab]');
    if(b)setTab(b.dataset.libraryTab);
  });

  document.querySelector('[data-mobile-lab="cards"]')?.addEventListener('click',()=>setTab('cards',{syncMobile:false}));
  document.querySelector('[data-mobile-lab="art"]')?.addEventListener('click',()=>setTab('artwork',{syncMobile:false}));

  async function fetchOfficial(raw,signal){
    const slug=(typeof pokemonSpeciesSlug==='function'
      ?pokemonSpeciesSlug(cleanName(raw))
      :cleanName(raw).toLowerCase().replace(/\s+/g,'-'));
    if(!slug)return [];
    try{
      const r=await fetch('https://pokeapi.co/api/v2/pokemon/'+encodeURIComponent(slug),{
        signal,headers:{Accept:'application/json'}
      });
      if(!r.ok)return [];
      const d=await r.json();
      const other=d?.sprites?.other||{};
      const candidates=[
        ['Official artwork',other?.['official-artwork']?.front_default],
        ['Official shiny',other?.['official-artwork']?.front_shiny],
        ['Pokémon HOME',other?.home?.front_default],
        ['Dream World',other?.dream_world?.front_default]
      ];
      return candidates.filter(([,u])=>safeUrl(u)).map(([label,url],i)=>({
        id:'official-'+slug+'-'+i,url,thumb:url,title:label,
        artist:'Official Pokémon artwork',source:'PokéAPI',
        width:1,height:1,fit:'1x1',official:true
      }));
    }catch(e){
      if(e?.name==='AbortError')throw e;
      return [];
    }
  }

  async function fetchSafebooru(raw,page,signal){
    const tag=booruTag(raw);
    if(!tag)return [];
    const params=new URLSearchParams({
      page:'dapi',s:'post',q:'index',json:'1',
      limit:'30',pid:String(Math.max(0,page||0)),
      tags:tag
    });
    try{
      const r=await fetch('https://safebooru.org/index.php?'+params.toString(),{
        signal,headers:{Accept:'application/json'}
      });
      if(!r.ok)throw new Error('Safebooru HTTP '+r.status);
      const data=await r.json();
      const rows=Array.isArray(data)?data:(Array.isArray(data?.post)?data.post:[]);
      return rows.map((p,i)=>{
        const directory=String(p.directory??'').trim();
        const image=String(p.image??'').trim();
        const constructed=(directory&&image)
          ?`https://safebooru.org/images/${encodeURIComponent(directory)}/${encodeURIComponent(image)}`
          :'';
        const thumbName=image?('thumbnail_'+image):'';
        const constructedThumb=(directory&&thumbName)
          ?`https://safebooru.org/thumbnails/${encodeURIComponent(directory)}/${encodeURIComponent(thumbName)}`
          :'';
        const file=safeUrl(p.file_url||p.sample_url||p.preview_url||constructed);
        const thumb=safeUrl(p.preview_url||p.sample_url||p.file_url||constructedThumb)||file;
        if(!file)return null;
        return {
          id:'safe-'+(p.id||`${page}-${i}`),
          url:file,thumb,
          title:cleanName(raw)+' fan art',
          artist:'Community artwork',
          source:'Safebooru',
          width:Number(p.width)||0,height:Number(p.height)||0,
          fit:fitFor(p.width,p.height),official:false
        };
      }).filter(Boolean);
    }catch(e){
      if(e?.name==='AbortError')throw e;
      return [];
    }
  }

  function render(rows,raw){
    const total=rows.length;
    count.textContent=String(total);
    tabCount.textContent=String(total);
    status.textContent=total
      ?`${total} results for ${cleanName(raw)} · choose a slot size, then add to Art Tray`
      :`No artwork found for ${cleanName(raw)}.`;

    if(!total){
      grid.innerHTML='<div class="auto-art-empty">No matching artwork returned.</div>';
      return;
    }

    grid.innerHTML=rows.map((a,i)=>`
      <article class="auto-art-card" data-auto-art="${i}">
        <button class="auto-art-pick" type="button" title="Add this artwork using the selected slot size">
          <span class="auto-art-image">
            <img src="${html(a.thumb||a.url)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="${html(a.title)}">
            <span class="auto-art-source">${html(a.source)}</span>
          </span>
        </button>
        <strong>${html(a.title)}</strong>
        <small>${html(a.artist||a.source)}</small>
        <label class="auto-art-size">
          <span>Slot</span>
          <select data-art-size aria-label="Artwork slot size">
            ${sizeOptions(a.fit||'1x1')}
          </select>
        </label>
        <button class="btn auto-art-add" type="button">Add</button>
      </article>
    `).join('');

    grid._rows=rows;
  }

  function addResult(article){
    const rows=grid._rows||[];
    const a=rows[Number(article.dataset.autoArt)];
    if(!a)return;
    const size=article.querySelector('[data-art-size]')?.value||a.fit||'1x1';

    const urlInput=document.querySelector('#artUrl');
    const sizeInput=document.querySelector('#newArtSize');
    const addBtn=document.querySelector('#addUrl');
    if(urlInput&&sizeInput&&addBtn){
      urlInput.value=a.url;
      sizeInput.value=size;
      addBtn.click();
      article.classList.add('added');
      setTimeout(()=>article.classList.remove('added'),700);
      if(typeof toast==='function')toast(`Added artwork as ${size}`);
    }
  }

  grid.addEventListener('click',e=>{
    const add=e.target.closest('.auto-art-add,.auto-art-pick');
    if(!add)return;
    const article=e.target.closest('.auto-art-card');
    if(article)addResult(article);
  });

  async function searchArtwork({force=false,more=false}={}){
    const raw=subject.value.trim();
    const q=cleanName(raw).toLowerCase();

    if(q.length<2){
      lastQuery='';
      grid.innerHTML='';
      count.textContent='0';
      tabCount.textContent='0';
      status.textContent='Search a Pokémon to load artwork automatically.';
      moreBtn.disabled=true;
      return;
    }

    let entry=cache.get(q);
    if(!entry||force&&!more){
      entry={rows:[],page:-1,officialLoaded:false};
      cache.set(q,entry);
    }

    if(!more && !force && q===lastQuery && entry.rows.length){
      render(entry.rows,raw);
      return;
    }

    lastQuery=q;
    controller?.abort();
    controller=new AbortController();
    const serial=++requestSerial;

    moreBtn.disabled=true;
    moreBtn.textContent=more?'Loading…':'↻ More';
    status.textContent=more
      ?`Loading more ${cleanName(raw)} artwork…`
      :'Finding official and fan artwork…';

    try{
      if(!entry.officialLoaded){
        const official=await fetchOfficial(raw,controller.signal);
        if(serial!==requestSerial)return;
        entry.rows=dedupe([...entry.rows,...official]);
        entry.officialLoaded=true;
      }

      const nextPage=more?entry.page+1:0;
      const fan=await fetchSafebooru(raw,nextPage,controller.signal);
      if(serial!==requestSerial)return;

      entry.page=nextPage;
      entry.rows=dedupe([...entry.rows,...fan]);
      cache.set(q,entry);
      render(entry.rows,raw);

      status.textContent=fan.length
        ?`${entry.rows.length} artwork results loaded · press ↻ More for another batch`
        :`${entry.rows.length} results loaded · no additional artwork returned`;
      moreBtn.disabled=fan.length===0;
      moreBtn.textContent='↻ More';
    }catch(e){
      if(e?.name==='AbortError')return;
      status.textContent='Artwork search failed. Card results are unaffected.';
      moreBtn.disabled=false;
      moreBtn.textContent='↻ Retry';
    }
  }

  searchBtn?.addEventListener('click',()=>searchArtwork({force:true}));
  subject.addEventListener('keydown',e=>{
    if(e.key==='Enter')searchArtwork({force:true});
  });
  subject.addEventListener('input',()=>{
    clearTimeout(debounce);
    debounce=setTimeout(()=>searchArtwork(),650);
  });
  moreBtn?.addEventListener('click',()=>searchArtwork({more:true}));

  document.querySelector('#artPokemonLink')?.addEventListener('click',()=>setTab('artwork'));

  setTab('cards',{syncMobile:false});
  moreBtn.disabled=true;
  if(subject.value.trim().length>=2)setTimeout(()=>searchArtwork(),700);

  globalThis.KBSArtworkSearch={
    search:searchArtwork,
    showCards:()=>setTab('cards'),
    showArtwork:()=>setTab('artwork')
  };
})();
