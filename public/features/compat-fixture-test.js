(()=>{
  'use strict';
  if(location.hostname!=='kaseys-binder-studio-v4-rc.jin345.workers.dev')return;

  const waitBinder=async()=>{
    for(let i=0;i<100;i++){
      if(typeof binderLayerReady!=='undefined'&&binderLayerReady&&binderDb&&typeof dbPut==='function')return true;
      await new Promise(r=>setTimeout(r,100));
    }
    throw new Error('Binder storage did not become ready.');
  };

  function makeFixture(){
    const now=Date.now();
    const binderId='compat-legacy-v4';
    const pageId='compat-legacy-v4-page-1';
    const base=(typeof defaults!=='undefined'&&defaults)?JSON.parse(JSON.stringify(defaults)):{};
    const state={
      ...base,
      subject:'Legacy Compatibility Test',
      layout:'3x3',
      binderColor:'#111827',
      pageColor:'#080b12',
      sleeveColor:'#334155',
      artworks:Array.isArray(base.artworks)?base.artworks:[],
      pockets:Array.isArray(base.pockets)&&base.pockets.length===9?base.pockets:Array(9).fill(null)
    };
    return {
      binder:{id:binderId,name:'Legacy Compatibility Test',createdAt:now-86400000,updatedAt:now-86400000},
      page:{id:pageId,binderId,order:0,createdAt:now-86400000,updatedAt:now-86400000,state}
    };
  }

  async function installFixture(){
    await waitBinder();
    const {binder,page}=makeFixture();
    await dbPut('binders',binder);
    await dbPut('pages',page);
    activeBinderId=binder.id;
    activePageId=page.id;
    if(typeof persistActiveIds==='function')persistActiveIds();
    state=typeof cloneEditorState==='function'?cloneEditorState(page.state):JSON.parse(JSON.stringify(page.state));
    try{localStorage.setItem('michiStandaloneState',JSON.stringify(state))}catch{}
    if(typeof rerenderEditor==='function')rerenderEditor();
    if(typeof renderEditorPageNav==='function')await renderEditorPageNav();
    if(typeof renderBinderList==='function')await renderBinderList();
    if(typeof toast==='function')toast('Legacy compatibility test binder loaded');
    return {binderId:binder.id,pageId:page.id};
  }

  function mount(){
    if(document.querySelector('#compatFixtureBtn'))return;
    const top=document.querySelector('.top-actions');
    if(!top)return;
    const btn=document.createElement('button');
    btn.id='compatFixtureBtn';
    btn.type='button';
    btn.className='btn ghost';
    btn.textContent='Load legacy test binder';
    btn.title='Release-candidate only: loads a production-format compatibility fixture into the isolated staging database/device.';
    btn.addEventListener('click',async()=>{
      if(!confirm('Load the legacy compatibility test binder into this release-candidate account? This only affects the isolated candidate/staging environment.'))return;
      btn.disabled=true;
      const old=btn.textContent;
      btn.textContent='Loading…';
      try{await installFixture();btn.textContent='Legacy binder loaded'}catch(err){console.error(err);btn.textContent='Load failed';if(typeof toast==='function')toast(err?.message||'Could not load compatibility binder')}finally{setTimeout(()=>{btn.disabled=false;btn.textContent=old},2200)}
    });
    top.appendChild(btn);
  }

  globalThis.KBSCompatFixture={installFixture,makeFixture};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
