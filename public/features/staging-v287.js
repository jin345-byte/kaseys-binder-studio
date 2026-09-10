/* Binder Studio v4.0.3 preview — page rail + compatibility + retry-safe lazy feature loading — full sanity rerun marker 2026-09-10-r9 */
(function(){
  function loadStyle(href,id){
    if(document.getElementById(id))return;
    if(globalThis.KBSModules?.lazy?.style)return globalThis.KBSModules.lazy.style(href,id);
    const l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=href;l.onerror=()=>l.remove();document.head.appendChild(l);
  }
  function loadScript(src,id){
    const existing=document.getElementById(id);
    if(existing?.dataset?.kbsLoaded==='1')return Promise.resolve();
    if(globalThis.KBSModules?.lazy?.script)return globalThis.KBSModules.lazy.script(src,id);
    if(existing)existing.remove();
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.id=id;s.src=src;s.onload=()=>{s.dataset.kbsLoaded='1';resolve()};s.onerror=()=>{s.remove();reject(new Error('Could not load '+src))};document.head.appendChild(s)});
  }
  loadStyle('styles/full-themes.css?v=3.0.5','kbsFullThemesStyle');
  loadStyle('styles/theme-picker-fit.css?v=3.0.2','kbsThemePickerFitStyle');
  loadStyle('styles/responsive-button-fit.css?v=3.3.4','kbsResponsiveButtonFitStyle');
  loadStyle('styles/ui-readability-fixes.css?v=3.5.5','kbsUiReadabilityFixesStyle');
  loadStyle('styles/theme-animated-accents.css?v=3.4.1','kbsThemeAnimatedAccentsStyle');
  loadStyle('styles/focus-presentation-mode.css?v=3.3.3','kbsFocusPresentationStyle');
  loadStyle('styles/layout-overlap-fixes.css?v=4.0.3.1','kbsLayoutOverlapFixesStyle');
  loadScript('features/full-themes.js?v=3.4.1','kbsFullThemesScript').catch(console.warn);
  loadScript('features/theme-picker-fit.js?v=3.0.2','kbsThemePickerFitScript').catch(console.warn);
  loadScript('features/focus-presentation-mode.js?v=3.3.3','kbsFocusPresentationScript').catch(console.warn);
  loadScript('features/artwork-legacy-repair.js?v=2.9.1','kbsArtworkLegacyRepairScript').catch(console.warn);
  let coverLoaded=false,coverLoading=null;
  async function loadCoverDesigner(){
    if(coverLoaded)return;if(coverLoading)return coverLoading;
    loadStyle('styles/binder-cover-designer.css?v=3.1.1','kbsBinderCoverDesignerStyle');
    coverLoading=loadScript('features/binder-cover-designer.js?v=3.1.1','kbsBinderCoverDesignerScript').then(()=>{coverLoaded=true}).catch(err=>{coverLoading=null;throw err});
    return coverLoading;
  }
  document.querySelector('#openBinders')?.addEventListener('click',()=>loadCoverDesigner().catch(console.warn),{capture:true});
  document.querySelector('#mobilePageBinders')?.addEventListener('click',()=>loadCoverDesigner().catch(console.warn),{capture:true});
  let sourceLinksLoaded=false,sourceLinksLoading=null;
  async function loadArtworkSources(){
    if(sourceLinksLoaded)return;if(sourceLinksLoading)return sourceLinksLoading;
    sourceLinksLoading=loadScript('features/art-source-links.js?v=2.9.1','kbsArtSourceLinksScript').then(()=>{sourceLinksLoaded=true}).catch(err=>{sourceLinksLoading=null;throw err});
    return sourceLinksLoading;
  }
  document.querySelector('#libraryArtworkTab')?.addEventListener('click',()=>loadArtworkSources().catch(console.warn),{capture:true});
  document.querySelector('[data-mobile-lab="art"]')?.addEventListener('click',()=>loadArtworkSources().catch(console.warn),{capture:true});
  let productivityLoaded=false,productivityLoading=null;
  function loadProductivity(){
    if(productivityLoaded)return Promise.resolve();if(productivityLoading)return productivityLoading;
    loadStyle('styles/productivity-suite.css?v=3.5.0','kbsProductivitySuiteStyle');
    productivityLoading=loadScript('features/productivity-suite.js?v=3.5.0','kbsProductivitySuiteScript').then(()=>{productivityLoaded=true;removeProductivityTriggers()}).catch(err=>{productivityLoading=null;throw err});
    return productivityLoading;
  }
  const productivityEvents=['pointerdown','keydown','touchstart'];
  const productivityTrigger=()=>loadProductivity().catch(console.warn);
  function removeProductivityTriggers(){productivityEvents.forEach(name=>document.removeEventListener(name,productivityTrigger,true))}
  productivityEvents.forEach(name=>document.addEventListener(name,productivityTrigger,{capture:true,passive:name==='pointerdown'||name==='touchstart'}));
  const numbers=document.querySelector('#editorPageNumbers');if(!numbers)return;let lastActive='';
  function activeButton(){return numbers.querySelector('.page-number.active,.page-number[aria-current="page"]')}
  function revealAndAnimate(){const active=activeButton();if(!active)return;const key=active.dataset.pageId||active.dataset.page||active.textContent?.trim()||'';active.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});if(key&&key!==lastActive){lastActive=key;active.classList.remove('page-switch-pop');void active.offsetWidth;active.classList.add('page-switch-pop');setTimeout(()=>active.classList.remove('page-switch-pop'),380)}}
  new MutationObserver(()=>requestAnimationFrame(revealAndAnimate)).observe(numbers,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-current']});
  numbers.addEventListener('click',()=>setTimeout(revealAndAnimate,40));
  document.querySelector('#editorPrev')?.addEventListener('click',()=>setTimeout(revealAndAnimate,80));
  document.querySelector('#editorNext')?.addEventListener('click',()=>setTimeout(revealAndAnimate,80));
  setTimeout(revealAndAnimate,250);
})();