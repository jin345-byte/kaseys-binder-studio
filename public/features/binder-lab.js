/* Kasey's Binder Studio v4.0.6 — binder overview, copy, reorder, and page numbering tools. */
const KBSBinderLab=(()=>{
  const autoTitle=/^Page\s+\d+$/i;

  async function normalizePages(binderId=activeBinderId){
    if(!binderId)return [];
    const pages=await pagesForBinder(binderId);
    const stamp=Date.now();
    for(let i=0;i<pages.length;i++){
      const p=pages[i],nextTitle=`Page ${i+1}`;
      const shouldRename=!String(p.title||'').trim()||autoTitle.test(String(p.title||'').trim());
      let changed=false;
      if(p.order!==i){p.order=i;changed=true}
      if(shouldRename&&p.title!==nextTitle){p.title=nextTitle;changed=true}
      if(changed){p.updatedAt=stamp+i;await dbPut('pages',p)}
    }
    return pages;
  }

  async function duplicatePage(pageId){
    await saveActivePageSnapshot().catch(()=>{});
    const page=await dbGet('pages',pageId);if(!page)return;
    const pages=await pagesForBinder(page.binderId);
    const at=pages.findIndex(p=>p.id===pageId);
    for(let i=pages.length-1;i>at;i--){pages[i].order=i+1;await dbPut('pages',pages[i]);}
    const baseTitle=autoTitle.test(String(page.title||''))?`Page ${at+2}`:`${page.title||`Page ${at+1}`} copy`;
    const copy={...page,id:id('page'),order:at+1,title:baseTitle,createdAt:Date.now(),updatedAt:Date.now(),state:JSON.parse(JSON.stringify(page.state||defaults))};
    await dbPut('pages',copy);await normalizePages(page.binderId);await renderEditorPageNav();await renderBinderLibrary();toast('Page duplicated');
  }

  async function reorderPage(dragId,targetId){
    if(!dragId||!targetId||dragId===targetId)return;
    const pages=await pagesForBinder(activeBinderId),from=pages.findIndex(p=>p.id===dragId),to=pages.findIndex(p=>p.id===targetId);
    if(from<0||to<0)return;
    const [moved]=pages.splice(from,1);pages.splice(to,0,moved);
    for(let i=0;i<pages.length;i++){
      pages[i].order=i;
      if(!String(pages[i].title||'').trim()||autoTitle.test(String(pages[i].title||'').trim()))pages[i].title=`Page ${i+1}`;
      pages[i].updatedAt=Date.now()+i;
      await dbPut('pages',pages[i]);
    }
    await renderEditorPageNav();await renderBinderLibrary();toast('Page order updated');
  }

  let draggedPage='';
  function enhanceOverview(){
    const browser=document.querySelector('#pageBrowser');if(!browser)return;
    if(!document.querySelector('#binderOverviewHint')){const hint=document.createElement('div');hint.className='overview-hint';hint.id='binderOverviewHint';hint.textContent='Tip: drag page cards to reorder. Copy makes a safe duplicate.';browser.parentNode.insertBefore(hint,browser)}
    browser.querySelectorAll('.page-card').forEach(card=>{
      const pid=card.dataset.pageCard;if(!pid)return;card.draggable=true;
      if(!card.querySelector('.duplicate-page')){const actions=card.querySelector('.page-card-actions');if(actions){const b=document.createElement('button');b.type='button';b.className='duplicate-page';b.textContent='Copy';b.title='Duplicate page';b.setAttribute('aria-label','Duplicate page');b.onclick=e=>{e.stopPropagation();duplicatePage(pid).catch(console.error)};actions.insertBefore(b,actions.querySelector('.danger'))}}
      card.ondragstart=e=>{draggedPage=pid;card.classList.add('is-dragging');e.dataTransfer.effectAllowed='move'};
      card.ondragend=()=>{draggedPage='';card.classList.remove('is-dragging');browser.querySelectorAll('.drag-target').forEach(x=>x.classList.remove('drag-target'))};
      card.ondragover=e=>{e.preventDefault();card.classList.add('drag-target');e.dataTransfer.dropEffect='move'};
      card.ondragleave=()=>card.classList.remove('drag-target');
      card.ondrop=e=>{e.preventDefault();card.classList.remove('drag-target');reorderPage(draggedPage,pid).catch(console.error)};
    });
  }

  const coreRenderBinderLibrary=renderBinderLibrary;
  renderBinderLibrary=async function(){await normalizePages(activeBinderId);const r=await coreRenderBinderLibrary.apply(this,arguments);enhanceOverview();return r};
  requestAnimationFrame(enhanceOverview);
  return{duplicatePage,reorderPage,normalizePages,enhanceOverview};
})();
