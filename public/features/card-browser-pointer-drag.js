/* Stable drag/drop and persistent scroll memory for Matching Card Variants.
   The variants panel owns its scroll position. Binder placement, focus changes,
   late renders, and same-query reruns must not move it. */
(()=>{
  'use strict';

  if(globalThis.KBSCardBrowserPointerDrag?.installed)return;

  const CARD_SELECTOR='#cards .item[data-kind="card"], #cards .card-item';
  const IGNORE_SELECTOR='select,input,a,[data-remove-art],[data-size],.card-info,.card-feature-actions';
  const THRESHOLD=6;
  let active=null;
  let suppressClickUntil=0;
  let restoring=false;
  let memory={key:'',top:0,left:0};

  const viewport=()=>document.getElementById('cardsViewport');
  const variants=()=>document.querySelector('.variant-pane');

  function queryKey(){
    return [
      document.querySelector('#subject')?.value||'',
      document.querySelector('#setFilter')?.value||'',
      document.querySelector('#artistFilter')?.value||''
    ].map(v=>String(v)).join('\u241f');
  }

  function remember(){
    if(restoring)return;
    const v=viewport();if(!v)return;
    memory={key:queryKey(),top:v.scrollTop,left:v.scrollLeft};
  }

  function restore(saved=memory){
    const v=viewport();
    if(!v||!saved||saved.key!==queryKey())return;
    restoring=true;
    try{
      if(v.scrollTop!==saved.top)v.scrollTop=saved.top;
      if(v.scrollLeft!==saved.left)v.scrollLeft=saved.left;
    }finally{restoring=false}
  }

  function restoreAfter(saved=memory){
    if(!saved||saved.key!==queryKey())return;
    const run=()=>restore(saved);
    queueMicrotask(run);
    requestAnimationFrame(()=>{run();requestAnimationFrame(run)});
    [40,120,300,700,1500,3000].forEach(ms=>setTimeout(run,ms));
  }

  function cardFromElement(el){
    const id=el?.dataset?.id||el?.querySelector?.('[data-select]')?.dataset?.select||'';
    if(!id||typeof cards==='undefined'||!Array.isArray(cards))return null;
    return cards.find(card=>String(card?.id)===String(id))||null;
  }

  function makeGhost(source,x,y){
    const img=source.querySelector('img');
    const ghost=document.createElement('div');
    ghost.id='kbsCardPointerGhost';ghost.setAttribute('aria-hidden','true');
    Object.assign(ghost.style,{position:'fixed',left:'0',top:'0',zIndex:'2147483646',pointerEvents:'none',width:'112px',padding:'5px',borderRadius:'10px',background:'rgba(35,28,55,.94)',border:'1px solid rgba(196,181,253,.58)',boxShadow:'0 16px 40px rgba(0,0,0,.42)',transform:'translate(-50%,-50%) rotate(2deg)',opacity:'.96'});
    if(img){const clone=img.cloneNode(true);clone.removeAttribute('id');Object.assign(clone.style,{display:'block',width:'100%',height:'auto',borderRadius:'7px'});ghost.appendChild(clone)}
    document.body.appendChild(ghost);moveGhost(ghost,x,y);return ghost;
  }

  function moveGhost(ghost,x,y){if(ghost){ghost.style.left=`${x}px`;ghost.style.top=`${y}px`}}

  function setPocketHover(x,y){
    document.querySelectorAll('#grid .kbs-pointer-drop-target').forEach(el=>el.classList.remove('kbs-pointer-drop-target'));
    document.elementFromPoint(x,y)?.closest?.('#grid [data-pocket]')?.classList.add('kbs-pointer-drop-target');
  }

  function cleanup(){
    if(!active)return;
    active.ghost?.remove();active.source?.classList.remove('kbs-pointer-dragging');
    document.querySelectorAll('#grid .kbs-pointer-drop-target').forEach(el=>el.classList.remove('kbs-pointer-drop-target'));
    document.documentElement.classList.remove('kbs-card-pointer-drag-active');
    document.body.style.removeProperty('user-select');document.body.style.removeProperty('-webkit-user-select');
    active=null;
  }

  function beginDrag(event){
    if(!active||active.dragging)return;
    active.dragging=true;suppressClickUntil=Date.now()+600;
    active.source.classList.add('kbs-pointer-dragging');
    document.documentElement.classList.add('kbs-card-pointer-drag-active');
    document.body.style.userSelect='none';document.body.style.webkitUserSelect='none';
    active.ghost=makeGhost(active.source,event.clientX,event.clientY);
    restore(active.scroll);
  }

  function onPointerMove(event){
    if(!active||event.pointerId!==active.pointerId)return;
    const dx=event.clientX-active.startX,dy=event.clientY-active.startY;
    if(!active.dragging&&Math.hypot(dx,dy)>=THRESHOLD)beginDrag(event);
    if(!active.dragging)return;
    event.preventDefault();
    moveGhost(active.ghost,event.clientX,event.clientY);setPocketHover(event.clientX,event.clientY);
    restore(active.scroll);
  }

  function finishPointer(event,cancelled=false){
    if(!active||event.pointerId!==active.pointerId)return;
    const session=active;
    if(session.dragging){
      event.preventDefault();restore(session.scroll);
      if(!cancelled){
        const target=document.elementFromPoint(event.clientX,event.clientY);
        const pocket=target?.closest?.('#grid [data-pocket]');const index=Number(pocket?.dataset?.pocket);
        if(pocket&&Number.isInteger(index)&&session.card&&typeof place==='function')place(index,session.card,null);
      }
      memory=session.scroll;
      restoreAfter(session.scroll);
    }
    cleanup();
  }

  function onPointerDown(event){
    if(event.button!==0||event.pointerType==='touch')return;
    const source=event.target?.closest?.(CARD_SELECTOR);
    if(!source||event.target?.closest?.(IGNORE_SELECTOR))return;
    const card=cardFromElement(source);if(!card)return;
    source.draggable=false;remember();
    active={pointerId:event.pointerId,source,card,startX:event.clientX,startY:event.clientY,scroll:{...memory},dragging:false,ghost:null};
  }

  function disableNativeDrag(root=document){root.querySelectorAll?.(CARD_SELECTOR).forEach(el=>{el.draggable=false;el.removeAttribute('draggable')})}

  function installSameQuerySearchGuard(){
    if(typeof search!=='function'||search.__kbsPersistentVariantScroll)return;
    const original=search;
    const wrapped=async function(...args){
      const key=queryKey();
      const same=key===memory.key;
      if(same&&typeof runCardSearch==='function'){
        const saved={...memory};
        const result=await runCardSearch.apply(this,args);
        restoreAfter(saved);
        return result;
      }
      memory={key,top:0,left:0};
      return original.apply(this,args);
    };
    wrapped.__kbsPersistentVariantScroll=true;wrapped.__kbsOriginal=original;search=wrapped;
  }

  function installPersistentMemory(){
    const v=viewport(),pane=variants(),root=document.getElementById('cards');
    if(!v)return;
    memory={key:queryKey(),top:v.scrollTop,left:v.scrollLeft};
    v.addEventListener('scroll',remember,{passive:true});

    // Clicking/focusing elsewhere must not discard the card-browser workspace.
    document.addEventListener('pointerdown',event=>{
      if(pane?.contains(event.target))return;
      const saved={...memory};
      queueMicrotask(()=>restore(saved));
      requestAnimationFrame(()=>restore(saved));
      setTimeout(()=>restore(saved),80);
    },true);
    pane?.addEventListener('focusout',()=>restoreAfter({...memory}),true);

    // Late card decorators/image repair may mutate the grid after placement.
    // Preserve the user's row whenever the query itself did not change.
    if(root)new MutationObserver(()=>{
      disableNativeDrag(root);
      const saved={...memory};
      if(saved.key===queryKey())restoreAfter(saved);
    }).observe(root,{childList:true,subtree:true});
  }

  document.addEventListener('pointerdown',onPointerDown,true);
  document.addEventListener('pointermove',onPointerMove,{capture:true,passive:false});
  document.addEventListener('pointerup',event=>finishPointer(event,false),true);
  document.addEventListener('pointercancel',event=>finishPointer(event,true),true);
  document.addEventListener('dragstart',event=>{if(event.target?.closest?.(CARD_SELECTOR)){event.preventDefault();event.stopImmediatePropagation()}},true);
  document.addEventListener('click',event=>{if(Date.now()<suppressClickUntil&&event.target?.closest?.(CARD_SELECTOR)){event.preventDefault();event.stopImmediatePropagation()}},true);

  disableNativeDrag();
  installPersistentMemory();
  installSameQuerySearchGuard();
  setTimeout(installSameQuerySearchGuard,500);

  globalThis.KBSCardBrowserPointerDrag={version:'1.2.0',installed:true,getScrollMemory:()=>({...memory})};
})();
