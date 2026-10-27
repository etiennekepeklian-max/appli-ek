import {latestRecords,localDate} from './core.js';
import {protectedFiles} from './archive-core.js';
import {validDraftDate} from './day-drafts-core.js';

const idsOf=row=>[...(row.photoIds||[]),...(row.daySources||[]).map(s=>s.photoId),...(row.pages||[]).map(p=>p.photoId)].filter(Boolean);
function datesOf(data){
 const dates=new Map(),orderPhotos=new Set(),documentDates=new Map();
 const add=(id,date)=>{if(!id||!validDraftDate(date))return;if(!dates.has(id))dates.set(id,new Set());dates.get(id).add(date);};
 for(const [key,row] of latestRecords(data.events||[])){
  if(key.startsWith('orders:'))for(const id of idsOf(row)){orderPhotos.add(id);add(id,row.date);}
  if(key.startsWith('documents:')&&row.dayDate)documentDates.set(row.id,row.dayDate);
 }
 for(const entry of data.metadata||[]){
  if(entry.key==='day-capture')for(const id of idsOf(entry.value||{})){orderPhotos.add(id);add(id,entry.value.date);}
  if(entry.key==='day-capture-backlog')for(const row of Object.values(entry.value||{}))for(const id of idsOf(row)){orderPhotos.add(id);add(id,row.date);}
 }
 for(const entry of data.metadata||[])if(entry.key==='day-photo-dates')for(const [id,date] of Object.entries(entry.value||{}))if(!dates.has(id))add(id,date);
 for(const [id,date] of documentDates)if(!dates.has(id))add(id,date);
 return {dates,orderPhotos};
}
export function dayPhotoIndex(data,snapshots=[]){
 const current=datesOf(data),rows=new Map(),allFiles=new Map((data.files||[]).map(f=>[f.id,f]));for(const s of snapshots)for(const f of s.data?.files||[])if(!allFiles.has(f.id))allFiles.set(f.id,f);
 const allIds=new Set(allFiles.keys()),locked=protectedFiles([...allFiles.values()],data.events||[],(data.metadata||[]).filter(r=>r.key!=='last-undo'));
 // A shared image used by another feature must remain available there.
 const protect=value=>{if(typeof value==='string'&&allIds.has(value))locked.set(value,'Photo utilisée par une autre fonction');else if(Array.isArray(value))value.forEach(protect);else if(value&&typeof value==='object'&&!(value instanceof Blob))Object.values(value).forEach(protect);};
 for(const [key,row] of latestRecords(data.events||[]))if(!row.deleted&&!key.startsWith('orders:')&&!key.startsWith('documents:')&&!key.startsWith('days:'))protect(row);
 const ingest=(source,local)=>{
  const info=datesOf(source);
  for(const file of source.files||[]){
   if(!file.blob?.type?.startsWith('image/')||!(file.kind==='day-photo'||current.orderPhotos.has(file.id)||info.orderPhotos.has(file.id)))continue;
   if(!rows.has(file.id)){
    const known=current.dates.get(file.id)||info.dates.get(file.id),fallback=file.createdAt&&Number.isFinite(Date.parse(file.createdAt))?localDate(new Date(file.createdAt)):null;
    rows.set(file.id,{id:file.id,file,dates:[...(known||[])].sort(),currentDated:current.dates.has(file.id),local:false,copies:0,copyBytes:0,protected:locked.get(file.id)||'',fallback});
   }
   const row=rows.get(file.id);if(local){row.local=true;row.file=file;}else{row.copies++;row.copyBytes+=file.blob.size;}
   if(!row.dates.length&&info.dates.has(file.id))row.dates=[...info.dates.get(file.id)].sort();
  }
 };
 ingest(data,true);for(const s of [...snapshots].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))))ingest(s.data||{},false);
 return [...rows.values()].map(row=>({...row,dates:row.dates.length?row.dates:row.fallback?[row.fallback]:[],bytes:(row.local?row.file.blob.size:0)+row.copyBytes}));
}
export function photoCleanupPlan(data,snapshots,dates,{copies=true}={}){
 const selected=[...new Set(dates)].sort();if(!selected.length||selected.some(d=>!validDraftDate(d)))throw Error('Sélectionnez au moins une date valide.');
 const chosen=new Set(selected),all=dayPhotoIndex(data,snapshots),matching=all.filter(r=>r.dates.some(d=>chosen.has(d))),blocked=matching.filter(r=>r.protected||r.dates.some(d=>!chosen.has(d))),rows=matching.filter(r=>!blocked.includes(r)&&(r.local||copies&&r.copies));
 const manifest=rows.map(r=>({id:r.id,name:r.file.name||'',kind:r.file.kind,createdAt:r.file.createdAt||'',size:r.file.blob.size,dates:r.dates,local:r.local,copies:copies?r.copies:0,copyBytes:copies?r.copyBytes:0}));
 return {dates:selected,rows,blocked,manifest,count:rows.length,localCount:rows.filter(r=>r.local).length,copyCount:copies?rows.reduce((n,r)=>n+r.copies,0):0,bytes:rows.reduce((n,r)=>n+(r.local?r.file.blob.size:0)+(copies?r.copyBytes:0),0),signature:JSON.stringify(manifest)};
}
