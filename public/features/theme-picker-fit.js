/* Binder Studio v3.0.1 — compact theme-picker behavior for narrow side rails. */
(function(){
  let tries=0;
  function install(){
    const select=document.querySelector('#fullThemeSelect');
    if(!select){
      if(tries++<80)setTimeout(install,75);
      return;
    }
    if(select.dataset.fitReady==='1')return;
    select.dataset.fitReady='1';
    select.title='Choose a full app and binder theme';
    for(const option of select.options){
      option.textContent=String(option.textContent||'').replace(/\s*·\s*Theme Pack\s*$/i,'');
    }
    const control=select.closest('.full-theme-control');
    if(control){
      control.title='Theme changes the app, panels, buttons, binder material, page texture, sleeve styling, accents and fonts.';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
