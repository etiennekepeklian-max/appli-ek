import test from 'node:test';
import assert from 'node:assert/strict';
import {validPin,randomSalt,digestPin,verifyPin,safeHashEqual,lockoutMs,isLocked} from '../backend/pikeo-api/pin-core.mjs';

const pepper='development-only-test-secret-not-for-production-and-not-an-account';
test('PIN admin quatre chiffres exactement, y compris les zéros initiaux',()=>{
 assert.equal(validPin('0042'),true);for(const v of [42,'123','12345','000a','999 ',' 0000',''])assert.equal(validPin(v),false);
});
test('empreinte salée lente, liée au secret serveur et comparaison',async()=>{
 const salt=randomSalt(),other=randomSalt(),h=await digestPin('0042',salt,pepper,12000);
 assert.match(salt,/^[a-f0-9]{32}$/);assert.match(h,/^[a-f0-9]{64}$/);
 assert.equal(await verifyPin('0042',salt,h,pepper,12000),true);
 assert.equal(await verifyPin('0043',salt,h,pepper,12000),false);
 assert.equal(safeHashEqual(h,h),true);assert.equal(safeHashEqual(h,h.slice(1)),false);
 assert.notEqual(h,await digestPin('0042',other,pepper,12000));
 assert.notEqual(h,await digestPin('0042',salt,pepper+'x',12000));
 await assert.rejects(()=>digestPin('0042',salt,'short',12000),/Secret serveur/);
});
test('verrouillages exponentiels après échecs répétés',()=>{
 for(let i=0;i<5;i++)assert.equal(lockoutMs(i),0);
 assert.equal(lockoutMs(5),15*60000);assert.equal(lockoutMs(6),30*60000);
 assert.equal(lockoutMs(7),60*60000);assert.equal(lockoutMs(100),24*60*60000);
 assert.equal(isLocked(new Date(Date.now()+60000).toISOString()),true);
 assert.equal(isLocked(new Date(Date.now()-60000).toISOString()),false);
});
