/* Binder Studio desktop-only gate. Mobile UI is temporarily disabled. */
(function(){
  const FORCE_KEY='kbsMobileLabForcePreview';
  try{localStorage.removeItem(FORCE_KEY)}catch{}

  function applyProductionBranding(){
    const brand=document.querySelector('.brand');
    if(brand){
      brand.classList.add('brand-image-lock');
      brand.innerHTML='<img class="brand-logo-image" src="branding/kaseys-binder-studio-logo.svg?v=1" alt="Kasey\'s Binder Studio">';
    }
    if(!document.querySelector('#kbsBrandLogoStyle')){
      const style=document.createElement('style');
      style.id='kbsBrandLogoStyle';
      style.textContent='.brand-image-lock{display:flex!important;align-items:center!important;min-width:0!important}.brand-image-lock .brand-logo-image{display:block;width:min(560px,48vw);height:auto;max-height:82px;object-fit:contain;object-position:left center}.brand-image-lock .k-logo,.brand-image-lock .brand-copy{display:none!important}@media(max-width:1180px){.brand-image-lock .brand-logo-image{width:min(430px,44vw);max-height:72px}}';
      document.head.appendChild(style);
    }
    document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]').forEach(x=>x.remove());
    const icon=document.createElement('link');
    icon.rel='icon';icon.type='image/svg+xml';icon.href='branding/kbs-favicon.svg?v=1';
    document.head.appendChild(icon);
    let apple=document.querySelector('link[rel="apple-touch-icon"]');
    if(!apple){apple=document.createElement('link');apple.rel='apple-touch-icon';document.head.appendChild(apple)}
    apple.href='branding/kbs-favicon.svg?v=1';
  }
  applyProductionBranding();

  /* Old mobile controls are retired while the mobile experience is disabled. */
  document.querySelector('#mobilePreviewToggle')?.remove();
  document.querySelector('#mobileLabBottomNav')?.remove();
  document.querySelector('#mobilePageActions')?.remove();

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

  function removeRetiredMobileControls(){
    document.querySelector('#mobilePreviewToggle')?.remove();
    document.querySelector('#mobileLabBottomNav')?.remove();
    document.querySelector('#mobilePageActions')?.remove();
  }

  function showMobileGate(){
    document.body.classList.remove('mobile-lab-enabled','mobile-lab-force-preview','mobile-lab-cards','mobile-lab-page','mobile-lab-art');
    document.body.classList.add('mobile-coming-soon','mobile-gate-ready');
    removeRetiredMobileControls();
    if(document.querySelector('#mobileComingSoon'))return;
    const gate=document.createElement('main');
    gate.id='mobileComingSoon';
    gate.setAttribute('role','main');
    gate.innerHTML='<section class="mobile-coming-soon-card" aria-labelledby="mobileComingSoonTitle"><img src="branding/kbs-favicon.svg?v=1" alt="" class="mobile-coming-soon-logo" style="width:92px;height:92px;object-fit:contain"><span class="mobile-coming-soon-brand">Kasey\'s Binder Studio</span><h1 id="mobileComingSoonTitle">Mobile version in the works</h1><p>Please visit Binder Studio on a <strong>desktop computer</strong> for the full experience.</p><span class="mobile-coming-soon-note">A dedicated phone and tablet experience is being developed.</span></section>';
    document.body.appendChild(gate);
  }

  function enableDesktop(){
    document.body.classList.add('mobile-gate-ready');
    document.body.classList.remove('mobile-coming-soon','mobile-lab-enabled','mobile-lab-force-preview','mobile-lab-cards','mobile-lab-page','mobile-lab-art');
    document.querySelector('#mobileComingSoon')?.remove();
    removeRetiredMobileControls();
  }

  if(isMobileDevice())showMobileGate();else enableDesktop();
})();
