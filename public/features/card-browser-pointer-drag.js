/* Stable drag/drop and scroll ownership for Matching Card Variants.
   Cards keep drag/drop behavior while the browser workspace remains at the exact
   same position through placement, save, image repair, and same-query reruns. */
(()=>{
  'use strict';

  if(globalThis.KBSCardBrowserPointerDrag?.installed)return;

  const CARD_SELECTOR='#cards .item[data-kind="card"], #cards .card-item';
  const IGNORE_SELECTOR='select,input,a,[data-remove-art],[data-size],.card-info,.card-feature-actions';
  const THRESHOLD=6;
  let active=null;
  let suppressClickUntil=0;
  let lastSearchKey='';

  function cardFromElement(el){
    const id=el?.dataset?.id||el?.querySelector?.('[data-select]')?.dataset?.select||'';
    if(!id||typeof cards==='undefined'||!Array.isArray(cards))return null;
    return cards.find(card=>String(card?.id)===String(id))||null;
  }

  function queryKey(){
    return [
      document.querySelector('#subject')?.value||'',
      document.querySelector('#setFilter')?.value||'',
      document.querySelector('#artistFilter')?.value||''
    ].map(v=>String(v)).join('\u241f');
  }

  function canScroll(node){
    if(!node||node===document.body||node===document.documentElement)return false;
    try{
      const style=getComputedStyle(node);
      const oy=style.overflowY,ox=style.overflowX;
      return ((/(auto|scroll|overlay)/).test(oy)&&node.scrollHeight>node.clientHeight+1)
        ||((/(auto|scroll|overlay)/).test(ox)&&node.scrollWidth>node.clientWidth+1);
    }catch{return false}
  }

  function captureScrollWorkspace(source=document.getElementById('cards')){
    const nodes=new Set();
    ['#cardsViewport','#cards','.variant-pane','.library'].forEach(selector=>{
      const node=document.querySelector(selector);if(node)nodes.add(node);
    });
    let node=source;
    while(node&&node!==document.body){if(canScroll(node))nodes.add(node);node=node.parentElement}
    const entries=[...nodes].map(node=>({node,top:node.scrollTop,left:node.scrollLeft}));
    const viewport=document.getElementById('cardsViewport');
    return {
      entries,
      viewportTop:viewport?.scrollTop||0,
      viewportLeft:viewport?.scrollLeft||0,
      windowX:window.scrollX,
      windowY:window.scrollY,
      createdAt:Date.now()
    };
  }

  function restoreScrollWorkspace(snapshot,{restoreWindow=false}={}){
    if(!snapshot)return;
    for(const entry of snapshot.entries||[]){
      const node=entry.node;
      if(!node?.isConnected)continue;
      if(node.scrollTop!==entry.top)node.scrollTop=entry.top;
      if(node.scrollLeft!==entry.left)node.scrollLeft=entry.left;
    }
    const viewport=document.getElementById('cardsViewport');
    if(viewport){
      if(viewport.scrollTop!==snapshot.viewportTop)viewport.scrollTop=snapshot.viewportTop;
      if(viewport.scrollLeft!==snapshot.viewportLeft)viewport.scrollLeft=snapshot.viewportLeft;
    }
    if(restoreWindow&&(window.scrollX!==snapshot.windowX||window.scrollY!==snapshot.windowY))window.scrollTo(snapshot.windowX,snapshot.windowY);
  }

  function stabilizeWorkspace(snapshot,duration=1800){
    if(!snapshot)return;
    const started=performance.now();
    const tick=now=>{
      restoreScrollWorkspace(snapshot,{restoreWindow:true});
      if(now-started<duration)requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    [0,40,120,240,450,800,1200,1750].forEach(ms=>setTimeout(()=>restoreScrollWorkspace(snapshot,{restoreWindow:true}),ms));
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
      const clone=img.cloneNode(true);clone.removeAttribute('id');
      Object.assign(clone.style,{display:'block',width:'100%',height:'auto',borderRadius:'7px'});
      ghost.appendChild(clone);
    }
    document.body.appendChild(ghost);moveGhost(ghost,clientX,clientY);return ghost;
  }

  function moveGhost(ghost,x,y){if(ghost){ghost.style.left=`${x}px`;ghost.style.top=`${y}px`}}

  function setPocketHover(clientX,clientY){
    document.querySelectorAll('#grid .kbs-pointer-drop-target').forEach(el=>el.classList.remove('kbs-pointer-drop-target'));
    document.elementFromPoint(clientX,clientY)?.closest?.('#grid [data-pocket]')?.classList.add('kbs-pointer-drop-target');
  }

  function cleanup(){
    if(!active)return;
    active.ghost?.remove();active.source?.classList.remove('kbs-pointer-dragging');
    document.querySelectorAll('#grid .kbs-pointer-drop-target').forEach(el=>el.classList.remove('kbs-pointer-drop-target'));
    document.documentElement.classList.remove('kbs-card-pointer-drag-active');
    document.body.style.removeProperty('user-select');document.body.style.removeProperty('-webkit-user-select');active=null;
  }

  function beginDrag(event){
    if(!active||active.dragging)return;
    active.dragging=true;suppressClickUntil=Date.now()+600;
    active.source.classList.add('kbs-pointer-dragging');document.documentElement.classList.add('kbs-card-pointer-drag-active');
    document.body.style.userSelect='none';document.body.style.webkitUserSelect='none';
    active.ghost=makeGhost(active.source,event.clientX,event.clientY);restoreScrollWorkspace(active.scroll,{restoreWindow:true});
  }

  function onPointerMove(event){
    if(!active||event.pointerId!==active.pointerId)return;
    const dx=event.clientX-active.startX,dy=event.clientY-active.startY;
    if(!active.dragging&&Math.hypot(dx,dy)>=THRESHOLD)beginDrag(event);
    if(!active.dragging)return;
    event.preventDefault();moveGhost(active.ghost,event.clientX,event.clientY);setPocketHover(event.clientX,event.clientY);
    restoreScrollWorkspace(active.scroll,{restoreWindow:true});
  }

  function finishPointer(event,cancelled=false){
    if(!active||event.pointerId!==active.pointerId)return;
    const session=active;
    if(session.dragging){
      event.preventDefault();restoreScrollWorkspace(session.scroll,{restoreWindow:true});
      if(!cancelled){
        const target=document.elementFromPoint(event.clientX,event.clientY);
        const pocket=target?.closest?.('#grid [data-pocket]');const index=Number(pocket?.dataset?.pocket);
        if(pocket&&Number.isInteger(index)&&session.card&&typeof place==='function')place(index,session.card,null);
      }
      stabilizeWorkspace(session.scroll,1800);
    }
    cleanup();
  }

  function onPointerDown(event){
    if(event.button!==0||event.pointerType==='touch')return;
    const source=event.target?.closest?.(CARD_SELECTOR);
    if(!source||event.target?.closest?.(IGNORE_SELECTOR))return;
    const card=cardFromElement(source);if(!card)return;
    source.draggable=false;
    active={pointerId:event.pointerId,source,card,startX:event.clientX,startY:event.clientY,scroll:captureScrollWorkspace(source),dragging:false,ghost:null};
  }

  function disableNativeDrag(root=document){root.querySelectorAll?.(CARD_SELECTOR).forEach(el=>{el.draggable=false;el.removeAttribute('draggable')})}

  function installSameQuerySearchGuard(){
    if(typeof search!=='function'||search.__kbsSameQueryScrollGuard)return;
    const original=search;
    lastSearchKey=queryKey();
    const wrapped=async function(...args){
      const key=queryKey();
      if(key===lastSearchKey&&typeof runCardSearch==='function'){
        const snapshot=captureScrollWorkspace();
        const result=await runCardSearch.apply(this,args);
        stabilizeWorkspace(snapshot,700);
        return result;
      }
      lastSearchKey=key;
      return original.apply(this,args);
    };
    wrapped.__kbsSameQueryScrollGuard=true;wrapped.__kbsOriginal=original;search=wrapped;

    const remember=()=>queueMicrotask(()=>{lastSearchKey=queryKey()});
    document.querySelector('#searchBtn')?.addEventListener('click',remember);
    document.querySelector('#setFilter')?.addEventListener('change',remember);
    document.querySelector('#artistFilter')?.addEventListener('change',remember);
    document.querySelector('#clearArtist')?.addEventListener('click',remember);
    document.querySelector('#subject')?.addEventListener('keydown',event=>{if(event.key==='Enter')remember()});
  }

  document.addEventListener('pointerdown',onPointerDown,true);
  document.addEventListener('pointermove',onPointerMove,{capture:true,passive:false});
  document.addEventListener('pointerup',event=>finishPointer(event,false),true);
  document.addEventListener('pointercancel',event=>finishPointer(event,true),true);
  document.addEventListener('dragstart',event=>{if(event.target?.closest?.(CARD_SELECTOR)){event.preventDefault();event.stopImmediatePropagation()}},true);
  document.addEventListener('click',event=>{if(Date.now()<suppressClickUntil&&event.target?.closest?.(CARD_SELECTOR)){event.preventDefault();event.stopImmediatePropagation()}},true);

  disableNativeDrag();
  const cardsRoot=document.getElementById('cards');
  if(cardsRoot)new MutationObserver(()=>disableNativeDrag(cardsRoot)).observe(cardsRoot,{childList:true,subtree:true});
  installSameQuerySearchGuard();
  setTimeout(installSameQuerySearchGuard,500);

  globalThis.KBSCardBrowserPointerDrag={version:'1.1.0',installed:true,captureScrollWorkspace};
})();
