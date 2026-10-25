import {uid} from './core.js';
import {cleanRecord,personalPreferences} from './workbench-core.js';
let namespace='live',promise,rows=[];
const localKey=()=> 'pikeo-personal-'+namespace;
const request=q=>new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
function database(){return promise||=new Promise((resolve,reject)=>{const q=indexedDB.open('pikeo-workbench-'+namespace,1);q.onupgradeneeded=()=>{q.result.createObjectStore('records',{keyPath:'id'});q.result.createObjectStore('snapshots',{keyPath:'id'});q.result.createObjectStore('meta',{keyPath:'key'});};q.onsuccess=()=>resolve(q.result);q.onerror=()=>{promise=null;reject(q.error);};});}
async function transaction(store,mode,operation){const db=await database();return new Promise((resolve,reject)=>{const t=db.transaction(store,mode);let result;const q=operation(t.objectStore(store));if(q)q.onsuccess=()=>{result=q.result;};t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Enregistrement local interrompu.'));});}
export async function open(demo=false){const next=demo?'demo':'live';if(namespace!==next){namespace=next;promise=null;}rows=await transaction('records','readonly',s=>s.getAll());return rows;}
export const list=kind=>rows.filter(r=>!kind||r.kind===kind).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
export const get=id=>rows.find(r=>r.id===id);
export function preferences(){try{return personalPreferences(JSON.parse(localStorage.getItem(localKey())||'{}'));}catch{return personalPreferences();}}
export function savePreferences(values){const p=personalPreferences(values);localStorage.setItem(localKey(),JSON.stringify(p));return p;}
export async function save(kind,input){const old=input.id?get(input.id):null;const row={...old,...cleanRecord(kind,input),id:input.id||uid(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(kind==='goal'&&row.active&&rows.some(r=>r.kind==='goal'&&r.active&&r.id!==row.id))throw Error('Terminez ou mettez en pause votre objectif actuel avant d’en choisir un autre.');
 await transaction('records','readwrite',s=>s.put(row));rows=[...rows.filter(r=>r.id!==row.id),row];return row;
}
export async function remove(id){await transaction('records','readwrite',s=>s.delete(id));rows=rows.filter(r=>r.id!==id);}
export async function meta(key){return (await transaction('meta','readonly',s=>s.get(key)))?.value;}
export const setMeta=(key,value)=>transaction('meta','readwrite',s=>s.put({key,value}));
export async function claim(key,value){const db=await database();return new Promise((resolve,reject)=>{const t=db.transaction('meta','readwrite'),s=t.objectStore('meta');let claimed=false;const q=s.get(key);q.onsuccess=()=>{if(!q.result){s.put({key,value});claimed=true;}};t.oncomplete=()=>resolve(claimed);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}
export const listSnapshots=async()=> (await transaction('snapshots','readonly',s=>s.getAll())).map(({id,version,createdAt,eventCount,fileCount,reason})=>({id,version,createdAt,eventCount,fileCount,reason})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
export const readSnapshot=id=>transaction('snapshots','readonly',s=>s.get(id));
export async function saveSnapshot(row){return transaction('snapshots','readwrite',s=>s.add(row));}
export const localData=()=>({preferences:preferences(),records:structuredClone(rows)});
export function validateLocal(data){if(!Array.isArray(data?.records)||data.records.length>10000)throw Error('Repères personnels invalides.');for(const r of data.records){if(typeof r.id!=='string'||!r.id||!Number.isFinite(Date.parse(r.updatedAt)))throw Error('Repère personnel invalide.');cleanRecord(r.kind,r);}return data;}
export async function restoreLocal(data,{replace=false}={}){
 validateLocal(data);
 const checked=data.records.map(r=>({...r,...cleanRecord(r.kind,r)})),merged=new Map((replace?[]:rows).map(r=>[r.id,r]));
 for(const r of checked){const old=merged.get(r.id);if(!old||old.updatedAt<r.updatedAt)merged.set(r.id,r);}
 const active=[...merged.values()].filter(r=>r.kind==='goal'&&r.active).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 const previous=replace?null:rows.find(r=>r.kind==='goal'&&r.active&&merged.get(r.id)?.active),chosen=previous?.id||active[0]?.id;
 for(const r of active)if(r.id!==chosen)merged.set(r.id,{...r,active:false});
 const db=await database();
 await new Promise((resolve,reject)=>{const t=db.transaction('records','readwrite'),s=t.objectStore('records');if(replace)s.clear();for(const r of merged.values())s.put(r);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});
 rows=await transaction('records','readonly',s=>s.getAll());if(data.preferences)savePreferences(data.preferences);
}
export async function storageSummary(){return {records:rows.length,photos:rows.filter(r=>r.photo instanceof Blob).reduce((n,r)=>n+r.photo.size,0),snapshots:(await listSnapshots()).length};}
