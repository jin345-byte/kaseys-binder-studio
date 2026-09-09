/* Binder Studio v2.9.1 staging — vertical page rail + artwork compatibility helpers */
(function(){
  function loadStyle(href,id){if(document.getElementById(id))return;const l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=href;document.head.appendChild(l);}
  function loadScript(src,id){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src;s.defer=false;document.head.appendChild(s);}
  loadStyle('styles/full-themes.css?v=3.0.5','kbsFullThemesStyle');
  loadStyle('styles/theme-picker-fit.css?v=3.0.2','kbsThemePickerFitStyle');
  loadStyle('styles/binder-cover-designer.css?v=3.1.1','kbsBinderCoverDesignerStyle');
  loadStyle('styles/physical-binder-preview.css?v=3.2.1','kbsPhysicalBinderPreviewStyle');
  loadScript('features/full-themes.js?v=3.0.5','kbsFullThemesScript');
  loadScript('features/theme-picker-fit.js?v=3.0.2','kbsThemePickerFitScript');
  loadScript('features/binder-cover-designer.js?v=3.1.1','kbsBinderCoverDesignerScript');
  loadScript('features/physical-binder-preview.js?v=3.2.1','kbsPhysicalBinderPreviewScript');
  loadScript('features/artwork-legacy-repair.js?v=2.9.1','kbsArtworkLegacyRepairScript');
  loadScript('features/art-source-links.js?v=2.9.1','kbsArtSourceLinksScript');

  const numbers=document.querySelector('#editorPageNumbers');if(!numbers)return;let lastActive='';
  function activeButton(){return numbers.querySelector('.page-number.active,.page-number[aria-current="page"]')}
  function revealAndAnimate(){const active=activeButton();if(!active)return;const key=active.dataset.pageId||active.dataset.page||active.textContent?.trim()||'';active.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});if(key&&key!==lastActive){lastActive=key;active.classList.remove('page-switch-pop');void active.offsetWidth;active.classList.add('page-switch-pop');setTimeout(()=>active.classList.remove('page-switch-pop'),380)}}
  new MutationObserver(()=>requestAnimationFrame(revealAndAnimate)).observe(numbers,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-current']});
  numbers.addEventListener('click',()=>setTimeout(revealAndAnimate,40));
  document.querySelector('#editorPrev')?.addEventListener('click',()=>setTimeout(revealAndAnimate,80));
  document.querySelector('#editorNext')?.addEventListener('click',()=>setTimeout(revealAndAnimate,80));
  setTimeout(revealAndAnimate,250);
})();
