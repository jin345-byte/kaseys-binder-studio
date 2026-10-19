/* Binder Studio: fixed Cyberpunk visual theme. Appearance remains manually
   adjustable using Binder / Page / Sleeves controls; no theme picker. */
(function(){
  'use strict';
  const DEFAULT_THEME='cyberpunk';
  const THEME={
    label:'Cyberpunk',
    description:'Neon cyan and magenta grid lab',
    tier:'premium',
    meta:'#0d1020',
    palette:['#15213a','#050713','#173e43']
  };
  function ensureStylesheet(id,href){
    if(document.getElementById(id))return;
    const link=document.createElement('link');
    link.id=id;link.rel='stylesheet';link.href=href;
    document.head.appendChild(link);
  }
  function ensureThemeStyles(){
    ensureStylesheet('kbsThemeBrandingStyle','styles/theme-branding.css?v=4.0.5');
    ensureStylesheet('kbsThemeLayoutLockStyle','styles/theme-layout-lock.css?v=3.0.5');
  }
  function applyFullTheme(_requested,{persist=false}={}){
    // Do not copy theme palette into binder/page/sleeve inputs. Those colors
    // belong to saved binder/page settings and are changed only manually.
    document.body.dataset.theme=DEFAULT_THEME;
    try{if(typeof state!=='undefined')state.theme=DEFAULT_THEME}catch{}
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',THEME.meta);
    document.documentElement.style.colorScheme='dark';
    document.querySelector('.full-theme-control')?.remove();
    // Older preferences may say Lavender. They no longer override the UI.
    try{localStorage.setItem('kbsThemePreference',DEFAULT_THEME)}catch{}
    if(persist){try{if(typeof save==='function')save()}catch{}}
    window.dispatchEvent(new CustomEvent('kbs-theme-change',{
      detail:{theme:DEFAULT_THEME,definition:{...THEME}}
    }));
    return DEFAULT_THEME;
  }
  globalThis.applyTheme=applyFullTheme;
  globalThis.KBSFullThemes={
    list:()=>[[DEFAULT_THEME,{...THEME}]],
    apply:applyFullTheme,
    get current(){return DEFAULT_THEME},
    defaultTheme:DEFAULT_THEME
  };
  ensureThemeStyles();
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>applyFullTheme(DEFAULT_THEME),{once:true});
  }else applyFullTheme(DEFAULT_THEME);
})();
