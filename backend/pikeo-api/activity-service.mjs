import {uuid} from './core.mjs';
const types=new Set(['families','products','enfs','packagings','locations','pending','orders','days','issues','movements','counts','replenishments','documents','codes','unknowns']);
const screens=new Set(['home','codes','scan','pending','orders','stock','families','locations','movements','inventories','issues','replenishments','history','settings','help','more','users','administration','enfs','enf','journal']);
export function validActivity(e){return !!e&&uuid(e.eventId)&&(['create','update','delete'].includes(e.action)&&types.has(e.resourceType)||e.action==='screen-open'&&e.resourceType==='screen'&&screens.has(e.resourceId))&&typeof e.resourceId==='string'&&e.resourceId.length>0&&e.resourceId.length<=160&&typeof e.occurredAt==='string'&&Number.isFinite(Date.parse(e.occurredAt))&&Date.parse(e.occurredAt)<=Date.now()+86400000;}
export async function record(sql,d,action,outcome='success'){
 await sql`insert into pikeo_private.activity_log(profile_id,device_id,action,source,outcome,occurred_at) values(${d.profile_id},${d.id},${action},'server',${outcome},clock_timestamp())`;
}
export async function ingest(sql,d,events){
 if(!Array.isArray(events)||!events.length||events.length>100||!events.every(validActivity))throw Error('Événements invalides.');
 for(const e of events)await sql`insert into pikeo_private.activity_log(event_id,profile_id,device_id,action,source,outcome,resource_type,resource_id,occurred_at) values(${e.eventId},${d.profile_id},${d.id},${e.action},'client','success',${e.resourceType},${e.resourceId},${new Date(e.occurredAt)}) on conflict(device_id,event_id) do nothing`;
 return {saved:true};
}
export const serverActions=new Set(['user-pin-enroll','user-pin-unlock','user-pin-logout','user-pin-reset','user-pin-owner-recover','admin-pin-enroll','admin-pin-unlock','admin-pin-lock','admin-pin-recover','admin-pin-reset','user-create','user-update','set-access','set-role','config-put','send','ack','sharing','achievement']);
export function serverLabel(action,denied){if(['user-pin-unlock','user-pin-enroll'].includes(action))return denied?'login-denied':action==='user-pin-enroll'?'login-enroll':'login';return action==='user-pin-logout'?'logout':action;}
