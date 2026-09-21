/* Binder Studio production hotfix — route Art of Pokemon cover backgrounds through the existing image proxy. */
(function(){
  'use strict';
  const ART_HOST='cdn.artofpkm.com';
  const clean=v=>String(v||'').trim();
  function proxied(raw){
    const value=clean(raw);
    if(!value)return '';
    if(value.startsWith('/api/art-image?url='))return value;
    try{
      const u=new URL(value,location.href);
      if(u.protocol==='https:'&&u.hostname.toLowerCase()===ART_HOST)return `/api/art-image?url=${encodeURIComponent(u.href)}`;
    }catch{}
    return value;
  }
  function setCoverBg(el,raw){
    if(!el)return;
    const url=proxied(raw);
    const safe=url.replace(/["\\\n\r]/g,'');
    el.style.backgroundImage=safe?`linear-gradient(180deg,rgba(5,8,12,.08),rgba(5,8,12,.52)),url("${safe}")`:'';
    el.classList.toggle('has-art',Boolean(safe));
  }
  function refreshDesigner(){
    const modal=document.querySelector('#binderCoverDesigner');
    if(!modal)return;
    const upload=clean(modal.dataset.upload);
    const raw=upload||clean(modal.querySelector('#binderCoverBackground')?.value);
    setCoverBg(modal.querySelector('.binder-cover-preview-art'),raw);
  }
  async function refreshShelf(){
    if(typeof dbAll!=='function')return;
    let binders=[];
    try{binders=await dbAll('binders')}catch{return}
    const byId=new Map((binders||[]).map(b=>[String(b.id),b]));
    document.querySelectorAll('#binderList [data-binder].binder-cover-card').forEach(chip=>{
      const binder=byId.get(String(chip.dataset.binder));
      if(!binder)return;
      const cover=binder.cover||{};
      setCoverBg(chip.querySelector('.binder-cover-art'),clean(cover.customImage)||clean(cover.backgroundUrl));
    });
  }
  function refresh(){refreshDesigner();refreshShelf().catch(()=>{})}
  let timer=0;
  function schedule(){clearTimeout(timer);timer=setTimeout(refresh,0)}
  document.addEventListener('input',e=>{if(e.target?.id==='binderCoverBackground')queueMicrotask(refreshDesigner)},true);
  document.addEventListener('change',e=>{if(e.target?.id==='binderCoverBackground'||e.target?.id==='binderCoverUpload')setTimeout(refreshDesigner,0)},true);
  const observer=new MutationObserver(mutations=>{
    for(const m of mutations){
      if(m.type==='attributes'&&m.target?.id==='binderCoverDesigner'){schedule();return}
      if(m.type==='childList'&&(m.target?.id==='binderList'||m.target?.closest?.('#binderList'))){schedule();return}
      for(const node of m.addedNodes||[]){if(node.nodeType===1&&(node.id==='binderCoverDesigner'||node.querySelector?.('#binderCoverDesigner')||node.id==='binderList'||node.querySelector?.('#binderList'))){schedule();return}}
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-hidden']});
  setTimeout(refresh,50);
  globalThis.KBSBinderCoverArtProxy={proxied,refresh};
})();
