'use strict';
/* Read-only guest smoke test against the published domain.
   Never signs in, calls write APIs, or changes real user binders. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const SITE='https://binderstudio.cc';
(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[],failures=[],relevantResponses=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(/\/api\/card-search|\/catalog\/cards-|\/catalog\/manifest/.test(r.url()))relevantResponses.push({url:r.url().slice(0,220),status:r.status()})});
  page.on('requestfailed',r=>failures.push((r.failure()?.errorText||'')+' '+r.url()));
  try{
    const response=await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(response?.status(),200,'Published site did not respond with HTTP 200');
    await page.locator('#grid').waitFor({state:'attached',timeout:15000});
    await page.locator('#cardsViewport').waitFor({state:'attached',timeout:15000});
    const config=await context.request.get(SITE+'/api/config');
    assert.equal(config.status(),200,'Production config API unavailable');
    const manifest=await context.request.get(SITE+'/catalog/manifest.json');
    assert.equal(manifest.status(),200,'Published card manifest unavailable');
    const metadata=await manifest.json();
    assert.ok(Number(metadata.cards)>20000&&Array.isArray(metadata.chunks)&&metadata.chunks.length>0,'Published catalog manifest was incomplete');
    console.log('PUBLISHED_CATALOG',JSON.stringify({cards:metadata.cards,generatedAt:metadata.generatedAt,version:metadata.version}));
    console.log('PUBLISHED_RUNTIME',JSON.stringify(await page.evaluate(()=>({
      build:document.querySelector('meta[name="kbs-build"]')?.content||'',
      stylesheets:document.styleSheets.length,
      cardSearch:Boolean(document.querySelector('#subject')&&document.querySelector('#searchBtn')),
      binderGrid:Boolean(document.querySelector('#grid')),
      printCurrent:Boolean(document.querySelector('#printTiles')),
      printAll:Boolean(document.querySelector('#printTilesAll')),
      lShapes:globalThis.KBSArtworkLShapes?.version||'pending',
      cardsPanel:globalThis.KBSCardVariantsV2?.version||'pending'
    }))));
    await page.fill('#subject','Pikachu');
    await page.click('#searchBtn');
    try{
      await page.waitForFunction(()=>document.querySelectorAll('#cards .kbs-variant-card').length>0,null,{timeout:28000});
    }catch(error){
      const diag=await page.evaluate(()=>({
        query:document.querySelector('#subject')?.value||'',
        set:document.querySelector('#setFilter')?.value||'',
        artist:document.querySelector('#artistFilter')?.value||'',
        master:typeof masterCards!=='undefined'?masterCards.length:-1,
        local:typeof localMasterMatches==='function'?localMasterMatches().length:-1,
        searchResults:typeof cards!=='undefined'?cards.length:-1,
        rendered:document.querySelectorAll('#cards .kbs-variant-card').length,
        catalogVersion:localStorage.getItem('kbsPrebuiltCatalogVersion'),
        catalogStatus:document.querySelector('#masterLibraryStatus')?.textContent||'',
        catalogProgress:document.querySelector('#libraryProgressText')?.textContent||'',
        runtimeError:document.querySelector('#runtimeErrorText')?.textContent||'',
        searchIndex:globalThis.KBSModules?.search?.size||0,
        indexReady:globalThis.KBSModules?.search?.ready||false,
        matchedName:(typeof masterCards!=='undefined'?masterCards.filter(c=>String(c?.name||'').toLowerCase().includes('pikachu')).length:0),
        cardHTML:document.querySelector('#cards')?.textContent?.slice(0,220)||''
      }));
      let apiCheck={status:null,body:''};
      try{
        const r=await context.request.get(SITE+'/api/card-search?q='+encodeURIComponent('name:"Pikachu"')+'&page=1&pageSize=250',{timeout:12000});
        apiCheck={status:r.status(),body:(await r.text()).slice(0,350)};
      }catch(e){apiCheck={error:String(e).slice(0,350)}}
      fs.mkdirSync('audit-artifacts',{recursive:true});
      await page.screenshot({path:'audit-artifacts/live-guest-search-failure.png',fullPage:true}).catch(()=>{});
      console.error('LIVE_SEARCH_DIAG',JSON.stringify({diag,apiCheck,relevantResponses:relevantResponses.slice(-18),errors,failures:failures.slice(0,15)},null,2));
      throw error;
    }
    const count=await page.locator('#cards .kbs-variant-card').count();
    console.log('PASS PUBLISHED_CARD_SEARCH',count);
    assert.ok(count>0);
    await page.locator('#libraryArtworkTab').click();
    assert.ok(await page.locator('.artwork-pane').count()>0);
    await page.locator('#libraryCardsTab').click();
    fs.mkdirSync('audit-artifacts',{recursive:true});
    await page.screenshot({path:'audit-artifacts/live-guest-binderstudio.png',fullPage:true});
    console.log('PASS PUBLISHED_GUEST_NAVIGATION');
    console.log('PUBLISHED_PAGE_ERRORS',JSON.stringify(errors));
    console.log('PUBLISHED_REQUEST_FAILURES',JSON.stringify(failures.slice(0,12)));
    if(errors.length)throw new Error('Uncaught script errors on published site: '+JSON.stringify(errors));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
