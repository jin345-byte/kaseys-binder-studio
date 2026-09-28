/* Smooth binder-page switching.
   Binder pages are editor state; the card browser is workspace state and must
   stay mounted while a different binder page is loaded. */
(()=>{
  'use strict';

  let switchQueue=Promise.resolve();
  let switching=false;

  function setValue(id,value){
    const node=document.getElementById(id);
    if(node&&node.value!==String(value??''))node.value=value??'';
  }

  function syncPageControls(){
    setValue('subject',state?.subject||'');
    setValue('layout',state?.layout||'3x3');
    setValue('binderColor',state?.binderColor||'#111827');
    setValue('pageColor',state?.pageColor||'#080b12');
    setValue('sleeveColor',state?.sleeveColor||'#334155');
  }

  function horizontalReveal(container,node){
    if(!container||!node)return;
    const left=node.offsetLeft;
    const right=left+node.offsetWidth;
    const viewLeft=container.scrollLeft;
    const viewRight=viewLeft+container.clientWidth;
    const pad=12;
    let next=viewLeft;
    if(left<viewLeft+pad)next=Math.max(0,left-pad);
    else if(right>viewRight-pad)next=Math.max(0,right-container.clientWidth+pad);
    if(next!==viewLeft)container.scrollLeft=next;
  }

  function updateExistingPageNav(pageId){
    const wrap=document.getElementById('editorPageNumbers');
    const prev=document.getElementById('editorPrev');
    const next=document.getElementById('editorNext');
    if(!wrap)return false;
    const buttons=[...wrap.querySelectorAll('[data-editor-page]')];
    if(!buttons.length)return false;
    const idx=buttons.findIndex(button=>button.dataset.editorPage===pageId);
    if(idx<0)return false;
    for(let i=0;i<buttons.length;i++){
      const active=i===idx;
      buttons[i].classList.toggle('active',active);
      buttons[i].setAttribute('aria-current',active?'page':'false');
    }
    if(prev)prev.disabled=idx<=0;
    if(next)next.disabled=idx>=buttons.length-1;
    requestAnimationFrame(()=>horizontalReveal(wrap,buttons[idx]));
    return true;
  }

  function wirePageNav(wrap,pages,idx){
    const prev=document.getElementById('editorPrev');
    const next=document.getElementById('editorNext');
    wrap.querySelectorAll('[data-editor-page]').forEach(button=>{
      button.onclick=()=>{
        const pageId=button.dataset.editorPage;
        if(pageId&&pageId!==activePageId)loadPageIntoEditor(pageId,{closeLibrary:false}).catch(error=>{
          console.error(error);
          if(typeof toast==='function')toast('Could not load that page');
        });
      };
    });
    if(prev){
      prev.disabled=idx<=0;
      prev.onclick=()=>{
        const current=Math.max(0,pages.findIndex(page=>page.id===activePageId));
        if(current>0)loadPageIntoEditor(pages[current-1].id,{closeLibrary:false}).catch(console.error);
      };
    }
    if(next){
      next.disabled=idx<0||idx>=pages.length-1;
      next.onclick=()=>{
        const current=pages.findIndex(page=>page.id===activePageId);
        if(current>=0&&current<pages.length-1)loadPageIntoEditor(pages[current+1].id,{closeLibrary:false}).catch(console.error);
      };
    }
  }

  async function smoothRenderEditorPageNav(){
    const wrap=document.getElementById('editorPageNumbers');
    if(!binderLayerReady||!activeBinderId||!wrap)return;
    const pages=await pagesForBinder(activeBinderId);
    const idx=Math.max(0,pages.findIndex(page=>page.id===activePageId));
    const existing=[...wrap.querySelectorAll('[data-editor-page]')];
    const sameStructure=existing.length===pages.length&&existing.every((button,i)=>button.dataset.editorPage===pages[i].id);

    if(!sameStructure){
      wrap.innerHTML=pages.map((page,i)=>`<button type="button" class="page-number ${page.id===activePageId?'active':''}" data-editor-page="${esc(page.id)}" aria-current="${page.id===activePageId?'page':'false'}" title="${esc(page.title||`Page ${i+1}`)}">${i+1}</button>`).join('');
    }else{
      existing.forEach((button,i)=>{
        const active=pages[i]?.id===activePageId;
        button.classList.toggle('active',active);
        button.setAttribute('aria-current',active?'page':'false');
        button.title=pages[i]?.title||`Page ${i+1}`;
      });
    }

    wirePageNav(wrap,pages,idx);
    const active=wrap.querySelector(`[data-editor-page="${CSS.escape(activePageId)}"]`);
    requestAnimationFrame(()=>horizontalReveal(wrap,active));
  }

  function renderLoadedPageOnly(){
    syncPageControls();
    selected=null;
    if(typeof renderHeader==='function')renderHeader();
    if(typeof renderArts==='function')renderArts();
    if(typeof renderSelected==='function')renderSelected();
    if(typeof renderGrid==='function')renderGrid();
  }

  async function performPageSwitch(pageId,{closeLibrary=true}={}){
    if(!pageId||pageId===activePageId)return;

    const previousBinderId=activeBinderId;
    const pagePromise=dbGet('pages',pageId);
    if(typeof binderWriteTimer!=='undefined'&&binderWriteTimer){
      clearTimeout(binderWriteTimer);
      binderWriteTimer=null;
    }
    const savePromise=saveActivePageSnapshot().catch(error=>console.warn('Could not save current binder page before switching',error));
    const [page]=await Promise.all([pagePromise,savePromise]);
    if(!page){
      if(typeof toast==='function')toast('That saved page could not be loaded');
      return;
    }

    switching=true;
    const canvas=document.getElementById('canvas');
    canvas?.setAttribute('aria-busy','true');
    try{
      binderLoading=true;
      activeBinderId=page.binderId;
      activePageId=page.id;
      persistActiveIds();
      state=cloneEditorState(page.state||defaults);
      try{localStorage.setItem('michiStandaloneState',JSON.stringify(state))}catch{}
      binderLoading=false;

      renderLoadedPageOnly();

      if(previousBinderId===activeBinderId&&!updateExistingPageNav(activePageId)){
        await smoothRenderEditorPageNav();
      }else if(previousBinderId!==activeBinderId){
        await smoothRenderEditorPageNav();
      }

      if(closeLibrary&&typeof closeBinderLibrary==='function')closeBinderLibrary();
      if(typeof toast==='function')toast(`${page.title||'Page'} loaded`);
    }finally{
      binderLoading=false;
      switching=false;
      canvas?.removeAttribute('aria-busy');
    }
  }

  function install(){
    if(typeof loadPageIntoEditor!=='function'||typeof renderEditorPageNav!=='function')return false;
    if(loadPageIntoEditor.__kbsPartialPageSwitch)return true;

    renderEditorPageNav=smoothRenderEditorPageNav;

    const wrappedLoadPage=function(pageId,options={}){
      const task=()=>performPageSwitch(pageId,options);
      switchQueue=switchQueue.catch(()=>{}).then(task);
      return switchQueue;
    };
    wrappedLoadPage.__kbsPartialPageSwitch=true;
    loadPageIntoEditor=wrappedLoadPage;

    globalThis.KBSPageSwitch={
      mode:'partial-render',
      get switching(){return switching},
      refreshNav:()=>smoothRenderEditorPageNav()
    };
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(install()||attempts>=20)clearInterval(timer);
    },250);
  }
})();
