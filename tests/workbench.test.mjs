import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanRecord,resumeQueue,orderChanges,reminderMessage,handoffText,concurrentChanges,dayFeedback,personalPreferences,endOfDayActions} from '../site/js/workbench-core.js';

test('Une commande reçue mais encore bloquée ne devient pas prête',()=>{
 const q=resumeQueue([{orderNumber:'001',sku:'A',status:'received'},{orderNumber:'001',sku:'B',status:'waiting'},{orderNumber:'002',sku:'C',status:'received'},{orderNumber:'003',status:'done'}]);
 assert.equal(q.length,2);assert.equal(q[0].orderNumber,'002');assert.equal(q[0].ready,true);assert.equal(q[1].ready,false);
});
test('La comparaison agrège les références et conserve les zéros',()=>{
 assert.deepEqual(orderChanges({lines:[{sku:'001',quantity:2},{sku:'001',quantity:3},{sku:'OLD',quantity:1}]},{lines:[{sku:'001',quantity:7},{sku:'NEW',quantity:4}]}),[{sku:'001',before:5,after:7,delta:2,kind:'changed'},{sku:'OLD',before:1,after:0,delta:-1,kind:'removed'},{sku:'NEW',before:0,after:4,delta:4,kind:'added'}]);
});
test('La relance utilise le signalement connu sans inventer un envoi',()=>{
 const row={orderNumber:'C1',sku:'001',location:'PAC001-A',status:'waiting',createdAt:'2026-10-25T08:00:00Z'};
 const text=reminderMessage(row,[row,{...row,orderNumber:'C2'},{...row,orderNumber:'C3',status:'done'}],Date.parse('2026-10-25T08:12:00Z'));
 assert.match(text,/depuis 12 min/);assert.match(text,/C1, C2/);assert.doesNotMatch(text,/C3|envoy/);assert.throws(()=>reminderMessage({...row,location:''},[]));
});
test('La passation masque les précisions tant que leur partage n’est pas choisi',()=>{
 const rows=[{orderNumber:'01',sku:'001',location:'PAD001',status:'received',notes:'NOTE PRIVEE'}];
 assert.doesNotMatch(handoffText(rows),/NOTE PRIVEE/);assert.match(handoffText(rows,{includeNotes:true}),/NOTE PRIVEE/);assert.throws(()=>handoffText([]));
});
test('Conflits : seuls les embranchements distincts non résolus sont proposés',()=>{
 const e=(id,name)=>({id,type:'products',record:{id:'p',name},baseEventId:'base',updatedAt:'2026-10-25T08:00:00Z'});
 const a=e('a','A'),b=e('b','B');assert.equal(concurrentChanges([a,b]).length,1);assert.equal(concurrentChanges([a,{...b,record:{...a.record}}]).length,0);assert.equal(concurrentChanges([a,b,{...e('c','A'),resolves:['a','b'],baseEventId:'b'}]).length,0);assert.equal(concurrentChanges([{...a,baseEventId:null},{...b,baseEventId:null}]).length,0);
});
test('Une estimation ne déclenche jamais une célébration d’objectif confirmé',()=>{
 assert.equal(dayFeedback({hasData:true,status:'estimated',total:2000,goal:1800}).celebrate,false);
 assert.equal(dayFeedback({hasData:true,status:'verified',total:2000,goal:1800}).celebrate,true);
 assert.equal(dayFeedback({hasData:true,status:'corrected',total:1700,goal:1800}).kind,'saved');
});
test('Le ressenti, les objectifs et les préférences refusent les valeurs incohérentes',()=>{
 assert.throws(()=>cleanRecord('fatigue',{title:'Jour',level:6}));assert.throws(()=>cleanRecord('goal',{title:'Test',target:0}));
 assert.deepEqual(personalPreferences({hand:'unknown',recoveryTimes:['10:05','25:20','10:05','13:45']}).recoveryTimes,['10:05','13:45']);
 assert.equal(personalPreferences().shareAchievements,false);
});
test('Le retour de poste propose au plus trois actions à choisir',()=>{
 const rows=Array.from({length:5},(_,i)=>({orderNumber:'C'+i,sku:'00'+i,status:'waiting'}));
 assert.equal(endOfDayActions(rows,4).length,3);
});
