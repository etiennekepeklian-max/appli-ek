import {writeAlertAcks} from './js/alert-acks.js';
import {redundantOCRAsset} from './js/offline-core.js';
const APP_VERSION='1.17.0';
const SHELL='ek-shell-v1-2be39f737fe5';
const LARGE='ek-large-assets-v1';
const root=new URL('./',self.location).href;
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(SHELL);const url=new URL('data/offline-assets.json',root);const r=await fetch(url,{cache:'reload'});if(!r.ok)throw Error('Manifest hors ligne indisponible');const files=await r.clone().json();await cache.addAll(files.filter(p=>!p.includes('vendor/ocr/')).map(p=>new Request(new URL(p,root).href,{cache:'reload'})));await cache.put(url,r);})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('ek-shell-')&&key!==SHELL)await caches.delete(key);const cache=await caches.open(LARGE);for(const request of await cache.keys())if(request.url.startsWith(root)&&redundantOCRAsset(new URL(request.url).pathname.slice(new URL(root).pathname.length)))await cache.delete(request);await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='PIKEO_VERSION')event.ports?.[0]?.postMessage({type:'PIKEO_VERSION',version:APP_VERSION});if(event.data?.type==='PIKEO_DIAGNOSTIC')event.ports?.[0]?.postMessage({version:APP_VERSION,shellCache:SHELL,largeCache:LARGE});});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const work=event.notification.data?.kind==='work-alert';if(work&&event.action==='stop-work-alert'){await acknowledgeNotification(event.notification);return;}const target=new URL(work?'./#schedule':'./#pending',root).href,windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows)if(client.url.startsWith(root)){await client.navigate(target);return client.focus();}return self.clients.openWindow(target);})());});
self.addEventListener('notificationclose',event=>{if(event.notification.data?.kind==='work-alert')event.waitUntil(acknowledgeNotification(event.notification));});
async function acknowledgeNotification(notification){const keys=notification.data?.keys||[];await writeAlertAcks(keys);for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))if(client.url.startsWith(root))client.postMessage({type:'STOP_WORK_ALERT',keys});}
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;if(!url.href.startsWith(root))return;
  event.respondWith((async()=>{
    if(url.pathname===new URL('release.json',root).pathname||url.pathname===new URL('sw.js',root).pathname)return fetch(event.request,{cache:'no-store'});
    const requested=url.searchParams.get('pikeo-v');
    if(requested&&requested!==APP_VERSION)return fetch(event.request,{cache:'no-store'});

    if(event.request.mode==='navigate'){try{const response=await fetch(event.request);if(response.ok){const cache=await caches.open(SHELL);await cache.put(event.request,response.clone());}return response;}catch{return await caches.match(event.request)||await caches.match(new URL('index.html',root))||Response.error();}}
    const shell=await caches.open(SHELL),canonical=new URL(event.request.url);if(requested)canonical.searchParams.delete('pikeo-v');
    const cached=await shell.match(requested?canonical.href:event.request)||await (await caches.open(LARGE)).match(event.request);if(cached)return cached;
    const response=await fetch(event.request);if(response.ok&&!url.pathname.endsWith('/sw.js')){const cache=await caches.open(url.pathname.includes('/vendor/ocr/')?LARGE:SHELL);await cache.put(event.request,response.clone());}return response;
  })());
});


