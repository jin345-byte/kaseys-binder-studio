/* Binder Studio v2.8.7 staging — vertical page rail interaction */
(function(){
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
