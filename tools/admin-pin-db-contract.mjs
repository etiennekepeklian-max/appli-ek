// Only a fresh, local CI PostgreSQL database is accepted. No production requests.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postgres from 'postgres';
import {createDeviceKeys,publicJWK,signedRequest} from '../site/js/session-crypto.js';
import {hash} from '../backend/pikeo-api/core.mjs';

const target=new URL(process.env.PIKEO_CONTRACT_DB_URL||'postgres://invalid/invalid');
assert.equal(process.env.CI,'true','Ce contrat est réservé au conteneur CI isolé.');
assert.ok(['127.0.0.1','localhost'].includes(target.hostname),'Base distante refusée.');
assert.equal(target.pathname,'/pikeo_pin_test','Nom de base de test obligatoire.');
const db=postgres(target.href,{prepare:false,max:8,connect_timeout:10,onnotice:()=>{}});
const randomSecret=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
const ownerSecret=randomSecret(),pepper=randomSecret(),env={SUPABASE_DB_URL:target.href,PIKEO_PIN_PEPPER:pepper};
const dependencyKey=Symbol.for('pikeo-pin-db-contract');
let handle,checks=0;
async function check(label,work){await work();checks++;console.log('OK '+checks+' · '+label);}
async function api(user,action,values={},provided){
 const payload={action,deviceId:user.id,timestamp:Date.now(),nonce:crypto.randomUUID(),...values};
 const body=provided||await signedRequest(payload,user.keys.signing.privateKey);
 const response=await handle(new Request('https://synthetic.invalid/pikeo-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
 return {status:response.status,data:await response.json(),body};
}
async function device(name='Fictif '+crypto.randomUUID().slice(0,8),{owner=false,role}={}){
 const user={id:crypto.randomUUID(),keys:await createDeviceKeys(),name};
 const r=await api(user,'register',{name,signingKey:await publicJWK(user.keys.signing.publicKey),encryptionKey:await publicJWK(user.keys.encryption.publicKey),...(owner?{ownerSecret}:{})});
 assert.equal(r.status,200,JSON.stringify(r.data));user.profileId=r.data.session.profileId;user.session=r.data.session;
 if(role)await db`update pikeo_private.devices set role=${role} where id=${user.id}`;
 return user;
}
const enroll=async(user,code='0042')=>assert.equal((await api(user,'admin-pin-enroll',{pin:code})).status,200);
const pinRow=async user=>(await db`select * from pikeo_private.admin_pins where device_id=${user.id}`)[0];
try{
 await db.unsafe("create role anon; create role authenticated;");
 const schema=await readFile(new URL('../backend/schema.sql',import.meta.url),'utf8');
 const cronMarker=schema.indexOf('create extension if not exists pg_cron;');
 assert.ok(cronMarker>0); // The Supabase retention scheduler is outside this local contract.
 await db.unsafe(schema.slice(0,cronMarker));
 const pinSchema=await readFile(new URL('../backend/admin-pin-schema.sql',import.meta.url),'utf8');
 await db.unsafe(pinSchema);await db.unsafe(pinSchema);
 await db`insert into pikeo_private.owner_keys(token_hash) values(${await hash(ownerSecret)})`;
 const entry=new URL('../backend/pikeo-api/index.ts',import.meta.url);
 const source=(await readFile(entry,'utf8'))
  .replace(/^import postgres from 'npm:postgres@3\.4\.9';$/m,"const deps=globalThis[Symbol.for('pikeo-pin-db-contract')];const Deno=deps.Deno;")
  .replace(/^const db=postgres\(.*;\n/m,'const db=deps.db;\n')
  .replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,entry).href))
  .replace('Deno.serve(handle);','export {handle};');
 globalThis[dependencyKey]={db,Deno:{env:{get:name=>env[name]}}};
 try{({handle}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')));}finally{delete globalThis[dependencyKey];}
 const owner=await device('Étienne',{owner:true});await enroll(owner);
 await check('nom seul sans privilège, fichier propriétaire préservé et consultation initiale',async()=>{
  const namesake=await device('Étienne');
  assert.equal(namesake.session.owner,false);assert.equal(namesake.session.role,'operator');
  assert.equal((await api(namesake,'admin-pin-enroll',{pin:'0042'})).status,403);
  const reader=await device();await db`update pikeo_private.profiles set default_role='viewer' where id=${reader.profileId}`;
  assert.equal((await device(reader.name)).session.role,'viewer');assert.equal(owner.session.owner,true);
 });
 await check('un autre appareil du même compte ne peut réinitialiser son propre code',async()=>{
  const actor=await device(undefined,{role:'admin'}),same=await device(actor.name,{role:'admin'});
  await enroll(actor);await enroll(same);const before=await pinRow(same);
  assert.equal((await api(actor,'admin-pin-reset',{target:same.id})).status,403);
  assert.deepEqual(await pinRow(same),before);
 });
 await check('réinitialisation par un autre compte, ancien code refusé, nouveau code accepté',async()=>{
  const actor=await device(undefined,{role:'admin'}),peer=await device(undefined,{role:'admin'});
  await enroll(actor);await enroll(peer);
  const profile=await db`select * from pikeo_private.profiles where id=${peer.profileId}`;
  assert.equal((await api(actor,'admin-pin-reset',{target:peer.id})).status,200);
  assert.equal((await pinRow(peer)).requires_reset,true);assert.equal((await pinRow(peer)).unlocked_until,null);
  assert.deepEqual(await db`select * from pikeo_private.profiles where id=${peer.profileId}`,profile);
  await enroll(peer,'0087');await api(peer,'admin-pin-lock');
  assert.equal((await api(peer,'admin-pin-unlock',{pin:'0042'})).status,401);
  assert.equal((await api(peer,'admin-pin-unlock',{pin:'0087'})).status,200);
 });
 await check('liste des pairs limitée aux autres comptes administrateurs',async()=>{
  const actor=await device(undefined,{role:'admin'}),same=await device(actor.name,{role:'admin'}),peer=await device(undefined,{role:'admin'});
  await enroll(actor);const r=await api(actor,'admin-pin-peers');assert.equal(r.status,200);
  assert.ok(r.data.peers.some(p=>p.id===peer.id));assert.ok(!r.data.peers.some(p=>[same.id,actor.id].includes(p.id)));
 });
 await check('échecs HTTP persistants, cinq erreurs, blocage et déverrouillage après expiration',async()=>{
  const actor=await device(undefined,{role:'admin'});await enroll(actor);await api(actor,'admin-pin-lock');
  for(let i=1;i<=5;i++){assert.equal((await api(actor,'admin-pin-unlock',{pin:'9999'})).status,i===5?429:401);assert.equal((await pinRow(actor)).failed_attempts,i);}
  assert.equal((await api(actor,'admin-pin-unlock',{pin:'0042'})).status,429);
  await db`update pikeo_private.admin_pins set locked_until=now()-interval '1 second' where device_id=${actor.id}`;
  assert.equal((await api(actor,'admin-pin-unlock',{pin:'0042'})).status,200);assert.equal((await pinRow(actor)).failed_attempts,0);
 });
 await check('droits modifiés puis rétablis : le déverrouillage précédent est invalidé',async()=>{
  const peer=await device(undefined,{role:'admin'});await enroll(peer);
  const update=(role,version)=>api(owner,'set-access',{target:peer.id,role,permissions:[],version});
  assert.equal((await update('operator',0)).status,200);assert.equal((await pinRow(peer)).unlocked_until,null);
  assert.equal((await update('admin',1)).status,200);
  assert.equal((await api(peer,'admin-pin-status')).data.unlocked,false);
  assert.equal((await api(peer,'config-put',{version:0,data:{records:[]}})).status,403);
 });
 await check('suspension et réactivation verrouillent tous les appareils sans retirer leurs empreintes',async()=>{
  const peer=await device(undefined,{role:'admin'}),second=await device(peer.name,{role:'admin'});
  await enroll(peer);await enroll(second);const before=[(await pinRow(peer)).verifier_hex,(await pinRow(second)).verifier_hex];
  assert.equal((await api(owner,'user-update',{target:peer.profileId,active:false,version:0})).status,200);
  assert.equal((await api(peer,'admin-pin-unlock',{pin:'0042'})).status,401);
  assert.equal((await api(owner,'user-update',{target:peer.profileId,active:true,version:1})).status,200);
  for(const p of [peer,second])assert.equal((await pinRow(p)).unlocked_until,null);
  assert.deepEqual([(await pinRow(peer)).verifier_hex,(await pinRow(second)).verifier_hex],before);assert.ok((await pinRow(owner)).unlocked_until);
 });
 await check('version de droits périmée : refus atomique sans verrouillage collatéral',async()=>{
  const peer=await device(undefined,{role:'admin'});await enroll(peer);const before=await pinRow(peer);
  assert.equal((await api(owner,'set-access',{target:peer.id,role:'operator',permissions:[],version:99})).status,409);
  assert.deepEqual(await pinRow(peer),before);assert.equal((await api(peer,'session')).data.session.role,'admin');
 });
 await check('récupération propriétaire avec le seul fichier privé valide',async()=>{
  await api(owner,'admin-pin-lock');const before=await pinRow(owner);
  assert.equal((await api(owner,'admin-pin-recover',{ownerSecret:'invalid-synthetic-secret'})).status,401);assert.deepEqual(await pinRow(owner),before);
  assert.equal((await api(owner,'admin-pin-recover',{ownerSecret})).status,200);assert.equal((await pinRow(owner)).requires_reset,true);
  await enroll(owner);
  const peer=await device(undefined,{role:'admin'});assert.equal((await api(peer,'admin-pin-recover',{ownerSecret})).status,403);
 });
 await check('tentatives concurrentes sérialisées et compteur durable',async()=>{
  const peer=await device(undefined,{role:'admin'});await enroll(peer);await api(peer,'admin-pin-lock');
  const results=await Promise.all(Array.from({length:7},()=>api(peer,'admin-pin-unlock',{pin:'9999'})));
  assert.equal(results.filter(r=>r.status===401).length,4);assert.equal(results.filter(r=>r.status===429).length,3);
  assert.equal((await pinRow(peer)).failed_attempts,5);
 });
 await check('signature modifiée et demande rejouée refusées',async()=>{
  const r=await api(owner,'session');assert.equal(r.status,200);
  assert.equal((await api(owner,'session',{},r.body)).status,409);
  const changed={...r.body,payload:{...r.body.payload,action:'user-update'}};
  assert.equal((await api(owner,'session',{},changed)).status,401);
 });
 await check('expiration du PIN imposée par le serveur sur la configuration et les comptes',async()=>{
  await db`update pikeo_private.admin_pins set unlocked_until=now()-interval '1 second' where device_id=${owner.id}`;
  assert.equal((await api(owner,'users')).status,403);
  assert.equal((await api(owner,'config-put',{version:0,data:{records:[]}})).status,403);
  assert.equal((await api(owner,'admin-pin-unlock',{pin:'0042'})).status,200);
  assert.equal((await api(owner,'users')).status,200);
 });
 await check('PIN et journaux privés : RLS, accès navigateur refusé, aucune valeur secrète dans les audits',async()=>{
  const tables=await db`select relname,relrowsecurity from pg_class where relnamespace='pikeo_private'::regnamespace and relkind='r'`;
  assert.ok(tables.every(t=>t.relrowsecurity));
  for(const role of ['anon','authenticated'])await assert.rejects(()=>db.begin(async sql=>{await sql.unsafe('set local role '+role);await sql`select * from pikeo_private.admin_pins`;}),e=>e.code==='42501');
  const audit=JSON.stringify(await db`select details from pikeo_private.access_audit`);
  assert.ok(!audit.includes(ownerSecret)&&!audit.includes(pepper)&&!audit.includes('"pin"'));
 });
 console.log(checks+' contrats API/SQL réussis sur PostgreSQL isolé ; aucun service de production utilisé.');
}finally{delete globalThis[dependencyKey];await db.end();}
