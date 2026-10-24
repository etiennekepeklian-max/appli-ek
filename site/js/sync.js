import * as Store from './storage.js';
import {SHEETS,HEADERS,rowForEvent,eventFromRow} from './core.js';
export const DEFAULT_SHEET='';
export const DEFAULT_CLIENT_ID='296553280936-dmrbf1rsbchdqgh2cgeuks1gjg0n10dq.apps.googleusercontent.com';
let accessToken='',expires=0,busy=false,identityPromise,lastError='';
export const activity=()=>({busy,error:lastError});
const emit=(message,detail={})=>{if(detail.error)lastError=message;else if(detail.success)lastError='';window.dispatchEvent(new CustomEvent('ek-sync',{detail:{message,busy,...detail}}));};
export function connection(){try{const saved=JSON.parse(localStorage.getItem('ek-google')||'{}');return {spreadsheetId:DEFAULT_SHEET,...saved,clientId:saved.clientId?.trim()||DEFAULT_CLIENT_ID};}catch{return {clientId:DEFAULT_CLIENT_ID,spreadsheetId:DEFAULT_SHEET};}}
export function saveConnection(values){const current=connection();localStorage.setItem('ek-google',JSON.stringify({...current,...values,...(values.spreadsheetId!==undefined&&values.spreadsheetId!==current.spreadsheetId?{folderId:''}:{})}));lastError='';}
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
  if(Store.isDemo())throw Error('La démonstration ne se synchronise pas avec Google.');
  const c=connection();if(!c.clientId?.trim())throw Error('Renseignez l’identifiant OAuth Google dans Réglages → Connexion Google. Le guide inclus explique sa création.');
  if(!navigator.onLine)throw Error('La connexion Google nécessite un accès Internet. Vos saisies restent enregistrées ici.');
  await loadIdentity();
  await new Promise((resolve,reject)=>{
    const client=google.accounts.oauth2.initTokenClient({client_id:c.clientId.trim(),scope:'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',callback:r=>{if(r.error){reject(Error(r.error_description||r.error));return;}accessToken=r.access_token;expires=Date.now()+Math.max(0,Number(r.expires_in)-60)*1000;resolve();},error_callback:r=>reject(Error(r.type==='popup_closed'?'La fenêtre Google a été fermée.':'Autorisez la fenêtre de connexion Google puis réessayez.'))});
    client.requestAccessToken({prompt:''});
  });emit('Compte Google connecté.');if(!c.spreadsheetId)return {connected:true,pendingDatabase:true};return sync();
}
async function api(url,{method='GET',body,headers={},retry=true}={}){
  if(!connected())throw Error('Reconnectez votre compte Google pour synchroniser.');
  const response=await fetch(url,{method,headers:{Authorization:`Bearer ${accessToken}`,...(body&&!(body instanceof Blob)?{'Content-Type':'application/json'}:{}),...headers},body:body instanceof Blob?body:body?JSON.stringify(body):undefined});
  if(!response.ok){if(response.status===401)disconnect();let data;try{data=await response.json();}catch{}
    if((response.status===429||response.status>=500)&&retry&&method==='GET'){await new Promise(r=>setTimeout(r,700));return api(url,{method,body,headers,retry:false});}
    throw Error(data?.error?.message||`Google ne peut pas terminer l’action (${response.status}).`);
  }if(response.status===204)return {};return response.json();
}
async function pull(id){
  const metadata=await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?fields=sheets(properties(title,gridProperties(rowCount)))`);
  const rowCounts=new Map(metadata.sheets.map(s=>[s.properties.title,s.properties.gridProperties.rowCount]));
  const additions=['Codes_inconnus','Journal_hebdomadaire'].filter(tab=>!rowCounts.has(tab));
  if(additions.length){await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}:batchUpdate`,{method:'POST',body:{requests:additions.map(title=>({addSheet:{properties:{title}}}))}});await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values:batchUpdate`,{method:'POST',body:{valueInputOption:'RAW',data:additions.map(tab=>({range:`'${tab}'!A1:L1`,values:[HEADERS]}))}});for(const tab of additions)rowCounts.set(tab,1000);}
  for(const tab of Object.values(SHEETS))if(!rowCounts.has(tab))throw Error(`L’onglet « ${tab} » manque dans cette feuille. Utilisez la base fournie ou créez une nouvelle base depuis les réglages.`);
  const types=Object.keys(SHEETS),all=[],active=new Set(types),chunk=2500;let offset=2;
  while(active.size){for(const type of active)if(rowCounts.get(SHEETS[type])<offset)active.delete(type);const batch=[...active];if(!batch.length)break;const q=new URLSearchParams({valueRenderOption:'UNFORMATTED_VALUE'});for(const type of batch)q.append('ranges',`'${SHEETS[type]}'!A${offset}:L${Math.min(offset+chunk-1,rowCounts.get(SHEETS[type]))}`);
    const data=await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values:batchGet?${q}`);
    for(let i=0;i<batch.length;i++){const rows=data.valueRanges?.[i]?.values||[];for(const row of rows){const ev=eventFromRow(row,batch[i]);if(ev)all.push(ev);}if(rows.length<chunk)active.delete(batch[i]);}
    offset+=chunk;
    if(offset>250002)throw Error('La base dépasse 250 000 lignes par onglet. Exportez et archivez une période avant de continuer.');
  }return all;
}
async function ensureFolder(){
  const c=connection();if(c.folderId)return c.folderId;
  const q="trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='ek-database' and value='"+c.spreadsheetId.replace(/[^a-zA-Z0-9_-]/g,'')+"' }";
  const found=await api('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q,fields:'files(id,name)'}));
  const f=found.files?.[0]||await api('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',body:{name:'EK Logistique — Documents',mimeType:'application/vnd.google-apps.folder',appProperties:{'ek-database':c.spreadsheetId}}});
  saveConnection({folderId:f.id});return f.id;
}
async function uploadFiles(){
  const files=await Store.files();const toUpload=files.filter(f=>!Store.get('documents',f.id)?.driveId);if(!toUpload.length)return;
  const folder=await ensureFolder();
  for(const f of toUpload){emit(`Sauvegarde du document ${f.name}…`);
    const q="trashed = false and appProperties has { key='ek-local-id' and value='"+f.id.replace(/[^a-zA-Z0-9_-]/g,'')+"' }";
    const existing=await api('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q,fields:'files(id,webViewLink)'}));let result=existing.files?.[0];
    if(!result){const boundary='ek-document-boundary-'+Date.now();const metadata={name:f.name,parents:[folder],appProperties:{'ek-local-id':f.id}};
      const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(metadata),`\r\n--${boundary}\r\nContent-Type: ${f.blob.type||'application/octet-stream'}\r\n\r\n`,f.blob,`\r\n--${boundary}--`],{type:`multipart/related; boundary=${boundary}`});
      result=await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',{method:'POST',body,headers:{'Content-Type':`multipart/related; boundary=${boundary}`}});
    }
    await Store.save('documents',{id:f.id,name:f.name,kind:f.kind,driveId:result.id,driveUrl:result.webViewLink||`https://drive.google.com/file/d/${result.id}/view`},'Document sauvegardé sur Drive');
  }
}
export async function sync(){
  if(Store.isDemo())throw Error('Les données d’exemple restent dans la démonstration.');
  if(busy)return;
  if(!connected())throw Error('Connectez votre compte Google pour synchroniser.');
  const c=connection();if(!/^[A-Za-z0-9_-]{20,}$/.test(c.spreadsheetId))throw Error('Renseignez un identifiant Google Sheet valide.');
  busy=true;lastError='';emit('Lecture de la sauvegarde Google…');
  try{
    const previousSheet=await Store.meta('lastSyncSheet');if(previousSheet&&previousSheet!==c.spreadsheetId)await Store.markUnsynced();
    const remote=await pull(c.spreadsheetId);const received=await Store.merge(remote);await Store.markSynced(remote.map(e=>e.id));
    await uploadFiles();
    let sent=0;const events=Store.pendingEvents();
    for(const [type,tab] of Object.entries(SHEETS)){
      const queue=events.filter(e=>e.type===type);
      for(let start=0;start<queue.length;start+=150){const chunk=queue.slice(start,start+150);emit('Enregistrement des modifications dans Google Sheets…');
        await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(c.spreadsheetId)}/values/${encodeURIComponent("'"+tab+"'!A:L")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,{method:'POST',body:{majorDimension:'ROWS',values:chunk.map(rowForEvent)}});
        await Store.markSynced(chunk.map(e=>e.id));sent+=chunk.length;
      }
    }
    await Store.setMeta('lastSync',new Date().toISOString());await Store.setMeta('lastSyncSheet',c.spreadsheetId);busy=false;const remaining=Store.pendingEvents().length;emit(remaining?'Dernier envoi terminé. Des modifications récentes restent à sauvegarder.':'Sauvegarde Google à jour.',{sent,received,remaining,success:true});return {sent,received};
  }catch(e){busy=false;emit(e.message,{error:true});throw e;}finally{busy=false;}
}
export async function createDatabase(){
  const sheets=[{properties:{title:'Mode_emploi'}},...Object.values(SHEETS).map(title=>({properties:{title,gridProperties:{rowCount:1000,columnCount:12,frozenRowCount:1}}}))];
  const data=await api('https://sheets.googleapis.com/v4/spreadsheets',{method:'POST',body:{properties:{title:'EK Logistique — Base de données',locale:'fr_FR',timeZone:'Europe/Paris'},sheets}});
  await api(`https://sheets.googleapis.com/v4/spreadsheets/${data.spreadsheetId}/values:batchUpdate`,{method:'POST',body:{valueInputOption:'RAW',data:Object.values(SHEETS).map(tab=>({range:`'${tab}'!A1:L1`,values:[HEADERS]})).concat([{range:"'Mode_emploi'!A1:B5",values:[['EK Logistique','Base événementielle'],['Principe','Chaque ligne conserve une version de fiche. Ne pas supprimer les anciennes lignes.'],['Documents','Photos conservées dans un dossier privé Google Drive.'],['Stock officiel','Application indépendante de Velocity.'],['Sauvegarde','Export JSON et CSV disponibles dans l’application.']]}])}});
  saveConnection({spreadsheetId:data.spreadsheetId,folderId:''});return data.spreadsheetId;
}
