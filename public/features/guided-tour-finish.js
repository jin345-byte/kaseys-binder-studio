/* Guided tour extension: Guest sign-in instruction + completion celebration */
(function(){
  const demo=document.querySelector('#guidedDemo');
  const bubble=document.querySelector('#guidedDemoCard');
  const launch=document.querySelector('#guidedTourLaunch');
  const nextBtn=document.querySelector('#guidedDemoNext');
  const stepLabel=document.querySelector('#guidedDemoStep');
  const title=document.querySelector('#guidedDemoTitle');
  const text=document.querySelector('#guidedDemoText');
  if(!demo||!bubble||!launch||!nextBtn||!stepLabel||!title||!text)return;

  const DEFAULTS={binder:'#111827',page:'#080b12',sleeve:'#334155'};
  const LOGIN_STEP_MS=4600;
  let takeover=false,guestTimer=0,highlighted=null;

  const shell=document.createElement('div');
  shell.className='guided-tour-congrats';
  shell.id='guidedTourCongrats';
  shell.hidden=true;
  shell.innerHTML=`
    <div class="guided-confetti" aria-hidden="true"></div>
    <section class="guided-tour-congrats-card" role="dialog" aria-modal="true" aria-labelledby="guidedCongratsTitle">
      <div class="guided-tour-congrats-badge" aria-hidden="true">✓</div>
      <span class="eyebrow">GUIDED TOUR COMPLETE</span>
      <h2 id="guidedCongratsTitle">Congratulations!</h2>
      <p>You now know the core Binder Studio workflow from building the card library through saving and printing your finished binder page.</p>
      <div class="guided-tour-summary" aria-label="Guided tour summary">
        <span>Build or refresh the card library</span>
        <span>Choose binder layout and colors</span>
        <span>Search and place exact card printings</span>
        <span>Find, add, and place artwork</span>
        <span>Configure inserts and print at 100%</span>
        <span>Use Guest → Google to save and sync progress</span>
      </div>
      <button class="btn guided-tour-finish" id="guidedCongratsFinish" type="button">Finish</button>
    </section>`;
  document.body.appendChild(shell);

  const confetti=shell.querySelector('.guided-confetti');
  const confettiColors=['#f5d52f','#ffffff','#74d7ff','#ff7bb8','#9cf0b8','#f29b4b'];
  for(let i=0;i<42;i++){
    const piece=document.createElement('i');
    piece.className='guided-confetti-piece';
    piece.style.left=((i*37)%101)+'%';
    piece.style.setProperty('--delay',(-((i*173)%3000)/1000)+'s');
    piece.style.setProperty('--d',(2.9+((i*29)%17)/10)+'s');
    piece.style.setProperty('--r',((i*47)%360)+'deg');
    piece.style.setProperty('--drift',(-54+((i*31)%109))+'px');
    piece.style.setProperty('--confetti',confettiColors[i%confettiColors.length]);
    confetti.appendChild(piece);
  }

  function clearHighlight(){
    highlighted?.classList.remove('guided-demo-target','guided-demo-click-pulse');
    highlighted=null;
  }
  function pulse(el){
    if(!el)return;
    el.classList.remove('guided-demo-click-pulse');
    void el.offsetWidth;
    el.classList.add('guided-demo-click-pulse');
    setTimeout(()=>el.classList.remove('guided-demo-click-pulse'),700);
  }
  function positionBubble(el){
    if(!el){bubble.style.cssText='left:50%;top:50%;transform:translate(-50%,-50%)';return;}
    const pad=12,r=el.getBoundingClientRect(),b=bubble.getBoundingClientRect();
    let left=Math.max(pad,Math.min(innerWidth-b.width-pad,r.left));
    let top=r.bottom+12;
    if(top+b.height>innerHeight-pad)top=Math.max(pad,r.top-b.height-12);
    bubble.style.left=left+'px';bubble.style.top=top+'px';bubble.style.transform='none';
  }
  async function waitForAccountButton(){
    for(let i=0;i<30;i++){
      const b=document.querySelector('#cloudAccountBtn');
      if(b)return b;
      await new Promise(r=>setTimeout(r,100));
    }
    return null;
  }

  async function beginGuestStep(){
    if(takeover||demo.hidden)return;
    takeover=true;
    nextBtn.hidden=true;
    clearHighlight();
    stepLabel.textContent='STEP 16 OF 16';
    title.textContent='Save your progress with Google';
    text.textContent='When you are using Binder Studio as a guest, click the Guest button in the upper-right corner. Then choose Continue with Google to save and sync your binders across devices. You do not need to sign in during this tour.';

    const accountBtn=await waitForAccountButton();
    if(!takeover||demo.hidden)return;
    if(accountBtn){
      accountBtn.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
      await new Promise(r=>setTimeout(r,280));
      highlighted=accountBtn;
      accountBtn.classList.add('guided-demo-target');
      positionBubble(accountBtn);
      pulse(accountBtn);
      const label=document.querySelector('#cloudAccountLabel')?.textContent?.trim();
      const pop=document.querySelector('#cloudPopover');
      if(label==='Guest'&&pop?.hidden)accountBtn.click();
      const googleMount=document.querySelector('#googleButtonMount');
      if(label==='Guest'&&googleMount){googleMount.classList.add('guided-demo-target');setTimeout(()=>googleMount.classList.remove('guided-demo-target'),LOGIN_STEP_MS-400);}
    }else positionBubble(null);

    clearTimeout(guestTimer);
    guestTimer=setTimeout(showCongrats,LOGIN_STEP_MS);
  }

  function showCongrats(){
    if(!takeover)return;
    clearHighlight();
    const googleMount=document.querySelector('#googleButtonMount');
    googleMount?.classList.remove('guided-demo-target');
    const pop=document.querySelector('#cloudPopover');if(pop)pop.hidden=true;
    demo.hidden=true;demo.setAttribute('aria-hidden','true');bubble.removeAttribute('style');
    document.body.classList.remove('live-guided-demo-running');
    shell.hidden=false;
    shell.querySelector('#guidedCongratsFinish')?.focus({preventScroll:true});
  }

  function resetSearchUi(){
    const subject=document.querySelector('#subject');
    if(subject){subject.value='';subject.dispatchEvent(new Event('input',{bubbles:true}));}
    const artSearch=document.querySelector('#artSearchQuery');
    if(artSearch){artSearch.value='';artSearch.dispatchEvent(new Event('input',{bubbles:true}));}
    try{globalThis.KBSArtworkSearch?.searchTerm?.('')}catch{}
    const artGrid=document.querySelector('#autoArtworkResults');if(artGrid)artGrid.innerHTML='';
    const artCount=document.querySelector('#autoArtworkCount');if(artCount)artCount.textContent='0';
    const tabCount=document.querySelector('#libraryArtworkTabCount');if(tabCount)tabCount.textContent='0';
    const status=document.querySelector('#autoArtworkStatus');if(status)status.textContent='Search Pokémon, anime characters, series, or artwork terms.';
    const more=document.querySelector('#autoArtworkLoadMore');if(more){more.disabled=true;more.textContent='More';}
  }
  function setDefaultColor(id,value){
    const el=document.querySelector('#'+id);
    if(!el)return;
    el.value=value;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function finishTour(){
    clearTimeout(guestTimer);guestTimer=0;clearHighlight();takeover=false;
    shell.hidden=true;
    nextBtn.hidden=false;nextBtn.disabled=false;nextBtn.textContent='Next';
    document.body.classList.remove('live-guided-demo-running');
    const pop=document.querySelector('#cloudPopover');if(pop)pop.hidden=true;

    try{
      if(typeof state!=='undefined'){
        state.subject='';
        state.layout='3x3';
        state.binderColor=DEFAULTS.binder;
        state.pageColor=DEFAULTS.page;
        state.sleeveColor=DEFAULTS.sleeve;
        state.pockets=Array(12).fill(null);
        state.artworks=[];
      }
      if(typeof selected!=='undefined')selected=null;
      if(typeof cards!=='undefined')cards=[];
      if(typeof save==='function')save();
    }catch(e){console.warn('Guided tour cleanup state reset failed',e);}

    resetSearchUi();
    const layout=document.querySelector('#layout');if(layout){layout.value='3x3';layout.dispatchEvent(new Event('change',{bubbles:true}));}
    const includeCards=document.querySelector('#includeCards');if(includeCards){includeCards.checked=false;includeCards.dispatchEvent(new Event('change',{bubbles:true}));}
    setDefaultColor('binderColor',DEFAULTS.binder);
    setDefaultColor('pageColor',DEFAULTS.page);
    setDefaultColor('sleeveColor',DEFAULTS.sleeve);
    document.querySelector('#libraryCardsTab')?.click();
    try{if(typeof renderHeader==='function')renderHeader();if(typeof renderSelected==='function')renderSelected();if(typeof renderCards==='function')renderCards();if(typeof renderArts==='function')renderArts();if(typeof renderGrid==='function')renderGrid();}catch(e){console.warn('Guided tour cleanup render failed',e);}
    window.scrollTo({top:0,behavior:'smooth'});
  }

  const finish=shell.querySelector('#guidedCongratsFinish');
  finish?.addEventListener('click',finishTour);

  /* The original tour enables its Finish button after the print step. That is
     our signal to replace the old ending with the Guest instruction. */
  const finishObserver=new MutationObserver(()=>{
    if(!takeover&&!demo.hidden&&!nextBtn.disabled&&nextBtn.textContent.trim()==='Finish')beginGuestStep();
  });
  finishObserver.observe(nextBtn,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden']});

  launch.addEventListener('click',()=>{
    clearTimeout(guestTimer);guestTimer=0;clearHighlight();takeover=false;shell.hidden=true;nextBtn.hidden=false;
    const pop=document.querySelector('#cloudPopover');if(pop)pop.hidden=true;
  },true);

  addEventListener('resize',()=>{if(takeover&&!demo.hidden)positionBubble(highlighted)},{passive:true});
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(!shell.hidden){e.preventDefault();finishTour();return;}
    if(takeover){clearTimeout(guestTimer);guestTimer=0;takeover=false;clearHighlight();nextBtn.hidden=false;}
  },true);
})();
