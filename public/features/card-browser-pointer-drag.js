/* Pointer-based drag for Matching Card Variants.
   Avoids native HTML5 drag auto-scroll so the card browser stays exactly where
   the user left it while cards are placed into binder pockets. */
(()=>{
  'use strict';

  if(globalThis.KBSCardBrowserPointerDrag?.installed)return;

  const CARD_SELECTOR='#cards .item[data-kind="card"], #cards .card-item';
  const IGNORE_SELECTOR='button,select,input,a,[data-remove-art],[data-size],.card-info,.card-feature-actions';
  const THRESHOLD=6;
  let active=null;
  let suppressClickUntil=0;

  function cardFromElement(el){
    const id=el?.dataset?.id||el?.querySelector?.('[data-select]')?.dataset?.select||'';
    if(!id||typeof cards==='undefined'||!Array.isArray(cards))return null;
    return cards.find(card=>String(card?.id)===String(id))||null;
  }

  function viewportSnapshot(){
    const viewport=document.getElementById('cardsViewport');
    return viewport?{top:viewport.scrollTop,left:viewport.scrollLeft}:null;
  }

  function restoreViewport(snapshot){
    const viewport=document.getElementById('cardsViewport');
    if(!viewport||!snapshot)return;
    viewport.scrollTop=snapshot.top;
    viewport.scrollLeft=snapshot.left;
  }

  function makeGhost(source,clientX,clientY){
    const img=source.querySelector('img');
    const ghost=document.createElement('div');
    ghost.id='kbsCardPointerGhost';
    ghost.setAttribute('aria-hidden','true');
    Object.assign(ghost.style,{
      position:'fixed',left:'0',top:'0',zIndex:'2147483646',pointerEvents:'none',
      width:'112px',padding:'5px',borderRadius:'10px',background:'rgba(35,28,55,.94)',
      border:'1px solid rgba(196,181,253,.58)',boxShadow:'0 16px 40px rgba(0,0,0,.42)',
      transform:'translate(-50%,-50%) rotate(2deg)',opacity:'.96'
    });
    if(img){
      const clone=img.cloneNode(true);
      clone.removeAttribute('id');
      Object.assign(clone.style,{display:'block',width:'100%',height:'auto',borderRadius:'7px'});
      ghost.appendChild(clone);
    }
    document.body.appendChild(ghost);
    moveGhost(ghost,clientX,clientY);
    return ghost;
  }

  function moveGhost(ghost,x,y){
    if(!ghost)return;
    ghost.style.left=`${x}px`;
    ghost.style.top=`${y}px`;
  }

  function cleanup(){
    if(!active)return;
    active.ghost?.remove();
    active.source?.classList.remove('kbs-pointer-dragging');
    document.documentElement.classList.remove('kbs-card-pointer-drag-active');
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('-webkit-user-select');
    active=null;
  }

  function beginDrag(event){
    if(!active||active.dragging)return;
    active.dragging=true;
    suppressClickUntil=Date.now()+500;
    active.source.classList.add('kbs-pointer-dragging');
    document.documentElement.classList.add('kbs-card-pointer-drag-active');
    document.body.style.userSelect='none';
    document.body.style.webkitUserSelect='none';
    active.ghost=makeGhost(active.source,event.clientX,event.clientY);
    restoreViewport(active.scroll);
  }

  function onPointerMove(event){
    if(!active||event.pointerId!==active.pointerId)return;
    const dx=event.clientX-active.startX;
    const dy=event.clientY-active.startY;
    if(!active.dragging&&Math.hypot(dx,dy)>=THRESHOLD)beginDrag(event);
    if(!active.dragging)return;
    event.preventDefault();
    moveGhost(active.ghost,event.clientX,event.clientY);
    restoreViewport(active.scroll);
  }

  function finishPointer(event,cancelled=false){
    if(!active||event.pointerId!==active.pointerId)return;
    const session=active;
    if(session.dragging){
      event.preventDefault();
      restoreViewport(session.scroll);
      if(!cancelled){
        const target=document.elementFromPoint(event.clientX,event.clientY);
        const pocket=target?.closest?.('#grid [data-pocket]');
        const index=Number(pocket?.dataset?.pocket);
        if(pocket&&Number.isInteger(index)&&session.card&&typeof place==='function'){
          place(index,session.card,null);
        }
      }
      queueMicrotask(()=>restoreViewport(session.scroll));
      requestAnimationFrame(()=>restoreViewport(session.scroll));
      setTimeout(()=>restoreViewport(session.scroll),40);
      setTimeout(()=>restoreViewport(session.scroll),140);
    }
    cleanup();
  }

  function onPointerDown(event){
    if(event.button!==0)return;
    if(event.pointerType==='touch')return;
    const source=event.target?.closest?.(CARD_SELECTOR);
    if(!source||event.target?.closest?.(IGNORE_SELECTOR))return;
    const card=cardFromElement(source);
    if(!card)return;
    // Disable the browser's native draggable path for card-browser cards.
    source.draggable=false;
    active={
      pointerId:event.pointerId,
      source,
      card,
      startX:event.clientX,
      startY:event.clientY,
      scroll:viewportSnapshot(),
      dragging:false,
      ghost:null
    };
  }

  function disableNativeDrag(root=document){
    root.querySelectorAll?.(CARD_SELECTOR).forEach(el=>{el.draggable=false;el.removeAttribute('draggable')});
  }

  document.addEventListener('pointerdown',onPointerDown,true);
  document.addEventListener('pointermove',onPointerMove,{capture:true,passive:false});
  document.addEventListener('pointerup',event=>finishPointer(event,false),true);
  document.addEventListener('pointercancel',event=>finishPointer(event,true),true);
  document.addEventListener('dragstart',event=>{
    if(event.target?.closest?.(CARD_SELECTOR)){event.preventDefault();event.stopImmediatePropagation()}
  },true);
  document.addEventListener('click',event=>{
    if(Date.now()<suppressClickUntil&&event.target?.closest?.(CARD_SELECTOR)){
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);

  disableNativeDrag();
  const cardsRoot=document.getElementById('cards');
  if(cardsRoot)new MutationObserver(()=>disableNativeDrag(cardsRoot)).observe(cardsRoot,{childList:true,subtree:true});

  globalThis.KBSCardBrowserPointerDrag={version:'1.0.0',installed:true};
})();
