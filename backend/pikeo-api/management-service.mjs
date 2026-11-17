import {RECORDS,MODULES,kindModule,validateRecord} from './management-core.mjs';
import {uuid} from './core.mjs';
import * as Pin from './pin-service.mjs';
const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};
export async function capabilities(sql,d){return d.is_owner&&d.role==='admin'?Object.keys(MODULES):(await sql`select modules from pikeo_private.management_access where profile_id=${d.profile_id}`)[0]?.modules||[];}
export async function handle(sql,d,p){
 const caps=await capabilities(sql,d),owner=d.is_owner&&d.role==='admin';
 if(p.action==='management-access')return {modules:caps,owner};
 if(!caps.length)fail(403,'Le pilotage est réservé à Étienne ou aux personnes qu’il autorise.');
 if(owner){const denied=await Pin.assertUnlocked(sql,d.id);if(denied)return denied;}
 const permit=kind=>{if(!kindModule(kind)||!caps.includes(kindModule(kind)))fail(403,'Ce module de pilotage ne vous est pas autorisé.');};
 const log=async(action,id,kind)=>{await sql`insert into pikeo_private.activity_log(profile_id,device_id,action,source,outcome,resource_type,resource_id,occurred_at) values(${d.profile_id},${d.id},${action},'server','success',${kind},${id},clock_timestamp())`;};
 if(p.action==='management-grant'){
  if(!owner)fail(403,'Seul Étienne attribue les accès au pilotage.');if(!uuid(p.profileId)||!Array.isArray(p.modules)||p.modules.some(m=>!Object.hasOwn(MODULES,m)))fail(400,'Délégation invalide.');
  const person=(await sql`select id,is_owner from pikeo_private.profiles where id=${p.profileId} and active`)[0];if(!person||person.is_owner)fail(400,'Compte protégé ou indisponible.');
  await sql`insert into pikeo_private.management_access(profile_id,modules) values(${p.profileId},${[...new Set(p.modules)]}) on conflict(profile_id) do update set modules=excluded.modules,updated_at=now()`;await log('management-grant',p.profileId,'access');return {saved:true};
 }
 if(p.action==='management-list'){
  const kinds=Object.keys(RECORDS).filter(k=>caps.includes(kindModule(k)));
  return {records:await sql`select id,kind,data,version,updated_at from pikeo_private.management_records where not deleted and kind in ${sql(kinds)} order by updated_at desc limit 10000`,modules:caps};
 }
 if(['management-files','management-file-put','management-file-get'].includes(p.action)){
  const recordId=p.action==='management-file-put'?p.recordId:p.id;
  let row,file;
  if(p.action==='management-file-get'){if(!uuid(p.id))fail(400,'Fichier invalide.');file=(await sql`select id,record_id,name,mime,encode(bytes,'base64') as data from pikeo_private.management_files where id=${p.id}`)[0];if(!file)fail(404,'Fichier introuvable.');row=(await sql`select id,kind from pikeo_private.management_records where id=${file.record_id} and not deleted`)[0];}
  else{if(!uuid(recordId))fail(400,'Fiche invalide.');row=(await sql`select id,kind from pikeo_private.management_records where id=${recordId} and not deleted`)[0];}
  if(!row)fail(404,'Fiche introuvable.');permit(row.kind);
  if(p.action==='management-files')return {files:await sql`select id,name,mime,octet_length(bytes) as size,created_at from pikeo_private.management_files where record_id=${row.id} order by created_at desc`};
  if(p.action==='management-file-get'){await log('management-file-read',p.id,row.kind);return {file};}
  if(!uuid(p.id)||typeof p.name!=='string'||p.name.length>200||/[\x00-\x1f/\\]/.test(p.name)||!['application/pdf','image/png','image/jpeg'].includes(p.mime)||typeof p.data!=='string'||p.data.length>1398104||!p.data.length||!/^[a-zA-Z0-9+/]+={0,2}$/.test(p.data))fail(400,'Justificatif invalide ou supérieur à 1 Mo.');
  await sql`insert into pikeo_private.management_files(id,record_id,name,mime,bytes,created_by) values(${p.id},${row.id},${p.name},${p.mime},decode(${p.data},'base64'),${d.profile_id})`;await log('management-file-create',p.id,row.kind);return {saved:true};
 }
 if(p.action==='management-upsert'){
  permit(p.kind);if(!uuid(p.id)||!Number.isInteger(p.version)||p.version<0)fail(400,'Fiche invalide.');let data;try{data=validateRecord(p.kind,p.data);}catch(e){fail(400,e.message);}
  const prior=(await sql`select * from pikeo_private.management_records where id=${p.id} for update`)[0];
  if(prior&&(prior.kind!==p.kind||prior.deleted||prior.version!==p.version)||!prior&&p.version!==0)fail(409,'La fiche a changé. Actualisez avant de recommencer.');
  if(data.personId&&!(await sql`select 1 from pikeo_private.management_records where id=${data.personId} and kind='staff' and not deleted`).length)fail(400,'Le collaborateur n’existe plus.');
  const rows=prior?await sql`update pikeo_private.management_records set data=${sql.json(data)},version=version+1,updated_by=${d.profile_id},updated_at=now() where id=${p.id} returning id,kind,data,version,updated_at`:await sql`insert into pikeo_private.management_records(id,kind,data,created_by,updated_by) values(${p.id},${p.kind},${sql.json(data)},${d.profile_id},${d.profile_id}) returning id,kind,data,version,updated_at`;
  await log(prior?'management-update':'management-create',p.id,p.kind);return {record:rows[0]};
 }
 if(p.action==='management-delete'){
  if(!uuid(p.id)||!Number.isInteger(p.version))fail(400,'Fiche invalide.');const row=(await sql`select * from pikeo_private.management_records where id=${p.id} and not deleted for update`)[0];if(!row)fail(404,'Fiche introuvable.');permit(row.kind);if(row.version!==p.version)fail(409,'La fiche a changé. Actualisez.');
  if(row.kind==='staff'&&(await sql`select 1 from pikeo_private.management_records where not deleted and data->>'personId'=${p.id} limit 1`).length)fail(409,'Ce collaborateur a des affectations ou formations. Modifiez son état plutôt que le supprimer.');
  await sql`update pikeo_private.management_records set deleted=true,version=version+1,updated_by=${d.profile_id},updated_at=now() where id=${p.id}`;await log('management-delete',p.id,row.kind);return {saved:true};
 }
 fail(400,'Action de pilotage inconnue.');
}
