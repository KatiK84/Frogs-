const CACHE="frogs-cache-v2";
const ASSETS=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE?caches.delete(k):null))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request;
  e.respondWith(caches.match(r).then(cached=>cached||fetch(r).then(resp=>{
    if(r.method==="GET"&&new URL(r.url).origin===location.origin){
      const copy=resp.clone(); caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});
    }
    return resp;
  }).catch(()=>cached)));
});
