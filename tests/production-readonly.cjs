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
  const errors=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));
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
    await page.waitForFunction(()=>document.querySelectorAll('#cards .kbs-variant-card').length>0,null,{timeout:65000});
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
