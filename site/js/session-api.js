import * as Local from './session-store.js';
import * as Context from './identity-context.js';
import {createDeviceKeys,signedRequest,publicJWK} from './session-crypto.js';
export const ENDPOINT='https://wcmuffmyozjolaaahhff.supabase.co/functions/v1/pikeo-api';
let active,verified;
export const current=()=>active;
const changed=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('pikeo-session'));};
const confirmSession=row=>{verified={id:row.id,role:row.role,until:Date.now()+60000};changed();};
export const bureauAllowed=()=>navigator.onLine&&active?.active!==false&&active?.role==='admin'&&verified?.role==='admin'&&verified.id===active.id&&verified.until>Date.now();
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
export async function init(){const id=localStorage.getItem('pikeo-active-identity');active=id?await Local.getIdentity(id):null;if(verified?.id!==active?.id)verified=null;Context.setIdentity(active);return active;}
async function call(row,action,values={}){const payload={action,deviceId:row.id,timestamp:Date.now(),nonce:crypto.randomUUID(),...values},body=await signedRequest(payload,row.keys.signing.privateKey);const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});let data;try{data=await response.json();}catch{throw Error('Le service des sessions est indisponible. Vos données restent sur cet appareil.');}if(!response.ok){const e=Error(data.error||'Le service est indisponible.');e.status=response.status;throw e;}return data;}
export async function register(row,ownerSecret){const result=await call(row,'register',{name:row.name,signingKey:await publicJWK(row.keys.signing.publicKey),encryptionKey:await publicJWK(row.keys.encryption.publicKey),...(ownerSecret?{ownerSecret}:{})});Object.assign(row,result.session,{registered:true});await Local.saveIdentity(row);return row;}
export async function login(name,{ownerSecret}={}){name=String(name||'').trim().replace(/\s+/g,' ');if(!name||name.length>40||/[<>\x00-\x1f]/.test(name))throw Error('Choisissez un nom de 1 à 40 caractères.');if(ownerSecret)name='Étienne';const rows=await Local.identities();let row=rows.find(r=>normalize(r.name)===normalize(name));if(!row){const id=crypto.randomUUID();row={id,name,role:'operator',owner:false,registered:false,scope:normalize(name)==='etienne'?'live':'user-'+id,keys:await createDeviceKeys()};await Local.saveIdentity(row);}if(navigator.onLine){await register(row,ownerSecret);}else if(ownerSecret)throw Error('La première activation admin nécessite Internet.');active=row;localStorage.setItem('pikeo-active-identity',row.id);Context.setIdentity(row);if(navigator.onLine)confirmSession(row);else{verified=null;changed();}return row;}
export async function activate(id){const row=await Local.getIdentity(id);if(!row)throw Error('Session introuvable.');if(navigator.onLine){if(!row.registered)await register(row);else{const r=await call(row,'session');Object.assign(row,r.session);await Local.saveIdentity(row);}}active=row;localStorage.setItem('pikeo-active-identity',row.id);Context.setIdentity(row);if(navigator.onLine)confirmSession(row);else{verified=null;changed();}return row;}
export function personal(){active=null;verified=null;localStorage.removeItem('pikeo-active-identity');Context.setIdentity(null);changed();}
export async function request(action,values){if(!active)throw Error('Choisissez votre nom dans Sessions et collègues.');const row=active;if(!row.registered)await register(row);if(active?.id!==row.id)throw Error('La session a changé.');return call(row,action,values);}
export async function refresh(){if(!active||!navigator.onLine){verified=null;changed();return;}const user=active;let r;try{r=await call(user,'session');}catch(e){if(active?.id===user.id&&[401,403].includes(e.status)){user.role='operator';user.owner=false;Context.setIdentity(user);await Local.saveIdentity(user);}if(active?.id===user.id){verified=null;changed();}throw e;}if(active?.id!==user.id)return;Object.assign(user,r.session);Context.setIdentity(user);await Local.saveIdentity(user);confirmSession(user);return user;}

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
