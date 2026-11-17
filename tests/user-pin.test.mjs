import test from 'node:test';
import assert from 'node:assert/strict';
import * as Pin from '../backend/pikeo-api/user-pin-service.mjs';
const pepper='test-personal-pin-server-secret-32-characters';
function database(initial=null){
 let row=initial,session=null;const actor={role:'operator',active:true,is_owner:false,profile_active:true};
 const sql=async(strings,...v)=>{
  const q=strings.join('?').replace(/\s+/g,' ').toLowerCase();
  if(q.startsWith('select * from pikeo_private.user_pins'))return row?[row]:[];
  if(q.startsWith('insert into pikeo_private.user_pins')){if(q.includes('requires_reset')){row={...row,enroll_device_id:v[1],requires_reset:true,failed_attempts:0,locked_until:null};}else if(!row)row={enroll_device_id:v[1],verifier_hex:null,requires_reset:false,failed_attempts:0};return [];}
  if(q.includes('set salt_hex=')){Object.assign(row,{salt_hex:v[0],verifier_hex:v[1],requires_reset:false,enroll_device_id:null,failed_attempts:0,locked_until:null});return [];}
  if(q.includes('set failed_attempts=?')){row.failed_attempts=v[0];row.locked_until=v[1];return [];}
  if(q.includes('set failed_attempts=0')){row.failed_attempts=0;row.locked_until=null;return [];}
  if(q.startsWith('delete from pikeo_private.user_pin_sessions')){session=null;return [];}
  if(q.startsWith('insert into pikeo_private.user_pin_sessions')){session={device:v[0],profile:v[1],hash:v[2]};return [];}
  if(q.startsWith('select 1 from pikeo_private.user_pin_sessions'))return session&&session.device===v[0]&&session.profile===v[1]&&session.hash===v[2]&&!row.requires_reset?[{}]:[];
  if(q.includes('select d.role,d.active'))return [actor];
  if(q.includes('select d.profile_id,d.active'))return [{profile_id:'profile',active:true,profile_active:true,is_owner:false}];
  throw Error(q);
 };return {sql,actor,row:()=>row};
}
test('première connexion obligatoire, confirmation, code opaque, session liée à l’appareil',async()=>{
 const db=database();assert.equal((await Pin.assertSession(db.sql,'profile','device')).status,423);
 assert.equal((await Pin.prepare(db.sql,'profile','device',true)).canEnroll,true);
 assert.equal((await Pin.enroll(db.sql,'profile','device','0042','0043',pepper)).status,400);
 assert.equal((await Pin.enroll(db.sql,'profile','other','0042','0042',pepper)).status,403);
 const result=await Pin.enroll(db.sql,'profile','device','0042','0042',pepper);
 assert.equal(result.token.length,64);assert.notEqual(db.row().verifier_hex,'0042');
 assert.equal(await Pin.assertSession(db.sql,'profile','device',result.token),null);
 assert.equal((await Pin.assertSession(db.sql,'profile','other',result.token)).status,423);
 assert.equal((await Pin.enroll(db.sql,'profile','device','1234','1234',pepper)).status,403);
});
test('un nouvel appareil ne peut pas choisir le code d’un compte existant',async()=>{
 const db=database();assert.equal((await Pin.prepare(db.sql,'profile','stranger',false)).canEnroll,false);
 await Pin.prepare(db.sql,'profile','known-device',true);
 assert.equal((await Pin.prepare(db.sql,'profile','stranger',true)).canEnroll,false);
});
test('échecs persistants, blocage après cinq erreurs et réinitialisation réservée au propriétaire',async()=>{
 const db=database();await Pin.prepare(db.sql,'profile','device',true);const initial=await Pin.enroll(db.sql,'profile','device','0042','0042',pepper);
 for(let i=1;i<=5;i++){const bad=await Pin.unlock(db.sql,'profile','device','9999',pepper);assert.equal(bad.status,i===5?429:401);assert.equal(db.row().failed_attempts,i);}
 assert.equal((await Pin.unlock(db.sql,'profile','device','0042',pepper)).status,429);
 assert.equal((await Pin.resetByOwner(db.sql,'operator','device')).status,403);
 db.actor.role='admin';assert.equal((await Pin.resetByOwner(db.sql,'fake-admin','device')).status,403);
 db.actor.is_owner=true;assert.equal((await Pin.resetByOwner(db.sql,'owner','device')).saved,true);
 assert.equal((await Pin.assertSession(db.sql,'profile','device',initial.token)).status,423);
 assert.equal((await Pin.enroll(db.sql,'profile','other','1234','1234',pepper)).status,403);
 assert.ok((await Pin.enroll(db.sql,'profile','device','1234','1234',pepper)).token);
 assert.equal((await Pin.unlock(db.sql,'profile','device','0042',pepper)).status,401);
 assert.ok((await Pin.unlock(db.sql,'profile','device','1234',pepper)).token);
});

test('les appareils de migration peuvent créer le premier code, les nouveaux et les anciens après reset ne peuvent pas',async()=>{
 const db=database({verifier_hex:null,requires_reset:false,bootstrap_device_ids:['legacy-a','legacy-b'],failed_attempts:0});
 assert.equal((await Pin.state(db.sql,'profile','legacy-a')).canEnroll,true);
 assert.equal((await Pin.prepare(db.sql,'profile','new-device',false)).canEnroll,false);
 assert.equal((await Pin.prepare(db.sql,'profile','new-device',false)).canEnroll,false);
 assert.equal((await Pin.enroll(db.sql,'profile','new-device','1234','1234',pepper)).status,403);
 assert.ok((await Pin.enroll(db.sql,'profile','legacy-b','1234','1234',pepper)).token);
 await Pin.reset(db.sql,'profile','recovery-device');
 assert.equal((await Pin.state(db.sql,'profile','legacy-a')).canEnroll,false);
 assert.equal((await Pin.state(db.sql,'profile','recovery-device')).canEnroll,true);
});
