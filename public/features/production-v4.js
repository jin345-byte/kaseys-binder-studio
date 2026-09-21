/* Kasey's Binder Studio v4 release-candidate loader.
   Production-safe only: no staging read-only guards, preview workers, or staging shims. */
(function(){
  'use strict';
  const BUILD='4.0.6-rc3';
  const sameAsset=(node,url)=>{try{return new URL(node.href||node.src,location.href).pathname===new URL(url,location.href).pathname}catch{return false}};
  function loadStyle(href,id){
    const existing=document.getElementById(id)||[...document.querySelectorAll('link[rel="stylesheet"]')].find(x=>sameAsset(x,href));
    if(existing){if(id&&!existing.id)existing.id=id;const current=existing.getAttribute('href')||'';if(current!==href&&sameAsset(existing,href))existing.setAttribute('href',href);return existing}
    const l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=href;l.onerror=()=>l.remove();document.head.appendChild(l);return l;
  }
  function loadScript(src,id){
    const existing=document.getElementById(id)||[...document.scripts].find(x=>sameAsset(x,src));
    if(existing){if(id&&!existing.id)existing.id=id;return Promise.resolve(existing)}
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.id=id;s.src=src;s.onload=()=>resolve(s);s.onerror=()=>{s.remove();reject(new Error('Could not load '+src))};document.head.appendChild(s)});
  }
  function syncBuildIdentity(){
    const version=document.querySelector('#versionLink');if(version)version.textContent='v4.0.6 RC3';
    let meta=document.querySelector('meta[name="kbs-build"]');if(!meta){meta=document.createElement('meta');meta.name='kbs-build';document.head.appendChild(meta)}meta.content=BUILD;
    const title=document.querySelector('#buildInfoTitle');if(title)title.textContent='Kasey’s Binder Studio v4.0.6 Release Candidate 3';
  }
  syncBuildIdentity();

  [
    ['styles/appearance-cleanup.css?v=2.9.7','kbsAppearanceCleanupStyle'],
    ['styles/full-themes.css?v=3.0.5','kbsFullThemesStyle'],
    ['styles/theme-picker-fit.css?v=3.0.2','kbsThemePickerFitStyle'],
    ['styles/responsive-button-fit.css?v=4.0.5','kbsResponsiveButtonFitStyle'],
    ['styles/ui-readability-fixes.css?v=3.5.5','kbsUiReadabilityFixesStyle'],
    ['styles/layout-overlap-fixes.css?v=4.0.3.1','kbsLayoutOverlapFixesStyle'],
    ['styles/focus-presentation-mode.css?v=4.0.5','kbsFocusPresentationStyle'],
    ['styles/typography-picker.css?v=4.0.6','kbsTypographyPickerStyle'],
    ['styles/ui-flow-polish.css?v=4.0.5.4','kbsUiFlowPolishStyle'],
    ['styles/page-rail-structural-fix.css?v=1.1.0&rev=3','kbsPageRailStructuralFixStyle'],
    ['styles/desktop-readability-pass.css?v=1.0.0','kbsDesktopReadabilityPassStyle'],
    ['styles/text-control-borderless.css?v=1.0.0','kbsTextControlBorderlessStyle'],
    ['styles/binder-grid-geometry-lock.css?v=1.2.0','kbsBinderGridGeometryLockStyle'],
    ['styles/mobile-lab.css?v=4.0.5','kbsMobileLabStyle'],
    ['features/cloud-sync.css?v=4.0.6-rc2','kbsCloudSyncStyle']
  ].forEach(([href,id])=>loadStyle(href,id));

  loadScript('features/full-themes.js?v=4.0.5','kbsFullThemesScript').catch(console.warn);
  loadScript('features/theme-picker-fit.js?v=3.0.2','kbsThemePickerFitScript').catch(console.warn);
  loadScript('features/typography-picker.js?v=4.0.6','kbsTypographyPickerScript').catch(console.warn);
  loadScript('features/focus-presentation-mode.js?v=4.0.5','kbsFocusPresentationScript').catch(console.warn);
  loadScript('features/artwork-legacy-repair.js?v=2.9.1','kbsArtworkLegacyRepairScript').catch(console.warn);
  loadScript('features/viewer-legacy-layout-repair.js?v=1.0.0','kbsViewerLegacyLayoutRepairScript').catch(console.warn);
  loadScript('features/artwork-height-sync.js?v=2.9.0','kbsArtworkHeightSyncScript').catch(console.warn);
  loadScript('features/mobile-lab.js?v=2.9.0','kbsMobileLabScript').catch(console.warn);
  loadScript('features/cloud-sync.js?v=4.0.6-rc2','kbsCloudSyncScript').catch(console.warn);
  if(location.hostname==='kaseys-binder-studio-v4-rc.jin345.workers.dev')loadScript('features/compat-fixture-test.js?v=1.0.0','kbsCompatFixtureScript').catch(console.warn);

  let coverLoaded=false,coverLoading=null;
  async function loadCoverDesigner(){if(coverLoaded)return;if(coverLoading)return coverLoading;loadStyle('styles/binder-cover-designer.css?v=3.1.1','kbsBinderCoverDesignerStyle');coverLoading=loadScript('features/binder-cover-designer.js?v=3.1.1','kbsBinderCoverDesignerScript').then(()=>{coverLoaded=true}).catch(err=>{coverLoading=null;throw err});return coverLoading}
  document.querySelector('#openBinders')?.addEventListener('click',()=>loadCoverDesigner().catch(console.warn),{capture:true});

  let sourceLinksLoaded=false,sourceLinksLoading=null;
  async function loadArtworkSources(){if(sourceLinksLoaded)return;if(sourceLinksLoading)return sourceLinksLoading;sourceLinksLoading=loadScript('features/art-source-links.js?v=2.9.1','kbsArtSourceLinksScript').then(()=>{sourceLinksLoaded=true}).catch(err=>{sourceLinksLoading=null;throw err});return sourceLinksLoading}
  document.querySelector('#libraryArtworkTab')?.addEventListener('click',()=>loadArtworkSources().catch(console.warn),{capture:true});
  document.querySelector('[data-mobile-lab="art"]')?.addEventListener('click',()=>loadArtworkSources().catch(console.warn),{capture:true});

  const numbers=document.querySelector('#editorPageNumbers');
  if(numbers){const revealActive=()=>{const active=numbers.querySelector('.page-number.active,.page-number[aria-current="page"]');if(active)active.scrollIntoView({behavior:'auto',block:'center',inline:'nearest'})};new MutationObserver(()=>requestAnimationFrame(revealActive)).observe(numbers,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-current']});numbers.addEventListener('click',()=>setTimeout(revealActive,20));document.querySelector('#editorPrev')?.addEventListener('click',()=>setTimeout(revealActive,40));document.querySelector('#editorNext')?.addEventListener('click',()=>setTimeout(revealActive,40));setTimeout(revealActive,150)}

  globalThis.KBSReleaseBuild={version:BUILD,productionSafe:true,readOnlyCloud:false,stagingShim:false,cloudSyncVersion:2,compatibilityFixture:location.hostname==='kaseys-binder-studio-v4-rc.jin345.workers.dev',lazy:{coverDesigner:true,artworkSources:true}};
})();
