let promise;
const db=()=>promise||=new Promise((resolve,reject)=>{const q=indexedDB.open('pikeo-sessions',1);q.onupgradeneeded=()=>{q.result.createObjectStore('identities',{keyPath:'id'});const s=q.result.createObjectStore('messages',{keyPath:'key'});s.createIndex('deviceId','deviceId');};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
async function tx(name,mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(name,mode),q=fn(t.objectStore(name));let result;q.onsuccess=()=>result=q.result;t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Enregistrement interrompu.'));});}
export const identities=()=>tx('identities','readonly',s=>s.getAll());
export const getIdentity=id=>tx('identities','readonly',s=>s.get(id));
export const saveIdentity=row=>tx('identities','readwrite',s=>s.put(row));
export const messages=deviceId=>tx('messages','readonly',s=>s.index('deviceId').getAll(deviceId));
export const getMessage=key=>tx('messages','readonly',s=>s.get(key));
export const saveMessage=row=>tx('messages','readwrite',s=>s.put(row));
export const removeMessage=key=>tx('messages','readwrite',s=>s.delete(key));
