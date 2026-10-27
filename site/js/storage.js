import {protectedFiles,hashBytes} from './archive-core.js';
import {validateEnf} from './enf-core.js';
import {restartDayPlan} from './day-core.js';
import {dayPhotoIndex} from './photo-cleanup-core.js';
import {pendingDayDrafts,switchDayDraftState,moveDayPlan} from './day-drafts-core.js';
import * as Identity from './identity-context.js';
import {uid,makeEvent,latestRecords,TYPES} from './core.js';
let db,events=[],records=new Map(),listeners=new Set(),namespace='live',demoMode=false,baseRecords=new Map();
export function setBaseRecords(type,rows){for(const [key] of baseRecords)if(key.startsWith(type+':'))baseRecords.delete(key);for(const row of rows)baseRecords.set(type+':'+row.id,row);}
const request = r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function openStore(demo=false){
  await mutations.catch(()=>{});
  if(db)db.close();demoMode=demo;namespace=Identity.scope(demo);events=[];records.clear();
  db=await new Promise((resolve,reject)=>{const q=indexedDB.open(`ek-logistique-${namespace}`,1);q.onupgradeneeded=()=>{const d=q.result;d.createObjectStore('events',{keyPath:'id'});d.createObjectStore('files',{keyPath:'id'});d.createObjectStore('meta',{keyPath:'key'});};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  events=await request(db.transaction('events').objectStore('events').getAll());records=latestRecords(events);
  if(!localStorage.getItem('ek-device-id'))localStorage.setItem('ek-device-id',uid());
}
export const isDemo=()=>demoMode;
export const scope=()=>namespace;
export const onChange=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
const changed=()=>{for(const fn of listeners)fn();};
export const allEvents=()=>events;
export const getEvents=(type,id)=>events.filter(e=>(!type||e.type===type)&&(!id||e.record.id===id)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
export const list=(type,{includeDeleted=false}={})=>[...records.entries()].filter(([k,r])=>k.startsWith(type+':')&&(includeDeleted||!r.deleted)).map(([,r])=>r);
export const get=(type,id)=>records.get(`${type}:${id}`);
export function settings(){const s=list('preferences').find(p=>p.id==='main')||{};return {name:'Étienne',profile:'preparer',goal:1800,beginner:true,scanSound:true,scanVibration:true,waitNotifications:true,homeShortcuts:['codes','new-pending','new-order','stock'],...s,...(Identity.identity().name?{name:Identity.identity().name}:{})};}
export async function save(type,record,action='Modification'){
  return (await saveBatch([{type,record}],action))[0];
}
let mutations=Promise.resolve();
const serial=fn=>{const task=mutations.catch(()=>{}).then(fn);mutations=task.catch(()=>{});return task;};
const undoTypes=new Set(['families','products','enfs','packagings','locations','pending','orders','days','issues','movements','counts','replenishments','journal']);
async function batch(items,action,{undoable=true,resolves=[],expectedScope,metadata=[]}={}){
  if(expectedScope&&namespace!==expectedScope)throw Error('L’espace de travail a changé.');
  let clock=events.reduce((max,e)=>Math.max(max,Date.parse(e.updatedAt)),0);const snapshots=[],seen=new Set();
  const next=items.map(({type,record})=>{
    if(!isDemo()&&['products','enfs','families','packagings','locations','replenishments'].includes(type))Identity.assertConfigure();
    const r={...record,id:record.id||uid()};if(type==='enfs'&&!r.deleted)Object.assign(r,validateEnf(r));delete r._eventId;delete r.updatedAt;
    const key=type+':'+r.id;if(seen.has(key))throw Error('Deux écritures concernent la même fiche.');seen.add(key);
    const before=get(type,r.id)||baseRecords.get(type+':'+r.id),e=makeEvent(type,r,action,settings().name,localStorage.getItem('ek-device-id'),clock);clock=Date.parse(e.updatedAt);
    e.baseEventId=before?._eventId||null;if(resolves.length)e.resolves=[...new Set(resolves)];
    if(JSON.stringify(e.record).length>42000)throw Error('Cette fiche est trop longue. Répartissez les informations sur plusieurs fiches.');
    if(undoTypes.has(type))snapshots.push({type,id:r.id,before:before?structuredClone(before):null,eventId:e.id});
    return e;
  });
  if(!next.length&&!metadata.length)return [];
  const undo=undoable&&(snapshots.length||metadata.length)?{id:uid(),action,items:snapshots,metadata:structuredClone(metadata),at:new Date().toISOString()}:undefined;
  await writeEvents(next,undo,metadata);return next.map(e=>e.record);
}
export function saveBatch(items,action='Modification groupée',options){return serial(()=>batch(items,action,options));}
export async function undoInfo(){const info=await meta('last-undo');return info&&(info.items?.length||info.metadata?.length)?info:null;}
export const undoId=info=>info?.id||info?.at;
export function dismissUndo(expectedId){return serial(async()=>{
  const info=await undoInfo();if(!info||undoId(info)!==expectedId)throw Error('La dernière action a changé. Vérifiez son intitulé.');
  await setMeta('last-undo',{...info,dismissed:true});
});}
export function undoLast(expectedId){return serial(async()=>{
  const info=await undoInfo();if(!info)throw Error('Aucune action à annuler.');
  if(expectedId&&undoId(info)!==expectedId)throw Error('La dernière action a changé. Vérifiez son intitulé.');
  if(info.items.some(i=>get(i.type,i.id)?._eventId!==i.eventId))throw Error('Une fiche a changé depuis cette action, éventuellement sur un autre appareil. Annulation refusée pour préserver ces changements.');
  const metadata=[];
  const dayKeys=new Set(['day-capture','day-capture-backlog']),dayMetadata=(info.metadata||[]).filter(item=>dayKeys.has(item.key));
  let daysUnchanged=true;for(const item of dayMetadata)if(JSON.stringify(await meta(item.key)??null)!==JSON.stringify(item.value??null))daysUnchanged=false;
  if(!daysUnchanged&&(!info.items.length||dayMetadata.some(item=>item.requireUnchanged)))throw Error('Les photos ont changé depuis cette action. Annulation refusée pour conserver vos nouvelles saisies.');
  for(const item of info.metadata||[])if((!dayKeys.has(item.key)||daysUnchanged)&&JSON.stringify(await meta(item.key)??null)===JSON.stringify(item.value??null))metadata.push({key:item.key,value:item.before??null});
  metadata.push({key:'last-undo',value:null});
  await batch(info.items.map(i=>({type:i.type,record:i.before||{id:i.id,deleted:true}})),'Annulation : '+info.action,{undoable:false,metadata});
  return info.action;
});}
async function writeEvents(items,undo,metadata=[]){
  const ownerDb=db,ownerScope=namespace;
  await new Promise((resolve,reject)=>{const t=db.transaction(undo||metadata.length?['events','meta']:['events'],'readwrite');for(const ev of items)t.objectStore('events').put(ev);for(const item of metadata)t.objectStore('meta').put({key:item.key,value:item.value});if(undo)t.objectStore('meta').put({key:'last-undo',value:undo});t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Enregistrement interrompu.'));});
  if(db!==ownerDb||namespace!==ownerScope)return;
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
export function removeDayPhotos(manifest,dates,expectedScope){return serial(async()=>{
 if(namespace!==expectedScope||!manifest?.length||new Set(manifest.map(f=>f.id)).size!==manifest.length)throw Error('La session ou la sélection a changé.');
 return new Promise((resolve,reject)=>{
  const t=db.transaction(['events','files','meta'],'readwrite'),fs=t.objectStore('files'),ms=t.objectStore('meta'),values=[];let left=3,failure,count=0;
  [t.objectStore('events').getAll(),fs.getAll(),ms.getAll()].forEach((q,i)=>{q.onsuccess=()=>{values[i]=q.result;if(--left)return;try{
   const [events,files,metadata]=values,index=new Map(dayPhotoIndex({events,files,metadata}).map(r=>[r.id,r])),selected=new Set(dates);
   for(const proof of manifest){
    const row=index.get(proof.id),file=files.find(f=>f.id===proof.id);
    if(!file){if(proof.local)throw Error('La sélection a changé. Actualisez les dates.');continue;}
    if(!row||row.protected||(row.currentDated?row.dates:proof.dates).some(d=>!selected.has(d))||file.blob.size!==proof.size||(file.name||'')!==proof.name||(file.createdAt||'')!==proof.createdAt)throw Error('Une photo est utilisée, a changé de date ou a été modifiée. Aucune suppression effectuée.');
   }
   for(const proof of manifest)if(files.some(f=>f.id===proof.id)){fs.delete(proof.id);count++;}
  }catch(error){failure=error;t.abort();}};});
  t.oncomplete=()=>{changed();resolve(count);};t.onerror=()=>reject(failure||t.error);t.onabort=()=>reject(failure||t.error||Error('Suppression interrompue.'));
 });
});}
export async function setMeta(key,value){await request(db.transaction('meta','readwrite').objectStore('meta').put({key,value}));}
export async function meta(key){const v=await request(db.transaction('meta').objectStore('meta').get(key));return v?.value;}
export async function dayDrafts(){return pendingDayDrafts(await meta('day-capture'),await meta('day-capture-backlog'));}
export function switchDayDraft(date,expectedScope){return serial(async()=>{
  if(scope()!==expectedScope)throw Error('L’espace de travail a changé. Rouvrez vos photos.');
  const next=switchDayDraftState(date,await meta('day-capture'),await meta('day-capture-backlog'));
  await new Promise((resolve,reject)=>{
    const t=db.transaction('meta','readwrite'),store=t.objectStore('meta');
    store.put({key:'day-capture',value:next.draft});store.put({key:'day-capture-backlog',value:next.backlog});
    t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Changement de journée interrompu.'));
  });
  return next.draft;
});}
export function restartDay(date,expectedSignature,expectedScope){return serial(async()=>{
  if(scope()!==expectedScope)throw Error('La session a changé. Rouvrez Ma journée.');
  const draft=await meta('day-capture'),backlog=await meta('day-capture-backlog'),plan=restartDayPlan(date,list('orders'),list('days'),draft,backlog);
  if(plan.signature!==expectedSignature)throw Error('La journée ou les photos ont changé. Relisez le récapitulatif avant de recommencer.');
  if(!plan.items.length&&!plan.photos)throw Error('Cette journée ne contient plus de commande, de correction ni de photo à supprimer.');
  const next=switchDayDraftState(date,draft,backlog);
  await batch(plan.items,'Journée du '+date+' annulée pour refaire les photos',{expectedScope,metadata:[{key:'day-capture',before:draft??null,value:plan.nextSession},{key:'day-capture-backlog',before:backlog??null,value:next.backlog}]});
  return plan.nextSession;
});}
export function moveDay(date,newDate,expectedSignature,expectedScope){return serial(async()=>{
  if(scope()!==expectedScope)throw Error('La session a changé. Rouvrez Ma journée.');
  const draft=await meta('day-capture'),backlog=await meta('day-capture-backlog'),plan=moveDayPlan(date,newDate,list('orders'),list('days'),draft,backlog);
  if(plan.signature!==expectedSignature)throw Error('La journée ou les photos ont changé. Rouvrez la modification de date avant de sauvegarder.');
  const photoDates=await meta('day-photo-dates'),source=draft?.date===date?draft:backlog?.[date],ids=new Set([...(source?.pages||[]).map(p=>p.photoId),...plan.items.filter(i=>i.type==='orders').flatMap(i=>[...(i.record.photoIds||[]),...(i.record.daySources||[]).map(s=>s.photoId)])].filter(Boolean));
  const nextPhotoDates={...photoDates,...Object.fromEntries([...ids].map(id=>[id,newDate]))};
  await batch(plan.items,'Journée déplacée du '+date+' au '+newDate,{expectedScope,metadata:[{key:'day-capture',before:draft??null,value:plan.draft,requireUnchanged:true},{key:'day-capture-backlog',before:backlog??null,value:plan.backlog,requireUnchanged:true},{key:'day-photo-dates',before:photoDates??null,value:nextPhotoDates}]});
  return plan;
});}
export async function drafts(){const rows=await request(db.transaction('meta').objectStore('meta').getAll());return rows.filter(r=>r.key.startsWith('draft-')&&r.value).sort((a,b)=>b.value.updatedAt.localeCompare(a.value.updatedAt));}
export async function exportData(){
  const assets=await files();const fileData=[];
  for(const f of assets){const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f.blob);});fileData.push({...f,blob:undefined,data:base64});}
  return {app:'EK Logistique',schema:1,exportedAt:new Date().toISOString(),events,files:fileData};
}
export async function prepareImport(data){
 if(data?.app!=='EK Logistique'||data.schema!==1||!Array.isArray(data.events)||!Array.isArray(data.files??[])||data.events.length>250000)throw Error('Ce fichier n’est pas une sauvegarde Pikéo reconnue.');
 const valid=data.events.every(e=>{if(!(typeof e.id==='string'&&e.id&&TYPES.includes(e.type)&&typeof e.record?.id==='string'&&e.record.id&&Number.isFinite(Date.parse(e.updatedAt))&&JSON.stringify(e.record).length<43000))return false;if(e.type==='enfs'&&!e.record.deleted){try{validateEnf(e.record);}catch{return false;}}return true;});
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
 const rows=Array.isArray(snapshot.files)?snapshot.files:[],metadata=(snapshot.metadata||[]).filter(r=>r.key?.startsWith('draft-')||['day-capture','day-capture-backlog','day-photo-dates'].includes(r.key));
 await new Promise((resolve,reject)=>{const t=db.transaction(['files','meta'],'readwrite');for(const row of rows)t.objectStore('files').put(row);for(const row of metadata)t.objectStore('meta').put(row);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});
 changed();
}

export function removeArchivedFiles(manifest,expectedScope,archiveName){
 return serial(async()=>{
  if(namespace!==expectedScope||!Array.isArray(manifest)||!manifest.length||manifest.length>500||new Set(manifest.map(f=>f.id)).size!==manifest.length)throw Error('La session ou la sélection a changé.');
  const wanted=new Map(manifest.map(f=>[f.id,f])),current=await files();
  for(const proof of manifest){const row=current.find(f=>f.id===proof.id);if(!row||row.blob.size!==proof.size||await hashBytes(await row.blob.arrayBuffer())!==proof.sha256)throw Error('Un fichier a changé : créez une nouvelle archive.');}
  if(namespace!==expectedScope)throw Error('La session a changé.');
  const count=await new Promise((resolve,reject)=>{
   const t=db.transaction(['events','files','meta'],'readwrite'),fs=t.objectStore('files'),ms=t.objectStore('meta'),values=[];let left=3,failure;
   const requests=[t.objectStore('events').getAll(),fs.getAll(),ms.getAll()];
   requests.forEach((q,i)=>{q.onsuccess=()=>{values[i]=q.result;if(--left)return;try{
    const [liveEvents,liveFiles,metadata]=values,locked=protectedFiles(liveFiles,liveEvents,metadata),archived={...(metadata.find(r=>r.key==='archived-files')?.value||{})};
    for(const proof of manifest){const row=liveFiles.find(f=>f.id===proof.id);if(!row||locked.has(row.id)||row.blob.size!==proof.size||(row.name||'fichier')!==proof.name||(row.kind||'document')!==proof.kind||(row.blob.type||'application/octet-stream')!==proof.mime||(row.createdAt||'')!==proof.createdAt)throw Error('Un fichier est maintenant utilisé ou a changé. Aucun retrait effectué.');}
    for(const proof of manifest){fs.delete(proof.id);archived[proof.id]={name:proof.name,kind:proof.kind,archiveName:String(archiveName||'').slice(0,180),archivedAt:new Date().toISOString()};}
    ms.put({key:'archived-files',value:archived});
   }catch(e){failure=e;t.abort();}};});
   t.oncomplete=()=>resolve(wanted.size);t.onerror=()=>reject(failure||t.error);t.onabort=()=>reject(failure||t.error||Error('Retrait interrompu.'));
  });changed();return count;
 });
}
export function restoreArchivedFiles(rows,expectedScope){
 return serial(async()=>{
  if(namespace!==expectedScope||!Array.isArray(rows)||!rows.length||rows.length>500||rows.some(f=>!f.id||!(f.blob instanceof Blob)||f.kind==='voice'||f.kind==='font'||f.blob.type.startsWith('audio/')))throw Error('L’archive ou la session est invalide.');
  const count=await new Promise((resolve,reject)=>{
   const t=db.transaction(['files','meta'],'readwrite'),fs=t.objectStore('files'),ms=t.objectStore('meta');let added=0;
   const q=ms.get('archived-files');q.onsuccess=()=>{const archived={...(q.result?.value||{})};for(const row of rows){const get=fs.get(row.id);get.onsuccess=()=>{if(!get.result){fs.put(row);added++;}delete archived[row.id];ms.put({key:'archived-files',value:archived});};}};
   t.oncomplete=()=>resolve(added);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Import interrompu.'));
  });changed();return count;
 });
}
