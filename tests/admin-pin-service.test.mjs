import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {digestPin,randomSalt} from '../backend/pikeo-api/pin-core.mjs';
import * as Pin from '../backend/pikeo-api/pin-service.mjs';

const pepper='test-only-development-pepper-value-not-a-production-secret';
function fakeDB(record){
 const sql=(strings,...args)=>{
  const query=strings.join('?').replace(/\s+/g,' ').toLowerCase();
  if(query.includes('select * from pikeo_private.admin_pins'))return Promise.resolve(record?[record]:[]);
  if(query.includes('set failed_attempts=?')){
   record.failed_attempts=args[0];record.locked_until=args[1];record.unlocked_until=null;
   return Promise.resolve([]);
  }
  if(query.includes('set failed_attempts=0,locked_until=null')){
   record.failed_attempts=0;record.locked_until=null;record.unlocked_until=new Date(Date.now()+600000);
   return Promise.resolve([]);
  }
  if(query.includes('set unlocked_until=null')){record.unlocked_until=null;return Promise.resolve([]);}
  if(query.includes('from pikeo_private.devices'))return Promise.resolve([]);
  throw Error('Unexpected database call: '+query);
 };
 return sql;
}
test('PIN refusé: échecs sauvegardés puis verrouillage, même si la réponse est une erreur HTTP',async()=>{
 const salt=randomSalt(),verifier=await digestPin('0042',salt,pepper);
 const row={salt_hex:salt,verifier_hex:verifier,requires_reset:false,failed_attempts:0,locked_until:null,unlocked_until:null};
 const sql=fakeDB(row);
 for(let i=1;i<=5;i++){
  const r=await Pin.unlock(sql,'device','9999',pepper);
  assert.equal(r.__pinError,true);assert.equal(row.failed_attempts,i);
 }
 assert.ok(row.locked_until instanceof Date);
 assert.equal((await Pin.unlock(sql,'device','0042',pepper)).status,429);
 assert.equal(row.failed_attempts,5);
 row.locked_until=new Date(Date.now()-1000);
 const r=await Pin.unlock(sql,'device','0042',pepper);
 assert.equal(r.unlocked,true);assert.equal(row.failed_attempts,0);
 assert.equal((await Pin.assertUnlocked(sql,'device')),null);
 await Pin.lock(sql,'device');
 assert.equal((await Pin.assertUnlocked(sql,'device')).status,403);
});
test('réinitialisation refusée par le même administrateur',async()=>{
 const row={requires_reset:false,unlocked_until:new Date(Date.now()+600000),locked_until:null};
 const r=await Pin.resetByAdmin(fakeDB(row),'same-device','same-device');
 assert.equal(r.status,403);
});
test('les opérations administratives utilisent un PIN côté serveur et les échecs sont validés hors transaction',async()=>{
 const api=await readFile(new URL('../backend/pikeo-api/index.ts',import.meta.url),'utf8');
 const ui=await readFile(new URL('../site/js/administration.js',import.meta.url),'utf8');
 assert.match(api,/protectedActions=\['users','user-create','user-update','set-access','devices','set-role'\]/);
 assert.match(api,/Pin\.assertUnlocked\(sql,fresh\.id\)/);
 assert.match(api,/if\(adminDevice\)\{const denied=await Pin\.assertUnlocked\(sql,fresh\.id\);if\(denied\)return denied;\}/);
 assert.match(api,/if\(result\?\.__pinError\)reject\(result\.status,result\.message\)/);
 assert.match(api,/admin-pin-recover/);
 assert.match(api,/admin-pin-reset/);
 assert.match(api,/admin-pin-peers/);
 assert.match(ui,/AdminPin\.unlocked\(\)/);
 assert.match(ui,/AdminPin\.panel\(\)/);
});
