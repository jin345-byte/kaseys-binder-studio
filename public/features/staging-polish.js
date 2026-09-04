/* Binder Studio v2.9.0 staging polish — hover preview, wheel zoom, brand, page rail, Art of Pokemon proxy */
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
  function placePreview(x,y){const pad=16,w=Math.min(340,innerWidth*.38),h=Math.min(480,innerHeight*.72);let left=x+18,top=y+18;if(left+w>innerWidth-pad)left=Math.max(pad,x-w-18);if(top+h>innerHeight-pad)top=Math.max(pad,innerHeight-h-pad);preview.style.left=left+'px';preview.style.top=top+'px'}
  function showPreview(img,e){if(!canHover()||!img)return;previewTarget=img;previewImg.src=img.currentSrc||img.src||img.dataset.fallbackSrc||'';preview.hidden=false;requestAnimationFrame(()=>preview.classList.add('visible'));placePreview(e.clientX,e.clientY)}
  function hidePreview(){previewTarget=null;preview.classList.remove('visible');setTimeout(()=>{if(!previewTarget)preview.hidden=true},120)}
  artGrid.addEventListener('pointerover',e=>{const img=e.target.closest('.auto-art-image img');if(img)showPreview(img,e)});
  artGrid.addEventListener('pointermove',e=>{if(previewTarget)placePreview(e.clientX,e.clientY)});
  artGrid.addEventListener('pointerout',e=>{if(e.target.closest('.auto-art-image img'))hidePreview()});
  artGrid.addEventListener('click',hidePreview);

  function getItem(index){try{return typeof state!=='undefined'?state?.pockets?.[index]:null}catch{return null}}
  function persist(){try{if(typeof save==='function')save()}catch{}}
  function clamp(n,min,max){return Math.min(max,Math.max(min,n))}
  function applyZooms(){binderGrid.querySelectorAll('.pocket.art[data-pocket]').forEach(p=>{const i=Number(p.dataset.pocket),item=getItem(i),img=p.querySelector('img');if(!item||!img)return;const z=Number.isFinite(item.zoom)?item.zoom:1;img.style.transform=`scale(${z})`;p.dataset.artZoom=String(Math.round(z*100));p.title=`Artwork position · wheel to resize · ${Math.round(z*100)}%`})}
  new MutationObserver(applyZooms).observe(binderGrid,{childList:true,subtree:true});applyZooms();
  let saveTimer=0;
  binderGrid.addEventListener('wheel',e=>{const img=e.target.closest('.pocket.art img');if(!img)return;const pocket=img.closest('.pocket.art[data-pocket]'),i=Number(pocket?.dataset?.pocket),item=getItem(i);if(!item||item.kind!=='art')return;e.preventDefault();e.stopPropagation();const current=Number.isFinite(item.zoom)?item.zoom:1,step=e.deltaY<0?.08:-.08;item.zoom=clamp(Math.round((current+step)*100)/100,.5,4);img.style.transform=`scale(${item.zoom})`;pocket.dataset.artZoom=String(Math.round(item.zoom*100));pocket.title=`Artwork position · wheel to resize · ${Math.round(item.zoom*100)}%`;clearTimeout(saveTimer);saveTimer=setTimeout(persist,120)},{passive:false});

  const brandTitle=document.querySelector('.brand-copy h1');
  if(brandTitle&&!brandTitle.dataset.animatedBrand){const text=brandTitle.textContent||'';brandTitle.textContent='';brandTitle.classList.add('brand-animated');brandTitle.dataset.animatedBrand='1';[...text].forEach((ch,i)=>{const span=document.createElement('span');span.className=ch===' '?'brand-char brand-space':'brand-char';span.style.setProperty('--char-index',String(i));span.textContent=ch===' '?'\u00a0':ch;brandTitle.appendChild(span)})}

  const pageNumbers=document.querySelector('#editorPageNumbers');
  let lastActive='';
  function revealActivePage(){
    if(!pageNumbers)return;
    const active=pageNumbers.querySelector('.page-number.active,[aria-current="page"]');
    if(!active)return;
    active.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
    const key=active.dataset.pageId||active.dataset.page||active.textContent?.trim()||'';
    if(key&&key!==lastActive){lastActive=key;active.classList.remove('page-switch-pop');void active.offsetWidth;active.classList.add('page-switch-pop');setTimeout(()=>active.classList.remove('page-switch-pop'),380)}
  }
  if(pageNumbers){new MutationObserver(()=>requestAnimationFrame(revealActivePage)).observe(pageNumbers,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-current']});pageNumbers.addEventListener('click',()=>setTimeout(revealActivePage,40));document.querySelector('#editorPrev')?.addEventListener('click',()=>setTimeout(revealActivePage,80));document.querySelector('#editorNext')?.addEventListener('click',()=>setTimeout(revealActivePage,80));setTimeout(revealActivePage,250)}

  const addUrlButton=document.querySelector('#addUrl'),artUrlInput=document.querySelector('#artUrl'),artSize=document.querySelector('#newArtSize');
  function artOfPkmProxy(raw){try{const u=new URL(raw);if(u.protocol!=='https:')return raw;if(u.hostname.toLowerCase()==='cdn.artofpkm.com')return `/api/art-image?url=${encodeURIComponent(u.href)}`;return raw}catch{return raw}}
  async function decodedImage(url){const img=new Image();img.decoding='async';img.src=url;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Image could not be decoded'))});if(!img.naturalWidth||!img.naturalHeight)throw new Error('Image had no usable dimensions');return{width:img.naturalWidth,height:img.naturalHeight}}
  if(addUrlButton&&artUrlInput){addUrlButton.onclick=async()=>{const raw=artUrlInput.value.trim();if(!/^https:\/\//i.test(raw))return typeof toast==='function'&&toast('Paste a direct HTTPS image link');const proxied=artOfPkmProxy(raw),isArtOfPkm=proxied!==raw,oldText=addUrlButton.textContent;try{addUrlButton.disabled=true;if(isArtOfPkm)addUrlButton.textContent='Checking image…';if(isArtOfPkm){const response=await fetch(proxied,{cache:'no-store'});if(!response.ok)throw new Error(`Art of Pokémon image unavailable (${response.status})`);if(!(response.headers.get('content-type')||'').toLowerCase().startsWith('image/'))throw new Error('Art of Pokémon returned something other than an image');await response.body?.cancel().catch(()=>{});await decodedImage(proxied)}if(typeof addArt!=='function')throw new Error('Artwork tray is not ready');addArt(proxied,'Artwork',isArtOfPkm?`Art of Pokémon · ${raw}`:'',artSize?.value||'1x1');artUrlInput.value='';if(typeof toast==='function')toast(isArtOfPkm?'Art of Pokémon image added through Binder Studio':'Artwork added')}catch(e){console.warn('Artwork link could not be added',e);if(typeof toast==='function')toast(e?.message||'Artwork could not be loaded')}finally{addUrlButton.disabled=false;addUrlButton.textContent=oldText||'Add link'}}}
})();
