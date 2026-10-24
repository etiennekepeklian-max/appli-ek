const SHELL='ek-shell-v1-23c2e3cda537';
const LARGE='ek-large-assets-v1';
const root=new URL('./',self.location).href;
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(SHELL);const r=await fetch(new URL('data/offline-assets.json',root),{cache:'reload'});const files=await r.json();await cache.addAll(files.filter(p=>!p.includes('vendor/ocr/')).map(p=>new Request(new URL(p,root).href,{cache:'reload'})));self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('ek-shell-')&&key!==SHELL)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const target=new URL('./#pending',root).href,windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows)if(client.url.startsWith(root)){await client.navigate(target);return client.focus();}return self.clients.openWindow(target);})());});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;if(!url.href.startsWith(root))return;
  event.respondWith((async()=>{
    if(event.request.mode==='navigate'){try{const response=await fetch(event.request);if(response.ok){const cache=await caches.open(SHELL);await cache.put(event.request,response.clone());}return response;}catch{return await caches.match(event.request)||await caches.match(new URL('index.html',root))||Response.error();}}
    const cached=await caches.match(event.request);if(cached)return cached;
    const response=await fetch(event.request);if(response.ok&&!url.pathname.endsWith('/sw.js')){const cache=await caches.open(url.pathname.includes('/vendor/ocr/')?LARGE:SHELL);await cache.put(event.request,response.clone());}return response;
  })());
});


