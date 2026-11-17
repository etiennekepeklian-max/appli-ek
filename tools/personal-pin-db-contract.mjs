// Fresh isolated CI PostgreSQL only. No production credentials or requests.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postgres from 'postgres';
import {createDeviceKeys,publicJWK,signedRequest} from '../site/js/session-crypto.js';
import {hash,publicKey} from '../backend/pikeo-api/core.mjs';
const target=new URL(process.env.PIKEO_CONTRACT_DB_URL||'postgres://invalid/invalid');
assert.equal(process.env.CI,'true');assert.ok(['localhost','127.0.0.1'].includes(target.hostname));assert.equal(target.pathname,'/pikeo_pin_test');
const db=postgres(target.href,{prepare:false,max:1,connect_timeout:10,onnotice:()=>{}}),ownerSecret=crypto.randomUUID()+crypto.randomUUID(),pepper=crypto.randomUUID()+crypto.randomUUID();
const env={SUPABASE_DB_URL:target.href,PIKEO_PIN_PEPPER:pepper};let handle,checks=0;
const check=async(name,fn)=>{await fn();console.log('OK '+(++checks)+' · '+name);};
const fresh=async name=>({id:crypto.randomUUID(),name,keys:await createDeviceKeys()});
async function api(user,action,values={},body){
 const payload={action,deviceId:user.id,timestamp:Date.now(),nonce:crypto.randomUUID(),...(user.token?{sessionToken:user.token}:{}),...values};
 const r=await handle(new Request('https://synthetic.invalid/pikeo-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||await (async()=>{const b=await signedRequest(payload,user.keys.signing.privateKey);if(user.native)b.nativeSignature=Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},user.native.privateKey,new TextEncoder().encode(JSON.stringify(payload)))).toString('base64');return b;})())}));return {status:r.status,data:await r.json()};
}
async function register(user,owner=false){const r=await api(user,'register',{name:user.name,signingKey:await publicJWK(user.keys.signing.publicKey),encryptionKey:await publicJWK(user.keys.encryption.publicKey),...(user.native?{nativePublicKey:Buffer.from(await crypto.subtle.exportKey('spki',user.native.publicKey)).toString('base64')}:{}),...(owner?{ownerSecret}:{})});assert.equal(r.status,200,JSON.stringify(r.data));user.profileId=r.data.session.profileId;return r;}
async function enroll(user,pin='0042'){const r=await api(user,'user-pin-enroll',{pin,confirmation:pin});assert.equal(r.status,200,JSON.stringify(r.data));user.token=r.data.token;return r;}
try{
 await db.unsafe('create role anon; create role authenticated;');
 const schema=await readFile(new URL('../backend/schema.sql',import.meta.url),'utf8');await db.unsafe(schema.slice(0,schema.indexOf('create extension if not exists pg_cron;')));
 await db.unsafe(await readFile(new URL('../backend/admin-pin-schema.sql',import.meta.url),'utf8'));
 await db.unsafe(await readFile(new URL('../backend/activity-schema.sql',import.meta.url),'utf8'));
 await db.unsafe(await readFile(new URL('../backend/management-schema.sql',import.meta.url),'utf8'));
 const legacy=await fresh('Legacy');
 const [{id:legacyProfile}]=await db`insert into pikeo_private.profiles(name,name_key) values('Legacy','legacy') returning id`;
 legacy.profileId=legacyProfile;
 await db`insert into pikeo_private.devices(id,profile_id,signing_key,encryption_key) values(${legacy.id},${legacyProfile},${db.json(publicKey(await publicJWK(legacy.keys.signing.publicKey)))},${db.json(publicKey(await publicJWK(legacy.keys.encryption.publicKey)))})`;
 const migration=await readFile(new URL('../backend/user-pin-schema.sql',import.meta.url),'utf8');const sql=await db.reserve();try{await sql.unsafe(migration);await sql.unsafe(migration);}finally{sql.release();}
 await db`insert into pikeo_private.owner_keys(token_hash) values(${await hash(ownerSecret)})`;
 const entry=new URL('../backend/pikeo-api/index.ts',import.meta.url),key=Symbol.for('pikeo-personal-contract');
 const source=(await readFile(entry,'utf8')).replace(/^import postgres from 'npm:postgres@3\.4\.9';$/m,"const deps=globalThis[Symbol.for('pikeo-personal-contract')];const Deno=deps.Deno;").replace(/^const db=postgres\(.*;\n/m,'const db=deps.db;\n').replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,entry).href)).replace('Deno.serve(handle);','export {handle};');
 globalThis[key]={db,Deno:{env:{get:name=>env[name]}}};try{({handle}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')));}finally{delete globalThis[key];}
 const owner=await fresh('Étienne'),alice=await fresh('Alice');
 await check('état serveur et secret prêt sans divulgation',async()=>{const h=await (await handle(new Request('https://synthetic.invalid/pikeo-api'))).json();assert.equal(h.version,'2.0.0');assert.equal(h.personalPinRequired,true);assert.equal(h.adminPinReady,true);assert.ok(!JSON.stringify(h).includes(pepper));});
 await check('première connexion et confirmation obligatoires côté serveur',async()=>{await register(alice);assert.equal((await api(alice,'session')).status,423);assert.equal((await api(alice,'user-pin-enroll',{pin:'0042',confirmation:'0043'})).status,400);await enroll(alice);assert.equal((await api(alice,'session')).status,200);const [row]=await db`select * from pikeo_private.user_pins where profile_id=${alice.profileId}`;assert.equal(row.verifier_hex.length,64);assert.notEqual(row.verifier_hex,'0042');});
 await check('appareil historique conservé, double inscription étrangère sans prise de compte',async()=>{const stranger=await fresh('Legacy');assert.equal((await register(stranger)).data.pin.canEnroll,false);assert.equal((await register(stranger)).data.pin.canEnroll,false);assert.equal((await api(stranger,'user-pin-enroll',{pin:'1234',confirmation:'1234'})).status,403);assert.equal((await register(legacy)).data.pin.canEnroll,true);await enroll(legacy);});
 await check('Étienne seul admin, nom et rôle falsifié insuffisants',async()=>{await register(owner,true);await enroll(owner,'0369');assert.equal((await api(owner,'admin-pin-enroll',{pin:'0246'})).status,200);const namesake=await fresh('Étienne');assert.equal((await register(namesake)).data.session.owner,false);assert.equal((await api(namesake,'user-pin-unlock',{pin:'0369'})).status,200);namesake.token=(await api(namesake,'user-pin-unlock',{pin:'0369'})).data.token;assert.equal((await api(namesake,'users')).status,403);await db`update pikeo_private.devices set role='admin' where id=${alice.id}`;assert.equal((await api(alice,'users')).status,403);assert.equal((await api(alice,'user-pin-reset',{target:legacy.id})).status,403);assert.equal((await api(owner,'set-role',{target:alice.id,role:'admin'})).status,400);await db`update pikeo_private.devices set role='operator' where id=${alice.id}`;});
 await check('plusieurs onglets restent valides sans conserver le PIN',async()=>{const a=alice.token,b=(await api(alice,'user-pin-unlock',{pin:'0042'})).data.token;assert.ok(b&&a!==b);assert.equal((await api(alice,'session',{sessionToken:a})).status,200);assert.equal((await api(alice,'session',{sessionToken:b})).status,200);});
 await check('échecs validés malgré réponse HTTP, verrouillage après cinq erreurs',async()=>{for(let i=1;i<=5;i++){assert.equal((await api(alice,'user-pin-unlock',{pin:'9999'})).status,i===5?429:401);const [r]=await db`select failed_attempts from pikeo_private.user_pins where profile_id=${alice.profileId}`;assert.equal(r.failed_attempts,i);}assert.equal((await api(alice,'user-pin-unlock',{pin:'0042'})).status,429);});
 await check('réinitialisation owner seulement, sessions révoquées, appareil désigné seulement',async()=>{assert.equal((await api(owner,'user-pin-reset',{target:alice.id})).status,200);assert.equal((await api(alice,'session')).status,423);const other=await fresh('Alice');await register(other);assert.equal((await api(other,'user-pin-enroll',{pin:'1111',confirmation:'1111'})).status,403);await enroll(alice,'1234');assert.equal((await api(alice,'user-pin-unlock',{pin:'0042'})).status,401);assert.equal((await api(alice,'session')).status,200);});
 await check('jetons expirés, détournés et signatures altérées refusés',async()=>{assert.equal((await api(legacy,'session',{sessionToken:alice.token})).status,423);const p={action:'session',deviceId:alice.id,timestamp:Date.now(),nonce:crypto.randomUUID(),sessionToken:alice.token},signed=await signedRequest(p,alice.keys.signing.privateKey);signed.payload.action='users';assert.equal((await api(alice,'users',{},signed)).status,401);await db`update pikeo_private.user_pin_sessions set expires_at=now()-interval '1 second' where device_id=${alice.id}`;assert.equal((await api(alice,'session')).status,423);});
 await check('récupération propriétaire contrôlée par fichier privé',async()=>{assert.equal((await api(owner,'user-pin-owner-recover',{ownerSecret:'wrong'})).status,401);assert.equal((await api(owner,'user-pin-owner-recover',{ownerSecret})).status,200);assert.equal((await api(owner,'session')).status,423);await enroll(owner,'0369');assert.equal((await api(owner,'session')).status,200);});
 await check('base privée et journaux sans codes ni secrets',async()=>{for(const role of ['anon','authenticated'])await assert.rejects(db.begin(async sql=>{await sql.unsafe('set local role '+role);await sql`select * from pikeo_private.user_pins`;}));const [{n}]=await db`select count(*)::int as n from pikeo_private.access_audit where details::text like '%0042%' or details::text like ${'%'+pepper+'%'} or details::text like ${'%'+ownerSecret+'%'}`;assert.equal(n,0);});
 await check('journal privé : connexions, PIN refusé, attribution et doublons hors ligne',async()=>{
  const r=await api(owner,'user-pin-unlock',{pin:'0369'});owner.token=r.data.token;
  await api(owner,'admin-pin-unlock',{pin:'0246'});
  const rows=await db`select action,outcome,source from pikeo_private.activity_log where device_id=${alice.id}`;
  assert.ok(rows.some(e=>e.action==='login-enroll'&&e.outcome==='success'));
  assert.ok(rows.some(e=>e.action==='login-denied'&&e.outcome==='denied'));
  assert.equal((await api(legacy,'activity-list')).status,403);
  const event={eventId:crypto.randomUUID(),action:'create',resourceType:'pending',resourceId:'synthetic-record',occurredAt:'2026-10-01T08:00:00Z',profileId:owner.profileId,deviceId:owner.id,pin:'must-not-persist'};
  assert.equal((await api(legacy,'activity-batch',{events:[event]})).status,200);
  assert.equal((await api(legacy,'activity-batch',{events:[event]})).status,200);
  const saved=await db`select * from pikeo_private.activity_log where event_id=${event.eventId}`;
  assert.equal(saved.length,1);assert.equal(saved[0].profile_id,legacy.profileId);assert.equal(saved[0].device_id,legacy.id);assert.equal(saved[0].source,'client');assert.ok(saved[0].received_at>saved[0].occurred_at);
  assert.equal((await api(legacy,'activity-batch',{events:[{...event,action:'login'}]})).status,400);
  const log=await api(owner,'activity-list');assert.equal(log.status,200);assert.ok(log.data.events.length);assert.ok(!JSON.stringify(log).includes('must-not-persist'));
  for(const role of ['anon','authenticated'])await assert.rejects(db.begin(async sql=>{await sql.unsafe('set local role '+role);await sql`select * from pikeo_private.activity_log`;}));
  await db`insert into pikeo_private.activity_log(profile_id,device_id,action,source,outcome,occurred_at) select ${legacy.profileId},${legacy.id},'create','server','success',now() from generate_series(1,105)`;
  const first=(await api(owner,'activity-list',{profileId:legacy.profileId})).data;assert.equal(first.events.length,100);assert.ok(first.next);
  const second=(await api(owner,'activity-list',{profileId:legacy.profileId,before:first.next})).data;assert.ok(second.events.length);assert.ok(!second.events.some(e=>first.events.some(f=>e.id===f.id)));
  assert.equal((await api(owner,'activity-list',{day:'2000-01-01'})).data.events.length,0);
  await api(owner,'admin-pin-lock');assert.equal((await api(owner,'activity-list')).status,403);
 });

 await check('pilotage privé, contrôle des versions et pièces jointes cloisonnés',async()=>{
  await api(owner,'admin-pin-unlock',{pin:'0246'});
  assert.equal((await api(legacy,'management-list')).status,403);
  const id=crypto.randomUUID(),p={id,kind:'tasks',version:0,data:{name:'Retour synthétique',activity:'Retours'}};
  const created=await api(owner,'management-upsert',p);assert.equal(created.status,200,JSON.stringify(created.data));assert.equal(created.data.record.version,1);
  assert.equal((await api(owner,'management-upsert',p)).status,409);
  const staffId=crypto.randomUUID();assert.equal((await api(owner,'management-upsert',{id:staffId,kind:'staff',version:0,data:{name:'Fiche RH synthétique'}})).status,200);
  const fileId=crypto.randomUUID();assert.equal((await api(owner,'management-file-put',{id:fileId,recordId:staffId,name:'preuve.pdf',mime:'application/pdf',data:Buffer.from('%PDF-1.4 synthetic').toString('base64')})).status,200);
  assert.equal((await api(owner,'management-grant',{profileId:legacy.profileId,modules:['operations']})).status,200);
  const list=await api(legacy,'management-list');assert.equal(list.status,200);assert.ok(list.data.records.some(r=>r.id===id));assert.ok(!list.data.records.some(r=>r.id===staffId));
  assert.equal((await api(legacy,'management-file-get',{id:fileId})).status,403);
  assert.equal((await api(legacy,'management-upsert',{id:staffId,kind:'staff',version:1,data:{name:'Interdit'}})).status,403);
  assert.equal((await api(legacy,'management-grant',{profileId:alice.profileId,modules:['people']})).status,403);
  for(const role of ['anon','authenticated'])await assert.rejects(db.begin(async sql=>{await sql.unsafe('set local role '+role);await sql`select * from pikeo_private.management_records`;}));
  await api(owner,'management-grant',{profileId:legacy.profileId,modules:[]});assert.equal((await api(legacy,'management-list')).status,403);
  await api(owner,'admin-pin-lock');assert.equal((await api(owner,'management-list')).status,403);await api(owner,'admin-pin-unlock',{pin:'0246'});
 });
 await check('web réservé propriétaire, clé Android signée et autorisation explicite',async()=>{
  await db`update pikeo_private.platform_policy set web_admin_only=true`;
  assert.equal((await api(legacy,'web-access')).status,403);assert.equal((await api(legacy,'session')).status,403);assert.equal((await api(owner,'web-access')).status,200);
  const android=await fresh('Android synthétique');android.native=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);await register(android);await enroll(android);
  assert.equal((await api(android,'native-access')).data.approved,false);assert.equal((await api(android,'session')).status,403);
  assert.equal((await api(owner,'native-approve',{target:android.id})).status,200);
  assert.equal((await api(android,'session')).status,200);assert.equal((await api(android,'web-access')).status,403);
  const key=android.native;delete android.native;assert.equal((await api(android,'session')).status,403);android.native=key;
  assert.equal((await api(android,'session',{platform:'android',nativePublicKey:'fake'})).status,200);
  const other=await fresh('Android imposteur');assert.equal((await api(other,'register',{name:other.name,signingKey:await publicJWK(other.keys.signing.publicKey),encryptionKey:await publicJWK(other.keys.encryption.publicKey),nativePublicKey:Buffer.from(await crypto.subtle.exportKey('spki',key.publicKey)).toString('base64')})).status,403);
  await api(owner,'native-revoke',{target:android.id});assert.equal((await api(android,'session')).status,403);
 });
 console.log(checks+' contrats réels SQL/API réussis ; aucune requête de production.');
}finally{await db.end({timeout:5});}
