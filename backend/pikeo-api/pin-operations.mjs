// A PIN is a second factor, never a replacement for a signed registered device.
// Do not deploy without a server-only PIKEO_PIN_PEPPER and the additive SQL schema.
import {validPin,randomSalt,digestPin,verifyPin,lockoutMs,isLocked} from './pin-core.mjs';
import {uuid,hash} from './core.mjs';

export const ADMIN_PIN_UNLOCK_MINUTES=10;
export const PRIVILEGED_ADMIN_ACTIONS=new Set(['users','devices','user-create','user-update','set-access','set-role','config-put']);
export const requiresAdminUnlock=(user,action)=>user?.role==='admin'&&PRIVILEGED_ADMIN_ACTIONS.has(action);
export const pinFailure=(status,message)=>({__pinErrorStatus:status,__pinErrorMessage:message});
export const isPinFailure=value=>Number.isInteger(value?.__pinErrorStatus);

export async function requirePinUnlock(sql,user,reject){
 if(user.role!=='admin')return;
 const row=(await sql`select requires_reset,locked_until,unlocked_until from pikeo_private.admin_pins where device_id=${user.id}`)[0];
 if(!row)reject(423,'Configurez votre code administrateur avant cette action.');
 if(row.requires_reset)reject(423,'Votre code administrateur doit être réinitialisé.');
 if(isLocked(row.locked_until))reject(429,'Code temporairement verrouillé.');
 if(!row.unlocked_until||Date.parse(row.unlocked_until)<=Date.now())reject(423,'Déverrouillez les fonctions administrateur avec votre code.');
}
export async function handlePinAction({sql,action,payload,user,pepper,reject,audit}){
 if(user.role!=='admin')reject(403,'Accès administrateur requis.');
 if(action==='pin-status'){
  const row=(await sql`select requires_reset,locked_until,unlocked_until from pikeo_private.admin_pins where device_id=${user.id}`)[0];
  return {configured:!!row&&!row.requires_reset,requiresReset:!!row?.requires_reset,locked:!!row&&isLocked(row.locked_until),unlocked:!!row?.unlocked_until&&!row?.requires_reset&&!isLocked(row.locked_until)&&Date.parse(row.unlocked_until)>Date.now(),serverReady:typeof pepper==='string'&&pepper.length>=32};
 }
 if(action==='pin-lock'){
  await sql`update pikeo_private.admin_pins set unlocked_until=null,updated_at=now() where device_id=${user.id}`;
  return {locked:true};
 }
 if(typeof pepper!=='string'||pepper.length<32)reject(503,'Le secret PIN du serveur n’est pas configuré.');
 if(action==='pin-enroll'){
  if(!validPin(payload.pin))reject(400,'Choisissez un code à quatre chiffres.');
  const prior=(await sql`select requires_reset from pikeo_private.admin_pins where device_id=${user.id} for update`)[0];
  let ownerRecovery=false;
  if(user.is_owner&&typeof payload.ownerSecret==='string'&&payload.ownerSecret.length>=32){
   const fingerprint=await hash(payload.ownerSecret);
   ownerRecovery=!!(await sql`select 1 from pikeo_private.owner_keys where token_hash=${fingerprint} and active limit 1`).length;
  }
  if(!prior?.requires_reset&&!ownerRecovery)reject(403,'La création initiale demande le fichier propriétaire ou une réinitialisation autorisée par un autre administrateur.');
  const salt=randomSalt(),verifier=await digestPin(payload.pin,salt,pepper);
  await sql`insert into pikeo_private.admin_pins(device_id,salt_hex,verifier_hex,failed_attempts,locked_until,unlocked_until,requires_reset)
  values(${user.id},${salt},${verifier},0,null,null,false)
  on conflict(device_id) do update set salt_hex=excluded.salt_hex,verifier_hex=excluded.verifier_hex,failed_attempts=0,locked_until=null,unlocked_until=null,requires_reset=false,updated_at=now()`;
  await audit(sql,user.id,user.id,ownerRecovery?'pin-owner-recovery':'pin-enrollment');
  return {configured:true,unlocked:false};
 }
 if(action==='pin-unlock'){
  if(!validPin(payload.pin))reject(400,'Saisissez quatre chiffres.');
  const row=(await sql`select * from pikeo_private.admin_pins where device_id=${user.id} for update`)[0];
  if(!row||row.requires_reset)reject(423,'Créez ou réinitialisez votre code administrateur.');
  if(isLocked(row.locked_until))return pinFailure(429,'Trop d’essais. Le code est temporairement verrouillé.');
  if(!await verifyPin(payload.pin,row.salt_hex,row.verifier_hex,pepper)){
   const failures=row.failed_attempts+1,delay=lockoutMs(failures),until=delay?new Date(Date.now()+delay).toISOString():null;
   await sql`update pikeo_private.admin_pins set failed_attempts=${failures},locked_until=${until},unlocked_until=null,updated_at=now() where device_id=${user.id}`;
   await audit(sql,user.id,user.id,'pin-rejected',{failedAttempts:failures,locked:!!delay});
   // Return rather than throw so the failed-attempt counter is committed.
   return pinFailure(delay?429:401,delay?'Trop d’essais. Le code est temporairement verrouillé.':'Code incorrect.');
  }
  await sql`update pikeo_private.admin_pins set failed_attempts=0,locked_until=null,unlocked_until=now()+(interval '1 minute'*${ADMIN_PIN_UNLOCK_MINUTES}),updated_at=now() where device_id=${user.id}`;
  await audit(sql,user.id,user.id,'pin-unlocked');
  return {unlocked:true,validForMinutes:ADMIN_PIN_UNLOCK_MINUTES};
 }
 if(action==='pin-change'){
  if(!validPin(payload.pin))reject(400,'Choisissez un code à quatre chiffres.');
  await requirePinUnlock(sql,user,reject);
  const salt=randomSalt(),verifier=await digestPin(payload.pin,salt,pepper);
  await sql`update pikeo_private.admin_pins set salt_hex=${salt},verifier_hex=${verifier},failed_attempts=0,locked_until=null,unlocked_until=null,updated_at=now() where device_id=${user.id}`;
  await audit(sql,user.id,user.id,'pin-changed');
  return {changed:true,unlocked:false};
 }
 if(action==='pin-reset'){
  await requirePinUnlock(sql,user,reject);
  if(!uuid(payload.target)||payload.target===user.id)reject(400,'Un autre appareil administrateur doit être sélectionné.');
  const target=(await sql`select id from pikeo_private.devices where id=${payload.target} and role='admin' and active for update`)[0];
  if(!target)reject(404,'Appareil administrateur introuvable.');
  const prior=(await sql`select device_id from pikeo_private.admin_pins where device_id=${payload.target} for update`)[0];
  if(prior)await sql`update pikeo_private.admin_pins set requires_reset=true,unlocked_until=null,locked_until=null,failed_attempts=0,updated_at=now() where device_id=${payload.target}`;
  else{
   const salt=randomSalt(),unusableVerifier=randomSalt()+randomSalt();
   await sql`insert into pikeo_private.admin_pins(device_id,salt_hex,verifier_hex,requires_reset) values(${payload.target},${salt},${unusableVerifier},true)`;
  }
  await audit(sql,user.id,payload.target,'pin-reset-authorized');
  return {reset:true};
 }
 reject(400,'Action PIN inconnue.');
}
