/* Binder Studio staging mobile workflow */
(function(){
  const mq=matchMedia('(max-width:820px)');
  const body=document.body;
  const FORCE_KEY='kbsMobileLabForcePreview';
  const previewToggle=document.querySelector('#mobilePreviewToggle');
  const nav=document.querySelector('#mobileLabBottomNav');
  const librarySetup=document.querySelector('#librarySetupCard');
  const variantPane=document.querySelector('.variant-pane');
  const libraryOriginalParent=librarySetup?.parentElement||null;
  const libraryOriginalNext=librarySetup?.nextElementSibling||null;
  let forced=localStorage.getItem(FORCE_KEY)==='1';
  let current='cards';
  let longPress=null;
  let suppressClickUntil=0;
  if(!nav)return;

  const modes=['cards','page','art'];
  const isMobileMode=()=>mq.matches||forced;

  function setActive(name,{fromCore=false}={}){
    if(!modes.includes(name))name='cards';
    current=name;
    body.classList.remove('mobile-lab-cards','mobile-lab-page','mobile-lab-art');
    body.classList.add('mobile-lab-'+name);
    nav.querySelectorAll('[data-mobile-lab]').forEach(b=>b.classList.toggle('active',b.dataset.mobileLab===name));
    if(!fromCore){
      if(name==='page')document.querySelector('#tabCanvas')?.click();
      else document.querySelector('#tabLibrary')?.click();
    }
    if(name==='cards')globalThis.KBSArtworkSearch?.showCards?.();
    if(name==='art')globalThis.KBSArtworkSearch?.showArtwork?.();
  }

  function updatePreviewToggle(){
    if(!previewToggle)return;
    previewToggle.classList.toggle('active',forced);
    previewToggle.setAttribute('aria-pressed',forced?'true':'false');
    previewToggle.textContent=forced?'▤ Desktop Preview':'▣ Mobile Preview';
  }

  function moveLibraryControl(enabled){
    if(!librarySetup)return;
    if(enabled){
      if(variantPane&&librarySetup.parentElement!==variantPane){
        variantPane.querySelector('.sectionhead')?.insertAdjacentElement('afterend',librarySetup);
      }
      librarySetup.classList.add('mobile-library-inline');
    }else{
      librarySetup.classList.remove('mobile-library-inline');
      if(libraryOriginalParent&&librarySetup.parentElement!==libraryOriginalParent){
        if(libraryOriginalNext&&libraryOriginalNext.parentElement===libraryOriginalParent)libraryOriginalParent.insertBefore(librarySetup,libraryOriginalNext);
        else libraryOriginalParent.appendChild(librarySetup);
      }
    }
  }

  function syncLibraryProgress(){
    const btn=document.querySelector('#syncMasterLibrary');
    const fill=document.querySelector('#libraryProgressFill');
    const pct=document.querySelector('#libraryProgressPercent');
    if(!btn)return;
    const width=(fill?.style.width||'0%').trim()||'0%';
    btn.style.setProperty('--mobile-library-progress',width);
    btn.dataset.progress=(pct?.textContent||width||'0%').trim();
    const label=document.querySelector('#libraryBuildLabel')?.textContent?.trim()||'Build Card Library';
    btn.dataset.mobileLabel=label.replace(/Build Both Card Libraries|Build Both Libraries/i,'Build Card Library').replace(/Refresh Both Card Libraries|Refresh Both Libraries/i,'Refresh Card Library');
  }

  function applyMode(){
    const enabled=isMobileMode();
    body.classList.toggle('mobile-lab-enabled',enabled);
    body.classList.toggle('mobile-lab-force-preview',forced&&!mq.matches);
    updatePreviewToggle();
    moveLibraryControl(enabled);
    if(enabled){setActive(current,{fromCore:true});syncLibraryProgress();}
    else body.classList.remove('mobile-lab-cards','mobile-lab-page','mobile-lab-art');
  }

  previewToggle?.addEventListener('click',()=>{
    forced=!forced;
    localStorage.setItem(FORCE_KEY,forced?'1':'0');
    applyMode();
  });
  nav.addEventListener('click',e=>{
    const b=e.target.closest('[data-mobile-lab]');
    if(b)setActive(b.dataset.mobileLab);
  });

  const progressFill=document.querySelector('#libraryProgressFill');
  const progressPct=document.querySelector('#libraryProgressPercent');
  if(progressFill)new MutationObserver(syncLibraryProgress).observe(progressFill,{attributes:true,attributeFilter:['style']});
  if(progressPct)new MutationObserver(syncLibraryProgress).observe(progressPct,{childList:true,subtree:true,characterData:true});

  const grid=document.querySelector('#grid');
  function clearLongPress(){
    if(longPress?.timer)clearTimeout(longPress.timer);
    document.querySelectorAll('#grid .mobile-drag-source,#grid .mobile-drop-target').forEach(x=>x.classList.remove('mobile-drag-source','mobile-drop-target'));
    longPress=null;
  }
  grid?.addEventListener('click',e=>{
    if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  grid?.addEventListener('pointerdown',e=>{
    if(!isMobileMode()||(e.pointerType==='mouse'&&e.button!==0))return;
    const pocket=e.target.closest('.pocket.filled.card[data-pocket]');
    if(!pocket||e.target.closest('[data-remove-pocket]'))return;
    const source=Number(pocket.dataset.pocket);
    if(!Number.isInteger(source)||!state?.pockets?.[source])return;
    longPress={source,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,dragging:false,item:structuredClone(state.pockets[source]),pocket};
    longPress.timer=setTimeout(()=>{
      if(!longPress)return;
      longPress.dragging=true;
      pocket.classList.add('mobile-drag-source');
      navigator.vibrate?.(25);
      suppressClickUntil=Date.now()+900;
    },430);
  },{passive:true});
  grid?.addEventListener('pointermove',e=>{
    if(!longPress)return;
    longPress.lastX=e.clientX;longPress.lastY=e.clientY;
    if(!longPress.dragging&&Math.hypot(e.clientX-longPress.startX,e.clientY-longPress.startY)>10){clearLongPress();return;}
    if(!longPress.dragging)return;
    e.preventDefault();
    document.querySelectorAll('#grid .mobile-drop-target').forEach(x=>x.classList.remove('mobile-drop-target'));
    const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('#grid .pocket[data-pocket]');
    if(hit&&Number(hit.dataset.pocket)!==longPress.source)hit.classList.add('mobile-drop-target');
  },{passive:false});
  function finishLongPress(e){
    if(!longPress)return;
    if(longPress.dragging){
      const hit=document.elementFromPoint(e.clientX??longPress.lastX,e.clientY??longPress.lastY)?.closest?.('#grid .pocket[data-pocket]');
      const target=Number(hit?.dataset?.pocket);
      if(Number.isInteger(target)&&target!==longPress.source){
        const {source,item}=longPress;
        clearLongPress();
        place(target,item,source);
        navigator.vibrate?.([18,20,18]);
        return;
      }
      suppressClickUntil=Date.now()+500;
    }
    clearLongPress();
  }
  grid?.addEventListener('pointerup',finishLongPress);
  grid?.addEventListener('pointercancel',clearLongPress);

  mq.addEventListener?.('change',applyMode);
  addEventListener('resize',applyMode,{passive:true});
  applyMode();
  setTimeout(syncLibraryProgress,500);
})();
