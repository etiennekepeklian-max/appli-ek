import {uid,makeEvent,latestRecords,TYPES} from './core.js';
let db,events=[],records=new Map(),listeners=new Set(),namespace='live',baseRecords=new Map();
export function setBaseRecords(type,rows){for(const [key] of baseRecords)if(key.startsWith(type+':'))baseRecords.delete(key);for(const row of rows)baseRecords.set(type+':'+row.id,row);}
const request = r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function openStore(demo=false){
  if(db)db.close();namespace=demo?'demo':'live';events=[];records.clear();
  db=await new Promise((resolve,reject)=>{const q=indexedDB.open(`ek-logistique-${namespace}`,1);q.onupgradeneeded=()=>{const d=q.result;d.createObjectStore('events',{keyPath:'id'});d.createObjectStore('files',{keyPath:'id'});d.createObjectStore('meta',{keyPath:'key'});};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  events=await request(db.transaction('events').objectStore('events').getAll());records=latestRecords(events);
  if(!localStorage.getItem('ek-device-id'))localStorage.setItem('ek-device-id',uid());
}
export const isDemo=()=>namespace==='demo';
export const onChange=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
const changed=()=>{for(const fn of listeners)fn();};
export const allEvents=()=>events;
export const getEvents=(type,id)=>events.filter(e=>(!type||e.type===type)&&(!id||e.record.id===id)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
export const list=(type,{includeDeleted=false}={})=>[...records.entries()].filter(([k,r])=>k.startsWith(type+':')&&(includeDeleted||!r.deleted)).map(([,r])=>r);
export const get=(type,id)=>records.get(`${type}:${id}`);
export function settings(){const s=list('preferences').find(p=>p.id==='main')||{};return {name:'Étienne',profile:'preparer',goal:1800,beginner:true,scanSound:true,scanVibration:true,waitNotifications:true,homeShortcuts:['codes','new-pending','new-order','stock'],...s};}
export async function save(type,record,action='Modification'){
  return (await saveBatch([{type,record}],action))[0];
}
let mutations=Promise.resolve();
const serial=fn=>{const task=mutations.catch(()=>{}).then(fn);mutations=task.catch(()=>{});return task;};
const undoTypes=new Set(['families','products','packagings','locations','pending','orders','days','issues','movements','counts','replenishments','journal']);
async function batch(items,action,{undoable=true,resolves=[]}={}){
  let clock=events.reduce((max,e)=>Math.max(max,Date.parse(e.updatedAt)),0);const snapshots=[],seen=new Set();
  const next=items.map(({type,record})=>{
    const r={...record,id:record.id||uid()};delete r._eventId;delete r.updatedAt;
    const key=type+':'+r.id;if(seen.has(key))throw Error('Deux écritures concernent la même fiche.');seen.add(key);
    const before=get(type,r.id)||baseRecords.get(type+':'+r.id),e=makeEvent(type,r,action,settings().name,localStorage.getItem('ek-device-id'),clock);clock=Date.parse(e.updatedAt);
    e.baseEventId=before?._eventId||null;if(resolves.length)e.resolves=[...new Set(resolves)];
    if(JSON.stringify(e.record).length>42000)throw Error('Cette fiche est trop longue. Répartissez les informations sur plusieurs fiches.');
    if(undoTypes.has(type))snapshots.push({type,id:r.id,before:before?structuredClone(before):null,eventId:e.id});
    return e;
  });
  if(!next.length)return [];
  const undo=undoable&&snapshots.length?{action,items:snapshots,at:new Date().toISOString()}:undefined;
  await writeEvents(next,undo);return next.map(e=>e.record);
}
export function saveBatch(items,action='Modification groupée',options){return serial(()=>batch(items,action,options));}
export async function undoInfo(){const info=await meta('last-undo');return info?.items?.length?info:null;}
export function undoLast(){return serial(async()=>{
  const info=await undoInfo();if(!info)throw Error('Aucune action à annuler.');
  if(info.items.some(i=>get(i.type,i.id)?._eventId!==i.eventId))throw Error('Une fiche a changé depuis cette action, éventuellement sur un autre appareil. Annulation refusée pour préserver ces changements.');
  await batch(info.items.map(i=>({type:i.type,record:i.before||{id:i.id,deleted:true}})),'Annulation : '+info.action,{undoable:false});
  await setMeta('last-undo',null);return info.action;
});}
async function writeEvents(items,undo){
  await new Promise((resolve,reject)=>{const t=db.transaction(undo?['events','meta']:['events'],'readwrite');for(const ev of items)t.objectStore('events').put(ev);if(undo)t.objectStore('meta').put({key:'last-undo',value:undo});t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Enregistrement interrompu.'));});
  const m=new Map(events.map(e=>[e.id,e]));for(const ev of items)m.set(ev.id,ev);events=[...m.values()];records=latestRecords(events);changed();
}
export function merge(remote){return serial(async()=>{
  const known=new Set(events.map(e=>e.id));const additions=remote.filter(e=>!known.has(e.id));
  if(additions.length)await writeEvents(additions);return additions.length;
});}
export async function markSynced(ids){const s=new Set(ids);const changedItems=events.filter(e=>s.has(e.id)&&!e.synced).map(e=>({...e,synced:true}));if(changedItems.length)await writeEvents(changedItems);}
export async function markUnsynced(){const items=events.filter(e=>e.synced).map(e=>({...e,synced:false}));if(items.length)await writeEvents(items);}
export const pendingEvents=()=>events.filter(e=>!e.synced);
export async function storeFile(blob,name,kind='photo'){const id=uid();await request(db.transaction('files','readwrite').objectStore('files').put({id,blob,name,kind,createdAt:new Date().toISOString()}));return id;}
export async function readFile(id){return request(db.transaction('files').objectStore('files').get(id));}
export async function files(){return request(db.transaction('files').objectStore('files').getAll());}
export async function setMeta(key,value){await request(db.transaction('meta','readwrite').objectStore('meta').put({key,value}));}
export async function meta(key){const v=await request(db.transaction('meta').objectStore('meta').get(key));return v?.value;}
export async function drafts(){const rows=await request(db.transaction('meta').objectStore('meta').getAll());return rows.filter(r=>r.key.startsWith('draft-')&&r.value).sort((a,b)=>b.value.updatedAt.localeCompare(a.value.updatedAt));}
export async function exportData(){
  const assets=await files();const fileData=[];
  for(const f of assets){const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f.blob);});fileData.push({...f,blob:undefined,data:base64});}
  return {app:'EK Logistique',schema:1,exportedAt:new Date().toISOString(),events,files:fileData};
}
export async function prepareImport(data){
 if(data?.app!=='EK Logistique'||data.schema!==1||!Array.isArray(data.events)||!Array.isArray(data.files??[])||data.events.length>250000)throw Error('Ce fichier n’est pas une sauvegarde Pikéo reconnue.');
 const valid=data.events.every(e=>typeof e.id==='string'&&e.id&&TYPES.includes(e.type)&&typeof e.record?.id==='string'&&e.record.id&&Number.isFinite(Date.parse(e.updatedAt))&&JSON.stringify(e.record).length<43000);
 if(!valid)throw Error('La sauvegarde contient une fiche invalide.');
 const assets=[];
 for(const f of data.files??[]){
  if(typeof f.id!=='string'||!f.id||typeof f.data!=='string'||!/^data:[^,]*;base64,/.test(f.data))throw Error('La sauvegarde contient un fichier invalide.');
  const comma=f.data.indexOf(','),raw=f.data.slice(comma+1);
  if(raw.length>80e6||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)||raw.length%4)throw Error('Fichier trop volumineux ou incomplet.');
  const bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0)),mime=f.data.slice(5,comma).split(';')[0];
  if(mime.startsWith('audio/')||f.kind==='voice')throw Error('Importez les mémos depuis Mémos vocaux.');
  assets.push({...f,data:undefined,blob:new Blob([bytes],{type:mime})});
 }
 return {events:data.events.map(e=>({...e,synced:false})),files:assets};
}
export async function importData(data){
 const prepared=await prepareImport(data);
 return serial(async()=>{
  const known=new Set(events.map(e=>e.id)),additions=prepared.events.filter(e=>!known.has(e.id));
  await new Promise((resolve,reject)=>{
   const t=db.transaction(['events','files'],'readwrite'),es=t.objectStore('events'),fs=t.objectStore('files');
   for(const e of additions)es.put(e);
   for(const f of prepared.files){const q=fs.get(f.id);q.onsuccess=()=>{if(!q.result)fs.put(f);};}
   t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Import interrompu.'));
  });
  events=[...events,...additions];records=latestRecords(events);changed();return additions.length;
 });
}
export async function clearDemo(){if(!isDemo())throw Error('Action réservée à la démonstration.');await new Promise((resolve,reject)=>{const t=db.transaction(['events','files','meta'],'readwrite');t.objectStore('events').clear();t.objectStore('files').clear();t.objectStore('meta').clear();t.oncomplete=resolve;t.onerror=()=>reject(t.error);});events=[];records.clear();changed();}




// Raw local checkpoint: Blob objects are copied by IndexedDB without encoding them.
export async function snapshotData(){
 const metadata=await request(db.transaction('meta').objectStore('meta').getAll());
 return {app:'EK Logistique',schema:1,events:structuredClone(events),files:await files(),metadata:metadata.filter(r=>r.key!=='last-undo')};
}
export async function restoreFilesAndDrafts(snapshot){
 const rows=Array.isArray(snapshot.files)?snapshot.files:[],metadata=(snapshot.metadata||[]).filter(r=>r.key?.startsWith('draft-')||r.key==='day-capture');
 await new Promise((resolve,reject)=>{const t=db.transaction(['files','meta'],'readwrite');for(const row of rows)t.objectStore('files').put(row);for(const row of metadata)t.objectStore('meta').put(row);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});
 changed();
}
