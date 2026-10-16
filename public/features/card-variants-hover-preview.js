/* Matching Card Variants: intentional, scroll-safe hover card preview.
   Never opens when scrolling carries a result beneath a stationary pointer. */
(()=>{
  'use strict';
  if(globalThis.KBSCardVariantsHoverPreview?.installed)return;
  const pane=document.querySelector('.variant-pane');
  const viewport=document.getElementById('cardsViewport');
  const preview=document.getElementById('hoverCardPreview');
  if(!pane||!viewport||!preview)return;

  const stableId=c=>String(c?.id||c?.sourceKey||[c?.setId,c?.localId,c?.name].join(':'));
  const cardFor=id=>{
    const current=typeof cards!=='undefined'&&Array.isArray(cards)?cards:[];
    const master=typeof masterCards!=='undefined'&&Array.isArray(masterCards)?masterCards:[];
    return current.find(c=>stableId(c)===id)||master.find(c=>stableId(c)===id)||null;
  };
  const candidates=card=>[
    card?.imageHigh,card?.images?.large,card?.imageLarge,
    card?.image,card?.imageLow,card?.images?.small,
    card?.imageSmall,...(Array.isArray(card?.imageFallbacks)?card.imageFallbacks:[])
  ].filter(Boolean).filter((src,i,a)=>a.indexOf(src)===i);

  let timer=0,activeId='',candidateId='',lastX=0,lastY=0;
  let blockUntil=0,mustMoveAfterScroll=false;
  let pointerStartX=0,pointerStartY=0,watchIndex=0;

  function hide(){
    clearTimeout(timer);timer=0;
    activeId='';candidateId='';
    preview.hidden=true;
    preview.classList.remove('kbs-variant-hover-open');
    preview.replaceChildren();
  }
  function suspend(){
    hide();
    blockUntil=performance.now()+900;
    mustMoveAfterScroll=true;
  }
  function eligible(e){
    return e.pointerType==='mouse'&&e.buttons===0&&
      window.matchMedia('(hover:hover) and (pointer:fine)').matches&&
      !e.target.closest('.kbs-variant-info')&&
      !document.querySelector('.kbs-variant-dragging');
  }
  function position(x,y){
    if(preview.hidden)return;
    const r=preview.getBoundingClientRect(),vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
    const gap=16;
    // Favor the results pane rather than obscuring the binder/canvas.
    const paneRight=pane.getBoundingClientRect().right;
    let left=x+gap;
    if(left+r.width+10>Math.min(paneRight,vw))left=x-r.width-gap;
    left=Math.max(10,Math.min(left,vw-r.width-10));
    let top=y-Math.min(60,r.height*.18);
    top=Math.max(10,Math.min(top,vh-r.height-10));
    preview.style.left=left+'px';preview.style.top=top+'px';
  }
  function show(id,x,y){
    if(performance.now()<blockUntil||mustMoveAfterScroll||candidateId!==id)return;
    const card=cardFor(id),sources=candidates(card);
    if(!card||!sources.length)return hide();
    const img=document.createElement('img');
    img.draggable=false;
    img.alt=card.name||'Card preview';
    const index=++watchIndex;
    let imageIndex=0;
    img.onerror=()=>{
      if(index!==watchIndex)return;
      imageIndex++;
      if(imageIndex<sources.length)img.src=sources[imageIndex];
      else hide(); // Never show a large broken-image placeholder.
    };
    // Decode/source changes are asynchronous, so stale preview images are ignored.
    const meta=document.createElement('div');meta.className='kbs-variant-hover-meta';
    const name=document.createElement('strong');name.textContent=card.name||'Card';
    const detail=document.createElement('small');
    detail.textContent=[card.setName||card.setId||'',card.localId?'#'+card.localId:''].filter(Boolean).join(' · ');
    meta.append(name,detail);
    preview.replaceChildren(img,meta);
    activeId=id;preview.hidden=false;preview.classList.add('kbs-variant-hover-open');
    img.src=sources[0];
    requestAnimationFrame(()=>{if(activeId===id)position(x,y)});
  }
  function queue(e,card){
    if(!eligible(e)||performance.now()<blockUntil)return;
    const id=card.dataset.id;
    if(!id)return;
    if(id===activeId&&!preview.hidden){position(e.clientX,e.clientY);return}
    clearTimeout(timer);candidateId=id;
    lastX=e.clientX;lastY=e.clientY;
    const x=lastX,y=lastY;
    timer=setTimeout(()=>{timer=0;show(id,x,y)},650);
  }
  // A change in which card is under the pointer is not evidence of intentional
  // hover: scrolling triggers pointerover/out without actual mouse movement.
  pane.addEventListener('pointermove',e=>{
    if(!eligible(e)){hide();return}
    const card=e.target.closest('.kbs-variant-card');
    if(!card||!pane.contains(card)){hide();return}
    const moved=Math.hypot(e.clientX-pointerStartX,e.clientY-pointerStartY);
    if(mustMoveAfterScroll){
      if(moved<10)return; // Re-arm only after real mouse movement.
      mustMoveAfterScroll=false;
    }
    pointerStartX=e.clientX;pointerStartY=e.clientY;
    queue(e,card);
  });
  pane.addEventListener('pointerout',e=>{
    const card=e.target.closest?.('.kbs-variant-card');
    if(card&&!card.contains(e.relatedTarget))hide();
  });
  viewport.addEventListener('wheel',suspend,{passive:true,capture:true});
  document.addEventListener('scroll',suspend,true);
  document.addEventListener('pointerdown',hide,true);
  document.addEventListener('pointercancel',hide,true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
  window.addEventListener('blur',hide);
  // Scrolling from keyboard/touchpad should not trigger a preview on stop.
  viewport.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))suspend()});
  globalThis.KBSCardVariantsHoverPreview={installed:true,version:'2.0.0',hide,suspend};
})();