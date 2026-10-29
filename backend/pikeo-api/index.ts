import postgres from 'npm:postgres@3.4.9';
import {nameKey,cleanName,uuid,publicKey,verify,hash,validMessage,mergeSharedEnfs} from './core.mjs';
import {hasPermission,validPermissions,permissionsFor} from './permissions-core.js';
const db=postgres(Deno.env.get('SUPABASE_DB_URL'),{ssl:'require',prepare:false,max:1,idle_timeout:20,connect_timeout:10});
const allowed=new Set(['https://etiennekepeklian-max.github.io','http://localhost:8765','http://127.0.0.1:8765']);
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const reject=(status,message)=>{throw new HttpError(status,message);};
async function rate(sql,bucket,max,minutes=1){const r=await sql`insert into pikeo_private.rate_limits(bucket,hits,expires_at) values(${bucket},1,now()+(${minutes}*interval '1 minute')) on conflict(bucket) do update set hits=pikeo_private.rate_limits.hits+1 returning hits`;if(r[0].hits>max)reject(429,'Trop de demandes. Réessayez un peu plus tard.');}
const access=d=>({...d,owner:d.is_owner&&d.role==='admin'});
const view=d=>({profileId:d.profile_id,deviceId:d.id,name:d.name,role:d.role,owner:d.is_owner&&d.role==='admin',permissions:permissionsFor(access(d)),active:true,sharing:d.share_achievements});
async function audit(sql,actor,target,action,details={}){await sql`insert into pikeo_private.access_audit(actor,target,action,details) values(${actor},${target},${action},${sql.json(details)})`;}
async function handle(req){
 const origin=req.headers.get('origin');if(origin&&!allowed.has(origin))return new Response('Origine refusée',{status:403});
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin||'https://etiennekepeklian-max.github.io','Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method==='GET')return new Response(JSON.stringify({app:'Pikeo',version:'1.18.0',status:'ready'}),{headers});
 try{
  if(req.method!=='POST')reject(405,'Méthode non autorisée.');
  const text=await req.text();if(text.length>2500000)reject(413,'Demande trop volumineuse.');
  const body=JSON.parse(text),p=body.payload;if(!p||!uuid(p.deviceId))reject(400,'Demande invalide.');
  let result;
  if(p.action==='register'){
   const signing=publicKey(p.signingKey),encryption=publicKey(p.encryptionKey),name=cleanName(p.name);
   if(!await verify(p,body.signature,signing))reject(401,'Signature de l’appareil invalide.');
   const ownerHash=p.ownerSecret?await hash(p.ownerSecret):'',ip=req.headers.get('x-forwarded-for')||'unknown';
   // Registration rate commits even when a later registration is rejected.
   await db.begin(async sql=>rate(sql,'register:'+await hash(Deno.env.get('SUPABASE_DB_URL')+ip+new Date().toISOString().slice(0,10)),100,1440));
   result=await db.begin(async sql=>{
    const validOwner=ownerHash?(await sql`select 1 from pikeo_private.owner_keys where token_hash=${ownerHash} and active`).length>0:false;
    if(p.ownerSecret&&!validOwner)reject(401,'La clé administrateur est incorrecte.');
    const n=validOwner?'Étienne':name,k=validOwner?'etienne':nameKey(name);
    const count=await sql`select count(*)::int as n from pikeo_private.profiles`;if(count[0].n>=500)reject(429,'Le nombre de profils doit être revu par l’administrateur.');
    await sql`insert into pikeo_private.profiles(name,name_key) values(${n},${k}) on conflict(name_key) do nothing`;
    const profile=(await sql`select * from pikeo_private.profiles where name_key=${k} for update`)[0];
    if(!profile.active)reject(403,'Ce compte est suspendu. Contactez Étienne.');
    const existing=(await sql`select * from pikeo_private.devices where id=${p.deviceId} for update`)[0];
    if(existing&&(!existing.active||existing.profile_id!==profile.id||existing.signing_key.x!==signing.x||existing.signing_key.y!==signing.y||existing.encryption_key.x!==encryption.x||existing.encryption_key.y!==encryption.y))reject(403,'Cet appareil ne correspond pas à ce profil.');
    await sql`insert into pikeo_private.devices(id,profile_id,signing_key,encryption_key,role) values(${p.deviceId},${profile.id},${sql.json(signing)},${sql.json(encryption)},${validOwner?'admin':profile.default_role}) on conflict(id) do update set last_seen=now()`;
    const replay=await sql`insert into pikeo_private.nonces(device_id,nonce) values(${p.deviceId},${p.nonce}) on conflict do nothing returning nonce`;if(!replay.length)reject(409,'Cette demande a déjà été traitée.');
    if(validOwner){await sql`update pikeo_private.devices set role='admin',permissions=null where id=${p.deviceId}`;await audit(sql,p.deviceId,p.deviceId,'owner-activation');}
    const device=(await sql`select d.*,p.name,p.is_owner,p.share_achievements from pikeo_private.devices d join pikeo_private.profiles p on p.id=d.profile_id where d.id=${p.deviceId}`)[0];return {session:view(device)};
   });
  }else{
   const d=(await db`select d.*,p.name,p.is_owner,p.share_achievements from pikeo_private.devices d join pikeo_private.profiles p on p.id=d.profile_id where d.id=${p.deviceId} and p.active`)[0];
   if(!d?.active||!await verify(p,body.signature,d.signing_key))reject(401,'Ouvrez à nouveau votre session sur cet appareil.');
   await db.begin(async sql=>rate(sql,'request:'+p.deviceId+':'+Math.floor(Date.now()/60000),150));
   result=await db.begin(async sql=>{
    const nonce=await sql`insert into pikeo_private.nonces(device_id,nonce) values(${p.deviceId},${p.nonce}) on conflict do nothing returning nonce`;if(!nonce.length)reject(409,'Cette demande a déjà été traitée.');
    await sql`update pikeo_private.devices set last_seen=now() where id=${p.deviceId}`;
    const fresh=(await sql`select d.*,p.name,p.is_owner,p.share_achievements from pikeo_private.devices d join pikeo_private.profiles p on p.id=d.profile_id where d.id=${p.deviceId} and d.active and p.active for update of d,p`)[0];if(!fresh)reject(401,'Cet accès a été retiré.');
    const allow=key=>{if(!hasPermission(access(fresh),key))reject(403,'Votre accès ne permet pas cette action.');};
    const owner=()=>{if(!(fresh.is_owner&&fresh.role==='admin'))reject(403,'Seul Étienne peut gérer les utilisateurs et leurs droits.');};
    if(p.action==='session')return {session:view(fresh)};
    if(p.action==='directory')return {profiles:await sql`select p.id,p.name,jsonb_agg(jsonb_build_object('id',d.id,'encryptionKey',d.encryption_key)) as devices from pikeo_private.profiles p join pikeo_private.devices d on d.profile_id=p.id and d.active group by p.id order by p.name`};
    if(p.action==='users'){owner();return {users:await sql`select p.id,p.name,p.is_owner,p.active,p.default_role,p.access_version,p.created_at,coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'role',d.role,'permissions',d.permissions,'active',d.active,'version',d.access_version,'lastSeen',d.last_seen) order by d.created_at) from pikeo_private.devices d where d.profile_id=p.id),'[]'::jsonb) as devices from pikeo_private.profiles p order by p.is_owner desc,p.name`,audit:await sql`select a.id,a.action,a.target,a.details,a.created_at,p.name as actor_name from pikeo_private.access_audit a left join pikeo_private.devices d on d.id=a.actor left join pikeo_private.profiles p on p.id=d.profile_id order by a.created_at desc limit 50`};}
    if(p.action==='user-create'){
     owner();const name=cleanName(p.name),key=nameKey(name);if(!['operator','viewer'].includes(p.role))reject(400,'Profil invalide.');
     const count=await sql`select count(*)::int as n from pikeo_private.profiles`;if(count[0].n>=500)reject(429,'Limite de comptes atteinte.');
     const row=await sql`insert into pikeo_private.profiles(name,name_key,default_role) values(${name},${key},${p.role}) on conflict(name_key) do nothing returning id`;if(!row.length)reject(409,'Ce nom existe déjà.');await audit(sql,fresh.id,row[0].id,'user-created',{name,role:p.role});return {saved:true,id:row[0].id};
    }
    if(p.action==='user-update'){
     owner();if(!uuid(p.target)||typeof p.active!=='boolean'||!Number.isInteger(p.version))reject(400,'Compte invalide.');
     const row=await sql`update pikeo_private.profiles set active=${p.active},access_version=access_version+1 where id=${p.target} and not is_owner and access_version=${p.version} returning id`;if(!row.length)reject(409,'Le compte a changé ou appartient au propriétaire. Actualisez la liste.');await audit(sql,fresh.id,p.target,p.active?'user-enabled':'user-suspended');return {saved:true};
    }
    if(p.action==='set-access'){
     owner();if(!uuid(p.target)||!['operator','admin','viewer','revoked'].includes(p.role)||!validPermissions(p.permissions)||!Number.isInteger(p.version))reject(400,'Droits invalides.');
     const row=await sql`update pikeo_private.devices d set role=${p.role==='revoked'?'viewer':p.role},permissions=${sql.json(p.permissions)},active=${p.role!=='revoked'},access_version=d.access_version+1 from pikeo_private.profiles p where d.id=${p.target} and p.id=d.profile_id and (not p.is_owner or (d.role<>'admin' and ${p.role}<>'admin')) and d.access_version=${p.version} returning d.id`;if(!row.length)reject(409,'Cet accès a changé ou nécessite le fichier privé propriétaire. Actualisez la liste.');await audit(sql,fresh.id,p.target,'device-access',{role:p.role,permissions:p.permissions});return {saved:true};
    }
    if(p.action==='devices'){owner();return {devices:await sql`select d.id,d.profile_id,p.name,d.role,p.is_owner,d.active,d.last_seen,d.permissions from pikeo_private.devices d join pikeo_private.profiles p on p.id=d.profile_id order by p.name,d.created_at`};}
    if(p.action==='set-role'){
     if(!(fresh.is_owner&&fresh.role==='admin'))reject(403,'Seul Étienne peut attribuer les habilitations.');if(!uuid(p.target)||!['operator','admin','revoked'].includes(p.role))reject(400,'Habilitation invalide.');
     const target=(await sql`select d.*,p.is_owner from pikeo_private.devices d join pikeo_private.profiles p on p.id=d.profile_id where d.id=${p.target}`)[0];if(!target||target.is_owner)reject(403,'L’accès propriétaire est conservé.');
     await sql`update pikeo_private.devices set role=${p.role==='admin'?'admin':'operator'},permissions=null,active=${p.role!=='revoked'},access_version=access_version+1 where id=${p.target}`;await audit(sql,fresh.id,p.target,'device-access',{role:p.role});return {saved:true};
    }
    if(p.action==='config-get')return (await sql`select version,data from pikeo_private.shared_config where id=true`)[0];
    if(p.action==='config-put'){
     allow('configure');if(!Array.isArray(p.data?.records)||p.data.records.length>10000||!p.data.records.every(r=>['products','enfs','families','packagings','locations','replenishments'].includes(r.type)&&typeof r.record?.id==='string'))reject(400,'Paramètres partagés invalides.');
     const previous=(await sql`select data from pikeo_private.shared_config where id=true`)[0];const shared=mergeSharedEnfs(p.data,previous?.data);
     const r=await sql`update pikeo_private.shared_config set data=${sql.json(shared)},version=version+1,updated_at=now() where id=true and version=${Number(p.version)} returning version`;if(!r.length)reject(409,'Les réglages ont changé. Actualisez avant de publier.');return r[0];
    }
    if(p.action==='send'){
     allow('messages');
     if(!Array.isArray(p.messages)||!p.messages.length||p.messages.length>20||!p.messages.every(validMessage))reject(400,'Message invalide.');
     for(const m of p.messages){const to=(await sql`select profile_id from pikeo_private.devices where id=${m.recipientDevice} and active`)[0];if(!to)reject(409,'Le destinataire doit rouvrir sa session.');
      await sql`insert into pikeo_private.messages(id,sender_device,recipient_device,sender_profile,recipient_profile,envelope) values(${m.id},${fresh.id},${m.recipientDevice},${fresh.profile_id},${to.profile_id},${sql.json(m.envelope)}) on conflict(id,recipient_device) do nothing`;
     }return {accepted:p.messages.length};
    }
    if(p.action==='inbox')return {messages:await sql`select m.id,m.sender_profile,m.sender_device,p.name as sender_name,m.envelope,m.created_at from pikeo_private.messages m join pikeo_private.profiles p on p.id=m.sender_profile where m.recipient_device=${fresh.id} and m.expires_at>now() order by m.created_at limit 100`};
    if(p.action==='ack'){if(!Array.isArray(p.ids)||p.ids.length>100||!p.ids.every(uuid))reject(400,'Accusé invalide.');if(p.ids.length)await sql`delete from pikeo_private.messages where recipient_device=${fresh.id} and id in ${sql(p.ids)}`;return {saved:true};}
    if(p.action==='sharing'){if(p.enabled)allow('team');if(typeof p.enabled!=='boolean')reject(400,'Choix invalide.');await sql`update pikeo_private.profiles set share_achievements=${p.enabled} where id=${fresh.profile_id}`;if(!p.enabled)await sql`delete from pikeo_private.achievements where profile_id=${fresh.profile_id}`;return {saved:true};}
    if(p.action==='achievement'){
     allow('team');
     if(!fresh.share_achievements)reject(403,'Activez votre participation avant de partager.');if(!['entraide','qualite','progres'].includes(p.category))reject(400,'Catégorie invalide.');
     await sql`insert into pikeo_private.achievements(profile_id,day,category) values(${fresh.profile_id},(now() at time zone 'Europe/Paris')::date,${p.category}) on conflict do nothing`;return {saved:true};
    }
    if(p.action==='team')return {sharing:fresh.share_achievements,achievements:await sql`select a.day,a.category,p.name from pikeo_private.achievements a join pikeo_private.profiles p on p.id=a.profile_id and p.share_achievements where a.day>=(now() at time zone 'Europe/Paris')::date-6 order by a.day desc,p.name`};
    reject(400,'Action inconnue.');
   });
  }
  return new Response(JSON.stringify(result),{headers});
 }catch(e){const status=e instanceof HttpError?e.status:400;if(!(e instanceof HttpError)&&!(e instanceof SyntaxError))console.error('pikeo-api failure',e.code||e.name);return new Response(JSON.stringify({error:e instanceof HttpError?e.message:'La demande ne peut pas être traitée. Réessayez.'}),{status,headers});}
}
Deno.serve(handle);
