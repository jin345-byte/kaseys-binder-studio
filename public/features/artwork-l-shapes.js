/* Binder Studio L-artwork v4
   Three independent, sealed pocket viewports sample one virtual 2x2 artwork canvas.
   No L artwork uses the legacy .sleeve renderer, so artwork cannot paint into page gaps. */
(()=>{
'use strict';
if(globalThis.KBSArtworkLShapes?.installed)return;

const L_SHAPES={
  'l-missing-br':{label:'L · 3 slots · open bottom-right',cells:[[0,0],[1,0],[0,1]]},
  'l-missing-bl':{label:'L · 3 slots · open bottom-left',cells:[[0,0],[1,0],[1,1]]},
  'l-missing-tr':{label:'L · 3 slots · open top-right',cells:[[0,0],[0,1],[1,1]]},
  'l-missing-tl':{label:'L · 3 slots · open top-left',cells:[[0,0],[-1,1],[0,1]]}
};
const isL=item=>Boolean(item?.kind==='art'&&L_SHAPES[item?.size]);
const shapeFor=item=>L_SHAPES[item?.size]||null;
const originalRenderGrid=typeof renderGrid==='function'?renderGrid:null;
const originalPreviewMarkup=typeof previewMarkup==='function'?previewMarkup:null;
const originalFullViewerMarkup=typeof fullViewerMarkup==='function'?fullViewerMarkup:null;
const originalCardTilePrint=typeof cardTilePrint==='function'?cardTilePrint:null;
const originalRenderPrintPageToWindow=typeof renderPrintPageToWindow==='function'?renderPrintPageToWindow:null;
const baseSpan=typeof span==='function'?span:null;

function installStyles(){
  document.getElementById('kbsLArtworkShapeStyles')?.remove();
  const s=document.createElement('style');
  s.id='kbsLArtworkShapeStyles';
  s.textContent=`
    #grid{isolation:isolate}
    #grid .kbs-l-cell{position:relative!important;overflow:visible!important;background:transparent!important;z-index:2!important}
    #grid .kbs-l-viewport{position:absolute!important;inset:5px!important;overflow:hidden!important;contain:paint!important;clip-path:inset(0)!important;-webkit-clip-path:inset(0)!important;background:var(--sleeve,#334155)!important;box-shadow:0 0 0 1px rgba(255,255,255,.16),0 1px 2px #0008!important;pointer-events:none!important}
    #grid .kbs-l-plane{position:absolute!important;display:block!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;object-fit:cover!important;pointer-events:none!important;user-select:none!important}
    #grid .kbs-l-cell .x{z-index:8!important;pointer-events:auto!important}
    .kbs-l-mini-cell,.kbs-l-view-cell{position:relative!important;overflow:hidden!important;contain:paint!important}
    .kbs-l-mini-viewport{position:absolute!important;inset:1px!important;overflow:hidden!important;contain:paint!important}
    .kbs-l-view-viewport{position:absolute!important;inset:5px!important;overflow:hidden!important;contain:paint!important;background:var(--sleeve,#334155)!important}
    .kbs-l-mini-plane,.kbs-l-view-plane{position:absolute!important;display:block!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;object-fit:cover!important}
    .kbs-art-drop-preview{position:absolute!important;z-index:40!important;pointer-events:none!important;border-radius:8px!important;background:color-mix(in srgb,var(--accent) 18%,transparent)!important;outline:3px solid color-mix(in srgb,var(--accent) 92%,white 8%)!important;outline-offset:-3px!important;box-shadow:0 0 18px color-mix(in srgb,var(--accent) 70%,transparent),inset 0 0 16px color-mix(in srgb,var(--accent) 28%,transparent)!important;animation:kbsArtDropPulse .72s ease-in-out infinite alternate!important}
    .kbs-art-drop-preview.invalid{background:rgba(239,68,68,.13)!important;outline-color:rgba(248,113,113,.95)!important;box-shadow:0 0 16px rgba(239,68,68,.5),inset 0 0 14px rgba(239,68,68,.22)!important}
    @keyframes kbsArtDropPulse{from{filter:brightness(.95)}to{filter:brightness(1.24)}}
    @media(max-width:768px){#grid .kbs-l-viewport,.kbs-l-view-viewport{inset:2px!important}.kbs-l-mini-viewport{inset:1px!important}}
  `;
  document.head.appendChild(s);
}
installStyles();

try{
  const have=new Set(SIZES.map(([v])=>v));
  for(const [v,d] of Object.entries(L_SHAPES))if(!have.has(v))SIZES.push([v,d.label]);
  const picker=document.getElementById('newArtSize');
  if(picker&&typeof sizeOptions==='function')picker.innerHTML=sizeOptions(picker.value||'1x1');
}catch(e){console.warn('L artwork size options failed',e)}

function layoutDims(s=state){return s.layout==='2x2'?{columns:2,rows:2}:s.layout==='4x3'?{columns:4,rows:3}:{columns:3,rows:3}}
function geometry(item,anchor,s=state){
  const d=layoutDims(s),bc=anchor%d.columns,br=Math.floor(anchor/d.columns);
  if(!isL(item)){
    const [wr,hr]=String(item?.kind==='art'?item.size||'1x1':'1x1').split('x').map(Number),w=wr||1,h=hr||1,cells=[];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)cells.push({dx:x,dy:y,nx:x,ny:y,col:bc+x,row:br+y,index:anchor+y*d.columns+x});
    return{valid:cells.every(c=>c.col>=0&&c.col<d.columns&&c.row>=0&&c.row<d.rows),width:w,height:h,cells,columns:d.columns,rows:d.rows};
  }
  const raw=shapeFor(item).cells,minX=Math.min(...raw.map(c=>c[0])),maxX=Math.max(...raw.map(c=>c[0])),minY=Math.min(...raw.map(c=>c[1])),maxY=Math.max(...raw.map(c=>c[1]));
  const cells=raw.map(([dx,dy])=>({dx,dy,nx:dx-minX,ny:dy-minY,col:bc+dx,row:br+dy,index:anchor+dy*d.columns+dx}));
  return{valid:cells.every(c=>c.col>=0&&c.col<d.columns&&c.row>=0&&c.row<d.rows),width:maxX-minX+1,height:maxY-minY+1,cells,columns:d.columns,rows:d.rows};
}

span=function(item){return isL(item)?{columns:2,rows:2}:(baseSpan?baseSpan(item):{columns:1,rows:1})};
placementMap=function(){
  const out=new Map();
  state.pockets.slice(0,count()).forEach((item,origin)=>{if(!item)return;const g=geometry(item,origin,state);if(!g.valid)return;for(const c of g.cells)if(!out.has(c.index))out.set(c.index,origin)});
  return out;
};
function placementValidity(item,index,source=null){
  const g=geometry(item,index,state);if(!g.valid)return{valid:false,geo:g};
  const map=placementMap();
  return{valid:!g.cells.some(c=>{const o=map.get(c.index);return Number.isInteger(o)&&o!==source}),geo:g};
}
place=function(index,item,source=null){
  if(!item)return;const g=geometry(item,index,state);if(!g.valid)return toast(isL(item)?'That L-shaped insert does not fit from this pocket':'That insert does not fit from this pocket');
  const map=placementMap(),collisions=new Set(g.cells.map(c=>map.get(c.index)).filter(o=>Number.isInteger(o)&&o!==source));collisions.forEach(o=>state.pockets[o]=null);
  if(Number.isInteger(source)&&source!==index){const o=map.get(index),displaced=Number.isInteger(o)&&o!==source?state.pockets[o]:state.pockets[index];state.pockets[source]=displaced||null}
  state.pockets[index]={...item,...(item.kind==='art'?{cropX:Number.isFinite(item.cropX)?item.cropX:50,cropY:Number.isFinite(item.cropY)?item.cropY:50}:{})};selected=null;save();renderGrid();renderSelected();
};

function planeStyle(item,cell,g){
  const x=Number.isFinite(item.cropX)?item.cropX:50,y=Number.isFinite(item.cropY)?item.cropY:50;
  return `width:${g.width*100}%;height:${g.height*100}%;left:${-cell.nx*100}%;top:${-cell.ny*100}%;object-position:${x}% ${y}%`;
}
function lCellMarkup(item,origin,cell,g){
  const im=item.imageHigh||item.imageLow||item.image||'',remove=cell.index===origin?`<span class="x" data-remove-pocket="${origin}" aria-label="Remove artwork">×</span>`:'';
  return `<button class="pocket filled art kbs-l-cell" type="button" draggable="false" data-pocket="${cell.index}" data-art-origin="${origin}" data-filled="1" style="grid-column:${cell.col+1};grid-row:${cell.row+1}"><span class="kbs-l-viewport"><img class="kbs-l-plane" src="${esc(im)}" draggable="false" style="${planeStyle(item,cell,g)}"></span>${remove}</button>`;
}
function refreshPlanes(origin){
  const item=state.pockets[origin];if(!isL(item))return;const g=geometry(item,origin,state);
  document.querySelectorAll(`[data-art-origin="${origin}"]`).forEach(node=>{const idx=Number(node.dataset.pocket),cell=g.cells.find(c=>c.index===idx),img=node.querySelector('.kbs-l-plane');if(cell&&img)img.style.cssText=planeStyle(item,cell,g)});
}
function wireLPan(hit,origin){
  hit.addEventListener('pointerdown',e=>{
    if((e.button!==undefined&&e.button!==0)||e.target.closest('[data-remove-pocket]'))return;const item=state.pockets[origin];if(!isL(item))return;
    e.preventDefault();e.stopPropagation();const sx=e.clientX,sy=e.clientY,startX=Number.isFinite(item.cropX)?item.cropX:50,startY=Number.isFinite(item.cropY)?item.cropY:50,rect=hit.getBoundingClientRect();hit.setPointerCapture?.(e.pointerId);
    const move=ev=>{item.cropX=clamp(startX-(ev.clientX-sx)/Math.max(1,rect.width*2)*100,0,100);item.cropY=clamp(startY-(ev.clientY-sy)/Math.max(1,rect.height*2)*100,0,100);refreshPlanes(origin)};
    const up=ev=>{hit.releasePointerCapture?.(ev.pointerId);hit.removeEventListener('pointermove',move);hit.removeEventListener('pointerup',up);hit.removeEventListener('pointercancel',up);save()};hit.addEventListener('pointermove',move);hit.addEventListener('pointerup',up);hit.addEventListener('pointercancel',up);
  });
}

function clearDropPreview(){document.querySelectorAll('#grid .kbs-art-drop-preview').forEach(n=>n.remove())}
function showDropPreview(index,item,source=null){
  clearDropPreview();if(!item||item.kind!=='art')return;const g=document.getElementById('grid');if(!g)return;const r=placementValidity(item,index,source);if(!r.geo?.cells)return;
  for(const c of r.geo.cells){if(c.col<0||c.row<0||c.col>=r.geo.columns||c.row>=r.geo.rows)continue;const m=document.createElement('span');m.className='kbs-art-drop-preview'+(r.valid?'':' invalid');m.style.gridColumn=String(c.col+1);m.style.gridRow=String(c.row+1);g.appendChild(m)}
}
function wireGridDropPreview(g){
  if(g.dataset.kbsArtworkDropPreview==='1')return;g.dataset.kbsArtworkDropPreview='1';
  g.addEventListener('dragover',e=>{const item=drag?.item;if(!item||item.kind!=='art'){clearDropPreview();return}e.preventDefault();const p=e.target.closest?.('[data-pocket]');if(!p)return clearDropPreview();showDropPreview(Number(p.dataset.pocket),item,drag?.source)});
  g.addEventListener('dragleave',e=>{if(!g.contains(e.relatedTarget))clearDropPreview()});g.addEventListener('drop',clearDropPreview,true);document.addEventListener('dragend',clearDropPreview,true);
}

renderGrid=function(){
  if(!state.pockets.some(isL)){const r=originalRenderGrid?.();const g=document.getElementById('grid');if(g)wireGridDropPreview(g);return r}
  const g=document.getElementById('grid'),map=placementMap(),d=dims();g.className='grid l'+state.layout;g.style.setProperty('--binder',state.binderColor);g.style.setProperty('--page',state.pageColor);g.style.setProperty('--sleeve',state.sleeveColor);let html='';
  for(let i=0;i<count();i++){
    const origin=map.get(i);
    if(Number.isInteger(origin)){
      const mapped=state.pockets[origin];if(isL(mapped)){const geo=geometry(mapped,origin,state),cell=geo.cells.find(c=>c.index===i);if(cell)html+=lCellMarkup(mapped,origin,cell,geo);continue}if(origin!==i)continue;
    }
    const item=state.pockets[i],s=span(item),col=i%d.columns+1,row=Math.floor(i/d.columns)+1;
    if(!item){html+=`<button class="pocket" data-pocket="${i}" style="grid-column:${col};grid-row:${row}"><b>${i+1}</b><small>Drop or tap to place</small></button>`;continue}
    const kind=item.kind||'card',pos=kind==='art'?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';
    html+=`<button class="pocket filled ${kind}" draggable="${kind==='art'?'false':'true'}" data-pocket="${i}" data-filled="1" style="--sc:${s.columns};--sr:${s.rows};grid-column:${col}/span ${s.columns};grid-row:${row}/span ${s.rows}"><span class="sleeve"><img src="${esc(item.imageHigh||item.imageLow||item.image)}" style="${pos}"></span><span class="x" data-remove-pocket="${i}">×</span></button>`;
  }
  g.innerHTML=html;
  g.querySelectorAll('[data-pocket]').forEach(p=>{const actual=Number(p.dataset.pocket),origin=p.dataset.artOrigin!==undefined?Number(p.dataset.artOrigin):actual,item=state.pockets[origin];p.onclick=e=>{if(e.target.matches('[data-remove-pocket]')){state.pockets[origin]=null;save();renderGrid();return}if(isL(item))return;if(e.target.tagName==='IMG'&&item?.kind==='art')return;if(selected)place(actual,selected);else if(item){selected=item;renderSelected()}};p.ondragover=e=>e.preventDefault();p.ondrop=e=>{e.preventDefault();clearDropPreview();if(drag?.item)place(actual,drag.item,drag.source)};if(p.dataset.filled&&item?.kind!=='art')p.ondragstart=()=>{drag={item,source:origin}};if(isL(item))wireLPan(p,origin);else if(item?.kind==='art')wireArtworkPan(p,origin)});
  wireGridDropPreview(g);
};

function visualMarkup(page,full=false){
  const s=page.state||page||defaults,d=layoutDims(s),occupied=new Map();
  for(let i=0;i<d.columns*d.rows;i++){const item=s.pockets?.[i];if(!item)continue;const g=geometry(item,i,s);if(!g.valid)continue;for(const c of g.cells)occupied.set(c.index,i)}
  let cells='';
  for(let i=0;i<d.columns*d.rows;i++){
    const origin=occupied.get(i),item=Number.isInteger(origin)?s.pockets?.[origin]:s.pockets?.[i];
    if(Number.isInteger(origin)&&isL(item)){
      const g=geometry(item,origin,s),c=g.cells.find(x=>x.index===i),im=item.imageLow||item.imageHigh||item.image;if(c){const cellClass=full?'pocket filled art kbs-l-view-cell':'mini-pocket filled art kbs-l-mini-cell',vp=full?'kbs-l-view-viewport':'kbs-l-mini-viewport',pl=full?'kbs-l-view-plane':'kbs-l-mini-plane';cells+=`<span class="${cellClass}" style="grid-column:${c.col+1};grid-row:${c.row+1}"><span class="${vp}"><img class="${pl}" src="${esc(im)}" style="${planeStyle(item,c,g)}"></span></span>`}continue;
    }
    if(Number.isInteger(origin)&&origin!==i)continue;
    const cs=item?.kind==='art'?span(item).columns:1,rs=item?.kind==='art'?span(item).rows:1,im=item&&(item.imageLow||item.imageHigh||item.image),pos=item?.kind==='art'?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';
    cells+=`<span class="${full?'pocket':'mini-pocket'} ${item?'filled':''} ${item?.kind||''}" style="grid-column:${i%d.columns+1}/span ${cs};grid-row:${Math.floor(i/d.columns)+1}/span ${rs}">${im?`${full?'<span class="sleeve">':''}<img src="${esc(im)}" style="${pos}">${full?'</span>':''}`:''}</span>`;
  }
  return full?`<div class="grid l${esc(s.layout||'3x3')}" style="--binder:${esc(s.binderColor||defaults.binderColor)};--page:${esc(s.pageColor||defaults.pageColor)};--sleeve:${esc(s.sleeveColor||defaults.sleeveColor)}">${cells}</div>`:`<div class="page-card-preview l${esc(s.layout||'3x3')}" style="--mini-binder:${esc(s.binderColor||defaults.binderColor)};--mini-page:${esc(s.pageColor||defaults.pageColor)};--mini-sleeve:${esc(s.sleeveColor||defaults.sleeveColor)}">${cells}</div>`;
}
previewMarkup=function(page){return page?.state?.pockets?.some(isL)?visualMarkup(page,false):(originalPreviewMarkup?originalPreviewMarkup(page):'')};
fullViewerMarkup=function(page){return page?.state?.pockets?.some(isL)?visualMarkup(page,true):(originalFullViewerMarkup?originalFullViewerMarkup(page):'')};

cardTilePrint=function(){
  if(!state.pockets.some(isL))return originalCardTilePrint?originalCardTilePrint():undefined;
  const map=placementMap(),origins=[...new Set([...map.values()])],arts=origins.map(index=>({index,item:state.pockets[index]})).filter(x=>x.item?.kind==='art');if(!arts.length)return toast('Place at least one artwork insert before using card-tile print');
  const tiles=[];for(const {item,index} of arts){const g=geometry(item,index,state),im=item.imageHigh||item.imageLow||item.image;for(const c of g.cells)tiles.push({item,im,x:c.nx,y:c.ny,cols:g.width,rows:g.height})}
  const pages=[];for(let i=0;i<tiles.length;i+=9)pages.push(tiles.slice(i,i+9));const tile=t=>`<figure class="tile"><div class="card"><div class="composite" style="width:${t.cols*63}mm;height:${t.rows*88}mm;left:${-t.x*63}mm;top:${-t.y*88}mm"><img src="${esc(t.im)}" style="object-position:${Number.isFinite(t.item.cropX)?t.item.cropX:50}% ${Number.isFinite(t.item.cropY)?t.item.cropY:50}%"></div></div></figure>`,sheets=pages.map(pg=>`<section class="sheet">${pg.map(tile).join('')}</section>`).join('');
  const p=window.open('','_blank');if(!p)return toast('Allow pop-ups once to open the card-tile print sheet');p.document.write(`<!doctype html><html><head><style>@page{size:letter;margin:0}*{box-sizing:border-box}body{margin:0}.sheet{width:215.9mm;height:279.4mm;display:grid;grid-template-columns:repeat(3,63mm);grid-auto-rows:88mm;gap:3mm;align-content:center;justify-content:center;page-break-after:always}.tile,.card{position:relative;width:63mm;height:88mm;overflow:hidden}.composite{position:absolute}.composite img{width:100%;height:100%;object-fit:cover}</style></head><body>${sheets}<button id="doPrint">Print</button></body></html>`);p.document.close();wirePrintPopup(p,'doPrint');p.focus();
};

renderPrintPageToWindow=function(p){
  if(!state.pockets.some(isL))return originalRenderPrintPageToWindow?originalRenderPrintPageToWindow(p):false;
  const d=dims(),map=placementMap(),includeCards=Boolean(document.querySelector('#includeCards')?.checked),origins=[...new Set([...map.values()])],items=origins.map(index=>({index,item:state.pockets[index]})).filter(x=>x.item&&(x.item.kind==='art'||includeCards));if(!items.length){try{p?.close?.()}catch{}return false}
  const blocks=[];for(const {item,index} of items){const im=item.imageHigh||item.imageLow||item.image;if(isL(item)){const g=geometry(item,index,state),px=Number.isFinite(item.cropX)?item.cropX:50,py=Number.isFinite(item.cropY)?item.cropY:50;for(const c of g.cells)blocks.push(`<figure style="left:${c.col*70}mm;top:${c.row*95}mm;width:70mm;height:95mm"><div class="composite" style="width:${g.width*70}mm;height:${g.height*95}mm;left:${-c.nx*70}mm;top:${-c.ny*95}mm"><img src="${esc(im)}" style="object-position:${px}% ${py}%"></div></figure>`)}else{const art=item.kind==='art',s=span(item),c=index%d.columns,r=Math.floor(index/d.columns),w=art?s.columns*70:63,h=art?s.rows*95:88,l=c*70+(art?0:3.5),t=r*95+(art?0:3.5),pos=art?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';blocks.push(`<figure style="left:${l}mm;top:${t}mm;width:${w}mm;height:${h}mm"><img src="${esc(im)}" style="${pos}"></figure>`)}}
  const pw=d.columns*70,ph=d.rows*95;if(!p||p.closed)return false;p.document.open();p.document.write(`<!doctype html><html><head><style>@page{size:${pw}mm ${ph}mm;margin:0}*{box-sizing:border-box}body{margin:0}.sheet{position:relative;width:${pw}mm;height:${ph}mm;overflow:hidden}figure{position:absolute;margin:0;overflow:hidden}.composite{position:absolute}.composite img,figure>img{display:block;width:100%;height:100%;object-fit:cover}</style></head><body><main class="sheet">${blocks.join('')}</main><button id="doPrint">Print</button></body></html>`);p.document.close();wirePrintPopup(p,'doPrint');p.focus();return true;
};

globalThis.KBSArtworkLShapes={installed:true,version:'4.0.0',shapes:L_SHAPES,geometry,isL,showDropPreview,clearDropPreview};
try{renderArts();renderGrid()}catch(e){console.warn('L artwork refresh failed',e)}
})();