import {validPin,randomSalt,digestPin,verifyPin,lockoutMs,isLocked} from './pin-core.mjs';

// PINs are a second factor for an already authenticated, signed ADMIN device.
// The PIN, pepper, and owner recovery secret are NEVER written to the audit log.
export const PIN_UNLOCK_MS=10*60*1000;
const error=(status,message)=>({__pinError:true,status,message});
const current=async(sql,id)=> (await sql`select * from pikeo_private.admin_pins where device_id=${id} for update`)[0];

export async function status(sql,deviceId){
 const row=await current(sql,deviceId);
 return {configured:!!row,requiresReset:!!row?.requires_reset,
  unlocked:!!row&&!row.requires_reset&&row.unlocked_until!=null&&Date.parse(row.unlocked_until)>Date.now(),
  locked:!!row&&isLocked(row.locked_until)};
}
export async function assertUnlocked(sql,deviceId){
 const pin=await status(sql,deviceId);
 if(!pin.configured||pin.requiresReset)return error(403,'Configurez le code administrateur sur cet appareil avant de modifier les droits.');
 if(pin.locked)return error(429,'Code administrateur temporairement bloqué.');
 if(!pin.unlocked)return error(403,'Déverrouillez vos droits avec votre code administrateur.');
 return null;
}
export async function enroll(sql,deviceId,pin,pepper){
 if(!validPin(pin))return error(400,'Saisissez exactement quatre chiffres.');
 const row=await current(sql,deviceId);
 if(row&&!row.requires_reset&&!(row.unlocked_until&&Date.parse(row.unlocked_until)>Date.now()))
  return error(403,'Déverrouillez votre code actuel avant de le remplacer.');
 const salt=randomSalt(),verifier=await digestPin(pin,salt,pepper);
 await sql`insert into pikeo_private.admin_pins(device_id,salt_hex,verifier_hex,failed_attempts,locked_until,unlocked_until,requires_reset,updated_at)
  values(${deviceId},${salt},${verifier},0,null,now()+interval '10 minutes',false,now())
  on conflict(device_id) do update set salt_hex=excluded.salt_hex,verifier_hex=excluded.verifier_hex,
   failed_attempts=0,locked_until=null,unlocked_until=excluded.unlocked_until,requires_reset=false,updated_at=now()`;
 return {configured:true,unlocked:true};
}
export async function unlock(sql,deviceId,pin,pepper){
 const row=await current(sql,deviceId);
 if(!row)return error(403,'Configurez d’abord votre code administrateur.');
 if(row.requires_reset)return error(403,'Votre code doit être réinitialisé par un autre administrateur.');
 if(isLocked(row.locked_until))return error(429,'Trop de tentatives. Réessayez après la fin du verrouillage.');
 // Commit failures before returning the HTTP error; throwing inside a SQL
 // transaction would roll back failed_attempts and bypass lockout.
 const valid=validPin(pin)&&await verifyPin(pin,row.salt_hex,row.verifier_hex,pepper);
 if(!valid){
  const attempts=row.failed_attempts+1,ms=lockoutMs(attempts);
  await sql`update pikeo_private.admin_pins set failed_attempts=${attempts},locked_until=${ms?new Date(Date.now()+ms):null},
   unlocked_until=null,updated_at=now() where device_id=${deviceId}`;
  return error(ms?429:401,ms?'Code incorrect. Accès temporairement verrouillé.':'Code incorrect.');
 }
 await sql`update pikeo_private.admin_pins set failed_attempts=0,locked_until=null,
  unlocked_until=now()+interval '10 minutes',updated_at=now() where device_id=${deviceId}`;
 return {unlocked:true,expiresInSeconds:600};
}
export async function lock(sql,deviceId){
 await sql`update pikeo_private.admin_pins set unlocked_until=null,updated_at=now() where device_id=${deviceId}`;
 return {unlocked:false};
}
export async function resetByAdmin(sql,actorId,targetId){
 if(actorId===targetId)return error(403,'Demandez la réinitialisation à un autre administrateur.');
 const allowed=await assertUnlocked(sql,actorId);
 if(allowed)return allowed;
 const target=(await sql`select d.id,d.role,d.active,p.active as profile_active from pikeo_private.devices d
  join pikeo_private.profiles p on p.id=d.profile_id where d.id=${targetId} for update of d`)[0];
 if(!target||!target.active||!target.profile_active||target.role!=='admin')
  return error(404,'Appareil administrateur introuvable ou inactif.');
 const row=await current(sql,targetId);
 if(!row)return error(404,'Ce compte n’a pas de code à réinitialiser.');
 await sql`update pikeo_private.admin_pins set requires_reset=true,unlocked_until=null,locked_until=null,
  failed_attempts=0,updated_at=now() where device_id=${targetId}`;
 return {saved:true,requiresReset:true};
}
export async function recovery(sql,deviceId,ownerSecret){
 if(typeof ownerSecret!=='string'||!ownerSecret||ownerSecret.length>200)
  return error(401,'Fichier propriétaire requis pour récupérer le code.');
 // Recovery is allowed only after the API independently confirmed this
 // signed device is the designated owner, never based on a display name.
 const {hash}=await import('./core.mjs');
 const digest=await hash(ownerSecret);
 const allowed=(await sql`select 1 from pikeo_private.owner_keys where token_hash=${digest} and active`).length>0;
 if(!allowed)return error(401,'Fichier propriétaire invalide.');
 await sql`update pikeo_private.admin_pins set requires_reset=true,unlocked_until=null,locked_until=null,
  failed_attempts=0,updated_at=now() where device_id=${deviceId}`;
 return {saved:true,requiresReset:true};
}
