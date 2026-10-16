'use strict';
/* Fresh-browser catalog bootstrap with a realistically sized, fully offline fixture. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../public');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const pokemon=Array.from({length:15050},(_,i)=>({
  id:'fixture-pokemon-'+i,name:i<80?'Pikachu':'Othermon '+i,
  setId:'fixture-pokemon-set',setName:'Fixture Set',localId:String(i+1),
  catalog:'english',game:'pokemon',kind:'card',imageLow:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E'
}));
const union=Array.from({length:6200},(_,i)=>({id:'fixture-union-'+i,name:'Union '+i,setId:'fixture-union-set',catalog:'union-arena',game:'union-arena',kind:'card',localId:String(i+1)}));
const pocket=Array.from({length:550},(_,i)=>({id:'fixture-pocket-'+i,name:'Pocket '+i,setId:'pocket:fixture',catalog:'pocket',game:'pokemon-pocket',kind:'card',localId:String(i+1)}));
const chunks=[JSON.stringify(pokemon),JSON.stringify(union),JSON.stringify(pocket)];
const manifest={schema:2,version:'fixture-2026-10-16',cards:pokemon.length+union.length+pocket.length,english:pokemon.length,unionArena:union.length,pocket:pocket.length,chunks:chunks.map((_,i)=>({file:'fixture-'+i+'.json'}))};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);res.end();return}
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
  });
});
const listen=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
(async()=>{
  await listen();
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1500,height:1000}});
  const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  try{
    await page.route(/\/catalog\/manifest\.json/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)}));
    await page.route(/\/catalog\/fixture-(\d+)\.json/,r=>{
      const ix=Number(r.request().url().match(/fixture-(\d+)\.json/)?.[1]||0);
      return r.fulfill({status:200,contentType:'application/json',body:chunks[ix]});
    });
    await page.route(/\/api\/card-search\?/,r=>r.fulfill({status:200,contentType:'application/json',body:'{"data":[],"totalCount":0,"pageSize":250,"page":1}'}));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
    await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof masterCards!=='undefined'&&masterCards.length>=21250,null,{timeout:40000});
    await page.fill('#subject','Pikachu');
    await page.click('#searchBtn');
    await page.waitForFunction(()=>document.querySelectorAll('#cards .kbs-variant-card').length===80,null,{timeout:20000});
    const status=await page.evaluate(()=>({
      cards:masterCards.length,visible:document.querySelectorAll('#cards .kbs-variant-card').length,
      progress:document.querySelector('#libraryProgressText')?.textContent||'',
      catalogVersion:localStorage.getItem('kbsPrebuiltCatalogVersion')||''
    }));
    assert.equal(status.visible,80);
    assert.ok(status.cards>=21250);
    console.log('PASS first-install catalog immediately searchable',JSON.stringify(status));
    if(errs.length)throw new Error('Uncaught errors in first-install bootstrap: '+errs.join('; '));
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
