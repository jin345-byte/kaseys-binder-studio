/* 3-slot L-shaped artwork support for Binder Studio.
   Adds all four 2x2-minus-one-corner orientations while preserving the fourth
   pocket as a real usable pocket. Rectangular artwork continues to use the
   existing editor path. */
(()=>{
  'use strict';

  if(globalThis.KBSArtworkLShapes?.installed)return;

  const L_SHAPES={
    'l-missing-br':{label:'L · 3 slots · open bottom-right',cells:[[0,0],[1,0],[0,1]]},
    'l-missing-bl':{label:'L · 3 slots · open bottom-left',cells:[[0,0],[1,0],[1,1]]},
    'l-missing-tr':{label:'L · 3 slots · open top-right',cells:[[0,0],[0,1],[1,1]]},
    // Anchor is the top-right occupied cell so the missing top-left pocket stays free.
    'l-missing-tl':{label:'L · 3 slots · open top-left',cells:[[0,0],[-1,1],[0,1]]}
  };

  const isL=item=>Boolean(item?.kind==='art'&&L_SHAPES[item?.size]);
  const defFor=item=>L_SHAPES[item?.size]||null;
  const originalRenderGrid=typeof renderGrid==='function'?renderGrid:null;
  const originalCardTilePrint=typeof cardTilePrint==='function'?cardTilePrint:null;
  const originalRenderPrintPageToWindow=typeof renderPrintPageToWindow==='function'?renderPrintPageToWindow:null;
  const originalPreviewMarkup=typeof previewMarkup==='function'?previewMarkup:null;
  const originalFullViewerMarkup=typeof fullViewerMarkup==='function'?fullViewerMarkup:null;

  // Extend the existing artwork-size source of truth rather than creating a second dropdown model.
  try{
    const existing=new Set(SIZES.map(([value])=>value));
    for(const [value,shape] of Object.entries(L_SHAPES))if(!existing.has(value))SIZES.push([value,shape.label]);
    const picker=document.getElementById('newArtSize');
    if(picker&&typeof sizeOptions==='function')picker.innerHTML=sizeOptions(picker.value||'1x1');
  }catch(e){console.warn('Could not extend artwork size options',e)}

  function geometry(item,anchorIndex,layoutState=state){
    const d=layoutState.layout==='2x2'?{columns:2,rows:2}:layoutState.layout==='4x3'?{columns:4,rows:3}:{columns:3,rows:3};
    const baseCol=anchorIndex%d.columns,baseRow=Math.floor(anchorIndex/d.columns);
    if(!isL(item)){
      const [wRaw,hRaw]=String(item?.kind==='art'?item.size||'1x1':'1x1').split('x').map(Number);
      const width=wRaw||1,height=hRaw||1,cells=[];
      for(let y=0;y<height;y++)for(let x=0;x<width;x++)cells.push({dx:x,dy:y,nx:x,ny:y});
      const placed=cells.map(cell=>({...cell,col:baseCol+cell.dx,row:baseRow+cell.dy,index:anchorIndex+cell.dy*d.columns+cell.dx}));
      const valid=placed.every(cell=>cell.col>=0&&cell.col<d.columns&&cell.row>=0&&cell.row<d.rows);
      return {valid,width,height,cells:placed,columns:d.columns,rows:d.rows,minX:0,minY:0};
    }
    const raw=defFor(item).cells;
    const minX=Math.min(...raw.map(([x])=>x)),maxX=Math.max(...raw.map(([x])=>x));
    const minY=Math.min(...raw.map(([,y])=>y)),maxY=Math.max(...raw.map(([,y])=>y));
    const cells=raw.map(([dx,dy])=>({
      dx,dy,nx:dx-minX,ny:dy-minY,
      col:baseCol+dx,row:baseRow+dy,
      index:anchorIndex+dy*d.columns+dx
    }));
    const valid=cells.every(cell=>cell.col>=0&&cell.col<d.columns&&cell.row>=0&&cell.row<d.rows);
    return {valid,width:maxX-minX+1,height:maxY-minY+1,cells,columns:d.columns,rows:d.rows,minX,minY};
  }

  // Keep legacy callers informed that L artwork occupies a 2x2 bounding box,
  // while actual occupancy is handled by geometry()/placementMap().
  const baseSpan=typeof span==='function'?span:null;
  span=function(item){
    if(isL(item))return {columns:2,rows:2};
    return baseSpan?baseSpan(item):{columns:1,rows:1};
  };

  placementMap=function(){
    const occupied=new Map();
    const total=count();
    state.pockets.slice(0,total).forEach((item,origin)=>{
      if(!item)return;
      const geo=geometry(item,origin,state);if(!geo.valid)return;
      for(const cell of geo.cells){if(!occupied.has(cell.index))occupied.set(cell.index,origin)}
    });
    return occupied;
  };

  place=function(index,item,source=null){
    if(!item)return;
    const geo=geometry(item,index,state);
    if(!geo.valid)return toast(isL(item)?'That L-shaped insert does not fit from this pocket':'That insert does not fit from this pocket');
    const map=placementMap();
    const targets=geo.cells.map(cell=>cell.index);
    const collisions=new Set(targets.map(target=>map.get(target)).filter(origin=>Number.isInteger(origin)&&origin!==source));
    collisions.forEach(origin=>{state.pockets[origin]=null});

    if(Number.isInteger(source)&&source!==index){
      const displacedOrigin=map.get(index);
      const displaced=Number.isInteger(displacedOrigin)&&displacedOrigin!==source?state.pockets[displacedOrigin]:state.pockets[index];
      state.pockets[source]=displaced||null;
    }
    state.pockets[index]={...item,...(item.kind==='art'?{cropX:Number.isFinite(item.cropX)?item.cropX:50,cropY:Number.isFinite(item.cropY)?item.cropY:50}:{})};
    selected=null;save();renderGrid();renderSelected();
    requestAnimationFrame(()=>{
      const pocket=document.querySelector(`[data-pocket="${index}"]`);
      if(pocket){pocket.classList.add('just-placed');setTimeout(()=>pocket.classList.remove('just-placed'),420)}
    });
  };

  function lPieceMarkup(item,origin,cell,geo){
    const im=item.imageHigh||item.imageLow||item.image||'';
    const posX=Number.isFinite(item.cropX)?item.cropX:50,posY=Number.isFinite(item.cropY)?item.cropY:50;
    const col=cell.col+1,row=cell.row+1;
    const remove=cell.index===origin?`<span class="x" data-remove-pocket="${origin}" aria-label="Remove artwork">×</span>`:'';
    return `<button class="pocket filled art kbs-l-art-piece" draggable="false" data-pocket="${cell.index}" data-art-origin="${origin}" data-filled="1" style="grid-column:${col};grid-row:${row}">
      <span class="sleeve kbs-l-piece-clip"><img src="${esc(im)}" class="kbs-l-composite-image" style="width:${geo.width*100}%;height:${geo.height*100}%;left:${-cell.nx*100}%;top:${-cell.ny*100}%;object-position:${posX}% ${posY}%"></span>${remove}</button>`;
  }

  function wireLPan(piece,origin){
    const img=piece.querySelector('img');if(!img)return;
    img.addEventListener('click',e=>e.stopPropagation());
    img.addEventListener('pointerdown',e=>{
      if(e.button!==undefined&&e.button!==0)return;
      e.preventDefault();e.stopPropagation();
      const item=state.pockets[origin];if(!isL(item))return;
      const sx=e.clientX,sy=e.clientY,startX=Number.isFinite(item.cropX)?item.cropX:50,startY=Number.isFinite(item.cropY)?item.cropY:50;
      const rect=piece.getBoundingClientRect();
      img.setPointerCapture?.(e.pointerId);
      const move=ev=>{
        item.cropX=clamp(startX-(ev.clientX-sx)/Math.max(1,rect.width*2)*100,0,100);
        item.cropY=clamp(startY-(ev.clientY-sy)/Math.max(1,rect.height*2)*100,0,100);
        document.querySelectorAll(`[data-art-origin="${origin}"] .kbs-l-composite-image`).forEach(node=>node.style.objectPosition=`${item.cropX}% ${item.cropY}%`);
      };
      const up=ev=>{img.releasePointerCapture?.(ev.pointerId);img.removeEventListener('pointermove',move);img.removeEventListener('pointerup',up);img.removeEventListener('pointercancel',up);save()};
      img.addEventListener('pointermove',move);img.addEventListener('pointerup',up);img.addEventListener('pointercancel',up);
    });
  }

  renderGrid=function(){
    if(!state.pockets.some(isL)){if(originalRenderGrid)return originalRenderGrid();}
    const g=document.querySelector('#grid'),map=placementMap(),d=dims();
    g.className='grid l'+state.layout;g.style.setProperty('--binder',state.binderColor);g.style.setProperty('--page',state.pageColor);g.style.setProperty('--sleeve',state.sleeveColor);
    let out='';
    for(let i=0;i<count();i++){
      const origin=map.get(i);
      if(Number.isInteger(origin)){
        const item=state.pockets[origin];
        if(isL(item)){
          const geo=geometry(item,origin,state),cell=geo.cells.find(x=>x.index===i);
          if(cell)out+=lPieceMarkup(item,origin,cell,geo);
          continue;
        }
        if(origin!==i)continue;
      }
      const item=state.pockets[i],s=span(item),col=i%d.columns+1,row=Math.floor(i/d.columns)+1;
      if(!item){out+=`<button class="pocket" data-pocket="${i}" style="grid-column:${col};grid-row:${row}"><b>${i+1}</b><small>Drop or tap to place</small></button>`;continue;}
      const kind=item.kind||'card',pos=kind==='art'?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';
      out+=`<button class="pocket filled ${kind}" draggable="${kind==='art'?'false':'true'}" data-pocket="${i}" data-filled="1" style="--sc:${s.columns};--sr:${s.rows};grid-column:${col}/span ${s.columns};grid-row:${row}/span ${s.rows}"><span class="sleeve"><img src="${esc(item.imageHigh||item.imageLow||item.image)}" style="${pos}"></span><span class="x" data-remove-pocket="${i}" aria-label="Remove from pocket">×</span></button>`;
    }
    g.innerHTML=out;
    g.querySelectorAll('[data-pocket]').forEach(p=>{
      const actual=Number(p.dataset.pocket),origin=p.dataset.artOrigin!==undefined?Number(p.dataset.artOrigin):actual;
      const item=state.pockets[origin];
      p.onclick=e=>{
        if(e.target.matches('[data-remove-pocket]')){state.pockets[origin]=null;save();renderGrid();return}
        if(e.target.tagName==='IMG'&&item?.kind==='art')return;
        if(selected)place(actual,selected);else if(item){selected=item;renderSelected()}
      };
      p.ondragover=e=>e.preventDefault();
      p.ondrop=e=>{e.preventDefault();if(drag?.item)place(actual,drag.item,drag.source)};
      if(p.dataset.filled&&item?.kind!=='art')p.ondragstart=()=>{drag={item,source:origin}};
      if(isL(item))wireLPan(p,origin);else if(item?.kind==='art')wireArtworkPan(p,origin);
    });
  };

  cardTilePrint=function(){
    if(!state.pockets.some(isL)){if(originalCardTilePrint)return originalCardTilePrint();}
    const map=placementMap();
    const arts=state.pockets.slice(0,count()).map((item,index)=>({item,index})).filter(({item,index})=>item&&item.kind==='art'&&[...map.values()].includes(index));
    if(!arts.length)return toast('Place at least one artwork insert before using card-tile print');
    const tiles=[];
    for(const {item,index} of arts){
      const geo=geometry(item,index,state),im=item.imageHigh||item.imageLow||item.image;
      for(const cell of geo.cells)tiles.push({item,im,x:cell.nx,y:cell.ny,cols:geo.width,rows:geo.height});
    }
    const pages=[];for(let i=0;i<tiles.length;i+=9)pages.push(tiles.slice(i,i+9));
    const tileMarkup=t=>`<figure class="tile"><div class="cutline"></div><div class="card"><div class="composite" style="width:${t.cols*63}mm;height:${t.rows*88}mm;left:${-t.x*63}mm;top:${-t.y*88}mm"><img src="${esc(t.im)}" style="object-position:${Number.isFinite(t.item.cropX)?t.item.cropX:50}% ${Number.isFinite(t.item.cropY)?t.item.cropY:50}%"></div></div></figure>`;
    const sheets=pages.map((page,i)=>`<section class="sheet">${page.map(tileMarkup).join('')}<span class="pageNo">${i+1}/${pages.length}</span></section>`).join('');
    const p=window.open('','_blank');if(!p)return toast('Allow pop-ups once to open the card-tile print sheet');
    p.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(state.subject||"Kasey's Binder Studio")} card tiles</title><style>@page{size:letter portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:white;font-family:system-ui,sans-serif}.help{max-width:900px;margin:14px auto;padding:12px 14px;border-radius:10px;background:#171b24;color:#fff;font-size:14px;line-height:1.45}.help button{float:right;padding:9px 14px}.sheet{position:relative;width:215.9mm;height:279.4mm;margin:0 auto;display:grid;grid-template-columns:repeat(3,63mm);grid-auto-rows:88mm;gap:3mm;align-content:center;justify-content:center;page-break-after:always}.sheet:last-of-type{page-break-after:auto}.tile{position:relative;width:63mm;height:88mm;margin:0}.card{position:absolute;inset:0;overflow:hidden;border-radius:3mm}.composite{position:absolute;overflow:hidden}.composite img{display:block;width:100%;height:100%;object-fit:cover}.cutline{position:absolute;inset:-.7mm;border:.18mm dashed #202020;border-radius:3.7mm;z-index:5}@media print{.help{display:none}}</style></head><body><div class="help"><button id="doPrint">Print / Save PDF</button><strong>Card-tile artwork mode</strong><br>L-shaped artwork prints only its three occupied card tiles. Print at 100% / Actual size.</div>${sheets}</body></html>`);
    p.document.close();wirePrintPopup(p,'doPrint');p.focus();
  };

  renderPrintPageToWindow=function(p){
    if(!state.pockets.some(isL)){return originalRenderPrintPageToWindow?originalRenderPrintPageToWindow(p):false;}
    const d=dims(),map=placementMap(),includeCards=Boolean(document.querySelector('#includeCards')?.checked);
    const items=state.pockets.slice(0,count()).map((item,index)=>({item,index})).filter(({item,index})=>item&&[...map.values()].includes(index)&&(item.kind==='art'||includeCards));
    if(!items.length){toast(includeCards?'Place at least one card or artwork before printing':'Place at least one artwork insert, or check Cards to include placed cards');try{p?.close?.()}catch{}return false}
    const blocks=[];
    for(const {item,index} of items){
      const art=item.kind==='art',im=item.imageHigh||item.imageLow||item.image,pos=`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`;
      if(isL(item)){
        const geo=geometry(item,index,state);
        for(const cell of geo.cells){
          const left=cell.col*70,top=cell.row*95;
          blocks.push(`<figure style="left:${left}mm;top:${top}mm;width:70mm;height:95mm"><div class="lprint" style="width:${geo.width*70}mm;height:${geo.height*95}mm;left:${-cell.nx*70}mm;top:${-cell.ny*95}mm"><img src="${esc(im)}" style="${pos}"></div></figure>`);
        }
      }else{
        const s=span(item),c=index%d.columns,r=Math.floor(index/d.columns),w=art?s.columns*70:63,h=art?s.rows*95:88,l=c*70+(art?0:3.5),t=r*95+(art?0:3.5);
        blocks.push(`<figure style="left:${l}mm;top:${t}mm;width:${w}mm;height:${h}mm"><img src="${esc(im)}" style="${art?pos:''}"></figure>`);
      }
    }
    const pw=d.columns*70,ph=d.rows*95;
    p.document.open();p.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(state.subject||"Kasey's Binder Studio")} print inserts</title><style>@page{size:${pw}mm ${ph}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:white}.sheet{position:relative;width:${pw}mm;height:${ph}mm;overflow:hidden;background:${state.pageColor}}figure{position:absolute;margin:0;overflow:hidden;border:.15mm dashed #0004}figure>img,.lprint img{display:block;width:100%;height:100%;object-fit:cover}.lprint{position:absolute;overflow:hidden}.help{margin:0 auto 12px;max-width:720px;color:white;font:14px system-ui}.help button{float:right;padding:8px 14px}@media screen{body{padding:16px;background:#20242c}.sheet{margin:auto;box-shadow:0 12px 40px #0008}}@media print{.help{display:none}}</style></head><body><div class="help"><button id="doPrint">Print / Save PDF</button><strong>Exact-size binder insert sheet</strong><br>L-shaped artwork prints only the three occupied pocket areas. Print at 100% / Actual size.</div><main class="sheet">${blocks.join('')}</main></body></html>`);p.document.close();wirePrintPopup(p,'doPrint');p.focus();return true;
  };

  function stateMarkup(s,mini=false){
    const d=s.layout==='2x2'?{columns:2,total:4}:s.layout==='4x3'?{columns:4,total:12}:{columns:3,total:9};
    const localState={...s,layout:s.layout||'3x3'},occupied=new Map();
    for(let i=0;i<d.total;i++){
      const item=s.pockets?.[i];if(!item)continue;
      const geo=geometry(item,i,localState);if(!geo.valid)continue;
      for(const cell of geo.cells)if(!occupied.has(cell.index))occupied.set(cell.index,i);
    }
    let cells='';
    for(let i=0;i<d.total;i++){
      const origin=occupied.get(i);
      if(Number.isInteger(origin)){
        const item=s.pockets?.[origin];
        if(isL(item)){
          const geo=geometry(item,origin,localState),cell=geo.cells.find(x=>x.index===i),im=item.imageLow||item.imageHigh||item.image||'';
          cells+=`<span class="${mini?'mini-pocket':'pocket'} filled art kbs-l-preview-piece" style="grid-column:${cell.col+1};grid-row:${cell.row+1}"><span class="sleeve kbs-l-piece-clip"><img src="${esc(im)}" class="kbs-l-composite-image" style="width:${geo.width*100}%;height:${geo.height*100}%;left:${-cell.nx*100}%;top:${-cell.ny*100}%;object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%"></span></span>`;
          continue;
        }
        if(origin!==i)continue;
      }
      const item=s.pockets?.[i],im=item&&(item.imageLow||item.imageHigh||item.image),sp=item?.kind==='art'?String(item.size||'1x1').split('x').map(Number):[1,1],cs=sp[0]||1,rs=sp[1]||1,pos=item?.kind==='art'?`object-position:${Number.isFinite(item.cropX)?item.cropX:50}% ${Number.isFinite(item.cropY)?item.cropY:50}%`:'';
      cells+=`<span class="${mini?'mini-pocket':'pocket'} ${item?'filled':''} ${item?.kind||''}" style="grid-column:span ${cs};grid-row:span ${rs}">${im?`<span class="sleeve"><img src="${esc(im)}" style="${pos}"></span>`:''}</span>`;
    }
    return cells;
  }

  if(originalPreviewMarkup)previewMarkup=function(page){
    const s=page.state||defaults;if(!s.pockets?.some(isL))return originalPreviewMarkup(page);
    return `<div class="page-card-preview l${esc(s.layout||'3x3')}" style="--mini-binder:${esc(s.binderColor||defaults.binderColor)};--mini-page:${esc(s.pageColor||defaults.pageColor)};--mini-sleeve:${esc(s.sleeveColor||defaults.sleeveColor)}">${stateMarkup(s,true)}</div>`;
  };
  if(originalFullViewerMarkup)fullViewerMarkup=function(page){
    const s=page.state||defaults;if(!s.pockets?.some(isL))return originalFullViewerMarkup(page);
    return `<div class="grid l${esc(s.layout||'3x3')}" style="--binder:${esc(s.binderColor||defaults.binderColor)};--page:${esc(s.pageColor||defaults.pageColor)};--sleeve:${esc(s.sleeveColor||defaults.sleeveColor)}">${stateMarkup(s,false)}</div>`;
  };

  const style=document.createElement('style');style.id='kbsArtworkLShapeStyle';style.textContent=`
    .kbs-l-art-piece,.kbs-l-preview-piece{position:relative!important;overflow:hidden!important}
    .kbs-l-piece-clip{position:absolute!important;inset:0!important;overflow:hidden!important;display:block!important}
    .kbs-l-composite-image{position:absolute!important;max-width:none!important;max-height:none!important;object-fit:cover!important;display:block!important}
    .kbs-l-art-piece .x{z-index:6}
  `;document.head.appendChild(style);

  try{renderArts();renderGrid()}catch(e){console.warn('Could not refresh L-shaped artwork UI',e)}
  globalThis.KBSArtworkLShapes={installed:true,version:'1.0.0',shapes:L_SHAPES,isL};
})();
