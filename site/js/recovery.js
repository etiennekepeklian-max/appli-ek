import * as Chat from './chat-store.js';
import * as Store from './storage.js';
import * as Personal from './workbench-store.js';
import * as AudioStore from './voice-store.js';
import {VERSION,latestRecords} from './core.js';
const CODE_ARCHIVES={
 '1.9.0':'https://github.com/etiennekepeklian-max/appli-ek/archive/9327cef9698a959d6fecd26d7abe8137af51701c.zip',
 '1.8.0':'https://github.com/etiennekepeklian-max/appli-ek/archive/b9f4e370172244226838f7ddb040b745e88b4a3f.zip'
};
const snapshotPromises=new Map();
export const codeArchive=version=>CODE_ARCHIVES[version]||'https://github.com/etiennekepeklian-max/appli-ek';
export function ensureVersionSnapshot(){const key=Store.scope();if(!snapshotPromises.has(key))snapshotPromises.set(key,makeSnapshot('Avant la version '+VERSION,'before-'+VERSION).catch(e=>{snapshotPromises.delete(key);throw e;}));return snapshotPromises.get(key);}
export async function makeSnapshot(reason='Point de restauration manuel',id='manual-'+Date.now()){
 await Personal.open(Store.isDemo());
 const existing=await Personal.readSnapshot(id);if(existing)return existing;
 const data=await Store.snapshotData();
 const row={id,version:VERSION,createdAt:new Date().toISOString(),reason,eventCount:data.events.length,fileCount:data.files.length,data,personal:Personal.localData(),schedule:localStorage.getItem('ek-work-schedule-'+(Store.scope()))};
 // Voice recovery remains in a different local database and never enters this snapshot.
 AudioStore.useVoiceNamespace(Store.isDemo());await AudioStore.snapshotVersion(id);
 await Chat.snapshotVersion(id);await Personal.saveSnapshot(row);
 return row;
}
export async function restoreSnapshot(id){
 const row=await Personal.readSnapshot(id);if(!row)throw Error('Point de restauration introuvable.');
 await makeSnapshot('Avant restauration '+id);
 const target=latestRecords(row.data.events),current=latestRecords(Store.allEvents()),items=[];
 for(const [key,record] of target){const type=key.slice(0,key.indexOf(':'));items.push({type,record});}
 for(const [key,record] of current){if(!target.has(key)&&!record.deleted){const type=key.slice(0,key.indexOf(':'));items.push({type,record:{id:record.id,deleted:true}});}}
 if(items.length)await Store.saveBatch(items,'Restauration du '+row.createdAt,{undoable:false});
 await Store.restoreFilesAndDrafts(row.data);
 await Personal.restoreLocal(row.personal,{replace:true});
 const key='ek-work-schedule-'+(Store.scope());if(row.schedule)localStorage.setItem(key,row.schedule);
 return {events:items.length,files:row.fileCount};
}
export const available=()=>Personal.listSnapshots();
export const read=id=>Personal.readSnapshot(id);
