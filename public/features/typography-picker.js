/* Binder Studio: fixed System Sans typography. No font picker. */
(function(){
  'use strict';
  const FONT={label:'System Sans',hint:'Consistent system interface font'};
  function apply(_requested,{persist=false}={}){
    document.body.dataset.kbsFont='system';
    document.querySelector('.font-choice-control')?.remove();
    // Discard a previously selected user font without changing binder data.
    try{localStorage.setItem('kbsFontChoice','system')}catch{}
    return 'system';
  }
  globalThis.KBSTypography={
    list:()=>[{id:'system',...FONT}],
    apply,
    current:()=> 'system'
  };
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>apply('system'),{once:true});
  }else apply('system');
})();
