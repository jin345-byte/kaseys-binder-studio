/* Binder Studio v2.8.13 — keep the desktop library panel aligned with the live binder canvas. */
(function(){
  let frame=0;
  let resizeObserver=null;
  let mutationObserver=null;
  let initialized=false;

  function elements(){
    return {
      workspace:document.querySelector('.workspace'),
      library:document.querySelector('.library'),
      canvas:document.querySelector('.canvas'),
      grid:document.querySelector('#grid')
    };
  }

  function isDesktop(){
    return innerWidth>=821&&!document.body.classList.contains('mobile-lab-enabled');
  }

  function sync(){
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const {workspace,library,canvas}=elements();
      if(!workspace||!library||!canvas)return;

      if(!isDesktop()){
        workspace.style.removeProperty('align-items');
        library.style.removeProperty('height');
        library.style.removeProperty('min-height');
        library.removeAttribute('data-canvas-height-sync');
        return;
      }

      /* Let the canvas report its natural content height; then explicitly match it. */
      workspace.style.setProperty('align-items','start','important');
      library.style.removeProperty('height');
      library.style.removeProperty('min-height');

      const canvasHeight=Math.ceil(Math.max(canvas.scrollHeight,canvas.getBoundingClientRect().height));
      if(canvasHeight<=0)return;

      library.style.setProperty('height',canvasHeight+'px','important');
      library.style.setProperty('min-height',canvasHeight+'px','important');
      library.dataset.canvasHeightSync=String(canvasHeight);
      document.documentElement.dataset.artworkHeightSync='ready';
    });
  }

  function init(){
    if(initialized)return true;
    const {workspace,library,canvas,grid}=elements();
    if(!workspace||!library||!canvas)return false;
    initialized=true;

    if(typeof ResizeObserver!=='undefined'){
      resizeObserver=new ResizeObserver(sync);
      resizeObserver.observe(canvas);
    }
    if(typeof MutationObserver!=='undefined'&&grid){
      mutationObserver=new MutationObserver(sync);
      mutationObserver.observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
    }

    addEventListener('resize',sync,{passive:true});
    document.querySelector('#libraryBrowserTabs')?.addEventListener('click',()=>setTimeout(sync,0));
    document.querySelector('#layout')?.addEventListener('change',()=>setTimeout(sync,0));

    sync();
    setTimeout(sync,100);
    setTimeout(sync,400);
    setTimeout(sync,1200);
    return true;
  }

  if(!init()){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
    setTimeout(init,0);
    setTimeout(init,250);
    setTimeout(init,1000);
  }

  globalThis.KBSArtworkHeightSync={sync,init};
})();
