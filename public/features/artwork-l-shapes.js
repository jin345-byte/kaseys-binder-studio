/* Slot-bounded 3-slot L-shaped artwork for Binder Studio.
   Artwork is shown only inside occupied card pockets. The page/gaps never show
   artwork. Native artwork drag gets a live geometry-accurate binder footprint. */
(()=>{
  'use strict';
  if(globalThis.KBSArtworkLShapes?.installed)return;

  const L_SHAPES={
    'l-missing-br':{label:'L · 3 slots · open bottom-right',cells:[[0,0],[1,0],[0,1]]},
    'l-missing-bl':{label:'L · 3 slots · open bottom-left',cells:[[0,0],[1,0],[1,1]]},
    'l-missing-tr':{label:'L · 3 slots · open top-right',cells:[[0,0],[0,1],[1,1]]},
    // Anchor is the top-right occupied cell. This keeps the missing top-left
    // pocket truly free instead of storing artwork in the empty corner.
    'l-missing-tl':{label:'L · 3 slots · open top-left',cells:[[0,0],[-1,1],[0,1]]}
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
    const style=document.createElement('style');
    style.id='kbsLArtworkShapeStyles';
    style.textContent=`
      #grid{isolation:isolate}
      .kbs-l-art-hit{position:relative!important;z-index:2!important;overflow:hidden!important;background:transparent!important}
      .kbs-l-art-hit>.sleeve{position:absolute!important;inset:0!important;overflow:hidden!important;padding:0!important;border:0!important;background:transparent!important}
      .kbs-l-art-hit .kbs-l-cell-composite{position:absolute!important;max-width:none!important;object-fit:cover!important;display:block!important;pointer-events:none!important;user-select:none!important}
      .kbs-l-art-hit .x{z-index:8!important;pointer-events:auto!important}
      .kbs-l-art-open-pocket{position:relative!important;z-index:1!important}
      .kbs-l-mini-piece,.kbs-l-view-piece{position:relative!important;overflow:hidden!important}
      .kbs-l-mini-piece img,.kbs-l-view-piece img{position:absolute!important;max-width:none!important;object-fit:cover!important;display:block!important}
      .kbs-art-drop-preview{position:absolute!important;z-index:40!important;pointer-events:none!important;border-radius:12px!important;background:color-mix(in srgb,var(--accent) 18%,transparent)!important;outline:3px solid color-mix(in srgb,var(--accent) 92%,white 8%)!important;outline-offset:-3px!important;box-shadow:0 0 18px color-mix(in srgb,var(--accent) 70%,transparent),inset 0 0 16px color-mix(in srgb,var(--accent) 28%,transparent)!important;animation:kbsArtDropPulse .72s ease-in-out infinite alternate!important}
      .kbs-art-drop-preview.invalid{background:rgba(239,68,68,.13)!important;outline-color:rgba(248,113,113,.95)!important;box-shadow:0 0 16px rgba(239,68,68,.5),inset 0 0 14px rgba(239,68,68,.22)!important}
      @keyframes kbsArtDropPulse{from{filter:brightness(.95)}to{filter:brightness(1.24)}}
    `;
    document.head.appendChild(style);
  }
  injectStyles();

  try{
    const existing=new Set(SIZES.map(([value])=>value));
    for(const [value,shape] of Object.entries(L_SHAPES))if(!existing.has(value))SIZES.push([value,shape.label]);
    const picker=document.getElementById('newArtSize');
    if(picker&&typeof sizeOptions==='function')picker.innerHTML=sizeOptions(picker.value||'1x1');
  }catch(e){console.warn('Could not extend artwork size options',e)}

  function layoutDims(layoutState=state){
    return layoutState.layout==='2x2'?{columns:2,rows:2}:layoutState.layout==='4x3'?{columns:4,rows:3}:{columns:3,rows:3};
  }

  function geometry(item,anchorIndex,layoutState=state){
    const d=layoutDims(layoutState),baseCol=anchorIndex%d.columns,baseRow=Math.floor(anchorIndex/d.columns);
    if(!isL(item)){
      const [wr,hr]=String(item?.kind==='art'?item.size||'1x1':'1x1').split('x').map(Number),width=wr||1,height=hr||1,cells=[];
      for(let y=0;y<height;y++)for(let x=0;x<width;x++)cells.push({dx:x,dy:y,nx:x,ny:y,col:baseCol+x,row:baseRow+y,index:anchorIndex+y*d.columns+x});
      return {valid:cells.every(c=>c.col>=0&&c.col<d.columns&&c.row>=0&&c.row<d.rows),width,height,cells,columns:d.columns,rows:d.rows,minCol:baseCol,minRow:baseRow};
    }
    const raw=shapeFor(item).cells;
    const minX=Math.min(...raw.map(c=>c[0])),maxX=Math.max(...raw.map(c=>c[0])),minY=Math.min(...raw.map(c=>c[1])),maxY=Math.max(...raw.map(c=>c[1]));
    const cells=raw.map(([dx,dy])=>({dx,dy,nx:dx-minX,ny:dy-minY,col:baseCol+dx,row:baseRow+dy,index:anchorIndex+dy*d.columns+dx}));
    return {valid:cells.every(c=>c.col>=0&&c.col<d.columns&&c.row>=0&&c.row<d.rows),width:maxX-minX+1,height:maxY-minY+1,cells,columns:d.columns,rows:d.rows,minCol:baseCol+minX,minRow:baseRow+minY};
  }

  span=function(item){return isL(item)?{columns:2,rows:2}:(baseSpan?baseSpan(item):{columns:1,rows:1})};

  placementMap=function(){
    const occupied=new Map();
    state.pockets.slice(0,count()).forEach((item,origin)=>{
      if(!item)return;
      const geo=geometry(item,origin,state);if(!geo.valid)return;
      for(const cell of geo.cells)if(!occupied.has(cell.index))occupied.set(cell.index,origin);
    });
    return occupied;
  };

  function placementValidity(item,index,source=null){
    const geo=geometry(item,index,state);if(!geo.valid)return {valid:false,geo};
    const map=placementMap();
    const blocked=geo.cells.some(cell=>{
      const origin=map.get(cell.index);
      return Number.isInteger(origin)&&origin!==source;
    });
    return {valid:!blocked,geo};
  }

  place=function(index,item,source=null){
    if(!item)return;
    const geo=geometry(item,index,state);
    if(!geo.valid)return toast(isL(item)?'That L-shaped insert does not fit from this pocket':'That insert does not fit from this pocket');
    const map=placementMap(),targets=geo.cells.map(c=>c.index),collisions=new Set(targets.map(t=>map.get(t)).filter(o=>Number.isInteger(o)&&o!==source));
    collisions.forEach(o=>state.pockets[o]=null);
    if(Number.isInteger(source)&&source!==index){
      const displacedOrigin=map.get(index),displaced=Number.isInteger(displacedOrigin)&&displacedOrigin!==source?state.pockets[displacedOrigin]:state.pockets[index];
      state.pockets[source]=displaced||null;
    }
    state.pockets[index]={...item,...(item.kind==='art'?{cropX:Number.isFinite(item.cropX)?item.cropX:50,cropY:Number.isFinite(item.cropY)?item.cropY:50}:{})};
    selected=null;save();renderGrid();renderSelected();
    requestAnimationFrame(()=>{const p=document.querySelector(`[data-pocket="${index}"]`);if(p){p.classList.add('just-placed');setTimeout(()=>p.classList.remove('just-placed'),420)}});
  };

  function cellCompositeStyle(item,cell,geo){
    const x=Number.isFinite(item.cropX)?item.cropX:50,y=Number.isFinite(item.cropY)?item.cropY:50;
    return `width:${geo.width*100}%;height:${geo.height*100}%;left:${-cell.nx*100}%;top:${-cell.ny*100}%;object-position:${x}% ${y}%`;
  }

  function lCellMarkup(item,origin,cell,geo){
    const im=item.imageHigh||item.imageLow||item.image||'';
    const remove=cell.index===origin?`<span class="x" data-remove-pocket="${origin}" aria-label="Remove artwork">×</span>`:'';
    return `<button class="pocket filled art kbs-l-art-hit" type="button" draggable="false" data-pocket="${cell.index}" data-art-origin="${origin}" data-filled="1" style="grid-column:${cell.col+1};grid-row:${cell.row+1}"><span class="sleeve"><img class="kbs-l-cell-composite" src="${esc(im)}" draggable="false" style="${cellCompositeStyle(item,cell,geo)}"></span>${remove}</button>`;
  }

  function wireLPan(hit,origin){
    hit.addEventListener('pointerdown',e=>{
      if((e.button!==undefined&&e.button!==0)||e.target.closest('[data-remove-pocket]'))return;
      const item=state.pockets[origin];if(!isL(item))return;
      e.preventDefault();e.stopPropagation();
      const sx=e.clientX,sy=e.clientY,startX=Number.isFinite(item.cropX)?item.cropX:50,startY=Number.isFinite(item.cropY)?item.cropY:50,rect=hit.getBoundingClientRect();
      hit.setPointerCapture?.(e.pointerId);
      const move=ev=>{
        item.cropX=clamp(startX-(ev.clientX-sx)/Math.max(1,rect.width*2)*100,0,100);
        item.cropY=clamp(startY-(ev.clientY-sy)/Math.max(1,rect.height*2)*100,0,100);
        const geo=geometry(item,origin,state);
        document.querySelectorAll(`[data-art-origin="${origin}"] .kbs-l-cell-composite`).forEach((img,i)=>{const cell=geo.cells[i];if(cell)img.style.cssText=cellCompositeStyle(item,cell,geo)});
      };
      const up=ev=>{hit.releasePointerCapture?.(ev.pointerId);hit.removeEventListener('pointermove',move);hit.removeEventListener('pointerup',up);hit.removeEventListener('pointercancel',up);save()};
      hit.addEventListener('pointermove',move);hit.addEventListener('pointerup',up);hit.addEventListener('pointercancel',up);
    });
  }

  function clearDropPreview(){document.querySelectorAll('#grid .kbs-art-drop-preview').forEach(n=>n.remove())}
  function showDropPreview(index,item,source=null){
    clearDropPreview();
    if(!item||item.kind!=='art')return;
    const g=document.getElementById('grid');if(!g)return;
    const result=placementValidity(item,index,source),geo=result.geo;
    if(!geo?.cells?.length)return;
    for(const cell of geo.cells){
      if(cell.col<0||cell.row<0||cell.col>=geo.columns||cell.row>=geo.rows)continue;
      const marker=document.createElement('span');
      marker.className='kbs-art-drop-preview'+(result.valid?'':' invalid');
      marker.style.gridColumn=String(cell.col+1);marker.style.gridRow=String(cell.row+1);
      g.appendChild(marker);
    }
  }

  function wireGridDropPreview(g){
    if(g.dataset.kbsArtworkDropPreview==='1')return;
    g.dataset.kbsArtworkDropPreview='1';
    g.addEventListener('dragover',e=>{
      const item=drag?.item;if(!item||item.kind!=='art'){clearDropPreview();return}
      e.preventDefault();
      const pocket=e.target.closest?.('[data-pocket]');
      if(!pocket){clearDropPreview();return}
      const index=Number(pocket.dataset.pocket);if(!Number.isInteger(index)){clearDropPreview();return}
      showDropPreview(index,item,drag?.source);
    });
    g.addEventListener('dragleave',e=>{if(!g.contains(e.relatedTarget))clearDropPreview()});
    g.addEventListener('drop',clearDropPreview,true);
    document.addEventListener('dragend',clearDropPreview,true);
  }

  renderGrid=function(){
    if(!state.pockets.some(isL)){
      const result=originalRenderGrid?.();
      const g=document.getElementById('grid');if(g)wireGridDropPreview(g);
      return result;
    }
    const g=document.querySelector('#grid'),map=placementMap(),d=dims();
    g.className='grid l'+state.layout;g.style.setProperty('--binder',state.binderColor);g.style.setProperty('--page',state.pageColor);g.style.setProperty('--sleeve',state.sleeveColor);
    let out='';
    for(let i=0;i<count();i++){
      const origin=map.get(i);
      if(Number.isInteger(origin)){
        const mapped=state.pockets[origin];
        if(isL(mapped)){
          const geo=geometry(mapped,origin,state),cell=geo.cells.find(c=>c.index===i);
          if(cell)out+=lCellMarkup(mapped,origin,cell,geo);
          continue;
        }
        if(origin!==i)continue;
      }
      const item=state.pockets[i],s=span(item),col=i%d.columns+1,row=Math.floor(i/d.columns)+1;
      if(!item){out+=`<button class="pocket kbs-l-art-open-pocket" data-pocket="${i}" style="grid-column:${col};grid-row:${row}"><b>${i+1}</b><small>Drop or tap to place</small></button>`;continue}
      const kind=item.kind||'card',pos=kind==='art'?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';
      out+=`<button class="pocket filled ${kind}" draggable="${kind==='art'?'false':'true'}" data-pocket="${i}" data-filled="1" style="--sc:${s.columns};--sr:${s.rows};grid-column:${col}/span ${s.columns};grid-row:${row}/span ${s.rows}"><span class="sleeve"><img src="${esc(item.imageHigh||item.imageLow||item.image)}" style="${pos}"></span><span class="x" data-remove-pocket="${i}" aria-label="Remove from pocket">×</span></button>`;
    }
    g.innerHTML=out;
    g.querySelectorAll('[data-pocket]').forEach(p=>{
      const actual=Number(p.dataset.pocket),origin=p.dataset.artOrigin!==undefined?Number(p.dataset.artOrigin):actual,item=state.pockets[origin];
      p.onclick=e=>{
        if(e.target.matches('[data-remove-pocket]')){state.pockets[origin]=null;save();renderGrid();return}
        if(isL(item))return;
        if(e.target.tagName==='IMG'&&item?.kind==='art')return;
        if(selected)place(actual,selected);else if(item){selected=item;renderSelected()}
      };
      p.ondragover=e=>e.preventDefault();
      p.ondrop=e=>{e.preventDefault();clearDropPreview();if(drag?.item)place(actual,drag.item,drag.source)};
      if(p.dataset.filled&&item?.kind!=='art')p.ondragstart=()=>{drag={item,source:origin}};
      if(isL(item))wireLPan(p,origin);else if(item?.kind==='art')wireArtworkPan(p,origin);
    });
    wireGridDropPreview(g);
  };

  function visualMarkup(page,full=false){
    const s=page.state||page||defaults,d=layoutDims(s),occupied=new Map();
    for(let i=0;i<d.columns*d.rows;i++){const item=s.pockets?.[i];if(!item)continue;const geo=geometry(item,i,s);if(!geo.valid)continue;for(const cell of geo.cells)occupied.set(cell.index,i)}
    let cells='';
    for(let i=0;i<d.columns*d.rows;i++){
      const origin=occupied.get(i),item=Number.isInteger(origin)?s.pockets?.[origin]:s.pockets?.[i];
      if(Number.isInteger(origin)&&isL(item)){
        const geo=geometry(item,origin,s),cell=geo.cells.find(c=>c.index===i),im=item.imageLow||item.imageHigh||item.image;
        if(cell)cells+=`<span class="${full?'pocket kbs-l-view-piece':'mini-pocket kbs-l-mini-piece'} filled art" style="grid-column:${cell.col+1};grid-row:${cell.row+1}">${full?'<span class="sleeve">':''}<img src="${esc(im)}" style="${cellCompositeStyle(item,cell,geo)}">${full?'</span>':''}</span>`;
        continue;
      }
      if(Number.isInteger(origin)&&origin!==i)continue;
      const cs=item?.kind==='art'?span(item).columns:1,rs=item?.kind==='art'?span(item).rows:1,im=item&&(item.imageLow||item.imageHigh||item.image),pos=item?.kind==='art'?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';
      cells+=`<span class="${full?'pocket':'mini-pocket'} ${item?'filled':''} ${item?.kind||''}" style="grid-column:${i%d.columns+1}/span ${cs};grid-row:${Math.floor(i/d.columns)+1}/span ${rs}">${im?`${full?'<span class="sleeve">':''}<img src="${esc(im)}" style="${pos}">${full?'</span>':''}`:''}</span>`;
    }
    if(full)return `<div class="grid l${esc(s.layout||'3x3')}" style="--binder:${esc(s.binderColor||defaults.binderColor)};--page:${esc(s.pageColor||defaults.pageColor)};--sleeve:${esc(s.sleeveColor||defaults.sleeveColor)}">${cells}</div>`;
    return `<div class="page-card-preview l${esc(s.layout||'3x3')}" style="--mini-binder:${esc(s.binderColor||defaults.binderColor)};--mini-page:${esc(s.pageColor||defaults.pageColor)};--mini-sleeve:${esc(s.sleeveColor||defaults.sleeveColor)}">${cells}</div>`;
  }

  previewMarkup=function(page){return page?.state?.pockets?.some(isL)?visualMarkup(page,false):(originalPreviewMarkup?originalPreviewMarkup(page):'')};
  fullViewerMarkup=function(page){return page?.state?.pockets?.some(isL)?visualMarkup(page,true):(originalFullViewerMarkup?originalFullViewerMarkup(page):'')};

  cardTilePrint=function(){
    if(!state.pockets.some(isL)){if(originalCardTilePrint)return originalCardTilePrint()}
    const map=placementMap(),origins=[...new Set([...map.values()])],arts=origins.map(index=>({index,item:state.pockets[index]})).filter(x=>x.item?.kind==='art');
    if(!arts.length)return toast('Place at least one artwork insert before using card-tile print');
    const tiles=[];
    for(const {item,index} of arts){const geo=geometry(item,index,state),im=item.imageHigh||item.imageLow||item.image;for(const cell of geo.cells)tiles.push({item,im,x:cell.nx,y:cell.ny,cols:geo.width,rows:geo.height})}
    const pages=[];for(let i=0;i<tiles.length;i+=9)pages.push(tiles.slice(i,i+9));
    const tile=t=>`<figure class="tile"><div class="cutline"></div><div class="card"><div class="composite" style="width:${t.cols*63}mm;height:${t.rows*88}mm;left:${-t.x*63}mm;top:${-t.y*88}mm"><img src="${esc(t.im)}" style="object-position:${Number.isFinite(t.item.cropX)?t.item.cropX:50}% ${Number.isFinite(t.item.cropY)?t.item.cropY:50}%"></div></div></figure>`;
    const sheets=pages.map((pg,i)=>`<section class="sheet">${pg.map(tile).join('')}<span class="pageNo">${i+1}/${pages.length}</span></section>`).join('');
    const p=window.open('','_blank');if(!p)return toast('Allow pop-ups once to open the card-tile print sheet');
    p.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Artwork tiles</title><style>@page{size:letter portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;background:white;font-family:system-ui}.help{max-width:900px;margin:14px auto;padding:12px;background:#171b24;color:white}.help button{float:right}.sheet{position:relative;width:215.9mm;height:279.4mm;margin:auto;display:grid;grid-template-columns:repeat(3,63mm);grid-auto-rows:88mm;gap:3mm;align-content:center;justify-content:center;page-break-after:always}.tile{position:relative;width:63mm;height:88mm;margin:0}.card{position:absolute;inset:0;overflow:hidden;border-radius:3mm}.composite{position:absolute}.composite img{display:block;width:100%;height:100%;object-fit:cover}.cutline{position:absolute;inset:-.7mm;border:.18mm dashed #202020;z-index:5}@media print{.help{display:none}}</style></head><body><div class="help"><button id="doPrint">Print / Save PDF</button><strong>L-shaped artwork tiles</strong><br>Only occupied card slots print. Use 100% / Actual size.</div>${sheets}</body></html>`);
    p.document.close();wirePrintPopup(p,'doPrint');p.focus();
  };

  renderPrintPageToWindow=function(p){
    if(!state.pockets.some(isL))return originalRenderPrintPageToWindow?originalRenderPrintPageToWindow(p):false;
    const d=dims(),map=placementMap(),includeCards=Boolean(document.querySelector('#includeCards')?.checked),origins=[...new Set([...map.values()])],items=origins.map(index=>({index,item:state.pockets[index]})).filter(x=>x.item&&(x.item.kind==='art'||includeCards));
    if(!items.length){toast('Place at least one artwork insert before printing');try{p?.close?.()}catch{}return false}
    const blocks=[];
    for(const {item,index} of items){
      const im=item.imageHigh||item.imageLow||item.image;
      if(isL(item)){
        const geo=geometry(item,index,state),posX=Number.isFinite(item.cropX)?item.cropX:50,posY=Number.isFinite(item.cropY)?item.cropY:50;
        for(const cell of geo.cells){
          const left=cell.col*70,top=cell.row*95;
          blocks.push(`<figure style="left:${left}mm;top:${top}mm;width:70mm;height:95mm"><div class="composite" style="width:${geo.width*70}mm;height:${geo.height*95}mm;left:${-cell.nx*70}mm;top:${-cell.ny*95}mm"><img src="${esc(im)}" style="object-position:${posX}% ${posY}%"></div></figure>`);
        }
      }else{
        const art=item.kind==='art',s=span(item),c=index%d.columns,r=Math.floor(index/d.columns),w=art?s.columns*70:63,h=art?s.rows*95:88,l=c*70+(art?0:3.5),t=r*95+(art?0:3.5),pos=art?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';
        blocks.push(`<figure style="left:${l}mm;top:${t}mm;width:${w}mm;height:${h}mm"><img src="${esc(im)}" style="${pos}"></figure>`);
      }
    }
    const pw=d.columns*70,ph=d.rows*95;if(!p||p.closed)return false;
    p.document.open();p.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Binder inserts</title><style>@page{size:${pw}mm ${ph}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;background:white}.sheet{position:relative;width:${pw}mm;height:${ph}mm;overflow:hidden;background:${state.pageColor}}figure{position:absolute;margin:0;overflow:hidden;border:.15mm dashed #0004}.composite{position:absolute}.composite img,figure>img{display:block;width:100%;height:100%;object-fit:cover}@media screen{body{padding:16px;background:#20242c}.sheet{margin:auto}.help{color:white;font:14px system-ui;max-width:720px;margin:0 auto 12px}.help button{float:right}}@media print{.help{display:none}}</style></head><body><div class="help"><button id="doPrint">Print / Save PDF</button><strong>Exact-size binder insert sheet</strong><br>Artwork is confined to occupied card slots. Print at 100% / Actual size.</div><main class="sheet">${blocks.join('')}</main></body></html>`);
    p.document.close();wirePrintPopup(p,'doPrint');p.focus();return true;
  };

  globalThis.KBSArtworkLShapes={installed:true,version:'3.0.0',shapes:L_SHAPES,geometry,isL,showDropPreview,clearDropPreview};
  try{renderArts();renderGrid()}catch(e){console.warn('Could not refresh L-shaped artwork UI',e)}
})();