/* Legacy Matching Card Variants stability fallback.
   V2 owns its own DOM and must not be wrapped by the old renderer guard. */
(()=>{
  'use strict';
  if(globalThis.KBSCardVariantsV2?.installed)return;

  let installed=false;
  let lastSignature='';
  let lastQueryKey='';

  function text(value){return String(value??'')}
  function queryKey(){return [document.querySelector('#subject')?.value||'',document.querySelector('#setFilter')?.value||'',document.querySelector('#artistFilter')?.value||''].map(text).join('\u241f')}
  function resultSignature(){if(typeof cards==='undefined'||!Array.isArray(cards))return '';return cards.map((card,index)=>[card?.id||card?.primaryId||card?.sourceKey||`row-${index}`,card?.setId||card?.rawSetId||'',card?.localId||'',card?.language||'',card?.catalog||''].map(text).join('\u241e')).join('\u241d')}
  function snapshotScroll(){const viewport=document.querySelector('#cardsViewport');return viewport?{top:viewport.scrollTop,left:viewport.scrollLeft}:null}
  function restoreScroll(snapshot){if(!snapshot)return;const viewport=document.querySelector('#cardsViewport');if(viewport){viewport.scrollTop=snapshot.top;viewport.scrollLeft=snapshot.left}}
  function updateCountOnly(){try{const count=document.querySelector('#count');if(count&&Array.isArray(cards))count.textContent=cards.length.toLocaleString()}catch{}}
  function gridHasCards(){const grid=document.querySelector('#cards');return Boolean(grid&&grid.querySelector('.card-item,[data-id]'))}

  function install(){
    if(globalThis.KBSCardVariantsV2?.installed)return true;
    if(installed)return true;
    if(typeof renderAllCardsStable!=='function'||typeof renderCards!=='function')return false;
    const originalStable=renderAllCardsStable;
    renderAllCardsStable=function(...args){
      if(globalThis.KBSCardVariantsV2?.installed)return globalThis.KBSCardVariantsV2.render?.();
      const nextQuery=queryKey(),nextSignature=resultSignature();
      if(nextQuery===lastQueryKey&&nextSignature===lastSignature&&gridHasCards()){updateCountOnly();return}
      const previous=nextQuery===lastQueryKey?snapshotScroll():null;
      const result=originalStable.apply(this,args);lastQueryKey=nextQuery;lastSignature=nextSignature;
      if(previous)requestAnimationFrame(()=>restoreScroll(previous));
      return result;
    };
    renderCards=function(...args){
      if(globalThis.KBSCardVariantsV2?.installed)return globalThis.KBSCardVariantsV2.render?.();
      const nextQuery=queryKey(),nextSignature=resultSignature();
      if(nextQuery===lastQueryKey&&nextSignature===lastSignature&&gridHasCards()){updateCountOnly();return}
      return renderAllCardsStable.apply(this,args);
    };
    lastQueryKey=queryKey();lastSignature=resultSignature();installed=true;
    globalThis.KBSCardBrowserRenderStability={version:'1.3.0-fallback',installed:true};return true;
  }
  if(!install()){let attempts=0;const timer=setInterval(()=>{attempts++;if(globalThis.KBSCardVariantsV2?.installed||install()||attempts>=20)clearInterval(timer)},250)}
})();
