import test from 'node:test';
import assert from 'node:assert/strict';
import {isPikeoCache,cacheRequestInScope,inspectAppCache,clearAppCache,formatCacheBytes} from '../site/js/cache-cleanup-core.js';
const baseURL='https://cache.example/appli-ek/';
function fixture(){
 const maps=new Map(),deleted=[],fail=new Set();
 const put=(name,url,body)=>{if(!maps.has(name))maps.set(name,new Map());const request=new Request(url),response=body?.type==='opaque'?body:new Response(body);maps.get(name).set(request.url,{request,response});};
 const cacheStorage={keys:async()=>[...maps.keys()],has:async name=>maps.has(name),open:async name=>{
  if(!maps.has(name))maps.set(name,new Map());const data=maps.get(name);
  return {keys:async()=>[...data.values()].map(v=>v.request.clone()),match:async request=>{const r=data.get(request.url)?.response;return r?.clone?r.clone():r;},delete:async request=>{if(fail.has(request.url))throw Error('Refus fictif');deleted.push(request.url);return data.delete(request.url);}};
 },delete:async()=>{throw Error('La suppression d’un conteneur entier est interdite.');}};
 return {maps,put,cacheStorage,deleted,fail};
}
test('cache : périmètre Pikéo strict et tailles affichées en français',()=>{
 assert.equal(isPikeoCache('ek-shell-v1-test'),true);assert.equal(isPikeoCache('ek-large-assets-v1'),true);assert.equal(isPikeoCache('miam-cache'),false);
 assert.equal(cacheRequestInScope(new Request(baseURL+'a.js'),baseURL),true);
 for(const url of ['https://cache.example/miam/a.js','https://cache.example/appli-ek-bis/a.js','https://other.example/appli-ek/a.js',baseURL+'../a.js'])
  assert.equal(cacheRequestInScope(new Request(url),baseURL),false);
 assert.equal(cacheRequestInScope(new Request(baseURL+'a.js',{method:'POST'}),baseURL),false);
 assert.equal(formatCacheBytes(0),'0 o');assert.equal(formatCacheBytes(1024),'1 Ko');assert.equal(formatCacheBytes(5.25*1024*1024),'5,3 Mo');
});
test('cache : seuls les octets des réponses autorisées sont mesurés, sans toucher aux données',async()=>{
 const f=fixture();f.put('ek-shell-v1-test',baseURL+'a.js','été');f.put('ek-large-assets-v1',baseURL+'vendor/ocr/a.js',new Uint8Array(4096));
 f.put('ek-shell-v1-test','https://cache.example/miam/a.js','foreign');f.put('miam-cache',baseURL+'outside.js','other cache');
 const plan=await inspectAppCache({cacheStorage:f.cacheStorage,baseURL});
 assert.equal(plan.bytes,4101);assert.equal(plan.entries.length,2);assert.deepEqual(f.deleted,[]);
 const repeat=await inspectAppCache({cacheStorage:f.cacheStorage,baseURL,previousFingerprint:plan.fingerprint});assert.equal(repeat.unchanged,true);assert.deepEqual(f.deleted,[]);
});
test('cache : confirmation limitée au plan, nouveaux fichiers et autres applications conservés',async()=>{
 const f=fixture();f.put('ek-shell-v1-test',baseURL+'a.js','été');f.put('ek-large-assets-v1',baseURL+'vendor/ocr/a.js',new Uint8Array(4096));
 f.put('ek-shell-v1-test','https://cache.example/miam/a.js','foreign');f.put('miam-cache',baseURL+'outside.js','other cache');
 const plan=await inspectAppCache({cacheStorage:f.cacheStorage,baseURL});
 f.put('ek-shell-v1-test',baseURL+'new.js','arrivé après confirmation');
 const result=await clearAppCache(plan,{cacheStorage:f.cacheStorage,baseURL});
 assert.equal(result.removed,2);assert.equal(result.bytes,4101);assert.equal(result.failed,0);
 assert.ok(f.maps.get('ek-shell-v1-test').has(baseURL+'new.js'));assert.ok(f.maps.get('ek-shell-v1-test').has('https://cache.example/miam/a.js'));assert.equal(f.maps.get('miam-cache').size,1);
});
test('cache : un plan étranger est refusé avant toute suppression',async()=>{
 const f=fixture();f.put('ek-shell-v1-test',baseURL+'a.js','keep');
 const plan={entries:[{cacheName:'ek-shell-v1-test',request:new Request(baseURL+'a.js')},{cacheName:'miam-cache',request:new Request(baseURL+'other.js')}]};
 await assert.rejects(clearAppCache(plan,{cacheStorage:f.cacheStorage,baseURL}),/cache a changé/);assert.deepEqual(f.deleted,[]);
});
test('cache : annulation, fichier déjà retiré et échec partiel ne gonflent pas le bilan',async()=>{
 const f=fixture();f.put('ek-shell-v1-test',baseURL+'a.js','abc');f.put('ek-shell-v1-test',baseURL+'b.js','defg');
 const plan=await inspectAppCache({cacheStorage:f.cacheStorage,baseURL}),controller=new AbortController();controller.abort();
 const cancelled=await clearAppCache(plan,{cacheStorage:f.cacheStorage,baseURL,signal:controller.signal});assert.equal(cancelled.removed,0);assert.equal(cancelled.cancelled,true);
 f.maps.get('ek-shell-v1-test').delete(baseURL+'a.js');f.fail.add(baseURL+'b.js');
 const result=await clearAppCache(plan,{cacheStorage:f.cacheStorage,baseURL});assert.equal(result.removed,0);assert.equal(result.bytes,0);assert.equal(result.failed,1);assert.ok(f.maps.get('ek-shell-v1-test').has(baseURL+'b.js'));
});
test('cache : réponse non mesurable conservée et API absente tolérée',async()=>{
 const f=fixture();f.put('ek-shell-v1-test',baseURL+'opaque',{type:'opaque',status:0,headers:new Headers(),body:null});
 const plan=await inspectAppCache({cacheStorage:f.cacheStorage,baseURL});assert.equal(plan.bytes,0);assert.equal(plan.unmeasured,1);assert.equal(plan.entries.length,0);
 await clearAppCache(plan,{cacheStorage:f.cacheStorage,baseURL});assert.equal(f.maps.get('ek-shell-v1-test').size,1);
 assert.equal((await inspectAppCache({cacheStorage:{},baseURL})).supported,false);
});
