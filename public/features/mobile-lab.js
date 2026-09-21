/* Binder Studio desktop-only gate. Mobile UI is temporarily disabled. */
(function(){
  const FORCE_KEY='kbsMobileLabForcePreview';
  try{localStorage.removeItem(FORCE_KEY)}catch{}

  const previewToggle=document.querySelector('#mobilePreviewToggle');
  if(previewToggle)previewToggle.remove();

  function isMobileDevice(){
    try{
      if(navigator.userAgentData?.mobile===true)return true;
      const ua=String(navigator.userAgent||'');
      if(/Android|iPhone|iPod|Mobile|IEMobile|Opera Mini/i.test(ua))return true;
      if(/iPad/i.test(ua))return true;
      if(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)return true;
      return matchMedia('(max-width:1024px) and (hover:none) and (pointer:coarse)').matches&&Number(navigator.maxTouchPoints||0)>0;
    }catch{return false}
  }

  function showMobileGate(){
    document.body.classList.remove('mobile-lab-enabled','mobile-lab-force-preview','mobile-lab-cards','mobile-lab-page','mobile-lab-art');
    document.body.classList.add('mobile-coming-soon','mobile-gate-ready');
    document.querySelector('#mobileLabBottomNav')?.remove();
    if(document.querySelector('#mobileComingSoon'))return;
    const gate=document.createElement('main');
    gate.id='mobileComingSoon';
    gate.setAttribute('role','main');
    gate.innerHTML='<section class="mobile-coming-soon-card" aria-labelledby="mobileComingSoonTitle"><div class="mobile-coming-soon-logo" aria-hidden="true">K</div><span class="mobile-coming-soon-brand">Kasey\'s Binder Studio</span><h1 id="mobileComingSoonTitle">Mobile version in the works</h1><p>Please visit Binder Studio on a <strong>desktop computer</strong> for the full experience.</p><span class="mobile-coming-soon-note">A dedicated phone and tablet experience is being developed.</span></section>';
    document.body.appendChild(gate);
  }

  function enableDesktop(){
    document.body.classList.add('mobile-gate-ready');
    document.body.classList.remove('mobile-coming-soon','mobile-lab-enabled','mobile-lab-force-preview','mobile-lab-cards','mobile-lab-page','mobile-lab-art');
    document.querySelector('#mobileComingSoon')?.remove();
  }

  if(isMobileDevice())showMobileGate();else enableDesktop();
})();
