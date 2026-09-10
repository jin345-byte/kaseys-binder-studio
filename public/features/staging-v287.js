/* Binder Studio v4.0.1 preview — page rail + compatibility + lazy feature loading */
(function(){
  function loadStyle(href,id){
    if(document.getElementById(id))return;
    if(globalThis.KBSModules?.lazy?.style)return globalThis.KBSModules.lazy.style(href,id);
    const l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=href;document.head.appendChild(l);
  }
  function loadScript(src,id){
    if(document.getElementById(id))return Promise.resolve();
    if(globalThis.KBSModules?.lazy?.script)return globalThis.KBSModules.lazy.script(src,id);
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.id=id;s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load '+src));document.head.appendChild(s)});
  }
  function onceAny(events,fn){
    const handler=e=>{cleanup();fn(e)};
    const cleanup=()=>events.forEach(name=>document.removeEventListener(name,handler,true));
    events.forEach(name=>document.addEventListener(name,handler,{capture:true,once:false,passive:name==='pointerdown'||name==='touchstart'}));
  }

  /* Required immediately: core themes, responsive/readability CSS and legacy artwork repair. */
  loadStyle('styles/full-themes.css?v=3.0.5','kbsFullThemesStyle');
  loadStyle('styles/theme-picker-fit.css?v=3.0.2','kbsThemePickerFitStyle');
  loadStyle('styles/responsive-button-fit.css?v=3.3.4','kbsResponsiveButtonFitStyle');
  loadStyle('styles/ui-readability-fixes.css?v=3.5.4','kbsUiReadabilityFixesStyle');
  loadScript('features/full-themes.js?v=3.4.1','kbsFullThemesScript');
  loadScript('features/theme-picker-fit.js?v=3.0.2','kbsThemePickerFitScript');
  loadScript('features/artwork-legacy-repair.js?v=2.9.1','kbsArtworkLegacyRepairScript');

  /* Binder cover assets are loaded only when the binder library is opened. */
  let coverLoaded=false;
  async function loadCoverDesigner(){
    if(coverLoaded)return;coverLoaded=true;
    loadStyle('styles/binder-cover-designer.css?v=3.1.1','kbsBinderCoverDesignerStyle');
    await loadScript('features/binder-cover-designer.js?v=3.1.1','kbsBinderCoverDesignerScript').catch(console.warn);
  }
  document.querySelector('#openBinders')?.addEventListener('click',loadCoverDesigner,{once:true,capture:true});
  document.querySelector('#mobilePageBinders')?.addEventListener('click',loadCoverDesigner,{once:true,capture:true});

  /* Artwork source helper is loaded only when the Artwork surface is opened. */
  let sourceLinksLoaded=false;
  async function loadArtworkSources(){
    if(sourceLinksLoaded)return;sourceLinksLoaded=true;
    await loadScript('features/art-source-links.js?v=2.9.1','kbsArtSourceLinksScript').catch(console.warn);
  }
  document.querySelector('#libraryArtworkTab')?.addEventListener('click',loadArtworkSources,{once:true,capture:true});
  document.querySelector('[data-mobile-lab="art"]')?.addEventListener('click',loadArtworkSources,{once:true,capture:true});

  /* Decorative/advanced modules wait for real user interaction instead of blocking startup. */
  onceAny(['pointerdown','keydown','touchstart'],()=>{
    loadStyle('styles/theme-animated-accents.css?v=3.4.1','kbsThemeAnimatedAccentsStyle');
    loadStyle('styles/focus-presentation-mode.css?v=3.3.2','kbsFocusPresentationStyle');
    loadStyle('styles/productivity-suite.css?v=3.5.0','kbsProductivitySuiteStyle');
    loadScript('features/theme-animated-accents.js?v=3.4.1','kbsThemeAnimatedAccentsScript').catch(console.warn);
    loadScript('features/focus-presentation-mode.js?v=3.3.2','kbsFocusPresentationScript').catch(console.warn);
    loadScript('features/productivity-suite.js?v=3.5.0','kbsProductivitySuiteScript').catch(console.warn);
  });

  const numbers=document.querySelector('#editorPageNumbers');if(!numbers)return;let lastActive='';
  function activeButton(){return numbers.querySelector('.page-number.active,.page-number[aria-current="page"]')}
  function revealAndAnimate(){const active=activeButton();if(!active)return;const key=active.dataset.pageId||active.dataset.page||active.textContent?.trim()||'';active.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});if(key&&key!==lastActive){lastActive=key;active.classList.remove('page-switch-pop');void active.offsetWidth;active.classList.add('page-switch-pop');setTimeout(()=>active.classList.remove('page-switch-pop'),380)}}
  new MutationObserver(()=>requestAnimationFrame(revealAndAnimate)).observe(numbers,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-current']});
  numbers.addEventListener('click',()=>setTimeout(revealAndAnimate,40));
  document.querySelector('#editorPrev')?.addEventListener('click',()=>setTimeout(revealAndAnimate,80));
  document.querySelector('#editorNext')?.addEventListener('click',()=>setTimeout(revealAndAnimate,80));
  setTimeout(revealAndAnimate,250);
})();
