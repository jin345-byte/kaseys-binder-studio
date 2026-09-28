/* Preserve Matching Card Variants while changing binder pages.
   Binder pages are editor state; the card browser is workspace state and should
   not be rebuilt just because the active binder page changes. */
(()=>{
  'use strict';

  let preservingPageSwitch=false;
  let savedScroll=null;

  function captureScroll(){
    const viewport=document.getElementById('cardsViewport');
    const grid=document.getElementById('cards');
    return {
      viewportTop:viewport?.scrollTop||0,
      viewportLeft:viewport?.scrollLeft||0,
      gridTop:grid?.scrollTop||0,
      gridLeft:grid?.scrollLeft||0
    };
  }

  function restoreScroll(snapshot){
    if(!snapshot)return;
    const viewport=document.getElementById('cardsViewport');
    const grid=document.getElementById('cards');
    if(viewport){viewport.scrollTop=snapshot.viewportTop;viewport.scrollLeft=snapshot.viewportLeft}
    if(grid){grid.scrollTop=snapshot.gridTop;grid.scrollLeft=snapshot.gridLeft}
  }

  function restoreAfterLayout(snapshot){
    const restore=()=>restoreScroll(snapshot);
    restore();
    queueMicrotask(restore);
    requestAnimationFrame(()=>{restore();requestAnimationFrame(restore)});
    setTimeout(restore,40);
    setTimeout(restore,120);
    setTimeout(restore,260);
  }

  function setValue(id,value){
    const node=document.getElementById(id);
    if(node)node.value=value??'';
  }

  function install(){
    if(typeof rerenderEditor!=='function'||typeof loadPageIntoEditor!=='function')return false;
    if(loadPageIntoEditor.__kbsPreservesCardBrowser)return true;

    const originalRerender=rerenderEditor;
    rerenderEditor=function(...args){
      if(!preservingPageSwitch)return originalRerender.apply(this,args);

      const snapshot=savedScroll||captureScroll();
      try{
        setValue('subject',state?.subject||'');
        setValue('layout',state?.layout||'3x3');
        setValue('binderColor',state?.binderColor||'#111827');
        setValue('pageColor',state?.pageColor||'#080b12');
        setValue('sleeveColor',state?.sleeveColor||'#334155');

        // A selection belongs to the previous binder page, but the card search
        // results themselves belong to the workspace and must remain untouched.
        selected=null;
        if(typeof renderHeader==='function')renderHeader();
        if(typeof renderArts==='function')renderArts();
        if(typeof renderSelected==='function')renderSelected();
        if(typeof renderGrid==='function')renderGrid();
        restoreAfterLayout(snapshot);
        return;
      }catch(error){
        console.warn('Could not preserve card browser during page change',error);
        return originalRerender.apply(this,args);
      }
    };

    const originalLoadPage=loadPageIntoEditor;
    const wrappedLoadPage=async function(...args){
      const snapshot=captureScroll();
      savedScroll=snapshot;
      preservingPageSwitch=true;
      try{
        return await originalLoadPage.apply(this,args);
      }finally{
        preservingPageSwitch=false;
        restoreAfterLayout(snapshot);
        setTimeout(()=>{if(savedScroll===snapshot)savedScroll=null},320);
      }
    };
    wrappedLoadPage.__kbsPreservesCardBrowser=true;
    loadPageIntoEditor=wrappedLoadPage;
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
