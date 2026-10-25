import test from 'node:test';
import assert from 'node:assert/strict';
import {generateRecoveryKey,importRecoveryKey,sealJSON,openJSON,sealedEventRow,eventFromSealedRow,sealBytes,openBytes} from '../site/js/secure-core.js';
test('Sauvegarde : chiffrement authentifié, clé différente et modification refusées',async()=>{
 const a=await importRecoveryKey(await generateRecoveryKey()),b=await importRecoveryKey(await generateRecoveryKey()),data={sku:'001234',location:'PAC001-A',note:'PRIVÉ'};
 const x=await sealJSON(data,a),y=await sealJSON(data,a);assert.notEqual(x.iv,y.iv);assert.doesNotMatch(JSON.stringify(x),/001234|PAC001|PRIVÉ/);assert.deepEqual(await openJSON(x,a),data);
 await assert.rejects(()=>openJSON(x,b),/Clé incorrecte/);await assert.rejects(()=>openJSON({...x,ciphertext:(x.ciphertext[0]==='A'?'B':'A')+x.ciphertext.slice(1)},a));await assert.rejects(()=>openJSON(x,a,'event'),/incompatible/);
});
test('Clé de récupération aléatoire : un PIN ne constitue pas une clé',async()=>{
 const a=await generateRecoveryKey(),b=await generateRecoveryKey();assert.notEqual(a.key,b.key);assert.equal((await importRecoveryKey(a)).extractable,false);await assert.rejects(()=>importRecoveryKey({...a,key:'1234'}),/256 bits/);
});
test('Google : aucune donnée métier dans les colonnes visibles',async()=>{
 const key=await importRecoveryKey(await generateRecoveryKey()),e={id:'event-123',type:'pending',record:{id:'p1',sku:'001234',location:'PAC001'},updatedAt:'2026-10-25T10:00:00Z'};
 const row=await sealedEventRow(e,key);assert.deepEqual(row.slice(1,10),Array(9).fill(''));assert.equal(row[11],'');assert.doesNotMatch(JSON.stringify(row),/001234|PAC001|pending/);assert.deepEqual((await eventFromSealedRow(row,key)).record,e.record);await assert.rejects(()=>eventFromSealedRow(['other',...row.slice(1)],key),/invalide/);
});
test('Les documents binaires retrouvent exactement leurs octets',async()=>{
 const key=await importRecoveryKey(await generateRecoveryKey()),bytes=new Uint8Array([0,1,2,128,255]),e=await sealBytes(bytes,key,'document');
 assert.deepEqual(await openBytes(e,key,'document'),bytes);
});
