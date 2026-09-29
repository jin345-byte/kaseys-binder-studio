/* Binder Studio card-tile print scopes.
   Keeps the existing current-page cardTilePrint() behavior and adds a combined
   all-pages print job for the active binder. */
(()=>{
  'use strict';
  if(globalThis.KBSCardTilePrintScope?.installed)return;

  const currentBtn=document.getElementById('printTiles');
  const allBtn=document.getElementById('printTilesAll');
  if(!currentBtn||!allBtn)return;

  function pageDims(s){
    return s?.layout==='2x2'?{columns:2,rows:2}:s?.layout==='4x3'?{columns:4,rows:3}:{columns:3,rows:3};
  }

  function normalGeometry(item,index,s){
    const d=pageDims(s),baseCol=index%d.columns,baseRow=Math.floor(index/d.columns);
    const parts=String(item?.size||'1x1').split('x').map(Number),cols=parts[0]||1,rows=parts[1]||1,cells=[];
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const col=baseCol+x,row=baseRow+y;
      cells.push({index:index+y*d.columns+x,col,row,nx:x,ny:y});
    }
    return {valid:baseCol+cols<=d.columns&&baseRow+rows<=d.rows,width:cols,height:rows,cells};
  }

  function geometryFor(item,index,s){
    const l=globalThis.KBSArtworkLShapes;
    if(l?.isL?.(item)&&typeof l.geometry==='function')return l.geometry(item,index,s);
    return normalGeometry(item,index,s);
  }

  function artworkOrigins(s){
    const d=pageDims(s),limit=d.columns*d.rows,occupied=new Map(),out=[];
    const pockets=Array.isArray(s?.pockets)?s.pockets:[];
    for(let origin=0;origin<limit;origin++){
      const item=pockets[origin];
      if(!item||item.kind!=='art'||occupied.has(origin))continue;
      const geo=geometryFor(item,origin,s);
      if(!geo?.valid)continue;
      out.push({item,origin,geo});
      for(const cell of geo.cells||[])occupied.set(cell.index,origin);
    }
    return out;
  }

  function collectPageTiles(page,pageNumber){
    const s=page?.state||page||{};
    const tiles=[];
    for(const {item,geo} of artworkOrigins(s)){
      const im=item.imageHigh||item.imageLow||item.image;
      if(!im)continue;
      for(const cell of geo.cells||[]){
        tiles.push({
          item,im,
          x:Number.isFinite(cell.nx)?cell.nx:0,
          y:Number.isFinite(cell.ny)?cell.ny:0,
          cols:geo.width||1,
          rows:geo.height||1,
          sourcePage:pageNumber,
          sourceTitle:page?.title||`Page ${pageNumber}`
        });
      }
    }
    return tiles;
  }

  function tileMarkup(t){
    const cropX=Number.isFinite(t.item.cropX)?t.item.cropX:50;
    const cropY=Number.isFinite(t.item.cropY)?t.item.cropY:50;
    return `<figure class="tile" data-source-page="${t.sourcePage}"><div class="cutline"></div><div class="card"><div class="composite" style="width:${t.cols*63}mm;height:${t.rows*88}mm;left:${-t.x*63}mm;top:${-t.y*88}mm"><img src="${esc(t.im)}" style="object-position:${cropX}% ${cropY}%"></div></div></figure>`;
  }

  function openCombinedTilePrint(tiles,binderName='Binder'){
    const sheets=[];
    for(let i=0;i<tiles.length;i+=9)sheets.push(tiles.slice(i,i+9));
    const sheetMarkup=sheets.map((sheet,i)=>`<section class="sheet">${sheet.map(tileMarkup).join('')}<span class="pageNo">${i+1}/${sheets.length}</span></section>`).join('');
    const p=window.open('','_blank');
    if(!p)return toast('Allow pop-ups once to open the card-tile print sheet');
    p.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(binderName)} · all page card tiles</title><style>
      @page{size:letter portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:white;font-family:system-ui,sans-serif}.help{max-width:900px;margin:14px auto;padding:12px 14px;border-radius:10px;background:#171b24;color:#fff;font-size:14px;line-height:1.45}.help button{float:right;margin-left:12px;padding:9px 14px;font:inherit;font-weight:800;cursor:pointer}.help button:disabled{opacity:.6;cursor:wait}.sheet{position:relative;width:215.9mm;height:279.4mm;margin:0 auto;display:grid;grid-template-columns:repeat(3,63mm);grid-auto-rows:88mm;gap:3mm;align-content:center;justify-content:center;page-break-after:always;background:#fff}.sheet:last-of-type{page-break-after:auto}.tile{position:relative;width:63mm;height:88mm;margin:0;overflow:visible}.card{position:absolute;inset:0;width:63mm;height:88mm;overflow:hidden;border-radius:3mm;background:#fff}.composite{position:absolute;overflow:hidden}.composite img{display:block;width:100%;height:100%;object-fit:cover}.cutline{position:absolute;inset:-.7mm;border:.18mm dashed #202020;border-radius:3.7mm;pointer-events:none;z-index:5}.pageNo{position:absolute;right:4mm;bottom:2mm;font-size:8pt;color:#777}@media screen{body{padding:0 12px 24px;background:#222833}.sheet{margin:12px auto;box-shadow:0 8px 35px #0008}}@media print{.help{display:none}.sheet{margin:0;box-shadow:none}.pageNo{display:none}}
    </style></head><body><div class="help"><button id="doPrint">Print / Save PDF</button><strong>All binder pages · card tiles</strong><br>${tiles.length} artwork tile${tiles.length===1?'':'s'} collected from the active binder. Tiles remain 63 × 88mm with the saved artwork crop preserved. Print at <strong>100% / Actual size</strong> with scaling disabled. Up to nine tiles are placed on each US Letter sheet.</div>${sheetMarkup}</body></html>`);
    p.document.close();
    if(typeof wirePrintPopup==='function')wirePrintPopup(p,'doPrint');
    else p.document.getElementById('doPrint')?.addEventListener('click',()=>p.print());
    p.focus();
  }

  async function printAllBinderTiles(){
    if(allBtn.disabled)return;
    const original=allBtn.textContent;
    allBtn.disabled=true;
    allBtn.textContent='Preparing…';
    try{
      if(typeof saveActivePageSnapshot==='function')await saveActivePageSnapshot().catch(()=>{});
      if(!binderLayerReady||!activeBinderId||typeof pagesForBinder!=='function'){
        toast('Open or create a binder before printing all pages');
        return;
      }
      const pages=await pagesForBinder(activeBinderId);
      const tiles=pages.flatMap((page,i)=>collectPageTiles(page,i+1));
      if(!tiles.length){toast('No artwork tiles were found in this binder');return}
      let binderName='Binder';
      try{const b=typeof dbGet==='function'?await dbGet('binders',activeBinderId):null;if(b?.name)binderName=b.name}catch{}
      openCombinedTilePrint(tiles,binderName);
    }catch(e){
      console.error('All-pages tile print failed',e);
      toast('Could not prepare all binder pages for printing');
    }finally{
      allBtn.disabled=false;
      allBtn.textContent=original;
    }
  }

  currentBtn.title='Print artwork card tiles from the current binder page';
  allBtn.title='Print artwork card tiles from every page in the active binder';
  allBtn.addEventListener('click',printAllBinderTiles);

  globalThis.KBSCardTilePrintScope={installed:true,version:'1.0.0',printAllBinderTiles,collectPageTiles};
})();
