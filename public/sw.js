const CACHE='kbs-pwa-v2.6.0';
const CORE=['./','./index.html','./app.js','./style.css','./styles/v2-visual.css','./features/feature-lab.css','./features/cards-lab.js','./features/catalog-lab.js','./features/binder-lab.js','./features/help-lab.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request).then(res=>{
    const copy=res.clone();
    caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
    return res;
  }).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});
