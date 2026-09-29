/* True 3-slot L-shaped artwork for Binder Studio.
   L artwork uses one continuous clipped image across a 2x2 bounding box while
   occupying only three real pockets. The missing corner remains fully usable. */
(()=>{
  'use strict';
  if(globalThis.KBSArtworkLShapes?.installed)return;

  const L_SHAPES={
    'l-missing-br':{label:'L · 3 slots · open bottom-right',cells:[[0,0],[1,0],[0,1]],clip:'polygon(0 0,100% 0,100% 50%,50% 50%,50% 100%,0 100%)'},
    'l-missing-bl':{label:'L · 3 slots · open bottom-left',cells:[[0,0],[1,0],[1,1]],clip:'polygon(0 0,100% 0,100% 100%,50% 100%,50% 50%,0 50%)'},
    'l-missing-tr':{label:'L · 3 slots · open top-right',cells:[[0,0],[0,1],[1,1]],clip:'polygon(0 0,50% 0,50% 50%,100% 50%,100% 100%,0 100%)'},
    // Anchor is the top-right occupied cell so the top-left corner can stay empty.
    'l-missing-tl':{label:'L · 3 slots · open top-left',cells:[[0,0],[-1,1],[0,1]],clip:'polygon(50% 0,100% 0,100% 100%,0 100%,0 50%,50% 50%)'}
  };

  const isL=item=>Boolean(item?.kind==='art'&&L_SHAPES[item?.size]);
  const shapeFor=item=>L_SHAPES[item?.size]||null;
  const originalRenderGrid=typeof renderGrid==='function'?renderGrid:null;
  const originalCardTilePrint=typeof cardTilePrint==='function'?cardTilePrint:null;
  const originalRenderPrintPageToWindow=typeof renderPrintPageToWindow==='function'?renderPrintPageToWindow:null;
  const originalPreviewMarkup=typeof previewMarkup==='function'?previewMarkup:null;
  const originalFullViewerMarkup=typeof fullViewerMarkup==='function'?fullViewerMarkup:null;
  const baseSpan=typeof span==='function'?span:null;

  function injectStyles(){
    if(document.getElementById('kbsLArtworkShapeStyles'))return;
    const style=document.createElement('style');style.id='kbsLArtworkShapeStyles';style.textContent=`
      #grid{isolation:isolate}
      .kbs-l-art-overlay{position:relative!important;z-index:2!important;min-width:0!important;min-height:0!important;overflow:hidden!important;pointer-events:none!important;border-radius:12px!important;background:transparent!important;align-self:stretch!important;justify-self:stretch!important}
      .kbs-l-art-overlay .sleeve{position:absolute!important;inset:0!important;display:block!important;padding:0!important;border:0!important;background:transparent!important;overflow:hidden!important}
      .kbs-l-art-overlay img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;object-fit:cover!important;display:block!important}
      .kbs-l-art-hit{position:relative!important;z-index:3!important;background:transparent!important;border-color:transparent!important;box-shadow:none!important}
      .kbs-l-art-hit .kbs-l-hit-label{position:absolute;inset:0;opacity:0;pointer-events:none}
      .kbs-l-art-hit:hover{outline:2px solid color-mix(in srgb,var(--accent) 55%,transparent)!important;outline-offset:-2px!important}
      .kbs-l-art-hit .x{z-index:8!important;pointer-events:auto!important}
      .kbs-l-art-open-pocket{position:relative!important;z-index:4!important}
      .kbs-l-preview-overlay{overflow:hidden!important;pointer-events:none!important;align-self:stretch!important;justify-self:stretch!important}
      .kbs-l-preview-overlay img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}
    `;document.head.appendChild(style);
  }
  injectStyles();

  try{
    const existing=new Set(SIZES.map(([value])=>value));
    for(const [value,shape] of Object.entries(L_SHAPES))if(!existing.has(value))SIZES.push([value,shape.label]);
    const picker=document.getElementById('newArtSize');if(picker&&typeof sizeOptions==='function')picker.innerHTML=sizeOptions(picker.value||'1x1');
  }catch(e){console.warn('Could not extend artwork size options',e)}

  function layoutDims(layoutState=state){return layoutState.layout==='2x2'?{columns:2,rows:2}:layoutState.layout==='4x3'?{columns:4,rows:3}:{columns:3,rows:3}}
  function geometry(item,anchorIndex,layoutState=state){
    const d=layoutDims(layoutState),baseCol=anchorIndex%d.columns,baseRow=Math.floor(anchorIndex/d.columns);
    if(!isL(item)){
      const [wr,hr]=String(item?.kind==='art'?item.size||'1x1':'1x1').split('x').map(Number),width=wr||1,height=hr||1,cells=[];
      for(let y=0;y<height;y++)for(let x=0;x<width;x++)cells.push({dx:x,dy:y,nx:x,ny:y,col:baseCol+x,row:baseRow+y,index:anchorIndex+y*d.columns+x});
      return {valid:cells.every(c=>c.col>=0&&c.col<d.columns&&c.row>=0&&c.row<d.rows),width,height,cells,columns:d.columns,rows:d.rows,minCol:baseCol,minRow:baseRow};
    }
    const raw=shapeFor(item).cells,minX=Math.min(...raw.map(x=>x[0])),maxX=Math.max(...raw.map(x=>x[0])),minY=Math.min(...raw.map(x=>x[1])),maxY=Math.max(...raw.map(x=>x[1]));
    const cells=raw.map(([dx,dy])=>({dx,dy,nx:dx-minX,ny:dy-minY,col:baseCol+dx,row:baseRow+dy,index:anchorIndex+dy*d.columns+dx}));
    return {valid:cells.every(c=>c.col>=0&&c.col<d.columns&&c.row>=0&&c.row<d.rows),width:maxX-minX+1,height:maxY-minY+1,cells,columns:d.columns,rows:d.rows,minCol:baseCol+minX,minRow:baseRow+minY};
  }

  span=function(item){return isL(item)?{columns:2,rows:2}:(baseSpan?baseSpan(item):{columns:1,rows:1})};
  placementMap=function(){
    const occupied=new Map();state.pockets.slice(0,count()).forEach((item,origin)=>{if(!item)return;const geo=geometry(item,origin,state);if(!geo.valid)return;for(const cell of geo.cells)if(!occupied.has(cell.index))occupied.set(cell.index,origin)});return occupied;
  };

  place=function(index,item,source=null){
    if(!item)return;const geo=geometry(item,index,state);if(!geo.valid)return toast(isL(item)?'That L-shaped insert does not fit from this pocket':'That insert does not fit from this pocket');
    const map=placementMap(),targets=geo.cells.map(c=>c.index),collisions=new Set(targets.map(t=>map.get(t)).filter(o=>Number.isInteger(o)&&o!==source));collisions.forEach(o=>state.pockets[o]=null);
    if(Number.isInteger(source)&&source!==index){const displacedOrigin=map.get(index),displaced=Number.isInteger(displacedOrigin)&&displacedOrigin!==source?state.pockets[displacedOrigin]:state.pockets[index];state.pockets[source]=displaced||null}
    state.pockets[index]={...item,...(item.kind==='art'?{cropX:Number.isFinite(item.cropX)?item.cropX:50,cropY:Number.isFinite(item.cropY)?item.cropY:50}:{})};selected=null;save();renderGrid();renderSelected();
    requestAnimationFrame(()=>{const p=document.querySelector(`[data-pocket="${index}"]`);if(p){p.classList.add('just-placed');setTimeout(()=>p.classList.remove('just-placed'),420)}});
  };

  function overlayMarkup(item,origin,geo){
    const im=item.imageHigh||item.imageLow||item.image||'',shape=shapeFor(item),x=Number.isFinite(item.cropX)?item.cropX:50,y=Number.isFinite(item.cropY)?item.cropY:50;
    return `<div class="kbs-l-art-overlay" data-l-overlay="${origin}" style="grid-column:${geo.minCol+1}/span ${geo.width};grid-row:${geo.minRow+1}/span ${geo.height};clip-path:${shape.clip};-webkit-clip-path:${shape.clip}"><span class="sleeve"><img src="${esc(im)}" draggable="false" style="object-position:${x}% ${y}%"></span></div>`;
  }
  function hitMarkup(item,origin,cell){
    const remove=cell.index===origin?`<span class="x" data-remove-pocket="${origin}" aria-label="Remove artwork">×</span>`:'';
    return `<button class="pocket filled art kbs-l-art-hit" type="button" draggable="false" data-pocket="${cell.index}" data-art-origin="${origin}" data-filled="1" style="grid-column:${cell.col+1};grid-row:${cell.row+1}"><span class="kbs-l-hit-label">Artwork</span>${remove}</button>`;
  }
  function wireLPan(hit,origin){
    hit.addEventListener('pointerdown',e=>{
      if(e.button!==undefined&&e.button!==0||e.target.closest('[data-remove-pocket]'))return;
      const item=state.pockets[origin];if(!isL(item))return;e.preventDefault();e.stopPropagation();
      const sx=e.clientX,sy=e.clientY,startX=Number.isFinite(item.cropX)?item.cropX:50,startY=Number.isFinite(item.cropY)?item.cropY:50,rect=hit.getBoundingClientRect();hit.setPointerCapture?.(e.pointerId);
      const move=ev=>{item.cropX=clamp(startX-(ev.clientX-sx)/Math.max(1,rect.width*2)*100,0,100);item.cropY=clamp(startY-(ev.clientY-sy)/Math.max(1,rect.height*2)*100,0,100);const img=document.querySelector(`[data-l-overlay="${origin}"] img`);if(img)img.style.objectPosition=`${item.cropX}% ${item.cropY}%`};
      const up=ev=>{hit.releasePointerCapture?.(ev.pointerId);hit.removeEventListener('pointermove',move);hit.removeEventListener('pointerup',up);hit.removeEventListener('pointercancel',up);save()};hit.addEventListener('pointermove',move);hit.addEventListener('pointerup',up);hit.addEventListener('pointercancel',up);
    });
  }

  renderGrid=function(){
    if(!state.pockets.some(isL)){if(originalRenderGrid)return originalRenderGrid();}
    const g=document.querySelector('#grid'),map=placementMap(),d=dims();g.className='grid l'+state.layout;g.style.setProperty('--binder',state.binderColor);g.style.setProperty('--page',state.pageColor);g.style.setProperty('--sleeve',state.sleeveColor);
    let out='',overlays='';const renderedOverlays=new Set();
    for(let i=0;i<count();i++){
      const origin=map.get(i);
      if(Number.isInteger(origin)){
        const mapped=state.pockets[origin];
        if(isL(mapped)){
          const geo=geometry(mapped,origin,state),cell=geo.cells.find(c=>c.index===i);if(cell)out+=hitMarkup(mapped,origin,cell);
          if(!renderedOverlays.has(origin)){renderedOverlays.add(origin);overlays+=overlayMarkup(mapped,origin,geo)}
          continue;
        }
        if(origin!==i)continue;
      }
      const item=state.pockets[i],s=span(item),col=i%d.columns+1,row=Math.floor(i/d.columns)+1;
      if(!item){out+=`<button class="pocket kbs-l-art-open-pocket" data-pocket="${i}" style="grid-column:${col};grid-row:${row}"><b>${i+1}</b><small>Drop or tap to place</small></button>`;continue}
      const kind=item.kind||'card',pos=kind==='art'?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';
      out+=`<button class="pocket filled ${kind}" draggable="${kind==='art'?'false':'true'}" data-pocket="${i}" data-filled="1" style="--sc:${s.columns};--sr:${s.rows};grid-column:${col}/span ${s.columns};grid-row:${row}/span ${s.rows}"><span class="sleeve"><img src="${esc(item.imageHigh||item.imageLow||item.image)}" style="${pos}"></span><span class="x" data-remove-pocket="${i}" aria-label="Remove from pocket">×</span></button>`;
    }
    g.innerHTML=out+overlays;
    g.querySelectorAll('[data-pocket]').forEach(p=>{const actual=Number(p.dataset.pocket),origin=p.dataset.artOrigin!==undefined?Number(p.dataset.artOrigin):actual,item=state.pockets[origin];p.onclick=e=>{if(e.target.matches('[data-remove-pocket]')){state.pockets[origin]=null;save();renderGrid();return}if(isL(item))return;if(e.target.tagName==='IMG'&&item?.kind==='art')return;if(selected)place(actual,selected);else if(item){selected=item;renderSelected()}};p.ondragover=e=>e.preventDefault();p.ondrop=e=>{e.preventDefault();if(drag?.item)place(actual,drag.item,drag.source)};if(p.dataset.filled&&item?.kind!=='art')p.ondragstart=()=>{drag={item,source:origin}};if(isL(item))wireLPan(p,origin);else if(item?.kind==='art')wireArtworkPan(p,origin)});
  };

  function visualMarkup(page,full=false){
    const s=page.state||page||defaults,d=layoutDims(s),occupied=new Map();
    for(let i=0;i<d.columns*d.rows;i++){const item=s.pockets?.[i];if(!item)continue;const geo=geometry(item,i,s);if(!geo.valid)continue;for(const cell of geo.cells)occupied.set(cell.index,i)}
    let cells='',overlays='';const seen=new Set();
    for(let i=0;i<d.columns*d.rows;i++){
      const origin=occupied.get(i),item=Number.isInteger(origin)?s.pockets?.[origin]:s.pockets?.[i];
      if(Number.isInteger(origin)&&isL(item)){
        cells+=`<span class="${full?'pocket':'mini-pocket'} filled art" style="grid-column:${i%d.columns+1};grid-row:${Math.floor(i/d.columns)+1};opacity:.08"></span>`;
        if(!seen.has(origin)){seen.add(origin);const geo=geometry(item,origin,s),im=item.imageLow||item.imageHigh||item.image,shape=shapeFor(item),pos=`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`;overlays+=`<span class="kbs-l-preview-overlay" style="grid-column:${geo.minCol+1}/span 2;grid-row:${geo.minRow+1}/span 2;clip-path:${shape.clip};-webkit-clip-path:${shape.clip}"><img src="${esc(im)}" style="${pos}"></span>`}continue;
      }
      if(Number.isInteger(origin)&&origin!==i)continue;
      const cs=item?.kind==='art'?span(item).columns:1,rs=item?.kind==='art'?span(item).rows:1,im=item&&(item.imageLow||item.imageHigh||item.image),pos=item?.kind==='art'?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';
      cells+=`<span class="${full?'pocket':'mini-pocket'} ${item?'filled':''} ${item?.kind||''}" style="grid-column:${i%d.columns+1}/span ${cs};grid-row:${Math.floor(i/d.columns)+1}/span ${rs}">${im?`${full?'<span class="sleeve">':''}<img src="${esc(im)}" style="${pos}">${full?'</span>':''}`:''}</span>`;
    }
    if(full)return `<div class="grid l${esc(s.layout||'3x3')}" style="--binder:${esc(s.binderColor||defaults.binderColor)};--page:${esc(s.pageColor||defaults.pageColor)};--sleeve:${esc(s.sleeveColor||defaults.sleeveColor)}">${cells}${overlays}</div>`;
    return `<div class="page-card-preview l${esc(s.layout||'3x3')}" style="--mini-binder:${esc(s.binderColor||defaults.binderColor)};--mini-page:${esc(s.pageColor||defaults.pageColor)};--mini-sleeve:${esc(s.sleeveColor||defaults.sleeveColor)}">${cells}${overlays}</div>`;
  }
  previewMarkup=function(page){return page?.state?.pockets?.some(isL)?visualMarkup(page,false):(originalPreviewMarkup?originalPreviewMarkup(page):'')};
  fullViewerMarkup=function(page){return page?.state?.pockets?.some(isL)?visualMarkup(page,true):(originalFullViewerMarkup?originalFullViewerMarkup(page):'')};

  cardTilePrint=function(){
    if(!state.pockets.some(isL)){if(originalCardTilePrint)return originalCardTilePrint();}
    const map=placementMap(),origins=[...new Set([...map.values()])],arts=origins.map(index=>({index,item:state.pockets[index]})).filter(x=>x.item?.kind==='art');if(!arts.length)return toast('Place at least one artwork insert before using card-tile print');
    const tiles=[];for(const {item,index} of arts){const geo=geometry(item,index,state),im=item.imageHigh||item.imageLow||item.image;for(const cell of geo.cells)tiles.push({item,im,x:cell.nx,y:cell.ny,cols:geo.width,rows:geo.height})}
    const pages=[];for(let i=0;i<tiles.length;i+=9)pages.push(tiles.slice(i,i+9));const tile=t=>`<figure class="tile"><div class="cutline"></div><div class="card"><div class="composite" style="width:${t.cols*63}mm;height:${t.rows*88}mm;left:${-t.x*63}mm;top:${-t.y*88}mm"><img src="${esc(t.im)}" style="object-position:${Number.isFinite(t.item.cropX)?t.item.cropX:50}% ${Number.isFinite(t.item.cropY)?t.item.cropY:50}%"></div></div></figure>`,sheets=pages.map((p,i)=>`<section class="sheet">${p.map(tile).join('')}<span class="pageNo">${i+1}/${pages.length}</span></section>`).join('');
    const p=window.open('','_blank');if(!p)return toast('Allow pop-ups once to open the card-tile print sheet');p.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Artwork tiles</title><style>@page{size:letter portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;background:white;font-family:system-ui}.help{max-width:900px;margin:14px auto;padding:12px;background:#171b24;color:white}.help button{float:right}.sheet{position:relative;width:215.9mm;height:279.4mm;margin:auto;display:grid;grid-template-columns:repeat(3,63mm);grid-auto-rows:88mm;gap:3mm;align-content:center;justify-content:center;page-break-after:always}.tile{position:relative;width:63mm;height:88mm;margin:0}.card{position:absolute;inset:0;overflow:hidden;border-radius:3mm}.composite{position:absolute}.composite img{display:block;width:100%;height:100%;object-fit:cover}.cutline{position:absolute;inset:-.7mm;border:.18mm dashed #202020;z-index:5}@media print{.help{display:none}}</style></head><body><div class="help"><button id="doPrint">Print / Save PDF</button><strong>L-shaped artwork tiles</strong><br>Only the three occupied pockets print. Use 100% / Actual size.</div>${sheets}</body></html>`);p.document.close();wirePrintPopup(p,'doPrint');p.focus();
  };

  renderPrintPageToWindow=function(p){
    if(!state.pockets.some(isL))return originalRenderPrintPageToWindow?originalRenderPrintPageToWindow(p):false;
    const d=dims(),map=placementMap(),includeCards=Boolean(document.querySelector('#includeCards')?.checked),origins=[...new Set([...map.values()])],items=origins.map(index=>({index,item:state.pockets[index]})).filter(x=>x.item&&(x.item.kind==='art'||includeCards));if(!items.length){toast('Place at least one artwork insert before printing');try{p?.close?.()}catch{}return false}
    const blocks=[];for(const {item,index} of items){const im=item.imageHigh||item.imageLow||item.image;if(isL(item)){const geo=geometry(item,index,state),shape=shapeFor(item),left=geo.minCol*70,top=geo.minRow*95;blocks.push(`<figure style="left:${left}mm;top:${top}mm;width:${geo.width*70}mm;height:${geo.height*95}mm;clip-path:${shape.clip};-webkit-clip-path:${shape.clip}"><img src="${esc(im)}" style="object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%"></figure>`)}else{const art=item.kind==='art',s=span(item),c=index%d.columns,r=Math.floor(index/d.columns),w=art?s.columns*70:63,h=art?s.rows*95:88,l=c*70+(art?0:3.5),t=r*95+(art?0:3.5),pos=art?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';blocks.push(`<figure style="left:${l}mm;top:${t}mm;width:${w}mm;height:${h}mm"><img src="${esc(im)}" style="${pos}"></figure>`)}}
    const pw=d.columns*70,ph=d.rows*95;if(!p||p.closed)return false;p.document.open();p.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Binder inserts</title><style>@page{size:${pw}mm ${ph}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;background:white}.sheet{position:relative;width:${pw}mm;height:${ph}mm;overflow:hidden;background:${state.pageColor}}figure{position:absolute;margin:0;overflow:hidden;border:.15mm dashed #0004}img{display:block;width:100%;height:100%;object-fit:cover}@media screen{body{padding:16px;background:#20242c}.sheet{margin:auto}.help{color:white;font:14px system-ui;max-width:720px;margin:0 auto 12px}.help button{float:right}}@media print{.help{display:none}}</style></head><body><div class="help"><button id="doPrint">Print / Save PDF</button><strong>Exact-size binder insert sheet</strong><br>L-shaped artwork is clipped to its true three-pocket outline. Print at 100% / Actual size.</div><main class="sheet">${blocks.join('')}</main></body></html>`);p.document.close();wirePrintPopup(p,'doPrint');p.focus();return true;
  };

  globalThis.KBSArtworkLShapes={installed:true,version:'2.0.0',shapes:L_SHAPES,geometry,isL};
  try{renderArts();renderGrid()}catch(e){console.warn('Could not refresh L-shaped artwork UI',e)}
})();