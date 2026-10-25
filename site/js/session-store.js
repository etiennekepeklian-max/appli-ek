let promise;
const db=()=>promise||=new Promise((resolve,reject)=>{const q=indexedDB.open('pikeo-sessions',2);q.onupgradeneeded=()=>{const d=q.result;if(!d.objectStoreNames.contains('identities'))d.createObjectStore('identities',{keyPath:'id'});if(!d.objectStoreNames.contains('messages')){const s=d.createObjectStore('messages',{keyPath:'key'});s.createIndex('deviceId','deviceId');}if(!d.objectStoreNames.contains('checkpoints')){const s=d.createObjectStore('checkpoints',{keyPath:'key'});s.createIndex('deviceId','deviceId');}};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
async function tx(name,mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(name,mode),q=fn(t.objectStore(name));let result;q.onsuccess=()=>result=q.result;t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Enregistrement interrompu.'));});}
export const identities=()=>tx('identities','readonly',s=>s.getAll());
export const getIdentity=id=>tx('identities','readonly',s=>s.get(id));
export const saveIdentity=row=>tx('identities','readwrite',s=>s.put(row));
export const messages=deviceId=>tx('messages','readonly',s=>s.index('deviceId').getAll(deviceId));
export const getMessage=key=>tx('messages','readonly',s=>s.get(key));
export const saveMessage=row=>tx('messages','readwrite',s=>s.put(row));
export const removeMessage=key=>tx('messages','readwrite',s=>s.delete(key));

export const checkpoints=deviceId=>tx('checkpoints','readonly',s=>s.index('deviceId').getAll(deviceId));
export const checkpoint=key=>tx('checkpoints','readonly',s=>s.get(key));
export const saveCheckpoint=row=>tx('checkpoints','readwrite',s=>s.put(row));
export async function mergeMessages(rows){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('messages','readwrite'),s=t.objectStore('messages');let count=0;for(const r of rows){const q=s.get(r.key);q.onsuccess=()=>{if(!q.result){s.put(r);count++;}};}t.oncomplete=()=>resolve(count);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}
