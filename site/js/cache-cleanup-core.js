// CacheStorage contains reproducible application files only.
// This module never opens, clears or deletes IndexedDB, localStorage or user files.
export const isPikeoCache=name=>typeof name==='string'&&(name.startsWith('ek-shell-')||name==='ek-large-assets-v1');
export function cacheRequestInScope(request,baseURL){
 try{const base=new URL(baseURL.endsWith('/')?baseURL:baseURL+'/'),url=new URL(request.url);return request.method==='GET'&&url.origin===base.origin&&url.pathname.startsWith(base.pathname);}catch{return false;}
}
const stamp=response=>[response.status,response.type,response.headers.get('etag'),response.headers.get('last-modified'),response.headers.get('content-length')].join('|');
async function responseBytes(response){
 if(response.type==='opaque'||response.type==='opaqueredirect')throw Error('Taille inaccessible');
 if(!response.body)return 0;
 const reader=response.body.getReader();let bytes=0;
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;}return bytes;}finally{reader.releaseLock();}
}
export function formatCacheBytes(bytes){
 if(!Number.isFinite(bytes)||bytes<0)return '0 o';
 const units=['o','Ko','Mo','Go'];let value=bytes,index=0;
 while(value>=1024&&index<units.length-1){value/=1024;index++;}
 return value.toLocaleString('fr-FR',{maximumFractionDigits:index?1:0})+' '+units[index];
}
export async function inspectAppCache({cacheStorage=globalThis.caches,baseURL=new URL('../',import.meta.url).href,previousFingerprint=''}={}){
 if(!cacheStorage?.keys)return {supported:false,entries:[],bytes:0,fingerprint:''};
 const snapshots=[];
 for(const name of await cacheStorage.keys()){
  if(!isPikeoCache(name)||!await cacheStorage.has(name))continue;
  const cache=await cacheStorage.open(name);
  for(const request of await cache.keys()){
   if(!cacheRequestInScope(request,baseURL))continue;
   const response=await cache.match(request);if(response)snapshots.push({cacheName:name,request,response,stamp:stamp(response)});
  }
 }
 const fingerprint=snapshots.map(r=>r.cacheName+'|'+r.request.url+'|'+r.stamp).sort().join('\n');
 if(fingerprint===previousFingerprint)return {supported:true,unchanged:true,entries:[],bytes:0,fingerprint};
 const entries=[];let bytes=0,unmeasured=0;
 for(const row of snapshots)try{const size=await responseBytes(row.response);entries.push({cacheName:row.cacheName,request:row.request,bytes:size});bytes+=size;}catch{unmeasured++;}
 return {supported:true,entries,bytes,unmeasured,fingerprint};
}
export async function clearAppCache(plan,{cacheStorage=globalThis.caches,baseURL=new URL('../',import.meta.url).href,signal}={}){
 if(!Array.isArray(plan?.entries)||!cacheStorage?.keys)throw Error('Le cache est indisponible.');
 // Validate every target before any deletion. Other apps and scopes are excluded.
 for(const entry of plan.entries)if(!isPikeoCache(entry.cacheName)||!cacheRequestInScope(entry.request,baseURL))throw Error('Le contenu du cache a changé. Relancez la proposition.');
 let removed=0,bytes=0,failed=0;
 for(const entry of plan.entries){
  if(signal?.aborted)break;
  try{
   if(!await cacheStorage.has(entry.cacheName))continue;
   const cache=await cacheStorage.open(entry.cacheName),response=await cache.match(entry.request);if(!response)continue;
   const size=await responseBytes(response);
   if(signal?.aborted)break;
   if(await cache.delete(entry.request)){removed++;bytes+=size;}
  }catch{failed++;}
 }
 // Keep cache containers: deleting one could erase entries added by another tab.
 return {removed,bytes,failed,cancelled:!!signal?.aborted};
}
