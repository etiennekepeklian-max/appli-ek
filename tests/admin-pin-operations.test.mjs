import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {requiresAdminUnlock,requirePinUnlock,handlePinAction,isPinFailure,ADMIN_PIN_ACTIONS} from '../backend/pikeo-api/pin-operations.mjs';
import {digestPin,randomSalt} from '../backend/pikeo-api/pin-core.mjs';

const actor={id:'02ba5f32-1715-44fe-a1b1-858a65e9b133',role:'admin',is_owner:false};
const secret='unit-test-server-only-pepper-not-for-production-2026';
const reject=(status,message)=>{const err=Error(message);err.status=status;throw err;};
const noAudit=async()=>{};

test('PIN exigé pour chaque opération sensible des administrateurs',async()=>{
 for(const action of ADMIN_PIN_ACTIONS){
  assert.equal(requiresAdminUnlock(actor,action),true);
  assert.equal(requiresAdminUnlock({...actor,role:'operator'},action),false);
 }
 assert.equal(requiresAdminUnlock(actor,'inbox'),false);
 let queried=0;
 const empty=async()=>{queried++;return []};
 await assert.rejects(()=>requirePinUnlock(empty,actor,reject),e=>e.status===423);
 assert.equal(queried,1);
 const locked=async()=>[{requires_reset:false,locked_until:new Date(Date.now()+60000).toISOString()}];
 await assert.rejects(()=>requirePinUnlock(locked,actor,reject),e=>e.status===429);
 const reset=async()=>[{requires_reset:true}];
 await assert.rejects(()=>requirePinUnlock(reset,actor,reject),e=>e.status===423);
});

test('le code faux augmente le compteur durablement et ne déverrouille pas',async()=>{
 const salt=randomSalt(),hash=await digestPin('0042',salt,secret);
 const row={salt_hex:salt,verifier_hex:hash,failed_attempts:0,requires_reset:false,locked_until:null,unlocked_until:null};
 let updates=0;
 const sql=async(parts,...params)=>{
  const query=parts.join('?');
  if(query.includes('select * from pikeo_private.admin_pins'))return [row];
  if(query.includes('update pikeo_private.admin_pins set failed_attempts=')){
   row.failed_attempts=params[0];row.locked_until=params[1];row.unlocked_until=null;updates++;return [];
  }
  throw Error('SQL inattendu : '+query);
 };
 const result=await handlePinAction({sql,action:'pin-unlock',payload:{pin:'0043'},user:actor,pepper:secret,reject,audit:noAudit});
 assert.equal(isPinFailure(result),true);
 assert.equal(result.__pinErrorStatus,401);
 assert.equal(row.failed_attempts,1);
 assert.equal(row.unlocked_until,null);
 assert.equal(updates,1);
});

test('un admin ne peut pas créer son premier code sans réinitialisation autorisée',async()=>{
 const sql=async(parts,...params)=>{
  if(parts.join('?').includes('select requires_reset from pikeo_private.admin_pins'))return [];
  throw Error('Requête inattendue');
 };
 await assert.rejects(()=>handlePinAction({sql,action:'pin-enroll',payload:{pin:'1234'},user:actor,pepper:secret,reject,audit:noAudit}),e=>e.status===403);
});

test('la déconnexion PIN signée et le statut ne dévoilent pas le vérificateur',async()=>{
 const sql=async(parts)=>{
  const query=parts.join('?');
  if(query.includes('select requires_reset,locked_until,unlocked_until from pikeo_private.admin_pins'))return [{requires_reset:false,locked_until:null,unlocked_until:new Date(Date.now()+60000).toISOString()}];
  if(query.includes('update pikeo_private.admin_pins set unlocked_until=null'))return [];
  throw Error('Requête inattendue '+query);
 };
 const args={sql,payload:{},user:actor,pepper:secret,reject,audit:noAudit};
 const status=await handlePinAction({...args,action:'pin-status'});
 assert.deepEqual(status,{configured:true,requiresReset:false,locked:false,unlocked:true,serverReady:true});
 assert.deepEqual(await handlePinAction({...args,action:'pin-lock'}),{locked:true});
});

test('le serveur doit authentifier la signature avant le PIN et bloquer les actions sensibles',async()=>{
 const src=await readFile(new URL('../backend/pikeo-api/index.ts',import.meta.url),'utf8');
 assert.match(src,/verify\(p,body\.signature,d\.signing_key\)/);
 assert.match(src,/if\(requiresAdminUnlock\(fresh,p\.action\)\)await requirePinUnlock\(sql,fresh,reject\)/);
 assert.match(src,/if\(isPinFailure\(result\)\)reject\(result\.__pinErrorStatus,result\.__pinErrorMessage\)/);
 assert.match(src,/if\(p\.action\.startsWith\('pin-'\)\)/);
 assert.doesNotMatch(src,/PIN_PEPPER\s*=\s*['"][^'"]+['"]/);
});
