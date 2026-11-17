import {validPin,randomSalt,digestPin,verifyPin,isLocked,lockoutMs} from './pin-core.mjs';
import {hash} from './core.mjs';
const error=(status,message)=>({__pinError:true,status,message});
const canEnroll=(row,id)=>!!row&&(!row.verifier_hex||row.requires_reset)&&(row.enroll_device_id===id||!row.requires_reset&&!!row.bootstrap_device_ids?.includes(id));
const current=async(sql,id)=>(await sql`select * from pikeo_private.user_pins where profile_id=${id} for update`)[0];
export async function state(sql,profileId,deviceId){
 const row=await current(sql,profileId);
 return {configured:!!row?.verifier_hex&&!row.requires_reset,canEnroll:canEnroll(row,deviceId),requiresReset:!!row?.requires_reset,locked:!!row&&isLocked(row.locked_until)};
}
export async function prepare(sql,profileId,deviceId,eligible){
 if(eligible)await sql`insert into pikeo_private.user_pins(profile_id,enroll_device_id) values(${profileId},${deviceId}) on conflict(profile_id) do nothing`;
 return state(sql,profileId,deviceId);
}
async function issue(sql,profileId,deviceId){
 const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
 const token=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join(''),digest=await hash(token);
 await sql`insert into pikeo_private.user_pin_sessions(device_id,profile_id,token_hash,expires_at) values(${deviceId},${profileId},${digest},now()+interval '12 hours') on conflict(device_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at`;
 return {token,expiresInSeconds:43200};
}
export async function enroll(sql,profileId,deviceId,pin,confirmation,pepper){
 if(!validPin(pin)||pin!==confirmation)return error(400,'Saisissez et confirmez le même code à quatre chiffres.');
 const row=await current(sql,profileId);
 if(!canEnroll(row,deviceId))return error(403,'Seul Étienne peut autoriser la réinitialisation de ce code. Utilisez votre appareil habituel pour une première création.');
 const salt=randomSalt(),verifier=await digestPin(pin,salt,pepper);
 await sql`update pikeo_private.user_pins set salt_hex=${salt},verifier_hex=${verifier},requires_reset=false,enroll_device_id=null,bootstrap_device_ids='{}',failed_attempts=0,locked_until=null,updated_at=now() where profile_id=${profileId}`;
 await sql`delete from pikeo_private.user_pin_sessions where profile_id=${profileId}`;
 return issue(sql,profileId,deviceId);
}
export async function unlock(sql,profileId,deviceId,pin,pepper){
 const row=await current(sql,profileId);
 if(!row?.verifier_hex||row.requires_reset)return error(403,'Choisissez votre code personnel sur l’appareil autorisé. En cas d’oubli, contactez Étienne.');
 if(isLocked(row.locked_until))return error(429,'Trop de tentatives. Réessayez après le verrouillage temporaire.');
 if(!validPin(pin)||!await verifyPin(pin,row.salt_hex,row.verifier_hex,pepper)){
  const attempts=row.failed_attempts+1,ms=lockoutMs(attempts);
  await sql`update pikeo_private.user_pins set failed_attempts=${attempts},locked_until=${ms?new Date(Date.now()+ms):null},updated_at=now() where profile_id=${profileId}`;
  return error(ms?429:401,ms?'Code incorrect. Accès temporairement verrouillé.':'Code incorrect.');
 }
 await sql`update pikeo_private.user_pins set failed_attempts=0,locked_until=null,updated_at=now() where profile_id=${profileId}`;
 return issue(sql,profileId,deviceId);
}
export async function assertSession(sql,profileId,deviceId,token){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return error(423,'Saisissez votre code personnel pour ouvrir la session.');
 const digest=await hash(token);
 const rows=await sql`select 1 from pikeo_private.user_pin_sessions s join pikeo_private.user_pins p on p.profile_id=s.profile_id where s.device_id=${deviceId} and s.profile_id=${profileId} and s.token_hash=${digest} and s.expires_at>now() and p.verifier_hex is not null and not p.requires_reset`;
 return rows.length?null:error(423,'Votre session est verrouillée. Saisissez votre code personnel.');
}
// The actor is read independently from the database; a local role never grants recovery.
export async function resetByOwner(sql,actorId,targetDevice){
 const actor=(await sql`select d.role,d.active,p.is_owner,p.active as profile_active from pikeo_private.devices d join pikeo_private.profiles p on p.id=d.profile_id where d.id=${actorId}`)[0];
 if(!actor?.active||!actor.profile_active||!actor.is_owner||actor.role!=='admin')return error(403,'Seul Étienne peut réinitialiser un code oublié.');
 const target=(await sql`select d.profile_id,d.active,p.is_owner,p.active as profile_active from pikeo_private.devices d join pikeo_private.profiles p on p.id=d.profile_id where d.id=${targetDevice}`)[0];
 if(!target?.active||!target.profile_active)return error(404,'Appareil actif introuvable.');
 if(target.is_owner)return error(403,'Utilisez votre fichier privé propriétaire pour récupérer votre propre code.');
 await reset(sql,target.profile_id,targetDevice);
 return {saved:true,requiresReset:true};
}
export async function reset(sql,profileId,deviceId){
 await sql`insert into pikeo_private.user_pins(profile_id,enroll_device_id,requires_reset) values(${profileId},${deviceId},true) on conflict(profile_id) do update set requires_reset=true,bootstrap_device_ids='{}',enroll_device_id=excluded.enroll_device_id,failed_attempts=0,locked_until=null,updated_at=now()`;
 await sql`delete from pikeo_private.user_pin_sessions where profile_id=${profileId}`;
}
