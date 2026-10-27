import {assertConfigure} from './identity-context.js';
import * as Secrets from './secure-session.js';
import {sealedEventRow,eventFromSealedRow,sealJSON,openJSON,toBase64,fromBase64} from './secure-core.js';
import * as Store from './storage.js';
import {SHEETS,SHEET_TABS,HEADERS,rowForEvent,eventFromRow} from './core.js';
export const DEFAULT_SHEET='';
export const DEFAULT_CLIENT_ID='296553280936-dmrbf1rsbchdqgh2cgeuks1gjg0n10dq.apps.googleusercontent.com';
let accessToken='',expires=0,busy=false,identityPromise,lastError='',legacyCount=0;
export const activity=()=>({busy,error:lastError,legacyCount,encrypted:false,keyLoaded:Secrets.unlocked()});
const emit=(message,detail={})=>{if(detail.error)lastError=message;else if(detail.success)lastError='';window.dispatchEvent(new CustomEvent('ek-sync',{detail:{message,busy,...detail}}));};
const connectionKey=()=>Store.scope()==='live'?'ek-google':'ek-google-'+Store.scope();
export function connection(){try{const saved=JSON.parse(localStorage.getItem(connectionKey())||'{}');return {spreadsheetId:DEFAULT_SHEET,...saved,clientId:saved.clientId?.trim()||DEFAULT_CLIENT_ID};}catch{return {clientId:DEFAULT_CLIENT_ID,spreadsheetId:DEFAULT_SHEET};}}
export function saveConnection(values){const current=connection();localStorage.setItem(connectionKey(),JSON.stringify({...current,...values,...(values.spreadsheetId!==undefined&&values.spreadsheetId!==current.spreadsheetId?{folderId:''}:{})}));lastError='';}
export const connected=()=>!!accessToken&&Date.now()<expires;
export function disconnect(){accessToken='';expires=0;lastError='';emit('Compte déconnecté sur cet appareil.');}
function loadIdentity(){
  if(window.google?.accounts?.oauth2)return Promise.resolve();
  if(identityPromise)return identityPromise;
  identityPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');let timer;
    const fail=()=>{clearTimeout(timer);identityPromise=null;script.remove();reject(Error('Connexion Google indisponible. Vérifiez le réseau puis réessayez.'));};
    script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=()=>{clearTimeout(timer);window.google?.accounts?.oauth2?resolve():fail();};script.onerror=fail;
    timer=setTimeout(fail,15000);document.head.append(script);
  });return identityPromise;
}
export async function connect(){
  assertConfigure();
  if(Store.isDemo())throw Error('La démonstration ne se synchronise pas avec Google.');
  const c=connection();if(!c.clientId?.trim())throw Error('Renseignez l’identifiant OAuth Google dans Réglages → Connexion Google. Le guide inclus explique sa création.');
  if(!navigator.onLine)throw Error('La connexion Google nécessite un accès Internet. Vos saisies restent enregistrées ici.');
  await loadIdentity();
  await new Promise((resolve,reject)=>{
    const client=google.accounts.oauth2.initTokenClient({client_id:c.clientId.trim(),scope:'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',callback:r=>{if(r.error){reject(Error(r.error_description||r.error));return;}accessToken=r.access_token;expires=Date.now()+Math.max(0,Number(r.expires_in)-60)*1000;resolve();},error_callback:r=>reject(Error(r.type==='popup_closed'?'La fenêtre Google a été fermée.':'Autorisez la fenêtre de connexion Google puis réessayez.'))});
    client.requestAccessToken({prompt:''});
  });emit('Compte Google connecté.');if(!c.spreadsheetId)return {connected:true,pendingDatabase:true};return sync();
}
async function api(url,{method='GET',body,headers={},retry=true,signal=AbortSignal.timeout(20000)}={}){
  if(!connected())throw Error('Reconnectez votre compte Google pour synchroniser.');
  const response=await fetch(url,{method,signal,headers:{Authorization:`Bearer ${accessToken}`,...(body&&!(body instanceof Blob)?{'Content-Type':'application/json'}:{}),...headers},body:body instanceof Blob?body:body?JSON.stringify(body):undefined});
  if(!response.ok){if(response.status===401)disconnect();let data;try{data=await response.json();}catch{}
    if((response.status===429||response.status>=500)&&retry&&method==='GET'){await new Promise(r=>setTimeout(r,700));return api(url,{method,body,headers,retry:false});}
    throw Error(data?.error?.message||`Google ne peut pas terminer l’action (${response.status}).`);
  }if(response.status===204)return {};return response.json();
}
export async function checkConnection(){
 if(Store.isDemo())return {status:'manual',detail:'La démonstration reste séparée de Google.'};
 if(!navigator.onLine)return {status:'warn',detail:'Hors connexion : accès Google à vérifier avec Internet.',route:'storage',linkLabel:'les sauvegardes'};
 const c=connection();if(!connected()||!c.spreadsheetId)return {status:'manual',detail:'Connectez votre sauvegarde puis relancez pour tester son accès en lecture.',route:'storage',linkLabel:'les sauvegardes'};
 const data=await api('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(c.spreadsheetId)+'?fields=sheets(properties(title))',{retry:false,signal:AbortSignal.timeout(6000)});
 const titles=new Set(data.sheets?.map(s=>s.properties.title));
 if(!SHEET_TABS.every(t=>titles.has(t)))throw Error('Onglet Google absent');
 return {detail:'Accès en lecture aux quatre onglets confirmé. L’envoi réel se vérifie depuis Sauvegardes.',route:'storage',linkLabel:'les sauvegardes'};
}
async function pull(id,key,capture=[]){
  legacyCount=0;
  const metadata=await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?fields=sheets(properties(title,gridProperties(rowCount)))`);
  const rowCounts=new Map(metadata.sheets.map(s=>[s.properties.title,s.properties.gridProperties.rowCount]));
  // Never recreate the old tabs. A legacy base must be migrated deliberately.
  for(const tab of SHEET_TABS)if(!rowCounts.has(tab))throw Error(`Cette base utilise encore l’ancienne organisation, ou l’onglet « ${tab} » manque. Utilisez la base regroupée en produit, manquant, objectif picking et historique. Vos données locales sont conservées.`);
  const known=new Map(Store.allEvents().map(e=>[e.id,e]));
  const all=[],active=new Set(SHEET_TABS),chunk=2500;let offset=2;
  while(active.size){for(const tab of active)if(rowCounts.get(tab)<offset)active.delete(tab);const batch=[...active];if(!batch.length)break;const q=new URLSearchParams({valueRenderOption:'UNFORMATTED_VALUE'});for(const tab of batch)q.append('ranges',`'${tab}'!A${offset}:L${Math.min(offset+chunk-1,rowCounts.get(tab))}`);
    const data=await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values:batchGet?${q}`);
    for(let i=0;i<batch.length;i++){const rows=data.valueRanges?.[i]?.values||[];for(const [rowIndex,row] of rows.entries()){const encrypted=String(row[10]||'').startsWith('{"app":"PikeoEncrypted"');if(encrypted&&!key&&!known.has(row[0]))throw Error('Cette base contient des anciennes lignes chiffrées absentes de ce téléphone. Chargez leur ancienne clé ou importez la copie JSON de votre appareil d’origine. Les nouveaux envois ne demandent aucune clé.');const ev=encrypted?(key?await eventFromSealedRow(row,key):{...known.get(row[0]),synced:true}):eventFromRow(row);if(row[0]&&row[10]&&!ev)throw Error('Une révision Google est illisible. Vérifiez la copie de sécurité avant de continuer.');if(ev&&SHEETS[ev.type]===batch[i]){all.push(ev);if(encrypted){legacyCount++;capture.push({tab:batch[i],row:offset+rowIndex,raw:row,event:ev});}}}if(rows.length<chunk)active.delete(batch[i]);}
    offset+=chunk;
    if(offset>250002)throw Error('La base dépasse 250 000 lignes par onglet. Exportez et archivez une période avant de continuer.');
  }return all;
}
async function ensureFolder(){
  const c=connection();if(c.folderId)return c.folderId;
  const q="trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='ek-database' and value='"+c.spreadsheetId.replace(/[^a-zA-Z0-9_-]/g,'')+"' }";
  const found=await api('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q,fields:'files(id,name)'}));
  const f=found.files?.[0]||await api('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',body:{name:'Pikéo — Documents',mimeType:'application/vnd.google-apps.folder',appProperties:{'ek-database':c.spreadsheetId}}});
  saveConnection({folderId:f.id});return f.id;
}
async function uploadFiles(){
  const files=await Store.files();const toUpload=files.filter(f=>f.kind!=='voice'&&!f.blob.type?.startsWith('audio/')&&(!Store.get('documents',f.id)?.driveId||Store.get('documents',f.id)?.encryption!=='plain'||Store.get('documents',f.id)?.cloudSheetId!==connection().spreadsheetId));if(!toUpload.length)return;
  const folder=await ensureFolder();
  for(const f of toUpload){emit('Sauvegarde d’un document lisible…');
    const q="trashed = false and appProperties has { key='ek-local-id' and value='"+f.id.replace(/[^a-zA-Z0-9_-]/g,'')+"' }";
    const secureQuery=q+" and appProperties has { key='pikeo-encrypted' and value='0' } and appProperties has { key='ek-database' and value='"+connection().spreadsheetId.replace(/[^a-zA-Z0-9_-]/g,'')+"' }";
    const existing=await api('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q:secureQuery,fields:'files(id,webViewLink)'}));let result=existing.files?.[0];
    if(!result){const boundary='ek-document-boundary-'+Date.now();const metadata={name:f.name,parents:[folder],appProperties:{'ek-local-id':f.id,'ek-database':connection().spreadsheetId,'pikeo-encrypted':'0'}};
      const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(metadata),`\r\n--${boundary}\r\nContent-Type: ${f.blob.type||'application/octet-stream'}\r\n\r\n`,f.blob,`\r\n--${boundary}--`],{type:`multipart/related; boundary=${boundary}`});
      result=await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',{method:'POST',body,headers:{'Content-Type':`multipart/related; boundary=${boundary}`}});
    }
    await Store.save('documents',{id:f.id,name:f.name,kind:f.kind,driveId:result.id,encryption:'plain',cloudSheetId:connection().spreadsheetId,driveUrl:result.webViewLink||`https://drive.google.com/file/d/${result.id}/view`},'Document sauvegardé sur Drive');
  }
}
export async function sync(){
  assertConfigure();
  if(Store.isDemo())throw Error('Les données d’exemple restent dans la démonstration.');
  if(busy)return;
  if(!connected())throw Error('Connectez votre compte Google pour synchroniser.');
  const key=Secrets.unlocked()?Secrets.key():null;
  const c=connection();if(!/^[A-Za-z0-9_-]{20,}$/.test(c.spreadsheetId))throw Error('Renseignez un identifiant Google Sheet valide.');
  busy=true;lastError='';emit('Lecture de la sauvegarde Google…');
  try{
    const previousSheet=await Store.meta('lastSyncSheet');if(previousSheet&&previousSheet!==c.spreadsheetId)await Store.markUnsynced();
    const oldRows=[];const remote=await pull(c.spreadsheetId,key,oldRows);const received=await Store.merge(remote);await Store.markSynced(remote.map(e=>e.id));
    if(oldRows.length){await (await import('./recovery.js')).makeSnapshot('Avant conversion automatique de l’historique Google');await rewriteRows(oldRows,c.spreadsheetId);}
    await uploadFiles();
    let sent=0;const events=Store.pendingEvents();
    for(const tab of SHEET_TABS){
      const queue=events.filter(e=>SHEETS[e.type]===tab);
      for(let start=0;start<queue.length;start+=150){const chunk=queue.slice(start,start+150);emit('Enregistrement des modifications dans Google Sheets…');
        await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(c.spreadsheetId)}/values/${encodeURIComponent("'"+tab+"'!A:L")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,{method:'POST',body:{majorDimension:'ROWS',values:chunk.map(rowForEvent)}});
        await Store.markSynced(chunk.map(e=>e.id));sent+=chunk.length;
      }
    }
    await Store.setMeta('lastSync',new Date().toISOString());await Store.setMeta('lastSyncSheet',c.spreadsheetId);busy=false;const remaining=Store.pendingEvents().length;emit(remaining?'Dernier envoi terminé. Des modifications récentes restent à sauvegarder.':legacyCount?'Sauvegarde à jour. Des lignes anciennes restent à convertir pour être lisibles.':'Sauvegarde Google à jour et lisible.',{sent,received,remaining,success:true});return {sent,received};
  }catch(e){busy=false;emit(e.message,{error:true});throw e;}finally{busy=false;}
}
export async function createDatabase(){
  assertConfigure();
  const sheets=SHEET_TABS.map(title=>({properties:{title,gridProperties:{rowCount:1000,columnCount:12,frozenRowCount:1}}}));
  const data=await api('https://sheets.googleapis.com/v4/spreadsheets',{method:'POST',body:{properties:{title:'Pikéo — Base de données',locale:'fr_FR',timeZone:'Europe/Paris'},sheets}});
  await api(`https://sheets.googleapis.com/v4/spreadsheets/${data.spreadsheetId}/values:batchUpdate`,{method:'POST',body:{valueInputOption:'RAW',data:SHEET_TABS.map(tab=>({range:`'${tab}'!A1:L1`,values:[HEADERS]}))}});
  saveConnection({spreadsheetId:data.spreadsheetId,folderId:''});return data.spreadsheetId;
}

async function cloudBlob(id){
 if(!connected())throw Error('Reconnectez votre compte Google.');
 const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers:{Authorization:'Bearer '+accessToken}});
 if(!response.ok)throw Error('Un document Google est inaccessible. Vérifiez les autorisations avant de continuer.');
 return response.blob();
}
async function downloadCloudFiles(key){
 let restored=0;
 for(const doc of Store.list('documents')){
  if(await Store.readFile(doc.id))continue;
  if(!doc.driveId)continue;
  let blob=await cloudBlob(doc.driveId),name=doc.name,kind=doc.kind;
  if(doc.encryption==='A256GCM'){if(!key)throw Error('Chargez l’ancienne clé pour récupérer ce document chiffré.');const data=await openJSON(JSON.parse(await blob.text()),key,'document:'+doc.id);blob=new Blob([fromBase64(data.data)],{type:data.mime});name=data.name;kind=data.kind;}
  if(blob.type.startsWith('audio/')||kind==='voice')continue;
  await Store.restoreFilesAndDrafts({files:[{id:doc.id,blob,name,kind,createdAt:new Date().toISOString()}]});restored++;
 }
 return restored;
}
export async function restoreCloudFiles(){
 if(busy)throw Error('Une synchronisation est en cours.');const key=Secrets.unlocked()?Secrets.key():null;busy=true;try{return await downloadCloudFiles(key);}finally{busy=false;}
}
export async function prepareEncryptedMigration(){
 assertConfigure();
 if(busy)throw Error('Attendez la fin de la synchronisation.');
 if(!connected())throw Error('Connectez votre compte Google.');
 const key=Secrets.unlocked()?Secrets.key():null,c=connection();
 busy=true;try{const remote=await pull(c.spreadsheetId,key);await Store.merge(remote);
 const files=await downloadCloudFiles(key);
 return {events:remote.length,files,legacy:legacyCount};}finally{busy=false;}
}

async function rewriteRows(rows,id){
 // Recheck all source cells before writing. Other devices only append new revisions.
 for(let i=0;i<rows.length;i+=100){const chunk=rows.slice(i,i+100),q=new URLSearchParams();for(const r of chunk)q.append('ranges',"'"+r.tab+"'!A"+r.row+':L'+r.row);const current=await api('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'/values:batchGet?'+q);for(let j=0;j<chunk.length;j++){const found=current.valueRanges?.[j]?.values?.[0]||[];if(JSON.stringify(found)!==JSON.stringify(chunk[j].raw))throw Error('La base a changé. Relisez la sauvegarde avant de relancer la conversion.');}}
 for(let i=0;i<rows.length;i+=100){const chunk=rows.slice(i,i+100);await api('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'/values:batchUpdate',{method:'POST',body:{valueInputOption:'RAW',data:chunk.map(r=>({range:"'"+r.tab+"'!A"+r.row+':L'+r.row,values:[rowForEvent(r.event)]}))}});}
 legacyCount=0;return rows.length;
}
export async function prepareHistoryReadable(){
 assertConfigure();if(busy)throw Error('Attendez la synchronisation.');if(!connected())throw Error('Connectez votre compte Google.');busy=true;try{const remote=await pull(connection().spreadsheetId,Secrets.unlocked()?Secrets.key():null);await Store.merge(remote);return remote.length;}finally{busy=false;}
}
export async function makeHistoryReadable(){
 assertConfigure();if(busy)throw Error('Attendez la synchronisation en cours.');busy=true;try{const rows=[];await pull(connection().spreadsheetId,Secrets.unlocked()?Secrets.key():null,rows);return await rewriteRows(rows,connection().spreadsheetId);}finally{busy=false;}
}
