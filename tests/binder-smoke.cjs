'use strict';
/* Isolated browser regression suite. No user credentials or production data. */
const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../public');
const img='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="63" height="88"%3E%3Crect width="63" height="88" fill="%23ab8bff"/%3E%3C/svg%3E';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/catalog/manifest.json'){res.writeHead(200,{'content-type':'application/json'});res.end('{}');return;}
  const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,body)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});
    res.end(body);
  });
});
const listen=()=>new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const shutdown=()=>new Promise(ok=>server.close(ok));
const makeApi=(name,start,count)=>Array.from({length:count},(_,i)=>({
  id:'audit-'+name+'-'+(start+i),
  name,number:String(start+i),
  set:{id:'audit-live',name:'Audit Live Set',series:'Audit',releaseDate:'2026/10/01'},
  images:{large:img,small:img},artist:'Audit Artist',nationalPokedexNumbers:[25]
}));

(async()=>{
  await listen();
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});
  const page=await context.newPage();
  const errors=[],consoleErrors=[],failedRequests=[];
  page.on('pageerror',e=>errors.push(String(e.message)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('requestfailed',req=>failedRequests.push(req.url()+': '+(req.failure()?.errorText||'')));

  try{
    await page.route(/\/api\/card-search\?/,async route=>{
      const u=new URL(route.request().url()),q=(u.searchParams.get('q')||'').toLowerCase(),number=Number(u.searchParams.get('page')||'1');
      if(q.includes('lagmon'))await new Promise(r=>setTimeout(r,900));
      let data=[],totalCount=0;
      if(q.includes('newmon')){totalCount=262;data=makeApi('Newmon',number===1?1:251,number===1?250:12);}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data,totalCount,page:number,pageSize:250})});
    });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)(?!api\.pokemontcg\.io)/,route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
    await page.goto(origin,{waitUntil:'domcontentloaded',timeout:30000});
    try{
      await page.waitForFunction(()=>Boolean(globalThis.KBSCardVariantsV2?.installed&&globalThis.KBSArtworkLShapes?.installed&&typeof renderGrid==='function'),null,{timeout:12000});
    }catch(err){
      const diag=await page.evaluate(()=>({
        readyState:document.readyState,
        variants:Boolean(globalThis.KBSCardVariantsV2?.installed),
        artwork:Boolean(globalThis.KBSArtworkLShapes?.installed),
        renderGrid:typeof renderGrid,
        cardCount:document.querySelectorAll('#cards').length,
        loadedScripts:[...document.scripts].filter(x=>x.src).map(x=>x.src),
        errorBanner:document.querySelector('#runtimeErrorText')?.textContent||''
      }));
      console.error('APP_BOOT_DIAG',JSON.stringify({diag,errors,consoleErrors,failedRequests},null,2));
      throw err;
    }
    await page.waitForTimeout(900); // Let asynchronous empty-library initialization settle.
    await page.evaluate((art)=>{
      const make=(n,i,setId)=>({
        id:setId+'-'+i,sourceKey:setId+'-'+i,
        name:n,nameLower:n.toLowerCase(),localId:String(i),
        setId,rawSetId:setId,setName:setId==='auditset'?'Audit Set':'Audit Filler',
        illustrator:'Audit Artist',illustratorLower:'audit artist',
        kind:'card',game:'pokemon',catalog:'english',
        image:art,imageLow:art,imageHigh:art
      });
      masterCards=[
        ...Array.from({length:300},(_,i)=>make('Auditmon',i+1,'auditset')),
        ...Array.from({length:5100},(_,i)=>make('Filler',i+1,'filler'))
      ];
      masterCardIndex=new Map(masterCards.map((c,i)=>[c.id,i]));
      masterReady=true;
      masterSetOptions=[{id:'auditset',name:'Audit Set'},{id:'filler',name:'Audit Filler'}];
      renderSetFilter();
      loadArtists();
      KBSModules.search.rebuild(masterCards);
    },img);
    await page.waitForFunction(()=>KBSModules.search.ready&&KBSModules.search.size===5400,null,{timeout:30000});
    await page.fill('#subject','Auditmon');
    await page.click('#searchBtn');
    console.log('SEARCH_DIAG',JSON.stringify(await page.evaluate(()=>({
      query:document.querySelector('#subject')?.value,
      selectedSet:document.querySelector('#setFilter')?.value,
      selectedArtist:document.querySelector('#artistFilter')?.value,
      tcgFilters:globalThis.KBSMultiTCGFilters?.state||null,
      firstCard:masterCards[0],
      rawLocal:masterCards.filter(c=>String(c.nameLower||c.name).toLowerCase().includes('auditmon')).length,
      localMatchFn:String(localMasterMatches).slice(0,750),
      master:masterCards.length,
      hasFullEnglish:masterCards.filter(c=>c?.game==='pokemon').length,
      local:localMasterMatches().length,
      dataCards:cards.length,
      rendered:document.querySelectorAll('#cards .kbs-variant-card').length,
      status:document.querySelector('#variantStatus')?.textContent,
      errors:document.querySelector('#runtimeErrorText')?.textContent
    }))));
    await page.waitForFunction(()=>document.querySelectorAll('#cards .kbs-variant-card').length===300,null,{timeout:12000});
    console.log('PASS 300 named card variants are visible without truncation');

    // Accidental enlarged preview while scrolling was reported by the user.
    await page.locator('#cards .kbs-variant-card').nth(0).hover();
    await page.waitForTimeout(850);
    const resultBox=await page.locator('#cardsViewport').boundingBox();
    await page.mouse.move(resultBox.x+resultBox.width/2,resultBox.y+resultBox.height/2);
    await page.mouse.wheel(0,460);
    await page.waitForTimeout(1250);
    assert.equal(await page.locator('#hoverCardPreview').evaluate(el=>el.hidden),true,'Scrolling re-opened enlarged preview');
    console.log('PASS scroll suppresses accidental enlarged card preview');



    // Previously fragile interactions: card zoom and pointer drag/placement.
    await page.mouse.move(6,6);
    const hoverTarget=page.locator('#cards .kbs-variant-card').nth(2);
    await hoverTarget.hover();
    const hoverBounds=await hoverTarget.boundingBox();
    await page.mouse.move(hoverBounds.x+hoverBounds.width*.68,hoverBounds.y+hoverBounds.height*.42,{steps:4});
    await page.waitForFunction(()=>!document.querySelector('#hoverCardPreview')?.hidden,null,{timeout:4500});
    console.log('PASS enlarged card hover preview appears');

    const cardBox=await page.locator('#cards .kbs-variant-card').nth(2).locator('img').boundingBox();
    const pocketBox=await page.locator('#grid [data-pocket="0"]').boundingBox();
    assert.ok(cardBox&&pocketBox,'Card and target binder pocket must be visible');
    await page.mouse.move(cardBox.x+cardBox.width/2,cardBox.y+cardBox.height/2);
    await page.mouse.down();
    await page.mouse.move(pocketBox.x+pocketBox.width/2,pocketBox.y+pocketBox.height/2,{steps:10});
    await page.mouse.up();
    await page.waitForFunction(()=>state.pockets[0]?.kind==='card',null,{timeout:5000});
    console.log('PASS pointer-drag card is placed into a binder pocket');



    await page.fill('#subject','');
    await page.evaluate(()=>{
      const el=document.querySelector('#setFilter');el.value='auditset';
      el.dispatchEvent(new Event('change',{bubbles:true}));
    });
    await page.waitForTimeout(400);
    console.log('SET_DIAG',JSON.stringify(await page.evaluate(()=>({
      set:document.querySelector('#setFilter')?.value,
      subject:document.querySelector('#subject')?.value,
      options:[...document.querySelector('#setFilter').options].slice(0,5).map(x=>x.value),
      local:localMasterMatches().length, cards:cards.length,
      rendered:document.querySelectorAll('#cards .kbs-variant-card').length,
      selectedSetWrapper:Boolean(runCardSearch.__kbsProductionFullSet),
      errors:document.querySelector('#runtimeErrorText')?.textContent||''
    }))));
    await page.waitForFunction(()=>document.querySelectorAll('#cards .kbs-variant-card').length===300,null,{timeout:12000});
    console.log('PASS full selected set remains uncapped');

    await page.evaluate(()=>{
      const el=document.querySelector('#setFilter');el.value='';
      el.dispatchEvent(new Event('change',{bubbles:true}));
    });
    await page.fill('#subject','Newmon');
    await page.click('#searchBtn');
    await page.waitForFunction(()=>document.querySelectorAll('#cards .kbs-variant-card').length===262,null,{timeout:16000});
    console.log('PASS all 262 live card printings loaded across two API pages');

    await page.fill('#subject','Lagmon');
    await page.click('#searchBtn');
    await page.fill('#subject','Auditmon');
    await page.click('#searchBtn');
    await page.waitForFunction(()=>document.querySelectorAll('#cards .kbs-variant-card').length===300,{timeout:12000});
    await page.waitForTimeout(1400);
    assert.equal(await page.locator('#cards .kbs-variant-card').count(),300);
    console.log('PASS stale live search cannot overwrite a new search');

    await page.evaluate(async(art)=>{
      await ensureBinderLibrary();
      state.layout='3x3';
      state.pockets=Array(12).fill(null);
      state.pockets[0]={kind:'art',id:'audit-art',name:'Audit Art',size:'l-missing-br',image:art,imageHigh:art,cropX:60,cropY:40};
      save();renderGrid();
      await saveActivePageSnapshot();
      const existing=await pagesForBinder(activeBinderId);
      if(!existing.some(p=>p.id==='audit-second-page')){
        const second=cloneEditorState();
        second.pockets=Array(12).fill(null);
        second.pockets[0]={kind:'art',id:'audit-second',name:'Second Art',size:'l-missing-br',image:art,imageHigh:art,cropX:35,cropY:55};
        await dbPut('pages',{id:'audit-second-page',binderId:activeBinderId,title:'Page 2',order:1,createdAt:Date.now(),updatedAt:Date.now(),state:second});
      }
    },img);
    assert.equal(await page.locator('#grid .kbs-l-art-hit').count(),3);
    assert.equal(await page.locator('#grid [data-pocket="4"]').count(),1);
    console.log('PASS L artwork occupies three pockets with open fourth corner');

    const [currentPrint]=await Promise.all([page.waitForEvent('popup',{timeout:10000}),page.click('#printTiles')]);
    await currentPrint.waitForLoadState('domcontentloaded');
    assert.equal(await currentPrint.locator('figure.tile').count(),3);
    assert.equal(await currentPrint.locator('#doPrint').count(),1);
    await currentPrint.close();
    console.log('PASS current-page printing contains exactly 3 L tiles');

    const [allPrint]=await Promise.all([page.waitForEvent('popup',{timeout:10000}),page.click('#printTilesAll')]);
    await allPrint.waitForFunction(()=>document.querySelectorAll('figure.tile').length===6,{timeout:12000});
    assert.equal(await allPrint.locator('figure.tile').count(),6);
    assert.equal(await allPrint.locator('#doPrint').count(),1);
    await allPrint.close();
    console.log('PASS all-pages print opens synchronously and contains 6 tiles');

    // Page changes must round-trip the saved contents of both pages.
    const pageIntegrity=await page.evaluate(async()=>{
      const first=activePageId;
      await loadPageIntoEditor('audit-second-page',{closeLibrary:false});
      const secondGood=state.pockets[0]?.id==='audit-second';
      await loadPageIntoEditor(first,{closeLibrary:false});
      const firstGood=state.pockets[0]?.id==='audit-art';
      return {secondGood,firstGood};
    });
    assert.deepEqual(pageIntegrity,{secondGood:true,firstGood:true});
    console.log('PASS saved binder pages round-trip without losing artwork');




    // Reproduce reported 4-pocket layout with 10 saved pages: the vertical
    // page rail used to collide with Selected/Theme below it.
    await page.evaluate(async()=>{
      state.layout='2x2';renderGrid();
      const existing=await pagesForBinder(activeBinderId);
      for(let i=existing.length;i<11;i++){
        const st=cloneEditorState();
        st.layout='2x2';
        await dbPut('pages',{id:'audit-extra-page-'+i,binderId:activeBinderId,title:'Page '+(i+1),order:i,createdAt:Date.now()+i,updatedAt:Date.now()+i,state:st});
      }
      await renderEditorPageNav();
    });
    await page.waitForFunction(()=>document.querySelectorAll('#editorPageNumbers .page-number').length>=10,null,{timeout:6000});

    // Screenshot-based geometry audit with strict horizontal overflow and
    // overlay-collision checks; responsive snapshots are retained as artifacts.
    fs.mkdirSync('audit-artifacts',{recursive:true});
    for(const [width,height] of [[1680,900],[1600,1000],[1280,800],[1024,768],[768,900],[390,844]]){
      await page.setViewportSize({width,height});
      await page.waitForTimeout(260);
      const geometry=await page.evaluate(()=>{
        const bounds=selector=>{
          const node=document.querySelector(selector);
          if(!node||getComputedStyle(node).display==='none')return null;
          const r=node.getBoundingClientRect();
          return {x:r.left,y:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
        };
        const intersects=(a,b)=>a&&b&&Math.min(a.right,b.right)-Math.max(a.x,b.x)>20&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>20;
        const card=bounds('#cardsViewport'),grid=bounds('#grid');
        const activeHover=!document.querySelector('#hoverCardPreview')?.hidden;
        return {
          width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
          card,grid,activeHover,
          overlap:intersects(card,grid),
          viewportOverflows:(document.querySelector('#cardsViewport')?.scrollWidth||0)>(document.querySelector('#cardsViewport')?.clientWidth||0)+10
        };
      });
      if(geometry.scrollWidth>geometry.width+12||geometry.overlap||geometry.viewportOverflows||geometry.activeHover)
        throw new Error('LAYOUT_COLLISION '+JSON.stringify(geometry));
      if(width>=901){
        const panels=await page.evaluate(()=>{
          const box=sel=>{const el=document.querySelector(sel),r=el?.getBoundingClientRect();return r?{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};
          return {library:box('.workspace>.library'),pane:box('.variant-pane'),viewport:box('#cardsViewport'),heading:box('.binder-heading-module'),nav:box('#editorPageNav'),numbers:box('#editorPageNumbers'),selected:box('#selected'),buttons:document.querySelectorAll('#editorPageNumbers .page-number').length};
        });
        const within=(child,parent)=>child&&parent&&child.y>=parent.y-2&&child.bottom<=parent.bottom+2&&child.x>=parent.x-2&&child.right<=parent.right+2;
        if(!within(panels.viewport,panels.pane)||!within(panels.pane,panels.library)||!within(panels.nav,panels.heading)||panels.heading.bottom>panels.selected.y+2)
          throw new Error('PANEL_BOUNDARY_COLLISION '+JSON.stringify(panels));
        const lastVisible=await page.locator('#editorPageNumbers').evaluate(el=>{
          el.scrollTop=el.scrollHeight;
          const last=el.querySelector('.page-number:last-child');
          const a=last?.getBoundingClientRect(),b=el.getBoundingClientRect();
          return !!a&&a.bottom<=b.bottom+2&&a.top>=b.top-2;
        });
        assert.ok(lastVisible,'Last binder page must be reachable within scrollable page rail');
        console.log('PASS card panel and page navigation stay within their modules at '+width+'px');
        if(width>=1101){
          const sidebar=await page.evaluate(()=>{
            const el=document.querySelector('.canvas-side-controls');
            const children=[...el.children].filter(x=>getComputedStyle(x).display!=='none');
            const last=children[children.length-1];
            const scrollable=el.scrollHeight>el.clientHeight+3;
            el.scrollTop=el.scrollHeight;
            const r=el.getBoundingClientRect(),b=last?.getBoundingClientRect();
            return {scrollable,scrollTop:el.scrollTop,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,lastBottom:b?.bottom??0,bottom:r.bottom,overflow:getComputedStyle(el).overflowY};
          });
          if(sidebar.scrollable&&(sidebar.scrollTop<=0||sidebar.lastBottom>sidebar.bottom+4))
            throw new Error('SIDEBAR_CONTROLS_UNREACHABLE '+JSON.stringify(sidebar));
          console.log('PASS appearance controls remain reachable at '+width+'px');
        }

      }
      if(width===1024){
        const controls=await page.evaluate(()=>[...document.querySelectorAll('.controls.command-deck > .print-control, .controls.command-deck > .tile-print-split, .controls.command-deck > button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{
          const r=e.getBoundingClientRect();return{id:e.id||e.className,width:Math.round(r.width),height:Math.round(r.height)};
        }));
        const cramped=controls.filter(x=>x.width<95||x.height>85);
        if(cramped.length)throw new Error('TABLET_CONTROLS_CRAMPED '+JSON.stringify(cramped));
        console.log('PASS tablet controls are not clipped or excessively wrapped');
      }
      if(width===390){
        const closed=await page.locator('#cardDetailsDrawer').evaluate(e=>!e.classList.contains('open')&&getComputedStyle(e).visibility==='hidden');
        assert.equal(closed,true,'Closed card drawer still paints over mobile binder');
        console.log('PASS closed drawer does not overlap mobile binder');
      }
      await page.screenshot({path:'audit-artifacts/layout-'+width+'x'+height+'.png',fullPage:true});
      console.log('PASS responsive geometry '+width+'x'+height);
    }
    if(errors.length)throw new Error('Browser JavaScript exceptions: '+JSON.stringify(errors));
    console.log('PASS no uncaught browser exceptions');
  }finally{
    await browser.close();
    await shutdown();
  }
})().catch(err=>{console.error(err);process.exitCode=1;server.close();});
