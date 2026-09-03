/* Binder Studio staging — guided tour update for automatic prebuilt catalog */
(function(){
  function init(){
    const title=document.querySelector('#guidedDemoTitle');
    const text=document.querySelector('#guidedDemoText');
    const bubble=document.querySelector('#guidedDemoCard');
    const status=document.querySelector('#masterLibraryStatus');
    const oldTarget=document.querySelector('#syncMasterLibrary');
    if(!title||!text||!bubble)return;

    let usingAutoLibraryStep=false;

    function positionByStatus(){
      if(!usingAutoLibraryStep||!status||status.offsetParent===null)return;
      const r=status.getBoundingClientRect();
      const b=bubble.getBoundingClientRect();
      const pad=10;
      let left=Math.max(pad,Math.min(innerWidth-b.width-pad,r.left));
      let top=r.bottom+10;
      if(top+b.height>innerHeight-pad)top=Math.max(pad,r.top-b.height-10);
      bubble.style.left=left+'px';
      bubble.style.top=top+'px';
      bubble.style.transform='none';
    }

    function apply(){
      const isLegacyStep=title.textContent.trim()==='Build the card library';
      if(isLegacyStep){
        usingAutoLibraryStep=true;
        title.textContent='Your card library loads automatically';
        text.textContent='Binder Studio checks for the latest prebuilt English + Pocket catalog when it opens. On a new browser it downloads and installs the catalog automatically; later visits reuse the local copy. Start building as soon as the library status says Ready.';
        oldTarget?.classList.remove('guided-demo-target','guided-demo-click-pulse');
        if(status){
          status.classList.add('guided-demo-target');
          status.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
          setTimeout(positionByStatus,240);
        }
        return;
      }
      if(usingAutoLibraryStep){
        usingAutoLibraryStep=false;
        status?.classList.remove('guided-demo-target','guided-demo-click-pulse');
      }
    }

    new MutationObserver(apply).observe(title,{childList:true,subtree:true,characterData:true});
    addEventListener('resize',()=>setTimeout(positionByStatus,0),{passive:true});
    apply();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
