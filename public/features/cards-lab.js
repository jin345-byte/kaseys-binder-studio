/* Kasey's Binder Studio v2.2.3 — card inspector */
const KBSCardLab=(()=>{
  function cardById(id){
    return cards.find(c=>c.id===id)
      || masterCards.find(c=>c.id===id)
      || (globalThis.KBSCatalogCards||[]).find(c=>c.id===id);
  }

  function sourceLabel(source){
    if(source==='pokemon-tcg-raw-github')return 'English catalog';
    if(source==='pokemon-tcg-api')return 'English live API';
    if(source==='tcgdex-fallback')return 'English TCGdex fallback';
    if(source==='tcgdex-ja')return 'Japanese TCG · TCGdex';
    if(source==='tcg-pocket')return 'Pokémon TCG Pocket';
    return source||'Catalog';
  }


  function attachImageFallback(img,c){
    if(!img||!c)return;
    const list=[c.imageHigh,c.imageLow,...(c.imageFallbacks||[])]
      .filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i);

    const removePocketTile=()=>{
      if(c.catalog!=='pocket')return false;
      const tile=img.closest('[data-id]')||img.closest('.card');
      if(tile)tile.remove();
      return true;
    };

    if(!list.length){
      if(!removePocketTile())img.classList.add('image-unavailable');
      return;
    }

    let i=Math.max(0,list.indexOf(img.getAttribute('src')));
    img.onerror=()=>{
      i++;
      if(i<list.length){img.src=list[i];return}
      img.onerror=null;
      if(!removePocketTile())img.classList.add('image-unavailable');
    };
  }

  function enhanceCards(){
    document.querySelectorAll('#cards .card-item').forEach(el=>{
      if(el.dataset.labEnhanced==='1')return;
      el.dataset.labEnhanced='1';
      const c=cardById(el.dataset.id);if(!c)return;
      attachImageFallback(el.querySelector('.card-image-wrap img'),c);

      // Card-details button only. Favorites/star functionality intentionally removed.
      const actions=document.createElement('span');
      actions.className='card-feature-actions card-info-only';
      actions.innerHTML='<button type="button" class="card-info" title="Card details" aria-label="Card details">ⓘ</button>';
      el.appendChild(actions);
      actions.querySelector('.card-info').onclick=e=>{
        e.stopPropagation();e.preventDefault();openDetails(c.id);
      };

      el.addEventListener('pointerenter',()=>showHover(c));
      el.addEventListener('pointerleave',hideHover);
      el.addEventListener('pointermove',moveHover);
    });
  }

  const coreRenderCards=renderCards;
  renderCards=function(){
    const r=coreRenderCards.apply(this,arguments);
    queueMicrotask(enhanceCards);
    return r;
  };
  const coreRenderStable=renderAllCardsStable;
  renderAllCardsStable=function(){
    const r=coreRenderStable.apply(this,arguments);
    queueMicrotask(enhanceCards);
    return r;
  };

  function showHover(c){
    if(window.matchMedia('(hover:none)').matches)return;
    const p=document.querySelector('#hoverCardPreview');if(!p)return;
    p.innerHTML=`<img src="${esc(c.imageLow||c.imageHigh||'')}">
      <strong>${esc(c.name)}</strong>
      <small>${esc(c.setName||c.setId||'Japanese card')} · ${esc(c.localId?'#'+c.localId:'')}${c.catalog==='ja'&&c.originalName?` · ${esc(c.originalName)}`:''}</small>
      <div class="preview-tags">
        ${c.rarity?`<span>${esc(c.rarity)}</span>`:''}
        ${c.illustrator?`<span>${esc(c.illustrator)}</span>`:''}
      </div>`;
    p.hidden=false;
  }
  function moveHover(e){
    const p=document.querySelector('#hoverCardPreview');if(!p||p.hidden)return;
    const x=Math.min(e.clientX+14,window.innerWidth-265);
    const y=Math.min(e.clientY+14,window.innerHeight-320);
    p.style.left=Math.max(8,x)+'px';
    p.style.top=Math.max(8,y)+'px';
  }
  function hideHover(){
    const p=document.querySelector('#hoverCardPreview');
    if(p)p.hidden=true;
  }

  function openDetails(id){
    const c=cardById(id);if(!c)return;
    hideHover();
    const drawer=document.querySelector('#cardDetailsDrawer');
    const body=document.querySelector('#cardDetailsBody');
    const title=document.querySelector('#cardDetailsTitle');
    title.textContent=c.name||'Card details';

    const isEnglish=(c.catalog||'en')==='en';
    const setId=c.setId||c.rawSetId||'';
    body.innerHTML=`<div class="card-details-hero">
      <img id="detailCardImage" src="${esc(c.imageHigh||c.imageLow||'')}">
      <div class="card-details-copy">
        <h3>${esc(c.name)}</h3>${c.catalog==='ja'&&c.originalName?`<small class="original-japanese-name">${esc(c.originalName)}</small>`:''}
        <div class="detail-set-brand">
          ${isEnglish&&setId?`<img id="detailSetSymbol" src="https://images.pokemontcg.io/${encodeURIComponent(setId)}/symbol.png">`:''}
          <span><strong>${esc(c.setName||setId||'Unknown set')}</strong><small>${esc(c.series||'')}</small></span>
        </div>
        <div class="card-details-actions">
          <button class="btn" id="detailSelect">Select card</button>
        </div>
      </div>
    </div>
    <div class="card-details-meta">
      <div class="detail-chip"><small>Catalog</small><strong>${esc(c.catalogLabel||sourceLabel(c.source))}</strong></div>
      <div class="detail-chip"><small>Image source</small><strong>${esc(c.imageSource||'Catalog image')}</strong></div>
      <div class="detail-chip"><small>Card number</small><strong>${esc(c.localId||'Unknown')}</strong></div>
      <div class="detail-chip"><small>Rarity</small><strong>${esc(c.rarity||'Not listed')}</strong></div>
      <div class="detail-chip"><small>Illustrator</small><strong>${esc(c.illustrator||c.artist||'Not listed')}</strong></div>
      <div class="detail-chip"><small>Release</small><strong>${esc(c.releaseDate||'Not listed')}</strong></div>
      <div class="detail-chip"><small>Type</small><strong>${esc([c.supertype,...(c.subtypes||[])].filter(Boolean).join(' · ')||'Card')}</strong></div>
    </div>`;

    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden','false');

    attachImageFallback(document.querySelector('#detailCardImage'),c);
    const setSymbol=document.querySelector('#detailSetSymbol');
    if(setSymbol)setSymbol.onerror=()=>{setSymbol.style.display='none'};
    document.querySelector('#detailSelect').onclick=()=>{
      selected=c;renderSelected();
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden','true');
      if(isMobile())setMobileView('canvas');
    };
  }

  function closeDetails(){
    const d=document.querySelector('#cardDetailsDrawer');
    d.classList.remove('open');
    d.setAttribute('aria-hidden','true');
  }
  document.querySelector('#cardDetailsClose')?.addEventListener('click',closeDetails);
  document.querySelector('#cardDetailsDrawer')?.addEventListener('click',e=>{
    if(e.target.id==='cardDetailsDrawer')closeDetails();
  });

  // Autocomplete uses the active catalog exposed by catalog-lab.
  const input=document.querySelector('#subject');
  const suggestions=document.querySelector('#searchSuggestions');
  let activeSuggestion=-1;
  function activePool(){
    const extra=globalThis.KBSCatalogCards||[];
    return extra.length?extra:masterCards;
  }
  function renderSuggestions(){
    const q=normText(input?.value||'');
    if(!input||!suggestions||q.length<2){suggestions.hidden=true;return}
    const pool=activePool();
    const seen=new Set(),rows=[];
    for(const c of pool){
      const n=normText(c?.name||'');
      if(!n.startsWith(q)||seen.has(n))continue;
      seen.add(n);rows.push(c);
      if(rows.length>=8)break;
    }
    if(!rows.length){suggestions.hidden=true;return}
    activeSuggestion=-1;
    suggestions.innerHTML=rows.map((c,i)=>`<button type="button" class="search-suggestion" data-suggestion="${esc(c.name)}" data-si="${i}">
      <strong>${esc(c.name)}</strong><small>${esc(c.setName||'')}</small>
    </button>`).join('');
    suggestions.hidden=false;
    suggestions.querySelectorAll('[data-suggestion]').forEach(b=>b.onclick=()=>{
      input.value=b.dataset.suggestion;suggestions.hidden=true;search();
    });
  }
  input?.addEventListener('input',()=>{
    clearTimeout(renderSuggestions.t);
    renderSuggestions.t=setTimeout(renderSuggestions,80);
  });
  input?.addEventListener('keydown',e=>{
    if(suggestions.hidden)return;
    const opts=[...suggestions.querySelectorAll('.search-suggestion')];
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();
      activeSuggestion=(activeSuggestion+(e.key==='ArrowDown'?1:-1)+opts.length)%opts.length;
      opts.forEach((x,i)=>x.classList.toggle('active',i===activeSuggestion));
    }else if(e.key==='Enter'&&activeSuggestion>=0){
      e.preventDefault();opts[activeSuggestion].click();
    }else if(e.key==='Escape'){
      suggestions.hidden=true;
    }
  });
  document.addEventListener('pointerdown',e=>{
    if(!e.target.closest?.('.searchrow'))suggestions.hidden=true;
  });

  // Set symbol is English-catalog only.
  function updateSetSymbol(){
    const catalog=document.querySelector('#catalogFilter')?.value||'en';
    const setId=document.querySelector('#setFilter')?.value||'';
    const frame=document.querySelector('#setSymbolFrame');
    const img=document.querySelector('#setSymbolPreview');
    if(!frame||!img)return;
    if(catalog!=='en'||!setId){
      frame.hidden=true;img.removeAttribute('src');return;
    }
    frame.hidden=false;img.style.display='block';
    img.src=`https://images.pokemontcg.io/${encodeURIComponent(setId)}/symbol.png`;
    img.onerror=()=>{img.style.display='none'};
  }
  document.querySelector('#setFilter')?.addEventListener('change',updateSetSymbol);
  document.querySelector('#catalogFilter')?.addEventListener('change',updateSetSymbol);

  const coreRenderSetFilter=renderSetFilter;
  renderSetFilter=function(){
    const r=coreRenderSetFilter.apply(this,arguments);
    updateSetSymbol();
    return r;
  };

  requestAnimationFrame(()=>{enhanceCards();updateSetSymbol()});
  return{openDetails,enhanceCards};
})();
