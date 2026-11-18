import {uuid} from './core.mjs';
export async function removeAccount(sql,actor,target,version){
 if(!actor?.is_owner||actor.role!=='admin')return {error:'Seul Étienne peut supprimer un compte.',status:403};
 if(!uuid(target)||!Number.isInteger(version)||version<0)return {error:'Compte invalide.',status:400};
 if(target===actor.profile_id)return {error:'Le compte propriétaire est protégé.',status:403};
 const rows=await sql`update pikeo_private.profiles set active=false,deleted_at=now(),access_version=access_version+1 where id=${target} and not is_owner and deleted_at is null and access_version=${version} returning id,name`;
 if(!rows.length)return {error:'Le compte a changé, a déjà été supprimé ou est protégé. Actualisez la liste.',status:409};
 await sql`update pikeo_private.devices set active=false,permissions='[]'::jsonb,access_version=access_version+1 where profile_id=${target}`;
 await sql`delete from pikeo_private.user_pin_sessions where profile_id=${target}`;
 await sql`update pikeo_private.admin_pins pin set unlocked_until=null,updated_at=now() from pikeo_private.devices d where pin.device_id=d.id and d.profile_id=${target}`;
 await sql`update pikeo_private.native_devices n set approved=false from pikeo_private.devices d where n.device_id=d.id and d.profile_id=${target}`;
 await sql`delete from pikeo_private.management_access where profile_id=${target}`;
 return {saved:true,name:rows[0].name};
}
