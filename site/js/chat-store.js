import * as API from './session-api.js';
import * as Local from './session-store.js';
import {localSeal,localOpen,encryptMessage,decryptMessage} from './session-crypto.js';
let running;
export async function history(){const user=API.current();if(!user)return [];const rows=await Local.messages(user.id);return Promise.all(rows.map(async r=>({...r,...await localOpen(r.body,user.keys.local)}))).then(a=>a.sort((a,b)=>a.at.localeCompare(b.at)));}
async function save(user,data){const {text,...meta}=data;return Local.saveMessage({...meta,key:user.id+':'+data.id,deviceId:user.id,body:await localSeal({text},user.keys.local)});}
export async function directory(){const user=API.current();if(!user)return [];if(navigator.onLine){try{const r=await API.request('directory');user.directory=r.profiles;await Local.saveIdentity(user);}catch(e){if(!user.directory)throw e;}}return (user.directory||[]).filter(p=>p.id!==user.profileId);}
export async function send(peer,text){const user=API.current();if(!user)throw Error('Choisissez votre session.');text=String(text||'').trim();if(!text||text.length>2000)throw Error('Écrivez un message de 1 à 2 000 caractères.');const profiles=await directory(),person=profiles.find(p=>p.id===peer);if(!person)throw Error('Choisissez un collègue.');await save(user,{id:crypto.randomUUID(),peer,peerName:person.name,direction:'out',at:new Date().toISOString(),status:'pending',text});if(navigator.onLine)await sync().catch(()=>{});}
export function sync(){if(running)return running;running=exchange().finally(()=>running=null);return running;}
async function exchange(){const user=API.current();if(!user||!navigator.onLine)return;const current=()=>API.current()?.id===user.id;
 const peers=await directory();if(!current())return;
 for(const m of (await history()).filter(m=>m.status==='pending'&&m.direction==='out')){
  if(!current())return;const peer=peers.find(p=>p.id===m.peer);if(!peer?.devices?.length)continue;
  const messages=[];for(const device of peer.devices.slice(0,20))messages.push({id:m.id,recipientDevice:device.id,envelope:await encryptMessage(m.text,device.encryptionKey,m.id,user.id,device.id)});
  if(!current())return;await API.request('send',{messages});await save(user,{id:m.id,peer:m.peer,peerName:m.peerName,direction:'out',at:m.at,status:'sent',text:m.text});
 }
 if(!current())return;const inbox=await API.request('inbox'),ids=[];
 for(const m of inbox.messages){if(!current())return;const key=user.id+':'+m.id,existing=await Local.getMessage(key);if(!existing){const text=await decryptMessage(m.envelope,user.keys.encryption.privateKey,m.id,m.sender_device,user.id);await save(user,{id:m.id,peer:m.sender_profile,peerName:m.sender_name,direction:'in',at:m.created_at,status:'received',text});}ids.push(m.id);}
 // Acknowledge only after durable local writes. Retries are deduplicated.
 if(ids.length&&current())await API.request('ack',{ids});
}

export async function snapshotVersion(id){const u=API.current();if(!u)return;const key=u.id+':'+id;if(await Local.checkpoint(key))return;await Local.saveCheckpoint({key,deviceId:u.id,id,at:new Date().toISOString(),localKey:u.keys.local,messages:await Local.messages(u.id)});}
export async function exportHistory(){const u=API.current();if(!u)throw Error('Ouvrez votre session.');const rows=await history();if(API.current()?.id!==u.id)throw Error('La session a changé.');return {app:'PikeoMessages',schema:1,name:u.name,exportedAt:new Date().toISOString(),messages:rows.map(({id,peer,peerName,direction,at,text})=>({id,peer,peerName,direction,at,text}))};}
export async function importHistory(data){const u=API.current();if(!u)throw Error('Ouvrez votre session.');const norm=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();if(data?.app!=='PikeoMessages'||data.schema!==1||norm(data.name)!==norm(u.name)||!Array.isArray(data.messages)||data.messages.length>20000)throw Error('Choisissez la sauvegarde de messages de ce même utilisateur.');
 const rows=[];for(const m of data.messages){if(typeof m.id!=='string'||!m.id||typeof m.peer!=='string'||typeof m.peerName!=='string'||!['in','out'].includes(m.direction)||typeof m.text!=='string'||m.text.length>2000||!Number.isFinite(Date.parse(m.at)))throw Error('Un message du fichier est invalide.');rows.push({key:u.id+':'+m.id,deviceId:u.id,id:m.id,peer:m.peer,peerName:m.peerName.slice(0,40),direction:m.direction,at:m.at,status:'imported',body:await localSeal({text:m.text},u.keys.local)});}
 if(API.current()?.id!==u.id)throw Error('La session a changé.');await snapshotVersion('before-import-'+Date.now());return Local.mergeMessages(rows);
}
export async function restoreVersion(id){const u=API.current();if(!u)throw Error('Ouvrez votre session.');const row=await Local.checkpoint(u.id+':'+id);if(!row)throw Error('Copie de messages introuvable.');const rows=[];for(const m of row.messages)rows.push({...m,...await localOpen(m.body,row.localKey)});return importHistory({app:'PikeoMessages',schema:1,name:u.name,messages:rows});}
