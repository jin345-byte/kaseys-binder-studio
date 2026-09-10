/* Kasey's Binder Studio v3.5.0 — productivity suite (roadmap steps 8–15).
   Preview-only modular layer: smart binder generation, auto-fill, templates,
   page copy, multi-select, undo/redo, universal search, and .kbsbinder I/O. */
(function(){
  'use strict';
  const VERSION='3.5.0';
  const EXPORT_FORMAT='KBS-BINDER-1';
  const MAX_HISTORY=40;
  const MAX_IMPORT_BYTES=8*1024*1024;
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const deep=v=>JSON.parse(JSON.stringify(v));
  const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const now=()=>Date.now();

  function slotsFor(layout){return layout==='2x2'?4:layout==='4x3'?12:9}
  function catalogPool(){
    const extra=globalThis.KBSCatalogCards||[];
    const base=extra.length?extra:(typeof masterCards!=='undefined'&&masterCards.length?masterCards:(typeof cards!=='undefined'?cards:[]));
    const seen=new Set();
    return base.filter(c=>{
      const key=c?.id||c?.primaryId||c?.sourceKey||`${c?.name}|${c?.setId}|${c?.localId}`;
      if(!c||seen.has(key)||!(c.imageHigh||c.imageLow||c.image))return false;
      seen.add(key);return true;
    });
  }
  function matchingCards(query,limit=500,poolOverride=null){
    const pool=Array.isArray(poolOverride)?poolOverride:catalogPool();
    const needle=norm(query);
    const out=[];
    for(const c of pool){
      if(!c)continue;
      if(needle){
        const blob=norm(c.searchBlob||`${c.name||''} ${c.setName||''} ${c.illustrator||c.artist||''} ${c.localId||''}`);
        if(!blob.includes(needle))continue;
      }
      out.push({...c,kind:'card'});
      if(out.length>=limit)break;
    }
    return out;
  }
  function currentBaseState(layout=state.layout){
    let s;
    try{s=typeof blankPageState==='function'?blankPageState():deep(defaults)}catch{s=deep(defaults)}
    s.layout=layout;
    s.theme=state.theme;
    s.binderColor=state.binderColor;
    s.pageColor=state.pageColor;
    s.sleeveColor=state.sleeveColor;
    s.subject=state.subject||'';
    s.pockets=Array.from({length:12},()=>null);
    s.artworks=Array.isArray(s.artworks)?s.artworks:[];
    return s;
  }

  /* ---------- Undo / Redo ---------- */
  let undoStack=[],redoStack=[],historyInternal=false,lastSnapshot='';
  function snapshot(){try{return JSON.stringify(state)}catch{return ''}}
  function updateHistoryButtons(){
    const u=q('#kbsUndoBtn'),r=q('#kbsRedoBtn');
    if(u)u.disabled=!undoStack.length;
    if(r)r.disabled=!redoStack.length;
    const badge=q('#kbsHistoryStatus');if(badge)badge.textContent=`${undoStack.length} undo · ${redoStack.length} redo`;
  }
  function resetHistory(){undoStack=[];redoStack=[];lastSnapshot=snapshot();updateHistoryButtons()}
  const coreSave=save;
  save=function(){
    const next=snapshot();
    if(!historyInternal&&lastSnapshot&&next&&next!==lastSnapshot){
      undoStack.push(lastSnapshot);if(undoStack.length>MAX_HISTORY)undoStack.shift();
      redoStack=[];
    }
    if(next)lastSnapshot=next;
    const out=coreSave.apply(this,arguments);updateHistoryButtons();return out;
  };
  function restoreSnapshot(raw){
    if(!raw)return false;
    historyInternal=true;
    try{
      state=JSON.parse(raw);
      try{localStorage.setItem('michiStandaloneState',raw)}catch{}
      rerenderEditor();
      coreSave();
      lastSnapshot=raw;
      return true;
    }finally{historyInternal=false;updateHistoryButtons()}
  }
  function undo(){
    if(!undoStack.length)return toast('Nothing to undo');
    const cur=snapshot();const prev=undoStack.pop();if(cur)redoStack.push(cur);
    restoreSnapshot(prev);toast('Undone');
  }
  function redo(){
    if(!redoStack.length)return toast('Nothing to redo');
    const cur=snapshot();const next=redoStack.pop();if(cur)undoStack.push(cur);
    restoreSnapshot(next);toast('Redone');
  }
  const coreLoadPage=loadPageIntoEditor;
  loadPageIntoEditor=async function(){const r=await coreLoadPage.apply(this,arguments);resetHistory();return r};

  /* ---------- Multi-select editing ---------- */
  let multiMode=false;const multiSelected=new Set();
  function updateMultiUi(){
    document.body.classList.toggle('kbs-multi-mode',multiMode);
    const b=q('#kbsMultiToggle');if(b){b.classList.toggle('active',multiMode);b.setAttribute('aria-pressed',String(multiMode));b.textContent=multiMode?'Finish selecting':'Multi-select'}
    const c=q('#kbsMultiCount');if(c)c.textContent=`${multiSelected.size} selected`;
    qa('#grid [data-pocket]').forEach(el=>el.classList.toggle('kbs-pocket-selected',multiSelected.has(Number(el.dataset.pocket))));
  }
  function setMultiMode(on){multiMode=!!on;if(!multiMode)multiSelected.clear();updateMultiUi()}
  function clearSelectedPockets(){
    if(!multiSelected.size)return toast('Select one or more pockets first');
    for(const i of multiSelected)state.pockets[i]=null;
    save();multiSelected.clear();renderGrid();updateMultiUi();toast('Selected pockets cleared');
  }
  function fillSelectedWithChosen(){
    if(!multiSelected.size)return toast('Select one or more pockets first');
    if(!selected)return toast('Choose a card or 1×1 artwork first');
    const size=selected.kind==='art'?String(selected.size||'1x1'):'1x1';
    if(size!=='1x1')return toast('Multi-fill supports cards and 1×1 artwork');
    for(const i of multiSelected)state.pockets[i]={...selected,...(selected.kind==='art'?{cropX:Number.isFinite(selected.cropX)?selected.cropX:50,cropY:Number.isFinite(selected.cropY)?selected.cropY:50}:{})};
    save();renderGrid();updateMultiUi();toast(`Filled ${multiSelected.size} pockets`);
  }
  function bindGridMulti(){
    const g=q('#grid');if(!g||g.dataset.kbsMultiBound==='1')return;g.dataset.kbsMultiBound='1';
    g.addEventListener('click',e=>{
      if(!multiMode)return;
      const p=e.target.closest?.('[data-pocket]');if(!p)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const i=Number(p.dataset.pocket);if(multiSelected.has(i))multiSelected.delete(i);else multiSelected.add(i);updateMultiUi();
    },true);
  }
  const coreRenderGrid=renderGrid;
  renderGrid=function(){const r=coreRenderGrid.apply(this,arguments);bindGridMulti();requestAnimationFrame(updateMultiUi);return r};

  /* ---------- Auto-fill ---------- */
  function autoFillPage({query=null,candidates=null,selectedOnly=false}={}){
    const pool=matchingCards(query??state.subject,200,candidates);
    if(!pool.length)return toast('No matching cards are available to auto-fill');
    const total=slotsFor(state.layout);let cursor=0,filled=0;
    const targetIndexes=selectedOnly&&multiSelected.size?[...multiSelected].sort((a,b)=>a-b):Array.from({length:total},(_,i)=>i).filter(i=>!state.pockets[i]);
    for(const i of targetIndexes){
      if(i>=total||cursor>=pool.length)break;
      if(!selectedOnly&&state.pockets[i])continue;
      state.pockets[i]={...pool[cursor++],kind:'card'};filled++;
    }
    if(!filled)return toast('No empty pockets were available');
    save();renderGrid();toast(`Auto-filled ${filled} pocket${filled===1?'':'s'}`);return filled;
  }

  /* ---------- Layout templates ---------- */
  const TEMPLATES={
    'classic-4':{label:'4-pocket Classic',layout:'2x2'},
    'classic-9':{label:'9-pocket Classic',layout:'3x3'},
    'showcase-12':{label:'12-pocket Showcase',layout:'4x3'},
    'banner-9':{label:'Banner + Cards',layout:'3x3',art:{index:0,size:'3x1'}},
    'feature-left':{label:'Feature Left',layout:'3x3',art:{index:0,size:'1x2'}}
  };
  function applyTemplate(id,{keepCards=true}={}){
    const t=TEMPLATES[id];if(!t)return;
    const old=state.pockets.slice();state.layout=t.layout;
    const total=slotsFor(t.layout);state.pockets=Array.from({length:12},(_,i)=>keepCards&&i<total?old[i]||null:null);
    if(t.art){
      const art=selected?.kind==='art'?selected:null;
      if(art){
        const item={...art,size:t.art.size,cropX:Number.isFinite(art.cropX)?art.cropX:50,cropY:Number.isFinite(art.cropY)?art.cropY:50};
        const [cs,rs]=t.art.size.split('x').map(Number),cols=t.layout==='4x3'?4:3;
        for(let y=0;y<rs;y++)for(let x=0;x<cs;x++)state.pockets[t.art.index+y*cols+x]=null;
        state.pockets[t.art.index]=item;
      }
    }
    q('#layout').value=t.layout;save();renderGrid();toast(`${t.label} applied`);
  }

  /* ---------- Copy page ---------- */
  async function copyCurrentPage(){
    if(!activePageId)return toast('Open a saved page first');
    if(globalThis.KBSBinderLab?.duplicatePage){await globalThis.KBSBinderLab.duplicatePage(activePageId);return}
    await saveActivePageSnapshot().catch(()=>{});
    const page=await dbGet('pages',activePageId);if(!page)return;
    const pages=await pagesForBinder(page.binderId),at=pages.findIndex(p=>p.id===page.id);
    for(let i=pages.length-1;i>at;i--){pages[i].order=i+1;await dbPut('pages',pages[i])}
    const cp={...deep(page),id:id('page'),order:at+1,title:`${page.title||`Page ${at+1}`} copy`,createdAt:now(),updatedAt:now()};
    await dbPut('pages',cp);await renderEditorPageNav();await renderBinderLibrary();toast('Page copied');
  }

  /* ---------- Smart Binder Generator ---------- */
  async function smartGenerate({name='Smart Binder',query='',pages=3,layout='3x3',candidates=null}={}){
    await saveActivePageSnapshot().catch(()=>{});
    const source=matchingCards(query,slotsFor(layout)*Math.max(1,pages),candidates);
    if(!source.length)throw new Error('No matching cards found for that binder');
    const bid=id('binder'),created=now(),pageCount=Math.max(1,Math.min(20,Number(pages)||1));
    await dbPut('binders',{id:bid,name:String(name||'Smart Binder').trim()||'Smart Binder',createdAt:created,updatedAt:created,smartQuery:String(query||'')});
    let cursor=0,first='';
    for(let p=0;p<pageCount;p++){
      const pid=id('page');if(!first)first=pid;
      const s=currentBaseState(layout);s.subject=String(query||'');
      const total=slotsFor(layout);
      for(let i=0;i<total&&cursor<source.length;i++)s.pockets[i]={...source[cursor++],kind:'card'};
      await dbPut('pages',{id:pid,binderId:bid,order:p,title:`Page ${p+1}`,createdAt:created+p,updatedAt:created+p,state:s});
      if(cursor>=source.length&&p+1<pageCount){/* remaining pages intentionally blank */}
    }
    if(first)await loadPageIntoEditor(first,{closeLibrary:false});
    await renderBinderLibrary();toast(`Generated ${pageCount}-page binder with ${Math.min(cursor,source.length)} cards`);return bid;
  }

  /* ---------- Universal Search ---------- */
  let universalTimer=0;
  async function universalResults(query){
    const needle=norm(query);if(needle.length<2)return [];
    const rows=[];
    for(const c of matchingCards(needle,24))rows.push({type:'card',id:c.id,label:c.name||'Card',meta:`${c.setName||c.setId||'Card'}${c.localId?' · #'+c.localId:''}`,image:c.imageLow||c.imageHigh||'',value:c});
    for(const a of (state.artworks||[])){if(norm(`${a.name} ${a.source}`).includes(needle))rows.push({type:'art',id:a.id,label:a.name||'Artwork',meta:a.source||'Artwork',image:a.image||'',value:a})}
    try{
      const [binders,pages]=await Promise.all([dbAll('binders'),dbAll('pages')]);
      for(const b of binders)if(norm(`${b.name||''} ${b.cover?.subtitle||''} ${b.cover?.character||''}`).includes(needle))rows.push({type:'binder',id:b.id,label:b.name||'Binder',meta:'Saved binder',value:b});
      for(const p of pages)if(norm(`${p.title||''} ${p.state?.subject||''}`).includes(needle))rows.push({type:'page',id:p.id,label:p.title||'Page',meta:p.state?.subject||'Saved page',value:p});
    }catch{}
    return rows.slice(0,50);
  }
  async function renderUniversal(query){
    const host=q('#kbsUniversalResults');if(!host)return;
    const rows=await universalResults(query);
    if(!rows.length){host.innerHTML='<div class="kbs-tools-empty">No matching cards, artwork, binders, or pages.</div>';return}
    host.innerHTML=rows.map((r,i)=>`<button type="button" class="kbs-universal-result" data-kbs-result="${i}">${r.image?`<img src="${esc(r.image)}" alt="">`:'<span class="kbs-result-icon">'+({card:'▤',art:'✦',binder:'▣',page:'▦'}[r.type]||'•')+'</span>'}<span><strong>${esc(r.label)}</strong><small>${esc(r.type)} · ${esc(r.meta||'')}</small></span></button>`).join('');
    qa('[data-kbs-result]').forEach((b,i)=>b.onclick=async()=>{
      const r=rows[i];
      if(r.type==='card'){selected={...r.value,kind:'card'};renderSelected();closeUniversal();toast(`${r.label} selected`)}
      else if(r.type==='art'){selected=r.value;renderSelected();closeUniversal();toast(`${r.label} selected`)}
      else if(r.type==='page'){await loadPageIntoEditor(r.id);closeUniversal()}
      else if(r.type==='binder'){const ps=await pagesForBinder(r.id);if(ps[0])await loadPageIntoEditor(ps[0].id);closeUniversal()}
    });
  }
  function openUniversal(){q('#kbsUniversalModal')?.classList.add('open');q('#kbsUniversalModal')?.setAttribute('aria-hidden','false');const input=q('#kbsUniversalInput');if(input){input.value='';input.focus()}const host=q('#kbsUniversalResults');if(host)host.innerHTML='<div class="kbs-tools-empty">Search cards, artwork, binders, and pages from one place.</div>'}
  function closeUniversal(){q('#kbsUniversalModal')?.classList.remove('open');q('#kbsUniversalModal')?.setAttribute('aria-hidden','true')}

  /* ---------- .kbsbinder import / export ---------- */
  async function buildExportPackage(){
    await saveActivePageSnapshot().catch(()=>{});
    const binder=await dbGet('binders',activeBinderId);if(!binder)throw new Error('No active binder');
    const pages=await pagesForBinder(activeBinderId);
    return {format:EXPORT_FORMAT,version:1,exportedAt:new Date().toISOString(),app:'Kasey\'s Binder Studio',binder:deep(binder),pages:deep(pages)};
  }
  async function exportActiveBinder(){
    const pack=await buildExportPackage();
    const blob=new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`${String(pack.binder.name||'binder').replace(/[^a-z0-9._-]+/gi,'-').replace(/^-|-$/g,'')||'binder'}.kbsbinder`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Binder exported');
  }
  function validateImport(pack){
    if(!pack||pack.format!==EXPORT_FORMAT||!pack.binder||!Array.isArray(pack.pages))throw new Error('That is not a valid .kbsbinder file');
    if(pack.pages.length<1||pack.pages.length>100)throw new Error('Binder file has an invalid page count');
    return pack;
  }
  async function importPackage(raw){
    const pack=validateImport(typeof raw==='string'?JSON.parse(raw):raw);await saveActivePageSnapshot().catch(()=>{});
    const bid=id('binder'),created=now();
    const existingNames=new Set((await dbAll('binders')).map(b=>String(b.name||'').toLowerCase()));
    let name=String(pack.binder.name||'Imported Binder').trim()||'Imported Binder';if(existingNames.has(name.toLowerCase()))name+=' (Imported)';
    const binder={...deep(pack.binder),id:bid,name,createdAt:created,updatedAt:created};
    await dbPut('binders',binder);
    let first='';
    for(let i=0;i<pack.pages.length;i++){
      const src=pack.pages[i],pid=id('page');if(!first)first=pid;
      const s={...deep(defaults),...deep(src.state||{}),pockets:Array.from({length:12},(_,n)=>src.state?.pockets?.[n]||null),artworks:Array.isArray(src.state?.artworks)?deep(src.state.artworks):[]};
      await dbPut('pages',{...deep(src),id:pid,binderId:bid,order:i,title:src.title||`Page ${i+1}`,createdAt:created+i,updatedAt:created+i,state:s});
    }
    if(first)await loadPageIntoEditor(first,{closeLibrary:false});await renderBinderLibrary();toast(`Imported ${name}`);return bid;
  }
  async function importFile(file){
    if(!file)return;if(file.size>MAX_IMPORT_BYTES)throw new Error('Binder file is too large to import safely');
    return importPackage(await file.text());
  }

  /* ---------- UI ---------- */
  function toolsMarkup(){return `
    <div class="kbs-tools-modal" id="kbsToolsModal" aria-hidden="true"><div class="kbs-tools-shell panel" role="dialog" aria-modal="true" aria-labelledby="kbsToolsTitle">
      <header class="kbs-tools-head"><div><span class="eyebrow">Binder productivity</span><h2 id="kbsToolsTitle">Binder Tools</h2><small>Roadmap steps 8–15</small></div><button class="modal-close" id="kbsToolsClose" type="button" aria-label="Close tools">×</button></header>
      <div class="kbs-tools-grid">
        <section class="kbs-tool-card kbs-tool-wide"><div><b>8</b><strong>Smart Binder Generator</strong><small>Create a new binder from a subject or character search.</small></div><div class="kbs-smart-form"><input id="kbsSmartName" placeholder="Binder name" value="Smart Binder"><input id="kbsSmartQuery" placeholder="Pokémon, Trainer, character, set…"><select id="kbsSmartPages"><option value="1">1 page</option><option value="3" selected>3 pages</option><option value="5">5 pages</option><option value="10">10 pages</option></select><select id="kbsSmartLayout"><option value="2x2">4-pocket</option><option value="3x3" selected>9-pocket</option><option value="4x3">12-pocket</option></select><button class="btn primary" id="kbsSmartGenerate">Generate binder</button></div></section>
        <section class="kbs-tool-card"><div><b>9</b><strong>Auto-Fill Page</strong><small>Fill empty pockets from the current card search.</small></div><button class="btn" id="kbsAutoFill">Fill empty pockets</button></section>
        <section class="kbs-tool-card kbs-tool-wide"><div><b>10</b><strong>Layout Templates</strong><small>Apply reusable binder-page structures without changing the theme.</small></div><div class="kbs-template-row">${Object.entries(TEMPLATES).map(([id,t])=>`<button class="btn ghost" data-kbs-template="${id}">${esc(t.label)}</button>`).join('')}</div></section>
        <section class="kbs-tool-card"><div><b>11</b><strong>Copy Page</strong><small>Duplicate the current page beside the original.</small></div><button class="btn" id="kbsCopyPage">Copy current page</button></section>
        <section class="kbs-tool-card"><div><b>12</b><strong>Multi-Select Editing</strong><small>Select several pockets, then clear or fill them together.</small></div><button class="btn" id="kbsMultiToggle" aria-pressed="false">Multi-select</button><small id="kbsMultiCount">0 selected</small><div class="kbs-inline-actions"><button class="btn ghost" id="kbsMultiFill">Fill selected</button><button class="btn ghost" id="kbsMultiClear">Clear selected</button></div></section>
        <section class="kbs-tool-card"><div><b>13</b><strong>Undo / Redo</strong><small>Up to ${MAX_HISTORY} page-edit states. Ctrl/Cmd+Z supported.</small></div><div class="kbs-inline-actions"><button class="btn" id="kbsUndoBtn">Undo</button><button class="btn" id="kbsRedoBtn">Redo</button></div><small id="kbsHistoryStatus">0 undo · 0 redo</small></section>
        <section class="kbs-tool-card"><div><b>14</b><strong>Universal Search</strong><small>Search cards, artwork, binders, and pages together.</small></div><button class="btn" id="kbsUniversalOpen">Search everything</button></section>
        <section class="kbs-tool-card"><div><b>15</b><strong>Binder Import / Export</strong><small>Portable <code>.kbsbinder</code> files for backup and sharing.</small></div><div class="kbs-inline-actions"><button class="btn" id="kbsExportBinder">Export</button><label class="btn ghost kbs-import-label">Import<input id="kbsImportBinder" type="file" accept=".kbsbinder,application/json"></label></div></section>
      </div>
    </div></div>
    <div class="kbs-universal-modal" id="kbsUniversalModal" aria-hidden="true"><div class="kbs-universal-shell panel" role="dialog" aria-modal="true" aria-labelledby="kbsUniversalTitle"><header class="kbs-tools-head"><div><span class="eyebrow">Universal search</span><h2 id="kbsUniversalTitle">Find anything</h2></div><button class="modal-close" id="kbsUniversalClose" type="button">×</button></header><input id="kbsUniversalInput" type="search" placeholder="Search cards, artwork, binders, pages…" autocomplete="off"><div id="kbsUniversalResults" class="kbs-universal-results"></div></div></div>`}
  function installUi(){
    if(q('#kbsToolsBtn'))return;
    const openBinders=q('#openBinders');if(openBinders){const b=document.createElement('button');b.className='btn kbs-tools-launch';b.id='kbsToolsBtn';b.type='button';b.textContent='Binder Tools';b.title='Smart fill, templates, undo, search, import/export';openBinders.insertAdjacentElement('afterend',b)}
    document.body.insertAdjacentHTML('beforeend',toolsMarkup());
    q('#kbsToolsBtn')?.addEventListener('click',()=>{q('#kbsToolsModal').classList.add('open');q('#kbsToolsModal').setAttribute('aria-hidden','false');updateHistoryButtons()});
    const closeTools=()=>{q('#kbsToolsModal').classList.remove('open');q('#kbsToolsModal').setAttribute('aria-hidden','true')};
    q('#kbsToolsClose')?.addEventListener('click',closeTools);q('#kbsToolsModal')?.addEventListener('click',e=>{if(e.target.id==='kbsToolsModal')closeTools()});
    q('#kbsSmartQuery').value=state.subject||'';
    q('#kbsSmartGenerate')?.addEventListener('click',async()=>{const btn=q('#kbsSmartGenerate');btn.disabled=true;btn.textContent='Generating…';try{await smartGenerate({name:q('#kbsSmartName').value,query:q('#kbsSmartQuery').value,pages:q('#kbsSmartPages').value,layout:q('#kbsSmartLayout').value});closeTools()}catch(e){console.error(e);toast(e.message||'Could not generate binder')}finally{btn.disabled=false;btn.textContent='Generate binder'}});
    q('#kbsAutoFill')?.addEventListener('click',()=>autoFillPage());
    qa('[data-kbs-template]').forEach(b=>b.onclick=()=>applyTemplate(b.dataset.kbsTemplate));
    q('#kbsCopyPage')?.addEventListener('click',()=>copyCurrentPage().catch(e=>{console.error(e);toast('Could not copy page')}));
    q('#kbsMultiToggle')?.addEventListener('click',()=>setMultiMode(!multiMode));q('#kbsMultiClear')?.addEventListener('click',clearSelectedPockets);q('#kbsMultiFill')?.addEventListener('click',fillSelectedWithChosen);
    q('#kbsUndoBtn')?.addEventListener('click',undo);q('#kbsRedoBtn')?.addEventListener('click',redo);
    q('#kbsUniversalOpen')?.addEventListener('click',()=>{closeTools();openUniversal()});q('#kbsUniversalClose')?.addEventListener('click',closeUniversal);q('#kbsUniversalModal')?.addEventListener('click',e=>{if(e.target.id==='kbsUniversalModal')closeUniversal()});
    q('#kbsUniversalInput')?.addEventListener('input',e=>{clearTimeout(universalTimer);universalTimer=setTimeout(()=>renderUniversal(e.target.value).catch(console.error),100)});
    q('#kbsExportBinder')?.addEventListener('click',()=>exportActiveBinder().catch(e=>{console.error(e);toast(e.message||'Could not export binder')}));
    q('#kbsImportBinder')?.addEventListener('change',async e=>{const f=e.target.files?.[0];try{await importFile(f);closeTools()}catch(err){console.error(err);toast(err.message||'Could not import binder')}finally{e.target.value=''}});
    document.addEventListener('keydown',e=>{
      const mod=e.ctrlKey||e.metaKey;
      if(mod&&!e.altKey&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
      if(mod&&!e.altKey&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return}
      if((e.key==='/'||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'))&&!/input|textarea|select/i.test(document.activeElement?.tagName||'')){e.preventDefault();openUniversal()}
      if(e.key==='Escape'){closeUniversal();if(q('#kbsToolsModal')?.classList.contains('open'))closeTools();if(multiMode)setMultiMode(false)}
    });
    bindGridMulti();resetHistory();
  }

  globalThis.KBSProductivity={VERSION,templates:deep(TEMPLATES),smartGenerate,autoFillPage,applyTemplate,copyCurrentPage,setMultiMode,clearSelectedPockets,fillSelectedWithChosen,undo,redo,resetHistory,universalResults,openUniversal,buildExportPackage,importPackage,exportActiveBinder,get multiSelected(){return [...multiSelected]},get multiMode(){return multiMode}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installUi,{once:true});else installUi();
})();
