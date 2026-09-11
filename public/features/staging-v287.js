/* Binder Studio v4.0.5 preview — cleanup, calm flow, Lavender default, typography picker, retry-safe lazy loading. */
(function(){
  const BUILD='4.0.5';
  const sameAsset=(node,url)=>{try{return new URL(node.href||node.src,location.href).pathname===new URL(url,location.href).pathname}catch{return false}};
  function loadStyle(href,id){const existing=document.getElementById(id)||[...document.querySelectorAll('link[rel="stylesheet"]')].find(x=>sameAsset(x,href));if(existing){if(id&&!existing.id)existing.id=id;return}if(globalThis.KBSModules?.lazy?.style)return globalThis.KBSModules.lazy.style(href,id);const l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=href;l.onerror=()=>l.remove();document.head.appendChild(l)}
  function loadScript(src,id){const existing=document.getElementById(id)||[...document.scripts].find(x=>sameAsset(x,src));if(existing?.dataset?.kbsLoaded==='1'||existing&&existing.readyState==='complete'){if(id&&!existing.id)existing.id=id;return Promise.resolve()}if(existing&&id&&!existing.id)existing.id=id;if(globalThis.KBSModules?.lazy?.script&&!existing)return globalThis.KBSModules.lazy.script(src,id);if(existing)return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script');s.id=id;s.src=src;s.onload=()=>{s.dataset.kbsLoaded='1';resolve()};s.onerror=()=>{s.remove();reject(new Error('Could not load '+src))};document.head.appendChild(s)})}
  function syncBuildIdentity(){
    const version=document.querySelector('#versionLink');if(version)version.textContent='v4.0.5 STAGING';
    const meta=document.querySelector('meta[name="kbs-build"]');if(meta)meta.content='4.0.5-staging-preview';
    const title=document.querySelector('#buildInfoTitle');if(title)title.textContent='Kasey’s Binder Studio v4.0.5 Staging';
    const section=document.querySelector('.build-info-content section');if(section)section.innerHTML='<strong>v4.0.5 Staging Preview</strong><p>Flow, readability and cleanup pass.</p><p>Removed obsolete theme-animation/font layers, removed legacy cramped four-column page actions, flattened brand glow styling, deduplicated dynamically loaded assets, strengthened card/binder overflow protection, and added a calmer rounded professional control system.</p><p>Lavender remains the default theme. System Sans, Verdana, Trebuchet and Georgia remain selectable. Performance, search, artwork, binder editing, printing, focus mode, themes, mobile controls and cloud compatibility remain under staging verification.</p>';
  }
  syncBuildIdentity();
  loadStyle('styles/full-themes.css?v=3.0.5','kbsFullThemesStyle');
  loadStyle('styles/theme-picker-fit.css?v=3.0.2','kbsThemePickerFitStyle');
  loadStyle('styles/responsive-button-fit.css?v=4.0.5','kbsResponsiveButtonFitStyle');
  loadStyle('styles/ui-readability-fixes.css?v=3.5.5','kbsUiReadabilityFixesStyle');
  loadStyle('styles/layout-overlap-fixes.css?v=4.0.3.1','kbsLayoutOverlapFixesStyle');
  loadStyle('styles/focus-presentation-mode.css?v=3.3.3','kbsFocusPresentationStyle');
  loadStyle('styles/typography-picker.css?v=4.0.5','kbsTypographyPickerStyle');
  loadStyle('styles/static-ui.css?v=4.0.5','kbsStaticUiStyle');
  loadStyle('styles/ui-flow-polish.css?v=4.0.5','kbsUiFlowPolishStyle');
  loadScript('features/full-themes.js?v=4.0.5','kbsFullThemesScript').catch(console.warn);
  loadScript('features/theme-picker-fit.js?v=3.0.2','kbsThemePickerFitScript').catch(console.warn);
  loadScript('features/typography-picker.js?v=4.0.4','kbsTypographyPickerScript').catch(console.warn);
  loadScript('features/focus-presentation-mode.js?v=3.3.3','kbsFocusPresentationScript').catch(console.warn);
  loadScript('features/artwork-legacy-repair.js?v=2.9.1','kbsArtworkLegacyRepairScript').catch(console.warn);
  let coverLoaded=false,coverLoading=null;
  async function loadCoverDesigner(){if(coverLoaded)return;if(coverLoading)return coverLoading;loadStyle('styles/binder-cover-designer.css?v=3.1.1','kbsBinderCoverDesignerStyle');coverLoading=loadScript('features/binder-cover-designer.js?v=3.1.1','kbsBinderCoverDesignerScript').then(()=>{coverLoaded=true}).catch(err=>{coverLoading=null;throw err});return coverLoading}
  document.querySelector('#openBinders')?.addEventListener('click',()=>loadCoverDesigner().catch(console.warn),{capture:true});
  document.querySelector('#mobilePageBinders')?.addEventListener('click',()=>loadCoverDesigner().catch(console.warn),{capture:true});
  let sourceLinksLoaded=false,sourceLinksLoading=null;
  async function loadArtworkSources(){if(sourceLinksLoaded)return;if(sourceLinksLoading)return sourceLinksLoading;sourceLinksLoading=loadScript('features/art-source-links.js?v=2.9.1','kbsArtSourceLinksScript').then(()=>{sourceLinksLoaded=true}).catch(err=>{sourceLinksLoading=null;throw err});return sourceLinksLoading}
  document.querySelector('#libraryArtworkTab')?.addEventListener('click',()=>loadArtworkSources().catch(console.warn),{capture:true});
  document.querySelector('[data-mobile-lab="art"]')?.addEventListener('click',()=>loadArtworkSources().catch(console.warn),{capture:true});
  let productivityLoaded=false,productivityLoading=null;
  function loadProductivity(){if(productivityLoaded)return Promise.resolve();if(productivityLoading)return productivityLoading;loadStyle('styles/productivity-suite.css?v=3.5.0','kbsProductivitySuiteStyle');productivityLoading=loadScript('features/productivity-suite.js?v=3.5.0','kbsProductivitySuiteScript').then(()=>{productivityLoaded=true;removeProductivityTriggers()}).catch(err=>{productivityLoading=null;throw err});return productivityLoading}
  const productivityEvents=['pointerdown','keydown','touchstart'];const productivityTrigger=()=>loadProductivity().catch(console.warn);function removeProductivityTriggers(){productivityEvents.forEach(name=>document.removeEventListener(name,productivityTrigger,true))}productivityEvents.forEach(name=>document.addEventListener(name,productivityTrigger,{capture:true,passive:name==='pointerdown'||name==='touchstart'}));
  const numbers=document.querySelector('#editorPageNumbers');if(numbers){const revealActive=()=>{const active=numbers.querySelector('.page-number.active,.page-number[aria-current="page"]');if(active)active.scrollIntoView({behavior:'auto',block:'center',inline:'nearest'})};new MutationObserver(()=>requestAnimationFrame(revealActive)).observe(numbers,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-current']});numbers.addEventListener('click',()=>setTimeout(revealActive,20));document.querySelector('#editorPrev')?.addEventListener('click',()=>setTimeout(revealActive,40));document.querySelector('#editorNext')?.addEventListener('click',()=>setTimeout(revealActive,40));setTimeout(revealActive,150)}
  globalThis.KBSPreviewBuild={version:BUILD,motion:'calm',defaultTheme:'lavender'};
})();
