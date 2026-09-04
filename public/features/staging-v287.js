/* Binder Studio v2.8.15 staging — vertical page rail + artwork height + tour finish */
(function(){
  /* This staging hook is already proven to execute on the live Worker. Load the
     dedicated height module from a new URL so an old cached polish script cannot
     leave the Artwork panel short. */
  if(!document.querySelector('script[data-kbs-artwork-height-sync]')){
    const script=document.createElement('script');
    script.src='/features/artwork-height-sync.js?v=2.8.13';
    script.dataset.kbsArtworkHeightSync='1';
    document.head.appendChild(script);
  }

  /* Guided tour completion extension. Kept separate from the original tour so
     the working demonstration remains untouched while its ending is upgraded. */
  if(!document.querySelector('link[data-kbs-guided-finish]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/features/guided-finish.css?v=2.8.15';
    link.dataset.kbsGuidedFinish='1';
    document.head.appendChild(link);
  }
  if(!document.querySelector('script[data-kbs-guided-finish]')){
    const script=document.createElement('script');
    script.src='/features/guided-tour-finish.js?v=2.8.15';
    script.dataset.kbsGuidedFinish='1';
    document.body.appendChild(script);
  }
  if(!document.querySelector('script[data-kbs-guided-step16-fix]')){
    const script=document.createElement('script');
    script.src='/features/guided-tour-step16-fix.js?v=2.8.15';
    script.dataset.kbsGuidedStep16Fix='1';
    document.body.appendChild(script);
  }

  const numbers=document.querySelector('#editorPageNumbers');
  if(!numbers)return;
  let lastActive='';

  function activeButton(){return numbers.querySelector('.page-number.active,.page-number[aria-current="page"]')}
  function revealAndAnimate(){
    const active=activeButton();
    if(!active)return;
    const key=active.dataset.pageId||active.dataset.page||active.textContent?.trim()||'';
    active.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
    if(key&&key!==lastActive){
      lastActive=key;
      active.classList.remove('page-switch-pop');
      void active.offsetWidth;
      active.classList.add('page-switch-pop');
      setTimeout(()=>active.classList.remove('page-switch-pop'),380);
    }
  }

  new MutationObserver(()=>requestAnimationFrame(revealAndAnimate)).observe(numbers,{
    childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-current']
  });
  numbers.addEventListener('click',()=>setTimeout(revealAndAnimate,40));
  document.querySelector('#editorPrev')?.addEventListener('click',()=>setTimeout(revealAndAnimate,80));
  document.querySelector('#editorNext')?.addEventListener('click',()=>setTimeout(revealAndAnimate,80));
  setTimeout(revealAndAnimate,250);
})();
