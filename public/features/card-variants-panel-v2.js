/* Matching Card Variants v2 — isolated card browser component.
   The binder may render/save/sync independently without rebuilding this DOM. */
(()=>{
  'use strict';

  if(globalThis.KBSCardVariantsV2?.installed)return;

  const pane=document.querySelector('.variant-pane');
  if(!pane)return;

  const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stableId=c=>String(c?.id||c?.sourceKey||`${c?.setId||''}:${c?.localId||''}:${c?.name||''}`);
  const ui={criteriaKey:'',resultKey:'',drag:null,suppressClickUntil:0};

  pane.classList.add('kbs-variants-v2');
  pane.innerHTML=`
    <div class="kbs-variants-head">
      <div><span class="eyebrow">Matching card variants</span><h2 id="subjectTitle">Choose a subject</h2><small id="variantStatus">Search or choose a set to browse cards.</small></div>
      <span class="badge" id="count">0</span>
    </div>
    <div class="variant-filters kbs-variants-filters">
      <label><span>Set</span><div class="set-filter-row"><span class="set-symbol-frame" id="setSymbolFrame" hidden><img id="setSymbolPreview" alt=""></span><select id="setFilter"><option value="">All sets</option></select></div></label>
      <label><span>Artist</span><select id="artistFilter"><option value="">All artists</option></select></label>
      <button class="btn ghost" id="clearArtist" type="button">Clear filters</button>
    </div>
    <div class="cards-viewport kbs-variants-scroll" id="cardsViewport" tabindex="0" aria-label="Matching card results">
      <div class="cards kbs-variants-grid" id="cards"><div class="empty">Type a Pokémon or Trainer name to find matching cards.</div></div>
    </div>`;

  const viewport=()=>document.getElementById('cardsViewport');
  const grid=()=>document.getElementById('cards');
  const criteriaKey=()=>[
    document.getElementById('subject')?.value.trim()||'',
    document.getElementById('setFilter')?.value||'',
    document.getElementById('artistFilter')?.value||''
  ].join('\u241f');
  const resultsKey=()=>`${criteriaKey()}\u241e${(Array.isArray(cards)?cards:[]).map(stableId).join('\u241f')}`;

  function cardById(id){
    return (Array.isArray(cards)?cards:[]).find(c=>stableId(c)===String(id))
      ||(Array.isArray(masterCards)?masterCards:[]).find(c=>stableId(c)===String(id))
      ||null;
  }

  function imageList(card){return [card?.imageLow,card?.imageHigh,card?.image,...(card?.imageFallbacks||[])].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i)}

  function cardMarkup(card,index){
    const id=stableId(card),images=imageList(card),src=images[0]||'';
    const number=card?.localId?`#${html(card.localId)}`:'';
    const artist=html(card?.illustrator||card?.artist||'');
    const badge=card?.catalog==='pocket'?'TCG Pocket':card?.catalog==='union-arena'?'Union Arena':'';
    return `<article class="item card-item kbs-variant-card" data-kind="card" data-id="${html(id)}" style="--card-index:${index}">
      <button class="pick kbs-variant-pick" type="button" data-select="${html(id)}" aria-label="Select ${html(card?.name||'card')}">
        <span class="card-image-wrap"><img src="${html(src)}" alt="${html(card?.name||'Card')}" loading="lazy" decoding="async" data-card-image="${html(id)}"></span>
        <span class="item-copy"><strong>${html(card?.name||'Unknown card')}</strong><small class="card-detail-row"><span class="card-number">${number}</span>${artist?`<span class="card-artist">${artist}</span>`:''}</small>${badge?`<small class="kbs-variant-source">${badge}</small>`:''}</span>
      </button>
      <button type="button" class="card-info kbs-variant-info" data-info-card="${html(id)}" aria-label="Card details">ⓘ</button>
    </article>`;
  }

  function bindImages(){
    grid()?.querySelectorAll('[data-card-image]').forEach(img=>{
      const card=cardById(img.dataset.cardImage),list=imageList(card);let at=Math.max(0,list.indexOf(img.getAttribute('src')));
      img.onerror=()=>{at++;if(at<list.length)img.src=list[at];else{img.onerror=null;img.classList.add('image-unavailable')}};
    });
  }

  function updateHeader(){
    const rows=Array.isArray(cards)?cards:[];
    const count=document.getElementById('count');if(count)count.textContent=rows.length.toLocaleString();
    const subject=document.getElementById('subject')?.value.trim();
    const set=document.getElementById('setFilter');
    const title=document.getElementById('subjectTitle');
    if(title)title.textContent=subject||set?.selectedOptions?.[0]?.textContent||'Browse cards';
    const status=document.getElementById('variantStatus');
    if(status)status.textContent=rows.length?`${rows.length.toLocaleString()} cards · drag any card into a binder pocket`:'No matching cards';
  }

  function renderResults({force=false}={}){
    const host=grid();if(!host)return;
    const nextCriteria=criteriaKey(),nextResult=resultsKey();
    const criteriaChanged=ui.criteriaKey!==nextCriteria;
    if(!force&&ui.resultKey===nextResult){updateHeader();return;}
    const keepTop=criteriaChanged?0:(viewport()?.scrollTop||0);
    const rows=Array.isArray(cards)?cards:[];
    host.innerHTML=rows.length?rows.map(cardMarkup).join(''):'<div class="empty">No matching cards.</div>';
    ui.criteriaKey=nextCriteria;ui.resultKey=nextResult;
    updateHeader();bindImages();
    const v=viewport();if(v)v.scrollTop=keepTop;
  }

  function selectCard(id){const card=cardById(id);if(!card)return;selected=card;renderSelected()}
  function makeGhost(source,x,y){const ghost=document.createElement('div');ghost.className='kbs-variant-drag-ghost';const img=source.querySelector('img');if(img)ghost.appendChild(img.cloneNode(true));document.body.appendChild(ghost);moveGhost(ghost,x,y);return ghost}
  function moveGhost(ghost,x,y){if(ghost){ghost.style.left=`${x}px`;ghost.style.top=`${y}px`}}
  function clearDropTarget(){document.querySelectorAll('#grid .kbs-variant-drop-target').forEach(x=>x.classList.remove('kbs-variant-drop-target'))}
  function markDropTarget(x,y){clearDropTarget();document.elementFromPoint(x,y)?.closest?.('#grid [data-pocket]')?.classList.add('kbs-variant-drop-target')}
  function cleanupDrag(){if(!ui.drag)return;ui.drag.ghost?.remove();ui.drag.source?.classList.remove('kbs-variant-dragging');clearDropTarget();ui.drag=null}

  function onPointerDown(e){
    if(e.button!==0||e.pointerType==='touch'||e.target.closest('.kbs-variant-info'))return;
    const source=e.target.closest('.kbs-variant-card');if(!source||!pane.contains(source))return;
    const card=cardById(source.dataset.id);if(!card)return;
    ui.drag={pointerId:e.pointerId,source,card,startX:e.clientX,startY:e.clientY,dragging:false,ghost:null};
  }
  function onPointerMove(e){
    const d=ui.drag;if(!d||e.pointerId!==d.pointerId)return;
    if(!d.dragging&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>=6){d.dragging=true;ui.suppressClickUntil=Date.now()+500;d.source.classList.add('kbs-variant-dragging');d.ghost=makeGhost(d.source,e.clientX,e.clientY)}
    if(!d.dragging)return;
    e.preventDefault();moveGhost(d.ghost,e.clientX,e.clientY);markDropTarget(e.clientX,e.clientY);
  }
  function onPointerEnd(e,cancelled=false){
    const d=ui.drag;if(!d||e.pointerId!==d.pointerId)return;
    if(d.dragging&&!cancelled){
      e.preventDefault();const pocket=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('#grid [data-pocket]');const index=Number(pocket?.dataset?.pocket);
      if(pocket&&Number.isInteger(index)&&typeof place==='function')place(index,d.card,null);
    }
    cleanupDrag();
  }

  pane.addEventListener('click',e=>{
    const info=e.target.closest('[data-info-card]');if(info){e.preventDefault();e.stopPropagation();globalThis.KBSCardLab?.openDetails?.(info.dataset.infoCard);return}
    const pick=e.target.closest('[data-select]');if(!pick||Date.now()<ui.suppressClickUntil)return;selectCard(pick.dataset.select);
  });
  document.addEventListener('pointerdown',onPointerDown,true);
  document.addEventListener('pointermove',onPointerMove,{capture:true,passive:false});
  document.addEventListener('pointerup',e=>onPointerEnd(e,false),true);
  document.addEventListener('pointercancel',e=>onPointerEnd(e,true),true);

  renderCards=function(){renderResults()};
  renderAllCardsStable=function(){renderResults()};

  const originalSearch=typeof search==='function'?search:null;
  search=async function(){
    const changed=ui.criteriaKey!==criteriaKey();
    if(changed&&viewport())viewport().scrollTop=0;
    if(typeof runCardSearch==='function')return runCardSearch();
    return originalSearch?.apply(this,arguments);
  };

  document.getElementById('setFilter').addEventListener('change',()=>search().catch(console.error));
  document.getElementById('artistFilter').addEventListener('change',()=>search().catch(console.error));
  document.getElementById('clearArtist').addEventListener('click',()=>{document.getElementById('setFilter').value='';document.getElementById('artistFilter').value='';search().catch(console.error)});

  try{renderSetFilter()}catch{}
  Promise.resolve(typeof loadArtists==='function'?loadArtists():null).catch(()=>{});
  renderResults({force:true});

  // Production card-flow keeps full-set/image repair, but its legacy scroll
  // capture/placement wrappers must not attach to this isolated component.
  document.documentElement.dataset.kbsCardScrollCapture='2';
  if(typeof place==='function')place.__kbsProductionPlacementGuard=true;

  globalThis.KBSCardVariantsV2={installed:true,version:'2.0.1',render:renderResults,get state(){return{criteriaKey:ui.criteriaKey,resultKey:ui.resultKey,scrollTop:viewport()?.scrollTop||0}}};
})();
