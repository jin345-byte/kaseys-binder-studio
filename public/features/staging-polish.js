/* Binder Studio staging polish — artwork hover preview + wheel zoom */
(function(){
  const artGrid=document.querySelector('#autoArtworkResults');
  const binderGrid=document.querySelector('#grid');
  if(!artGrid||!binderGrid)return;

  const preview=document.createElement('div');
  preview.className='artwork-hover-preview';
  preview.id='artworkHoverPreview';
  preview.hidden=true;
  preview.innerHTML='<img alt="Artwork preview">';
  document.body.appendChild(preview);
  const previewImg=preview.querySelector('img');
  let previewTarget=null;

  function canHover(){return matchMedia('(hover:hover) and (pointer:fine)').matches;}
  function placePreview(x,y){
    const pad=16;
    const w=Math.min(340,innerWidth*.38),h=Math.min(480,innerHeight*.72);
    let left=x+18,top=y+18;
    if(left+w>innerWidth-pad)left=Math.max(pad,x-w-18);
    if(top+h>innerHeight-pad)top=Math.max(pad,innerHeight-h-pad);
    preview.style.left=left+'px';preview.style.top=top+'px';
  }
  function showPreview(img,e){
    if(!canHover()||!img)return;
    previewTarget=img;
    previewImg.src=img.currentSrc||img.src||img.dataset.fallbackSrc||'';
    preview.hidden=false;
    requestAnimationFrame(()=>preview.classList.add('visible'));
    placePreview(e.clientX,e.clientY);
  }
  function hidePreview(){previewTarget=null;preview.classList.remove('visible');setTimeout(()=>{if(!previewTarget)preview.hidden=true},120);}
  artGrid.addEventListener('pointerover',e=>{const img=e.target.closest('.auto-art-image img');if(img)showPreview(img,e)});
  artGrid.addEventListener('pointermove',e=>{if(previewTarget)placePreview(e.clientX,e.clientY)});
  artGrid.addEventListener('pointerout',e=>{if(e.target.closest('.auto-art-image img'))hidePreview()});
  artGrid.addEventListener('click',hidePreview);

  function getItem(index){
    try{return typeof state!=='undefined'?state?.pockets?.[index]:null}catch{return null}
  }
  function persist(){try{if(typeof save==='function')save()}catch{}}
  function clamp(n,min,max){return Math.min(max,Math.max(min,n));}
  function applyZooms(){
    binderGrid.querySelectorAll('.pocket.art[data-pocket]').forEach(p=>{
      const i=Number(p.dataset.pocket),item=getItem(i),img=p.querySelector('img');
      if(!item||!img)return;
      const z=Number.isFinite(item.zoom)?item.zoom:1;
      img.style.transform=`scale(${z})`;
      p.dataset.artZoom=String(Math.round(z*100));
      p.title=`Artwork position · wheel to resize · ${Math.round(z*100)}%`;
    });
  }
  new MutationObserver(applyZooms).observe(binderGrid,{childList:true,subtree:true});
  applyZooms();

  let saveTimer=0;
  binderGrid.addEventListener('wheel',e=>{
    const img=e.target.closest('.pocket.art img');
    if(!img)return;
    const pocket=img.closest('.pocket.art[data-pocket]');
    const i=Number(pocket?.dataset?.pocket),item=getItem(i);
    if(!item||item.kind!=='art')return;
    e.preventDefault();e.stopPropagation();
    const current=Number.isFinite(item.zoom)?item.zoom:1;
    const step=e.deltaY<0?.08:-.08;
    item.zoom=clamp(Math.round((current+step)*100)/100,.5,4);
    img.style.transform=`scale(${item.zoom})`;
    pocket.dataset.artZoom=String(Math.round(item.zoom*100));
    pocket.title=`Artwork position · wheel to resize · ${Math.round(item.zoom*100)}%`;
    clearTimeout(saveTimer);saveTimer=setTimeout(persist,120);
  },{passive:false});
})();
