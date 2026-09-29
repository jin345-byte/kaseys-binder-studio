/* Matching Card Variants v2 loader.
   Kept at the legacy stability path so existing production boot order stays intact. */
(()=>{
  'use strict';
  if(globalThis.KBSCardVariantsV2?.installed)return;
  if(!document.getElementById('kbsCardVariantsV2Style')){
    const link=document.createElement('link');
    link.id='kbsCardVariantsV2Style';link.rel='stylesheet';link.href='styles/card-variants-panel-v2.css?v=2.0.0';
    document.head.appendChild(link);
  }
  if(document.getElementById('kbsCardVariantsV2Script'))return;
  const script=document.createElement('script');
  script.id='kbsCardVariantsV2Script';script.src='features/card-variants-panel-v2.js?v=2.0.0';
  script.onerror=()=>{script.remove();console.warn('Could not load Matching Card Variants v2')};
  document.head.appendChild(script);
})();
