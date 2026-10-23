import {uid,makeEvent,latestRecords,TYPES} from './core.js';
let db,events=[],records=new Map(),listeners=new Set(),namespace='live';
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
export function settings(){const s=list('preferences').find(p=>p.id==='main')||{};return {name:'Étienne',profile:'preparer',goal:1800,beginner:true,...s};}
export async function save(type,record,action='Modification'){
  const r={...record,id:record.id||uid()};delete r._eventId;delete r.updatedAt;
  const clock=events.reduce((max,e)=>Math.max(max,Date.parse(e.updatedAt)),0);
  const e=makeEvent(type,r,action,settings().name,localStorage.getItem('ek-device-id'),clock);
  if(JSON.stringify(e.record).length>42000)throw Error('Cette fiche est trop longue. Répartissez les informations sur plusieurs fiches.');
  await writeEvents([e]);return r;
}
async function writeEvents(items){
  await new Promise((resolve,reject)=>{const t=db.transaction('events','readwrite');for(const ev of items)t.objectStore('events').put(ev);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Enregistrement interrompu.'));});
  const m=new Map(events.map(e=>[e.id,e]));for(const ev of items)m.set(ev.id,ev);events=[...m.values()];records=latestRecords(events);changed();
}
export async function merge(remote){
  const known=new Set(events.map(e=>e.id));const additions=remote.filter(e=>!known.has(e.id));
  if(additions.length)await writeEvents(additions);return additions.length;
}
export async function markSynced(ids){const s=new Set(ids);const changedItems=events.filter(e=>s.has(e.id)&&!e.synced).map(e=>({...e,synced:true}));if(changedItems.length)await writeEvents(changedItems);}
export async function markUnsynced(){const items=events.filter(e=>e.synced).map(e=>({...e,synced:false}));if(items.length)await writeEvents(items);}
export const pendingEvents=()=>events.filter(e=>!e.synced);
export async function storeFile(blob,name,kind='photo'){const id=uid();await request(db.transaction('files','readwrite').objectStore('files').put({id,blob,name,kind,createdAt:new Date().toISOString()}));return id;}
export async function readFile(id){return request(db.transaction('files').objectStore('files').get(id));}
export async function files(){return request(db.transaction('files').objectStore('files').getAll());}
export async function setMeta(key,value){await request(db.transaction('meta','readwrite').objectStore('meta').put({key,value}));}
export async function meta(key){const v=await request(db.transaction('meta').objectStore('meta').get(key));return v?.value;}
export async function exportData(){
  const assets=await files();const fileData=[];
  for(const f of assets){const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f.blob);});fileData.push({...f,blob:undefined,data:base64});}
  return {app:'EK Logistique',schema:1,exportedAt:new Date().toISOString(),events,files:fileData};
}
export async function importData(data){
  if(data.app!=='EK Logistique'||data.schema!==1||!Array.isArray(data.events)||!Array.isArray(data.files??[]))throw Error('Ce fichier n’est pas une sauvegarde EK Logistique reconnue.');
  const valid=data.events.every(e=>e.id&&TYPES.includes(e.type)&&e.record?.id&&Number.isFinite(Date.parse(e.updatedAt))&&JSON.stringify(e.record).length<43000);
  if(!valid)throw Error('La sauvegarde contient une fiche invalide.');
  await merge(data.events.map(e=>({...e,synced:false})));
  for(const f of data.files??[]){if(typeof f.data!=='string'||!f.data.startsWith('data:'))continue;const blob=await (await fetch(f.data)).blob();await request(db.transaction('files','readwrite').objectStore('files').put({...f,data:undefined,blob}));}
  changed();
}
export async function clearDemo(){if(!isDemo())throw Error('Action réservée à la démonstration.');await new Promise((resolve,reject)=>{const t=db.transaction(['events','files'],'readwrite');t.objectStore('events').clear();t.objectStore('files').clear();t.oncomplete=resolve;t.onerror=()=>reject(t.error);});events=[];records.clear();changed();}
