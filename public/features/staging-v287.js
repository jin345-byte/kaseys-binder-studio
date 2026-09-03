/* Binder Studio v2.8.13 staging — vertical page rail + desktop artwork height sync */
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
