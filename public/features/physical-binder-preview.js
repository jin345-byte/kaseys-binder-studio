/* Kasey's Binder Studio v3.2.1 — physical binder preview mode. */
(function(){
  const SETTINGS_KEY='kbsPhysicalBinderPreviewSettings';
  const DEFAULTS={shadows:true,glare:true,rings:true,reducedMotion:false};
  let physicalBinder=null;
  let physicalPages=[];
  let physicalStep=0; // 0 = cover, 1+ = page spreads.
  let installed=false;
  let restoreLibraryOnClose=false;

  function loadSettings(){
    try{
      const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
      return {...DEFAULTS,...saved,reducedMotion:Boolean(saved.reducedMotion||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)};
    }catch{return {...DEFAULTS,reducedMotion:Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)}}
  }
  let settings=loadSettings();
  function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch{}}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
  function cleanImage(v){return String(v||'').trim().replace(/["\\\n\r]/g,'')}
  function coverFor(b){
    const c=b?.cover||{};
    return {
      title:String(c.title||b?.name||'Binder'),
      subtitle:String(c.subtitle||''),
      spineText:String(c.spineText||c.title||b?.name||'BINDER'),
      icon:String(c.icon||'✦'),
      character:String(c.character||''),
      color:/^#[0-9a-f]{6}$/i.test(c.color||'')?c.color:'#29354a',
      image:cleanImage(c.customImage||c.backgroundUrl||'')
    };
  }

  function ensurePreviewButton(){
    const toolbar=document.querySelector('.binder-toolbar');
    if(!toolbar||document.querySelector('#physicalBinderPreview'))return;
    const btn=document.createElement('button');
    btn.type='button';btn.className='btn ghost';btn.id='physicalBinderPreview';btn.textContent='Physical preview';
    btn.title='Preview this binder as a physical cover and two-page spreads';
    btn.onclick=e=>{e?.preventDefault();e?.stopPropagation();openPhysicalBinder(activeBinderId).catch(err=>{console.error(err);toast('Could not open physical binder preview')})};
    const before=document.querySelector('#designBinderCover')||document.querySelector('#renameBinder')||document.querySelector('#binderStatus');
    toolbar.insertBefore(btn,before||null);
  }

  function ensureViewerUi(){
    const shell=document.querySelector('#binderViewer .viewer-shell');
    if(!shell||shell.dataset.physicalReady==='1')return;
    shell.dataset.physicalReady='1';
    document.querySelector('#binderViewer')?.classList.add('physical-binder-viewer');
    const nav=document.querySelector('#binderViewer .viewer-nav');
    if(nav){
      nav.innerHTML=`<button class="btn ghost" id="viewerPrev" type="button">‹ Previous</button>
        <div class="viewer-pages"><span id="viewerCounter">Cover</span><div class="page-numbers viewer-page-numbers" id="viewerPageNumbers" aria-label="Physical binder sections"></div></div>
        <button class="btn ghost" id="viewerNext" type="button">Next ›</button>
        <button class="btn" id="viewerEdit" type="button">Edit page</button>`;
    }
    let opts=shell.querySelector('.physical-preview-options');
    if(!opts){
      opts=document.createElement('div');opts.className='physical-preview-options';
      opts.innerHTML=`<label><input id="physicalShadows" type="checkbox"> <span>Page shadows</span></label>
        <label><input id="physicalGlare" type="checkbox"> <span>Plastic glare</span></label>
        <label><input id="physicalRings" type="checkbox"> <span>Binder rings</span></label>
        <label><input id="physicalReducedMotion" type="checkbox"> <span>Reduced motion</span></label>`;
      const page=document.querySelector('#viewerPage');page?.before(opts);
    }
    for(const [id,key] of [['physicalShadows','shadows'],['physicalGlare','glare'],['physicalRings','rings'],['physicalReducedMotion','reducedMotion']]){
      const el=document.querySelector('#'+id);if(!el)continue;
      el.checked=Boolean(settings[key]);
      el.onchange=()=>{settings[key]=el.checked;saveSettings();applyEffectClasses();renderPhysical()};
    }
    document.querySelector('#viewerPrev').onclick=()=>goPhysical(-1);
    document.querySelector('#viewerNext').onclick=()=>goPhysical(1);
    document.querySelector('#viewerEdit').onclick=()=>{
      if(physicalStep===0)return toast('Turn to a page before editing');
      const p=physicalPages[(physicalStep-1)*2];
      if(p){closePhysical({restoreLibrary:false});loadPageIntoEditor(p.id)}
    };
    document.querySelector('#closeViewer').onclick=()=>closePhysical({restoreLibrary:true});
    document.querySelector('#binderViewer').addEventListener('click',e=>{if(e.target?.id==='binderViewer')closePhysical({restoreLibrary:true})});
  }

  function applyEffectClasses(){
    const viewer=document.querySelector('#binderViewer');if(!viewer)return;
    viewer.classList.toggle('physical-no-shadows',!settings.shadows);
    viewer.classList.toggle('physical-no-glare',!settings.glare);
    viewer.classList.toggle('physical-no-rings',!settings.rings);
    viewer.classList.toggle('physical-reduced-motion',settings.reducedMotion);
  }

  function totalSteps(){return 1+Math.max(1,Math.ceil(physicalPages.length/2))}
  function spreadLabel(step){
    if(step===0)return 'Cover';
    const a=(step-1)*2+1,b=Math.min(a+1,physicalPages.length);
    return b>a?`Pages ${a}–${b}`:`Page ${a}`;
  }
  function goPhysical(delta){
    const next=clamp(physicalStep+delta,0,totalSteps()-1);
    if(next===physicalStep)return;
    const viewer=document.querySelector('#binderViewer');
    if(viewer&&!settings.reducedMotion){viewer.classList.remove('physical-turning');void viewer.offsetWidth;viewer.classList.add('physical-turning');setTimeout(()=>viewer.classList.remove('physical-turning'),440)}
    physicalStep=next;renderPhysical();
  }

  function pageLeaf(page,side,index){
    if(!page)return `<section class="physical-leaf physical-leaf-empty ${side}" aria-label="Empty inside cover"><div class="physical-empty-page">End of binder</div></section>`;
    return `<section class="physical-leaf ${side}" data-physical-page="${esc(page.id)}" aria-label="${esc(page.title||`Page ${index+1}`)}">
      <div class="physical-page-paper">${fullViewerMarkup(page)}<span class="physical-plastic-glare" aria-hidden="true"></span></div>
      <footer><span>${esc(page.title||`Page ${index+1}`)}</span><b>${index+1}</b></footer>
    </section>`;
  }

  function renderCover(){
    const c=coverFor(physicalBinder);
    const holder=document.querySelector('#viewerPage');
    holder.innerHTML=`<div class="physical-stage cover-stage" style="--physical-binder:${esc(c.color)}">
      <div class="physical-closed-binder">
        <div class="physical-cover-spine"><span>${esc(c.spineText)}</span></div>
        <div class="physical-cover-face" id="physicalCoverFace">
          <span class="physical-cover-icon">${esc(c.icon)}</span>
          <div class="physical-cover-copy"><small>${esc(c.character)}</small><strong>${esc(c.title)}</strong><span>${esc(c.subtitle)}</span></div>
          <span class="physical-cover-sheen" aria-hidden="true"></span>
        </div>
      </div>
    </div>`;
    const face=holder.querySelector('#physicalCoverFace');
    if(c.image){face.style.backgroundImage=`linear-gradient(180deg,rgba(3,5,8,.10),rgba(3,5,8,.62)),url("${c.image}")`;face.classList.add('has-art')}
  }

  function renderSpread(){
    const start=(physicalStep-1)*2;
    const left=physicalPages[start],right=physicalPages[start+1];
    const binderColor=(left?.state?.binderColor||right?.state?.binderColor||physicalBinder?.cover?.color||'#111827');
    const holder=document.querySelector('#viewerPage');
    holder.innerHTML=`<div class="physical-stage spread-stage" style="--physical-binder:${esc(binderColor)}">
      <div class="physical-binder-base"></div>
      <div class="physical-spread">
        ${pageLeaf(left,'left',start)}
        <div class="physical-rings" aria-hidden="true">${Array.from({length:4},()=>'<i></i>').join('')}</div>
        ${pageLeaf(right,'right',start+1)}
      </div>
    </div>`;
  }

  function renderNav(){
    const counter=document.querySelector('#viewerCounter');if(counter)counter.textContent=spreadLabel(physicalStep);
    const prev=document.querySelector('#viewerPrev'),next=document.querySelector('#viewerNext');
    if(prev)prev.disabled=physicalStep<=0;
    if(next)next.disabled=physicalStep>=totalSteps()-1;
    const edit=document.querySelector('#viewerEdit');if(edit){edit.disabled=physicalStep===0;edit.textContent=physicalStep===0?'Edit page':'Edit left page'}
    const nums=document.querySelector('#viewerPageNumbers');if(!nums)return;
    const labels=Array.from({length:totalSteps()},(_,i)=>i===0?'C':String((i-1)*2+1)+(physicalPages[(i-1)*2+1]?'–'+String((i-1)*2+2):''));
    nums.innerHTML=labels.map((label,i)=>`<button type="button" class="page-number ${i===physicalStep?'active':''}" data-physical-step="${i}" aria-current="${i===physicalStep?'page':'false'}" title="${esc(spreadLabel(i))}">${esc(label)}</button>`).join('');
    nums.querySelectorAll('[data-physical-step]').forEach(b=>b.onclick=()=>{const next=Number(b.dataset.physicalStep);if(next!==physicalStep){physicalStep=next;renderPhysical()}});
  }

  function renderPhysical(){
    if(!physicalBinder)return;
    const viewer=document.querySelector('#binderViewer');
    if(viewer&&!viewer.classList.contains('open')){viewer.classList.add('open');viewer.setAttribute('aria-hidden','false')}
    applyEffectClasses();
    document.querySelector('#viewerTitle').textContent=physicalBinder.name||'Binder';
    if(physicalStep===0)renderCover();else renderSpread();
    renderNav();
  }

  async function openPhysicalBinder(binderId,startPageId=''){
    if(!binderDb)return toast('Binder library is still loading');
    const b=await dbGet('binders',binderId);if(!b)return toast('That binder could not be loaded');
    await saveActivePageSnapshot().catch(()=>{});
    physicalBinder=b;physicalPages=await pagesForBinder(b.id);
    physicalStep=startPageId?1+Math.floor(Math.max(0,physicalPages.findIndex(p=>p.id===startPageId))/2):0;
    ensureViewerUi();applyEffectClasses();
    const library=document.querySelector('#binderModal');
    restoreLibraryOnClose=Boolean(library?.classList.contains('open'));
    if(restoreLibraryOnClose&&typeof closeBinderLibrary==='function')closeBinderLibrary();
    const viewer=document.querySelector('#binderViewer');
    viewer.classList.add('open','physical-preview-active');viewer.setAttribute('aria-hidden','false');
    document.body.classList.add('physical-preview-open');
    renderPhysical();
  }
  function closePhysical({restoreLibrary=true}={}){
    const viewer=document.querySelector('#binderViewer');
    viewer?.classList.remove('open','physical-turning','physical-preview-active');viewer?.setAttribute('aria-hidden','true');
    document.body.classList.remove('physical-preview-open');
    const shouldRestore=restoreLibrary&&restoreLibraryOnClose;
    restoreLibraryOnClose=false;
    if(shouldRestore&&typeof openBinderLibrary==='function')setTimeout(()=>openBinderLibrary(),0);
  }

  function patchPageView(){
    // Existing page cards continue to say View, but now open the page in its physical spread.
    openViewer=async function(pageId){
      const page=await dbGet('pages',pageId);if(!page)return;
      await openPhysicalBinder(page.binderId,pageId);
    };
  }

  function install(){
    if(installed)return;installed=true;
    ensurePreviewButton();ensureViewerUi();patchPageView();
    const modal=document.querySelector('#binderModal');
    if(modal)new MutationObserver(()=>ensurePreviewButton()).observe(modal,{childList:true,subtree:true});
    globalThis.KBSPhysicalBinderPreview={open:openPhysicalBinder,close:closePhysical,render:renderPhysical,settings:()=>({...settings})};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
