/* Kasey's Binder Studio v3.3.0 — clean focus / presentation mode. */
(function(){
  let installed=false;
  let open=false;
  let previewPages=[];
  let previewIndex=0;
  let touchStartX=0;

  function ensureButton(){
    if(document.querySelector('#previewBinder'))return;
    const controls=document.querySelector('.controls');
    if(!controls)return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='btn ghost focus-preview-launch';
    btn.id='previewBinder';
    btn.textContent='Preview Binder';
    btn.title='Show only the binder for screenshots, sharing, or display';
    btn.addEventListener('click',()=>enter().catch(e=>{console.error(e);toast('Could not open binder preview')}));
    const binders=document.querySelector('#openBinders');
    if(binders?.nextSibling)controls.insertBefore(btn,binders.nextSibling);else controls.appendChild(btn);
  }

  function ensureOverlay(){
    if(document.querySelector('#focusPresentation'))return;
    const overlay=document.createElement('div');
    overlay.id='focusPresentation';
    overlay.className='focus-presentation';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML=`<div class="focus-presentation-stage" id="focusPresentationStage" role="region" aria-label="Binder presentation preview"></div>
      <button type="button" class="focus-presentation-exit" id="focusPresentationExit" aria-label="Exit binder preview" title="Exit preview (Esc)">×</button>
      <div class="focus-presentation-hint" id="focusPresentationHint" aria-hidden="true">← → change pages · Esc exits</div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#focusPresentationExit').onclick=exit;
    overlay.addEventListener('click',e=>{
      if(e.target.closest('#focusPresentationExit'))return;
      const x=e.clientX/window.innerWidth;
      if(x<.24)changePage(-1);else if(x>.76)changePage(1);
    });
    overlay.addEventListener('touchstart',e=>{touchStartX=e.changedTouches?.[0]?.clientX||0},{passive:true});
    overlay.addEventListener('touchend',e=>{
      const end=e.changedTouches?.[0]?.clientX||0,d=end-touchStartX;
      if(Math.abs(d)>55)changePage(d<0?1:-1);
    },{passive:true});
  }

  async function loadPages(){
    if(!binderDb||!activeBinderId)return [];
    await saveActivePageSnapshot().catch(()=>{});
    return await pagesForBinder(activeBinderId);
  }

  function cleanViewerMarkup(html){
    const wrap=document.createElement('div');
    wrap.innerHTML=html;
    wrap.querySelectorAll('.x,.tag').forEach(el=>el.remove());
    wrap.querySelectorAll('[draggable]').forEach(el=>el.removeAttribute('draggable'));
    return wrap.innerHTML;
  }

  function render(){
    const stage=document.querySelector('#focusPresentationStage');
    if(!stage)return;
    const page=previewPages[previewIndex];
    if(!page){
      const live=document.querySelector('#grid');
      stage.innerHTML=live?`<div class="focus-page-shell">${cleanViewerMarkup(live.outerHTML)}</div>`:'<div class="focus-preview-empty">No binder page to preview.</div>';
      return;
    }
    const markup=typeof fullViewerMarkup==='function'?fullViewerMarkup(page):document.querySelector('#grid')?.outerHTML||'';
    stage.innerHTML=`<div class="focus-page-shell" data-focus-page="${esc(page.id)}">${cleanViewerMarkup(markup)}</div>`;
    stage.dataset.pageIndex=String(previewIndex);
    stage.dataset.pageCount=String(previewPages.length);
  }

  function changePage(delta){
    if(!open||previewPages.length<2)return;
    const next=Math.max(0,Math.min(previewPages.length-1,previewIndex+delta));
    if(next===previewIndex)return;
    previewIndex=next;
    const stage=document.querySelector('#focusPresentationStage');
    if(stage&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      stage.classList.remove('focus-page-changing');void stage.offsetWidth;stage.classList.add('focus-page-changing');
      setTimeout(()=>stage.classList.remove('focus-page-changing'),260);
    }
    render();
  }

  async function enter(){
    ensureOverlay();
    previewPages=await loadPages();
    previewIndex=Math.max(0,previewPages.findIndex(p=>p.id===activePageId));
    const overlay=document.querySelector('#focusPresentation');
    open=true;
    document.body.classList.add('focus-presentation-mode');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    render();
    const hint=document.querySelector('#focusPresentationHint');
    if(hint&&previewPages.length>1){hint.classList.add('show');setTimeout(()=>hint.classList.remove('show'),2200)}
  }

  function exit(){
    if(!open)return;
    open=false;
    document.body.classList.remove('focus-presentation-mode');
    const overlay=document.querySelector('#focusPresentation');
    overlay?.classList.remove('open');
    overlay?.setAttribute('aria-hidden','true');
  }

  function onKey(e){
    if(!open)return;
    if(e.key==='Escape'){e.preventDefault();exit()}
    else if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();changePage(1)}
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();changePage(-1)}
  }

  function install(){
    if(installed)return;installed=true;
    ensureButton();ensureOverlay();
    document.addEventListener('keydown',onKey);
    new MutationObserver(ensureButton).observe(document.body,{childList:true,subtree:true});
    globalThis.KBSFocusPresentation={open:enter,close:exit,next:()=>changePage(1),previous:()=>changePage(-1),isOpen:()=>open};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
