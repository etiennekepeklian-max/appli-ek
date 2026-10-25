// Deliberately separate from storage.js: audio NEVER enters Google sync or JSON backups.
import {uid} from './core.js';
let dbPromise,namespace='live';
export function useVoiceNamespace(demo=false){const next=demo?'demo':'live';if(next===namespace)return;const previous=dbPromise;namespace=next;dbPromise=null;void previous?.then(db=>db.close()).catch(()=>{});}
function database(){return dbPromise||=new Promise((resolve,reject)=>{const q=indexedDB.open(`ek-voice-${namespace}`,1);q.onupgradeneeded=()=>q.result.createObjectStore('memos',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>{dbPromise=null;reject(q.error);};});}
async function transact(mode,operation){const db=await database();return new Promise((resolve,reject)=>{const t=db.transaction('memos',mode);let result;const q=operation(t.objectStore('memos'));q.onsuccess=()=>{result=q.result;};t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Enregistrement audio interrompu.'));});}
export const listMemos=async()=> (await transact('readonly',s=>s.getAll())).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
export const getMemo=id=>transact('readonly',s=>s.get(id));
export const removeMemo=id=>transact('readwrite',s=>s.delete(id));
export async function saveMemo(record){
 if(!(record.blob instanceof Blob)||!record.blob.size)throw Error('Aucun son n’a été enregistré.');
 const row={id:record.id||uid(),name:String(record.name||'Mémo vocal').trim().slice(0,100),createdAt:record.createdAt||new Date().toISOString(),duration:Math.max(0,Number(record.duration)||0),mimeType:record.blob.type||'audio/webm',blob:record.blob};
 await transact('readwrite',s=>s.put(row));return row;
}
export function memoExtension(mime){return mime.includes('mp4')?'m4a':mime.includes('ogg')?'ogg':mime.includes('wav')?'wav':'webm';}
export async function exportMemos(){
 const memos=[];
 for(const row of await listMemos()){
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(row.blob);});
  const {blob,...metadata}=row;memos.push({...metadata,data});
 }
 return {app:'PikeoVoice',schema:1,exportedAt:new Date().toISOString(),memos};
}
export async function importMemos(data){
 if(data?.app!=='PikeoVoice'||data.schema!==1||!Array.isArray(data.memos)||data.memos.length>1000)throw Error('Choisissez une sauvegarde de mémos Pikéo.');
 const rows=[];
 for(const row of data.memos){
  if(typeof row.id!=='string'||!row.id||!Number.isFinite(Date.parse(row.createdAt))||typeof row.data!=='string'||!/^data:audio\/[a-zA-Z0-9.+-]+(?:;[a-zA-Z0-9=.+_-]+)*;base64,/.test(row.data))throw Error('La sauvegarde contient un mémo invalide.');
  const blob=await (await fetch(row.data)).blob();if(blob.size>256e6)throw Error('Un mémo dépasse 256 Mo.');rows.push({...row,blob});
 }
 // Validate everything before writing; restore atomically and preserve existing IDs.
 const db=await database();return new Promise((resolve,reject)=>{const t=db.transaction('memos','readwrite'),s=t.objectStore('memos');let count=0;for(const row of rows){const q=s.get(row.id);q.onsuccess=()=>{if(!q.result){const {data,...memo}=row;s.put(memo);count++;}};}t.oncomplete=()=>resolve(count);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Import interrompu.'));});
}


// Local voice checkpoints have their own database; they are never synced or exported with business data.
function recoveryDatabase(){return new Promise((resolve,reject)=>{const q=indexedDB.open('ek-voice-recovery-'+namespace,1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
export async function snapshotVersion(id){
 const rows=await listMemos(),db=await recoveryDatabase();
 try{await new Promise((resolve,reject)=>{const t=db.transaction('snapshots','readwrite'),s=t.objectStore('snapshots'),q=s.get(id);q.onsuccess=()=>{if(!q.result)s.put({id,createdAt:new Date().toISOString(),memos:rows});};t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}finally{db.close();}
}
export async function restoreVoiceVersion(id){
 const db=await recoveryDatabase();let row;try{row=await requestRecovery(db,id);}finally{db.close();}
 if(!row)throw Error('Aucune copie audio pour ce point de restauration.');
 await snapshotVersion('before-voice-restore-'+Date.now());
 for(const memo of row.memos)await saveMemo(memo);return row.memos.length;
}
function requestRecovery(db,id){return new Promise((resolve,reject)=>{const q=db.transaction('snapshots').objectStore('snapshots').get(id);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
