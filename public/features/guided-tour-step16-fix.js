/* v2.8.15 — deterministic Step 16 -> Congratulations handoff */
(function(){
  const demo=document.querySelector('#guidedDemo');
  const next=document.querySelector('#guidedDemoNext');
  const step=document.querySelector('#guidedDemoStep');
  const title=document.querySelector('#guidedDemoTitle');
  if(!demo||!next||!step||!title)return;

  let fallback=0,active=false;

  function congrats(){
    const shell=document.querySelector('#guidedTourCongrats');
    if(!active||!shell)return;
    clearTimeout(fallback);fallback=0;
    document.querySelector('#cloudPopover')?.setAttribute('hidden','');
    document.querySelector('#cloudAccountBtn')?.classList.remove('guided-demo-target','guided-demo-click-pulse');
    document.querySelector('#googleButtonMount')?.classList.remove('guided-demo-target');
    demo.hidden=true;
    demo.setAttribute('aria-hidden','true');
    document.body.classList.remove('live-guided-demo-running');
    shell.hidden=false;
    shell.querySelector('#guidedCongratsFinish')?.focus({preventScroll:true});
  }

  function arm(){
    if(active||demo.hidden)return;
    if(step.textContent.trim()!=='STEP 16 OF 16'&&title.textContent.trim()!=='Save your progress with Google')return;
    active=true;
    next.hidden=false;
    next.disabled=false;
    next.textContent='Continue';
    next.setAttribute('aria-label','Continue to guided tour summary');
    clearTimeout(fallback);
    fallback=setTimeout(congrats,7000);
  }

  next.addEventListener('click',e=>{
    if(!active)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    congrats();
  },true);

  const observer=new MutationObserver(()=>queueMicrotask(arm));
  observer.observe(step,{childList:true,subtree:true,characterData:true});
  observer.observe(title,{childList:true,subtree:true,characterData:true});
  observer.observe(next,{attributes:true,childList:true,subtree:true,attributeFilter:['hidden','disabled']});

  document.querySelector('#guidedTourLaunch')?.addEventListener('click',()=>{
    active=false;clearTimeout(fallback);fallback=0;
    next.removeAttribute('aria-label');
  },true);

  document.querySelector('#guidedCongratsFinish')?.addEventListener('click',()=>{
    active=false;clearTimeout(fallback);fallback=0;
    next.removeAttribute('aria-label');
  });

  arm();
})();
