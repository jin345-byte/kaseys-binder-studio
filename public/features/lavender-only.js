/* Kasey's Binder Studio — permanent Lavender-only theme lock. */
(function(){
  'use strict';
  const THEME='lavender';
  const META_COLOR='#272038';
  const STATE_KEY='michiStandaloneState';
  const PREF_KEY='kbsThemePreference';

  function rewriteState(raw){
    try{
      const parsed=JSON.parse(String(raw||'{}'))||{};
      parsed.theme=THEME;
      return JSON.stringify(parsed);
    }catch{return JSON.stringify({theme:THEME})}
  }

  try{
    localStorage.setItem(PREF_KEY,THEME);
    localStorage.setItem(STATE_KEY,rewriteState(localStorage.getItem(STATE_KEY)));
  }catch{}

  const nativeSetItem=Storage.prototype.setItem;
  if(!globalThis.__kbsLavenderStorageLock){
    globalThis.__kbsLavenderStorageLock=true;
    Storage.prototype.setItem=function(key,value){
      if(this===localStorage){
        if(key===PREF_KEY)value=THEME;
        else if(key===STATE_KEY)value=rewriteState(value);
      }
      return nativeSetItem.call(this,key,value);
    };
  }

  function enforce(){
    const body=document.body;
    if(body&&body.dataset.theme!==THEME)body.dataset.theme=THEME;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta&&meta.getAttribute('content')!==META_COLOR)meta.setAttribute('content',META_COLOR);
    document.documentElement.style.colorScheme='dark';
    document.querySelector('#fullThemeSelect')?.closest('.full-theme-control')?.remove();
  }

  const observer=new MutationObserver(enforce);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-theme']});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enforce,{once:true});
  else enforce();

  globalThis.applyTheme=function(){enforce();return THEME};
  globalThis.KBSLavenderOnly={theme:THEME,enforce};
})();
