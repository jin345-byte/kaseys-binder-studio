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
    // Existing users can have stale visual preferences saved from the picker era.
    await page.addInitScript(()=>{
      localStorage.setItem('kbsThemePreference','lavender');
      localStorage.setItem('kbsFontChoice','georgia');
    });
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

    // Unified styling contract: only action buttons share button radius/type.
    // Bubble pagination, upload controls, card images and color swatches retain
    // their purposeful geometry. Run at both desktop and tablet widths.
    for(const [width,height] of [[1600,1000],[1024,768]]){
      await page.setViewportSize({width,height});
      const ui=await page.evaluate(()=>{
        const actions=[
          '#searchBtn','#openBinders','#guidedTourLaunch','#print',
          '#printTiles','#printTilesAll','#clear','#clearArtist',
          '#libraryCardsTab','#libraryArtworkTab','#addUrl',
          '.artadd .upload','#artSearchSubmit','#autoArtworkLoadMore',
          '#versionLink'
        ];
        const compact=new Set(['#artSearchSubmit','#autoArtworkLoadMore']);
        const sampled=actions.map(selector=>{
          const el=document.querySelector(selector);
          if(!el)return {selector,missing:true};
          const s=getComputedStyle(el);
          return {selector,radius:s.borderRadius,fontSize:s.fontSize,
            fontWeight:s.fontWeight,fontFamily:s.fontFamily,
            minHeight:s.minHeight,compact:compact.has(selector)};
        });
        const inputSample=['#subject','#layout','#artSearchQuery','#artUrl','#newArtSize']
          .map(selector=>{const el=document.querySelector(selector),s=el&&getComputedStyle(el);
            return {selector,radius:s?.borderRadius||null,fontSize:s?.fontSize||null};});
        const bubble=document.querySelector('#editorPageNumbers .page-number');
        return {sampled,inputSample,bubbleRadius:bubble&&getComputedStyle(bubble).borderRadius,
          styleSheet:!!document.querySelector('#kbsControlDesignSystemStyle'),
          rootFont:getComputedStyle(document.body).fontFamily};
      });
      assert.equal(ui.styleSheet,true,'Unified control stylesheet was not loaded');
      for(const item of ui.sampled){
        assert.ok(!item.missing,'Missing expected action: '+item.selector);
        assert.equal(item.radius,'12px','Mixed button corner radius at '+width+': '+JSON.stringify(item));
        assert.equal(item.fontSize,item.compact?'12px':'13px','Mixed action font size at '+width+': '+JSON.stringify(item));
        assert.equal(item.fontWeight,'700','Mixed action weight at '+width+': '+JSON.stringify(item));
        assert.equal(item.fontFamily,ui.rootFont,'Action did not inherit selected UI font at '+width+': '+JSON.stringify(item));
      }
      for(const item of ui.inputSample){
        assert.equal(item.radius,'12px','Field corner mismatch at '+width+': '+JSON.stringify(item));
        assert.equal(item.fontSize,'13px','Field font size mismatch at '+width+': '+JSON.stringify(item));
      }
      assert.equal(ui.bubbleRadius,'50%','Page numbers must remain circular');
      console.log('PASS unified action/field typography and shape at '+width+'px');
    }
    await page.waitForFunction(()=>Boolean(globalThis.KBSFullThemes&&globalThis.KBSTypography),null,{timeout:10000});
    const fixedAppearance=await page.evaluate(()=>{
      const before={binder:state.binderColor,page:state.pageColor,sleeve:state.sleeveColor};
      const loaded={theme:document.body.dataset.theme,font:document.body.dataset.kbsFont};
      // Older choices, even explicit calls to the old theme/font API, cannot
      // change the fixed look or overwrite independently selected colors.
      KBSFullThemes.apply('lavender',{persist:false,applyPalette:true});
      KBSTypography.apply('georgia',{persist:false});
      const after={binder:state.binderColor,page:state.pageColor,sleeve:state.sleeveColor};
      document.body.dataset.kbsFont='georgia';
      const typefaces=['#searchBtn','#libraryCardsTab','#subject']
        .map(selector=>getComputedStyle(document.querySelector(selector)).fontFamily.toLowerCase());
      document.body.dataset.kbsFont='system';
      return {
        loaded,theme:document.body.dataset.theme,font:document.body.dataset.kbsFont,
        selectedTheme:KBSFullThemes.current,
        selectedFont:KBSTypography.current(),
        themeOptions:KBSFullThemes.list().map(x=>x.id),
        fontOptions:KBSTypography.list().map(x=>x.id),
        themeControl:!!document.querySelector('#fullThemeSelect,.full-theme-control'),
        fontControl:!!document.querySelector('#kbsFontSelect,.font-choice-control'),
        storedTheme:localStorage.getItem('kbsThemePreference'),
        storedFont:localStorage.getItem('kbsFontChoice'),
        before,after,typefaces,
        manualColors:['binderColor','pageColor','sleeveColor']
          .every(id=>document.getElementById(id)?.type==='color')
      };
    });
    assert.deepEqual(fixedAppearance.loaded,{theme:'cyberpunk',font:'system'});
    assert.equal(fixedAppearance.theme,'cyberpunk');
    assert.equal(fixedAppearance.font,'system');
    assert.equal(fixedAppearance.selectedTheme,'cyberpunk');
    assert.equal(fixedAppearance.selectedFont,'system');
    assert.deepEqual(fixedAppearance.themeOptions,['cyberpunk']);
    assert.deepEqual(fixedAppearance.fontOptions,['system']);
    assert.equal(fixedAppearance.themeControl,false,'Theme selector should not be rendered');
    assert.equal(fixedAppearance.fontControl,false,'Font selector should not be rendered');
    assert.equal(fixedAppearance.storedTheme,'cyberpunk');
    assert.equal(fixedAppearance.storedFont,'system');
    assert.deepEqual(fixedAppearance.after,fixedAppearance.before,'Fixed theme must not overwrite manual binder/page/sleeve colors');
    assert.ok(fixedAppearance.typefaces.every(x=>x.includes('system-ui')),
      'System Sans did not remain fixed on all controls: '+JSON.stringify(fixedAppearance.typefaces));
    assert.equal(fixedAppearance.manualColors,true,'Manual color pickers must remain available');
    console.log('PASS Cyberpunk/System Sans fixed across legacy preferences, UI, API and manual colors');
    await page.setViewportSize({width:1600,height:1000});


    // Previously the suggestions div was attached to <body> even though its
    // absolute positioning assumes it lives inside the search row. That
    // caused an enormous persistent strip across the bottom of the editor.
    for(const [w,h] of [[1600,1000],[1024,768]]){
      await page.setViewportSize({width:w,height:h});
      await page.evaluate(()=>scrollTo(0,0));
      await page.fill('#subject','Audi');
      await page.locator('#searchSuggestions').waitFor({state:'visible',timeout:6000});
      const suggestionGeometry=await page.evaluate(()=>{
        const row=document.querySelector('.searchrow'),input=document.querySelector('#subject');
        const menu=document.querySelector('#searchSuggestions');
        const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
        return {
          parent:menu.parentElement===row,menu:rect(menu),input:rect(input),
          expanded:input.getAttribute('aria-expanded'),
          screenWidth:innerWidth,screenHeight:innerHeight
        };
      });
      assert.equal(suggestionGeometry.parent,true,'Suggestion menu must be a direct child of the search row');
      assert.equal(suggestionGeometry.expanded,'true','Autocomplete ARIA state is not expanded');
      assert.ok(suggestionGeometry.menu.width>100&&suggestionGeometry.menu.width<=suggestionGeometry.screenWidth,
        'Autocomplete menu width escaped the viewport: '+JSON.stringify(suggestionGeometry));
      assert.ok(Math.abs(suggestionGeometry.menu.left-suggestionGeometry.input.left)<8,
        'Autocomplete menu is not anchored to the input: '+JSON.stringify(suggestionGeometry));
      assert.ok(suggestionGeometry.menu.top>=suggestionGeometry.input.bottom-3 &&
        suggestionGeometry.menu.top<=suggestionGeometry.input.bottom+30,
        'Autocomplete appeared away from its input: '+JSON.stringify(suggestionGeometry));
      await page.locator('#searchBtn').click();
      assert.equal(await page.locator('#searchSuggestions').isHidden(),true,
        'Clicking Search should dismiss suggestions at '+w+'px');
      assert.equal(await page.locator('#subject').getAttribute('aria-expanded'),'false');
      console.log('PASS anchored autocomplete and Search dismissal at '+w+'px');
    }
    await page.setViewportSize({width:1600,height:1000});
    await page.fill('#subject','Audi');
    await page.locator('#searchSuggestions').waitFor({state:'visible'});
    await page.locator('#subject').press('Enter');
    assert.equal(await page.locator('#searchSuggestions').isHidden(),true,'Enter did not dismiss suggestions');
    await page.fill('#subject','Audi');
    await page.locator('#searchSuggestions').waitFor({state:'visible'});
    await page.locator('#subject').press('Escape');
    assert.equal(await page.locator('#searchSuggestions').isHidden(),true,'Escape did not dismiss suggestions');
    await page.fill('#subject','Audi');
    await page.locator('#searchSuggestions').waitFor({state:'visible'});
    await page.locator('#libraryCardsTab').click();
    assert.equal(await page.locator('#searchSuggestions').isHidden(),true,'Leaving the search field did not dismiss suggestions');
    await page.fill('#subject','Audi');
    await page.locator('#searchSuggestions').waitFor({state:'visible'});
    await page.locator('#searchSuggestions [data-suggestion]').first().click();
    assert.equal(await page.locator('#subject').inputValue(),'Auditmon');
    assert.equal(await page.locator('#searchSuggestions').isHidden(),true,'Selecting a suggestion did not close the menu');
    await page.waitForFunction(()=>document.querySelectorAll('#cards .kbs-variant-card').length===300,null,{timeout:12000});
    console.log('PASS autocomplete dismissal by Enter, Escape, outside focus and suggestion selection');


    // Cards and Artwork are mutually exclusive grid panels, not two stacked
    // panels with the inactive card browser still reserving half the height.
    // Test after V2 adds its stronger display:grid class; keep results in DOM.
    for(const [tabWidth,tabHeight] of [[1600,1000],[1024,768],[390,844]]){
      await page.setViewportSize({width:tabWidth,height:tabHeight});
      await page.locator('#libraryArtworkTab').click();
      const artworkView=await page.evaluate(()=>{
        const library=document.querySelector('.workspace > .library.panel');
        const cards=document.querySelector('.variant-pane');
        const artwork=document.querySelector('.artwork-pane');
        const tabs=document.querySelector('#libraryBrowserTabs');
        const visible=el=>getComputedStyle(el).display!=='none'&&el.getClientRects().length>0;
        const a=artwork.getBoundingClientRect();
        const l=library.getBoundingClientRect();
        const t=tabs.getBoundingClientRect();
        return {
          tab:library.dataset.libraryTab,
          cardsVisible:visible(cards),artworkVisible:visible(artwork),
          cardsDisplay:getComputedStyle(cards).display,
          artworkHeight:a.height,libraryBottom:l.bottom,artworkTop:a.top,
          artworkBottom:a.bottom,tabsBottom:t.bottom,
          cardsSelected:document.querySelector('#libraryCardsTab').getAttribute('aria-selected'),
          artworkSelected:document.querySelector('#libraryArtworkTab').getAttribute('aria-selected'),
          preservedCards:document.querySelectorAll('#cards .kbs-variant-card').length
        };
      });
      assert.equal(artworkView.tab,'artwork');
      assert.equal(artworkView.cardsDisplay,'none','Inactive Cards pane must have display:none at '+tabWidth+'px');
      assert.equal(artworkView.cardsVisible,false,'Inactive Cards pane still reserves space at '+tabWidth+'px');
      assert.equal(artworkView.artworkVisible,true,'Artwork must remain visible at '+tabWidth+'px');
      assert.ok(artworkView.artworkHeight>100,'Artwork pane collapsed at '+tabWidth+'px');
      assert.equal(artworkView.cardsSelected,'false');
      assert.equal(artworkView.artworkSelected,'true');
      assert.equal(artworkView.preservedCards,300,'Tab switch unexpectedly rebuilt the card results');
      if(tabWidth>=901){
        assert.ok(artworkView.artworkTop>=artworkView.tabsBottom-3,'Artwork overlaps tab buttons');
        assert.ok(artworkView.artworkBottom<=artworkView.libraryBottom+3,'Artwork exceeds library height');
      }

      await page.locator('#libraryCardsTab').click();
      const cardsView=await page.evaluate(()=>{
        const library=document.querySelector('.workspace > .library.panel');
        const cards=document.querySelector('.variant-pane');
        const artwork=document.querySelector('.artwork-pane');
        return {
          tab:library.dataset.libraryTab,
          cardsVisible:getComputedStyle(cards).display!=='none'&&cards.getClientRects().length>0,
          artworkDisplay:getComputedStyle(artwork).display,
          artworkVisible:getComputedStyle(artwork).display!=='none'&&artwork.getClientRects().length>0,
          preservedCards:document.querySelectorAll('#cards .kbs-variant-card').length
        };
      });
      assert.equal(cardsView.tab,'cards');
      assert.equal(cardsView.cardsVisible,true,'Cards must be visible after switching back');
      assert.equal(cardsView.artworkDisplay,'none','Inactive Artwork pane should not reserve space');
      assert.equal(cardsView.artworkVisible,false);
      assert.equal(cardsView.preservedCards,300,'Card results lost after returning from Artwork');
      console.log('PASS Cards / Artwork panes occupy one grid slot at '+tabWidth+'px');
    }
    await page.setViewportSize({width:1600,height:1000});


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

    // Binder/page palette is shared by all pages in one binder. A page's
    // sleeve color remains independent and survives ordinary/partial switches.
    // The first-card palette loader (including manual Rematch button) is off.
    const colorIsolation=await page.evaluate(async()=>{
      const firstId=activePageId,secondId='audit-second-page';
      const originalSecondSleeve=(await dbGet('pages',secondId)).state.sleeveColor;
      const setColor=(id,value)=>{
        const input=document.getElementById(id);
        input.value=value;
        input.dispatchEvent(new Event('input',{bubbles:true}));
      };
      setColor('binderColor','#234567');
      setColor('pageColor','#345678');
      setColor('sleeveColor','#abcdef');
      await flushSharedColorWrite();
      await saveActivePageSnapshot();
      const binder=await dbGet('binders',activeBinderId);
      const firstSnapshot=await dbGet('pages',firstId);
      await loadPageIntoEditor(secondId,{closeLibrary:false});
      const secondColors={binder:state.binderColor,page:state.pageColor,sleeve:state.sleeveColor};
      setColor('sleeveColor','#cba987');
      await saveActivePageSnapshot();
      await loadPageIntoEditor(firstId,{closeLibrary:false});
      const firstColors={binder:state.binderColor,page:state.pageColor,sleeve:state.sleeveColor};
      const secondSnapshot=await dbGet('pages',secondId);
      const preview=previewMarkup(secondSnapshot,binder);
      await openViewer(secondId);
      const viewer=document.querySelector('#viewerPage .grid');
      const viewerColors={
        binder:viewer?.style.getPropertyValue('--binder'),
        page:viewer?.style.getPropertyValue('--page'),
        sleeve:viewer?.style.getPropertyValue('--sleeve')
      };
      closeViewer();
      return {
        sharedBinder:binder.binderColor,sharedPage:binder.pageColor,version:binder.sharedColorsVersion,originalSecondSleeve,
        firstColors,secondColors,firstStoredSleeve:firstSnapshot.state.sleeveColor,
        secondStoredSleeve:secondSnapshot.state.sleeveColor,viewerColors,
        previewColors:preview.includes('--mini-binder:#234567')&&preview.includes('--mini-page:#345678')&&preview.includes('--mini-sleeve:#cba987'),
        autoPaletteLoaded:!!document.querySelector('script[src*="first-card-auto-theme"]'),
        autoMatchButton:!!document.querySelector('#rematchColors'),
        releaseFlag:globalThis.KBSReleaseBuild?.lazy?.firstCardAutoTheme
      };
    });
    assert.equal(colorIsolation.sharedBinder,'#234567');
    assert.equal(colorIsolation.sharedPage,'#345678');
    assert.equal(colorIsolation.version,1);
    assert.deepEqual(colorIsolation.firstColors,{binder:'#234567',page:'#345678',sleeve:'#abcdef'});
    assert.deepEqual(colorIsolation.secondColors,{binder:'#234567',page:'#345678',sleeve:colorIsolation.originalSecondSleeve});
    assert.notEqual(colorIsolation.originalSecondSleeve,colorIsolation.firstStoredSleeve,'Sleeves must not bleed between pages');
    assert.equal(colorIsolation.firstStoredSleeve,'#abcdef');
    assert.equal(colorIsolation.secondStoredSleeve,'#cba987');
    assert.deepEqual(colorIsolation.viewerColors,{binder:'#234567',page:'#345678',sleeve:'#cba987'});
    assert.equal(colorIsolation.previewColors,true);
    assert.equal(colorIsolation.autoPaletteLoaded,false);
    assert.equal(colorIsolation.autoMatchButton,false);
    assert.equal(colorIsolation.releaseFlag,false);
    console.log('PASS binder-wide colors, independent page sleeves, previews, viewer and disabled auto matching');

    // Viewer simulates a physical binder: page one alone, then facing
    // spreads 2+3, 4+5, ending with a lone page when necessary.
    await page.evaluate(async()=>{
      const pages=await pagesForBinder(activeBinderId);
      for(let i=pages.length;i<6;i++){
        const st=cloneEditorState();st.pockets=Array(12).fill(null);
        await dbPut('pages',{id:'audit-preview-page-'+i,binderId:activeBinderId,title:'Page '+(i+1),order:i,createdAt:Date.now()+i,updatedAt:Date.now()+i,state:st});
      }
      await openViewer((await pagesForBinder(activeBinderId))[0].id);
    });
    const viewerState=()=>page.evaluate(()=>({
      shown:[...document.querySelectorAll('#viewerPage [data-viewer-sheet]')].map(e=>Number(e.dataset.viewerSheet)),
      grids:document.querySelectorAll('#viewerPage .grid').length,
      chosen:viewerIndex,
      counter:document.querySelector('#viewerCounter').textContent,
      prevDisabled:document.querySelector('#viewerPrev').disabled,
      nextDisabled:document.querySelector('#viewerNext').disabled,
      editLabel:document.querySelector('#viewerEdit').textContent,
      activeNumbers:[...document.querySelectorAll('#viewerPageNumbers .page-number.in-spread')].map(e=>Number(e.dataset.viewerPage)),
      boxes:[...document.querySelectorAll('#viewerPage .viewer-sheet .grid')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,width:r.width,height:r.height}}),
      totalNumbers:document.querySelectorAll('#viewerPageNumbers .page-number').length
    }));
    let spread=await viewerState();
    assert.deepEqual(spread.shown,[0]);
    assert.equal(spread.grids,1);
    assert.equal(spread.prevDisabled,true);
    assert.equal(spread.nextDisabled,false);
    assert.equal(spread.counter,'Page 1 of 6');
    assert.equal(spread.totalNumbers,6);
    await page.locator('#viewerNext').click();
    spread=await viewerState();
    assert.deepEqual(spread.shown,[1,2]);
    assert.deepEqual(spread.activeNumbers,[1,2]);
    assert.equal(spread.counter,'Pages 2–3 of 6');
    assert.equal(spread.grids,2);
    assert.ok(spread.boxes[0].right<=spread.boxes[1].x,'Facing sheets overlap');
    assert.ok(spread.boxes.every(b=>b.width>100&&b.height>100),'Facing sheet became too small');
    await page.locator('#viewerPageNumbers [data-viewer-page="2"]').click();
    spread=await viewerState();
    assert.deepEqual(spread.shown,[1,2],'Page-number jump should keep facing page visible');
    assert.equal(spread.chosen,2,'Clicking page 3 must select page 3 for editing');
    assert.equal(spread.editLabel,'Edit page 3');
    await page.locator('#viewerNext').click();
    spread=await viewerState();
    assert.deepEqual(spread.shown,[3,4]);
    assert.equal(spread.counter,'Pages 4–5 of 6');
    await page.locator('#viewerNext').click();
    spread=await viewerState();
    assert.deepEqual(spread.shown,[5]);
    assert.equal(spread.nextDisabled,true);
    assert.equal(spread.counter,'Page 6 of 6');
    await page.locator('#viewerPrev').click();
    spread=await viewerState();
    assert.deepEqual(spread.shown,[3,4]);
    await page.locator('#viewerPage .viewer-sheet-select[data-viewer-select="4"]').click();
    assert.equal((await viewerState()).chosen,4,'Selecting visible sheet did not select editing target');
    await page.locator('#viewerEdit').click();
    await page.waitForFunction(()=>activePageId==='audit-preview-page-4',null,{timeout:8000});
    const editedPage=await page.evaluate(()=>activePageId);
    assert.equal(editedPage,'audit-preview-page-4','Edit must open selected page 5, not adjacent facing page');
    await page.evaluate(async()=>{const pages=await pagesForBinder(activeBinderId);await loadPageIntoEditor(pages[0].id,{closeLibrary:false})});
    console.log('PASS binder preview solo first page, paired spreads, orphan last page and selected-page editing');






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
        const pager=await page.evaluate(()=>{
          const nav=document.querySelector('#editorPageNav');
          const list=document.querySelector('#editorPageNumbers');
          const heading=document.querySelector('.binder-heading-module');
          const buttons=[...list.querySelectorAll('.page-number')];
          const box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
          const area=box(list),headingBox=box(heading);
          const chips=buttons.map(box);
          return {
            mode:getComputedStyle(list).display,
            columns:new Set(chips.map(r=>Math.round(r.x))).size,
            rows:new Set(chips.map(r=>Math.round(r.y))).size,
            scrollHeight:list.scrollHeight,
            clientHeight:list.clientHeight,
            nav:box(nav),area,heading:headingBox,chips,
            prev:getComputedStyle(document.querySelector('#editorPrev')).display,
            next:getComputedStyle(document.querySelector('#editorNext')).display
          };
        });
        const numbersVisible=pager.chips.every(r=>r.x>=pager.area.x-2&&r.right<=pager.area.right+2&&r.y>=pager.area.y-2&&r.bottom<=pager.area.bottom+2);
        if(pager.mode!=='grid'||pager.columns<3||(pager.area.width<400&&pager.rows<2)||
           !numbersVisible||pager.chips.some(r=>r.width>32||r.height>32)||pager.scrollHeight>pager.clientHeight+3||
           pager.prev!=='none'||pager.next!=='none'||
           pager.heading.bottom>panels.selected.y+2)
          throw new Error('FULL_PAGE_GRID_CLIPPED '+JSON.stringify(pager));
        console.log('PASS all page numbers form a visible left-to-right grid at '+width+'px');
        if(width===1680){
          const last=page.locator('#editorPageNumbers .page-number').last();
          const lastId=await last.getAttribute('data-editor-page');
          await last.click();
          await page.waitForFunction(id=>activePageId===id,lastId,{timeout:6500});
          const first=page.locator('#editorPageNumbers .page-number').first();
          const firstId=await first.getAttribute('data-editor-page');
          await first.click();
          await page.waitForFunction(id=>activePageId===id,firstId,{timeout:6500});
          console.log('PASS first and last page numbers navigate directly');
        }

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
    // Mobile-size regression is last: the app's legacy breakpoint handling
    // can replace the desktop workspace on a resize back from phone to desktop.
    // Keep that unrelated behavior from invalidating subsequent desktop tests.
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>scrollTo(0,0));
    await page.locator('#subject').fill('Audi');
    await page.locator('#searchSuggestions').waitFor({state:'visible',timeout:6000});
    const mobileMenu=await page.evaluate(()=>{
      const row=document.querySelector('.searchrow'),menu=document.querySelector('#searchSuggestions'),
        input=document.querySelector('#subject'),m=menu.getBoundingClientRect(),i=input.getBoundingClientRect();
      return {anchored:menu.parentElement===row,menuX:m.left,inputX:i.left,menuTop:m.top,inputBottom:i.bottom,menuWidth:m.width};
    });
    assert.equal(mobileMenu.anchored,true);
    assert.ok(Math.abs(mobileMenu.menuX-mobileMenu.inputX)<8&&mobileMenu.menuTop>=mobileMenu.inputBottom-3&&mobileMenu.menuTop<=mobileMenu.inputBottom+30);
    await page.locator('#searchBtn').click();
    assert.equal(await page.locator('#searchSuggestions').isHidden(),true,'Mobile width Search did not close suggestions');
    console.log('PASS anchored autocomplete and Search dismissal at 390px');

    // A paired spread must remain two visible pages on a phone, stacked
    // instead of being clipped or becoming a single-page navigation view.
    await page.evaluate(async()=>openViewer('audit-second-page'));
    const phoneSpread=await viewerState();
    assert.deepEqual(phoneSpread.shown,[1,2]);
    assert.equal(phoneSpread.grids,2);
    assert.ok(Math.abs(phoneSpread.boxes[0].x-phoneSpread.boxes[1].x)<8,'Mobile pages should stack vertically');
    assert.ok(phoneSpread.boxes[0].y+phoneSpread.boxes[0].height<phoneSpread.boxes[1].y,'Mobile preview sheets overlap');
    assert.ok(phoneSpread.boxes.every(b=>b.x>=-2&&b.right<=390+2),'Mobile preview extends beyond screen');
    await page.screenshot({path:'audit-artifacts/binder-facing-pages-mobile.png',fullPage:true});
    await page.evaluate(()=>closeViewer());
    console.log('PASS facing-page binder preview stacks both pages on mobile');

    if(errors.length)throw new Error('Browser JavaScript exceptions: '+JSON.stringify(errors));
    console.log('PASS no uncaught browser exceptions');
  }finally{
    await browser.close();
    await shutdown();
  }
})().catch(err=>{console.error(err);process.exitCode=1;server.close();});
