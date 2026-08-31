/* Kasey's Binder Studio v2.2.3 — binder overview enhancements */
const KBSBinderLab=(()=>{
  const coreLoadPage=loadPageIntoEditor;
  loadPageIntoEditor=async function(){
    const grid=document.querySelector('#grid');
    if(grid&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      grid.classList.remove('page-enter');
      grid.classList.add('page-exit');
      await new Promise(r=>setTimeout(r,100));
    }
    const result=await coreLoadPage.apply(this,arguments);
    if(grid){
      grid.classList.remove('page-exit');
      void grid.offsetWidth;
      grid.classList.add('page-enter');
      setTimeout(()=>grid.classList.remove('page-enter'),320);
    }
    return result;
  };

  async function duplicatePage(pageId){
    await saveActivePageSnapshot().catch(()=>{});
    const page=await dbGet('pages',pageId);if(!page)return;
    const pages=await pagesForBinder(page.binderId);
    const at=pages.findIndex(p=>p.id===pageId);
    for(let i=pages.length-1;i>at;i--){
      pages[i].order=i+1;
      await dbPut('pages',pages[i]);
    }
    const copy={
      ...page,
      id:id('page'),
      order:at+1,
      title:`${page.title||`Page ${at+1}`} copy`,
      createdAt:Date.now(),
      updatedAt:Date.now(),
      state:JSON.parse(JSON.stringify(page.state||defaults))
    };
    await dbPut('pages',copy);
    await renderEditorPageNav();
    await renderBinderLibrary();
    toast('Page duplicated');
  }

  async function reorderPage(dragId,targetId){
    if(!dragId||!targetId||dragId===targetId)return;
    const pages=await pagesForBinder(activeBinderId);
    const from=pages.findIndex(p=>p.id===dragId);
    const to=pages.findIndex(p=>p.id===targetId);
    if(from<0||to<0)return;
    const [moved]=pages.splice(from,1);
    pages.splice(to,0,moved);
    for(let i=0;i<pages.length;i++){
      if(pages[i].order!==i){
        pages[i].order=i;
        pages[i].updatedAt=Date.now();
        await dbPut('pages',pages[i]);
      }
    }
    await renderEditorPageNav();
    await renderBinderLibrary();
    toast('Page order updated');
  }

  let draggedPage='';
  function enhanceOverview(){
    const browser=document.querySelector('#pageBrowser');if(!browser)return;
    if(!document.querySelector('#binderOverviewHint')){
      const hint=document.createElement('div');
      hint.className='overview-hint';
      hint.id='binderOverviewHint';
      hint.textContent='Tip: drag page cards to reorder. Duplicate makes a safe copy.';
      browser.parentNode.insertBefore(hint,browser);
    }
    browser.querySelectorAll('.page-card').forEach(card=>{
      const pid=card.dataset.pageCard;if(!pid)return;
      card.draggable=true;
      if(!card.querySelector('.duplicate-page')){
        const actions=card.querySelector('.page-card-actions');
        if(actions){
          const b=document.createElement('button');
          b.type='button';b.className='duplicate-page';b.textContent='Duplicate';
          b.onclick=e=>{e.stopPropagation();duplicatePage(pid).catch(console.error)};
          actions.insertBefore(b,actions.querySelector('.danger'));
        }
      }
      card.ondragstart=e=>{
        draggedPage=pid;card.classList.add('is-dragging');e.dataTransfer.effectAllowed='move';
      };
      card.ondragend=()=>{
        draggedPage='';card.classList.remove('is-dragging');
        browser.querySelectorAll('.drag-target').forEach(x=>x.classList.remove('drag-target'));
      };
      card.ondragover=e=>{
        e.preventDefault();card.classList.add('drag-target');e.dataTransfer.dropEffect='move';
      };
      card.ondragleave=()=>card.classList.remove('drag-target');
      card.ondrop=e=>{
        e.preventDefault();card.classList.remove('drag-target');
        reorderPage(draggedPage,pid).catch(console.error);
      };
    });
  }

  const coreRenderBinderLibrary=renderBinderLibrary;
  renderBinderLibrary=async function(){
    const r=await coreRenderBinderLibrary.apply(this,arguments);
    enhanceOverview();
    return r;
  };

  requestAnimationFrame(enhanceOverview);
  return{duplicatePage,reorderPage,enhanceOverview};
})();
