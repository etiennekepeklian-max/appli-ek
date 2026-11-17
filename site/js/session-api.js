import {askPin} from './session-pin-ui.js';
import * as Local from './session-store.js';
import * as Context from './identity-context.js';
import {createDeviceKeys,signedRequest,publicJWK} from './session-crypto.js';
export const ENDPOINT='https://wcmuffmyozjolaaahhff.supabase.co/functions/v1/pikeo-api';
let active,verified;
const tokens=new Map();
const suppliedPins=new Map();
const pendingAuth=new Map();
export const current=()=>active;
const changed=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('pikeo-session'));};
const confirmSession=row=>{verified={id:row.id,role:row.role,until:Date.now()+60000};changed();};
export const bureauAllowed=()=>navigator.onLine&&active?.active!==false&&active?.role==='admin'&&verified?.role==='admin'&&verified.id===active.id&&verified.until>Date.now();
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
export async function init(){if(active)return active;const id=localStorage.getItem('pikeo-active-identity');active=id?await Local.getIdentity(id):null;if(verified?.id!==active?.id)verified=null;if(active){const row=active;active=null;Context.setIdentity(null);try{await register(row);active=row;}catch{active=null;}}Context.setIdentity(active);return active;}
async function call(row,action,values={}){
 const native=globalThis.PikeoNative;
 const extra=action==='register'&&native?{nativePublicKey:(await native.deviceKey()).publicKey}:{};
 const payload={action,deviceId:row.id,timestamp:Date.now(),nonce:crypto.randomUUID(),...(tokens.has(row.id)?{sessionToken:tokens.get(row.id)}:{}),...extra,...values},body=await signedRequest(payload,row.keys.signing.privateKey);
 if(native)body.nativeSignature=(await native.sign({payload:JSON.stringify(payload)})).signature;
 const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});let data;try{data=await response.json();}catch{throw Error('Le service des sessions est indisponible. Vos données restent sur cet appareil.');}if(!response.ok){const e=Error(data.error||'Le service est indisponible.');e.status=response.status;throw e;}return data;
}

async function authorize(row,initial){
 if(tokens.has(row.id))return;
 if(pendingAuth.has(row.id))return pendingAuth.get(row.id);
 const task=(async()=>{
  if(!navigator.onLine)throw Error('Connectez-vous à Internet pour saisir votre code personnel.');
  let status=initial||(await call(row,'user-pin-status')).pin,error='';
  while(true){
   if(!status.configured&&!status.canEnroll&&!row.owner)throw Error('Ouvrez votre session sur votre appareil habituel pour créer votre code. Sinon, demandez à Étienne d’autoriser la réinitialisation sur cet appareil.');
   const provided=suppliedPins.get(row.id);suppliedPins.delete(row.id);
   const values=provided&&status.configured?provided:await askPin({name:row.name,initialPin:provided?.pin,enroll:!status.configured,error,owner:row.owner,recover:async data=>{if(data.app!=='PikeoAdminAccess'||data.endpoint!==ENDPOINT||typeof data.secret!=='string')throw Error('Fichier propriétaire invalide.');await call(row,'user-pin-owner-recover',{ownerSecret:data.secret});}});
   if(values.recovered){status=(await call(row,'user-pin-status')).pin;error='';continue;}
   try{const result=await call(row,status.configured?'user-pin-unlock':'user-pin-enroll',values);if(!result.token)throw Error('Le serveur n’a pas confirmé la connexion.');tokens.set(row.id,result.token);return;}catch(e){if(provided||![400,401,429].includes(e.status))throw e;error=e.message;}
  }
 })();pendingAuth.set(row.id,task);try{return await task;}finally{pendingAuth.delete(row.id);}
}
export async function register(row,ownerSecret){const result=await call(row,'register',{name:row.name,signingKey:await publicJWK(row.keys.signing.publicKey),encryptionKey:await publicJWK(row.keys.encryption.publicKey),...(ownerSecret?{ownerSecret}:{})});Object.assign(row,result.session,{registered:true});await Local.saveIdentity(row);await authorize(row,result.pin);return row;}
export async function login(name,{ownerSecret,pin,deferPlatform=false}={}){name=String(name||'').trim().replace(/\s+/g,' ');if(!name||name.length>40||/[<>\x00-\x1f]/.test(name))throw Error('Choisissez un nom de 1 à 40 caractères.');if(ownerSecret)name='Étienne';const rows=await Local.identities();let row=rows.find(r=>normalize(r.name)===normalize(name));if(!row){const id=crypto.randomUUID();row={id,name,role:'operator',owner:false,registered:false,scope:normalize(name)==='etienne'?'live':'user-'+id,keys:await createDeviceKeys()};await Local.saveIdentity(row);}tokens.delete(row.id);if(pin)suppliedPins.set(row.id,{pin});await register(row,ownerSecret);if(!deferPlatform)await platform(row);active=row;localStorage.setItem('pikeo-active-identity',row.id);Context.setIdentity(row);if(navigator.onLine)confirmSession(row);else{verified=null;changed();}return row;}
async function platform(row){const r=await call(row,globalThis.PikeoNative?'native-access':'web-access');if(globalThis.PikeoNative&&!r.approved&&!r.owner){const e=Error('Cet appareil Android doit être autorisé par Étienne.');e.status=403;throw e;}}
export async function activate(id){const row=await Local.getIdentity(id);if(!row)throw Error('Session introuvable.');tokens.delete(row.id);if(!row.registered)await register(row);else{await register(row);const r=await call(row,'session');Object.assign(row,r.session);await Local.saveIdentity(row);}await platform(row);active=row;localStorage.setItem('pikeo-active-identity',row.id);Context.setIdentity(row);if(navigator.onLine)confirmSession(row);else{verified=null;changed();}return row;}
export function personal(){if(active){const row=active;void call(row,'user-pin-logout').catch(()=>{});}tokens.clear();active=null;verified=null;localStorage.removeItem('pikeo-active-identity');Context.setIdentity(null);changed();}
export async function request(action,values){if(!active)throw Error('Choisissez votre nom dans Sessions et collègues.');const row=active;if(!row.registered)await register(row);if(active?.id!==row.id)throw Error('La session a changé.');await authorize(row);try{return await call(row,action,values);}catch(e){if(e.status!==423)throw e;tokens.delete(row.id);await authorize(row);return call(row,action,values);}}
export async function refresh(){if(!active||!navigator.onLine){verified=null;changed();return;}const user=active;let r;try{r=await request('session');}catch(e){if(active?.id===user.id&&[401,403].includes(e.status)){user.role='operator';user.owner=false;Context.setIdentity(user);await Local.saveIdentity(user);}if(active?.id===user.id){verified=null;changed();}throw e;}if(active?.id!==user.id)return;Object.assign(user,r.session);Context.setIdentity(user);await Local.saveIdentity(user);confirmSession(user);return user;}

// A cached identity is insufficient to open Bureau. Each entry is signed by
// this device and authorized against the current server role and active flags.
export async function authorizeBureau(){
 const row=active;
 try{
  if(!navigator.onLine)throw Error('Connectez cet ordinateur à Internet pour vérifier les droits administrateur.');
  if(!row)throw Error('Ouvrez votre session administrateur dans la version mobile sur cet ordinateur.');
  const result=await request('bureau-access');
  if(active?.id!==row.id)throw Error('La session a changé. Vérifiez à nouveau votre accès.');
  const until=Date.parse(result.expiresAt);
  if(result.session?.deviceId!==row.id||result.session.role!=='admin'||result.session.active!==true||!Number.isFinite(until)||until<=Date.now())throw Error('Le serveur n’a pas confirmé les droits administrateur.');
  Object.assign(row,result.session);await Local.saveIdentity(row);
  if(active?.id!==row.id)throw Error('La session a changé.');
  Context.setIdentity(row);verified={id:row.id,role:'admin',until:Math.min(until,Date.now()+60000)};changed();return row;
 }catch(error){
  if(active?.id===row?.id){verified=null;if(row&&[401,403].includes(error.status)){row.role='operator';row.owner=false;Context.setIdentity(row);await Local.saveIdentity(row);}changed();}
  throw error;
 }
}
