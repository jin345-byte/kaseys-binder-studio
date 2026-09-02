const CACHE='kbs-pwa-v2.7.6-staging-r2';
const CORE=['./','./index.html','./app.js','./style.css','./styles/v2-visual.css','./styles/mobile-lab.css','./art-search-lab.css','./features/feature-lab.css','./features/cards-lab.js','./features/catalog-lab.js','./features/binder-lab.js','./features/help-lab.js','./features/mobile-lab.js','./features/cloud-sync.js','./features/cloud-sync.css'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.pathname.startsWith('/api/'))return;
  if(url.pathname==='/features/art-search-proxy.js'||url.pathname==='/features/art-search-lab.js'||url.pathname==='/sw.js'){
    event.respondWith(fetch(event.request,{cache:'no-store'}));
    return;
  }
  event.respondWith(fetch(event.request).then(res=>{
    const copy=res.clone();
    caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
    return res;
  }).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});
