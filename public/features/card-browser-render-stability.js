/* Keep Matching Card Variants stable unless the actual browser results change.
   Prevents binder placement, autosave, image repair, or other unrelated editor work
   from rebuilding #cards and resetting the user's scroll position. */
(()=>{
  'use strict';

  let installed=false;
  let lastSignature='';
  let lastQueryKey='';

  function text(value){return String(value??'')}
  function queryKey(){
    return [
      document.querySelector('#subject')?.value||'',
      document.querySelector('#setFilter')?.value||'',
      document.querySelector('#artistFilter')?.value||''
    ].map(text).join('\u241f');
  }

  // IMPORTANT: this signature must use immutable card identity only.
  // Image URLs, fallbacks, rarity labels and other presentation fields may be
  // repaired/mutated asynchronously and must never make the tray look "new".
  function resultSignature(){
    if(typeof cards==='undefined'||!Array.isArray(cards))return '';
    return cards.map((card,index)=>[
      card?.id||card?.primaryId||card?.sourceKey||`row-${index}`,
      card?.setId||card?.rawSetId||'',
      card?.localId||'',
      card?.language||'',
      card?.catalog||''
    ].map(text).join('\u241e')).join('\u241d');
  }

  function snapshotScroll(){
    const viewport=document.querySelector('#cardsViewport');
    return viewport?{top:viewport.scrollTop,left:viewport.scrollLeft}:null;
  }
  function restoreScroll(snapshot){
    if(!snapshot)return;
    const viewport=document.querySelector('#cardsViewport');
    if(!viewport)return;
    viewport.scrollTop=snapshot.top;
    viewport.scrollLeft=snapshot.left;
  }
  function restoreAfterLayout(snapshot){
    if(!snapshot)return;
    const restore=()=>restoreScroll(snapshot);
    restore();
    queueMicrotask(restore);
    requestAnimationFrame(()=>{restore();requestAnimationFrame(restore)});
    setTimeout(restore,40);
    setTimeout(restore,120);
    setTimeout(restore,260);
    setTimeout(restore,600);
  }
  function updateCountOnly(){
    try{
      const count=document.querySelector('#count');
      if(count&&Array.isArray(cards))count.textContent=cards.length.toLocaleString();
    }catch{}
  }
  function gridHasCards(){
    const grid=document.querySelector('#cards');
    return Boolean(grid&&grid.querySelector('.card-item,[data-id]'));
  }

  function install(){
    if(installed)return true;
    if(typeof renderAllCardsStable!=='function'||typeof renderCards!=='function')return false;

    const originalStable=renderAllCardsStable;
    const originalRender=renderCards;

    renderAllCardsStable=function(...args){
      const nextQuery=queryKey();
      const nextSignature=resultSignature();
      const sameQuery=nextQuery===lastQueryKey;
      const sameResults=nextSignature===lastSignature;

      // If the actual result identities are unchanged, never touch #cards.
      // This keeps scroll position, focus, loaded images and drag state intact.
      if(sameQuery&&sameResults&&gridHasCards()){
        updateCountOnly();
        return;
      }

      const previousScroll=sameQuery?snapshotScroll():null;
      const result=originalStable.apply(this,args);
      lastQueryKey=nextQuery;
      lastSignature=nextSignature;
      if(previousScroll)restoreAfterLayout(previousScroll);
      return result;
    };
    renderAllCardsStable.__kbsStableBrowserDom=true;

    renderCards=function(...args){
      const nextQuery=queryKey();
      const nextSignature=resultSignature();
      if(nextQuery===lastQueryKey&&nextSignature===lastSignature&&gridHasCards()){
        updateCountOnly();
        return;
      }
      return renderAllCardsStable.apply(this,args);
    };
    renderCards.__kbsStableBrowserDom=true;
    renderCards.__kbsCountWrapped=originalRender.__kbsCountWrapped||false;
    renderCards.__kbsProductionFullSet=originalRender.__kbsProductionFullSet||false;

    lastQueryKey=queryKey();
    lastSignature=resultSignature();
    installed=true;
    globalThis.KBSCardBrowserRenderStability={version:'1.2.0',installed:true};
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(install()||attempts>=20)clearInterval(timer);
    },250);
  }
})();
