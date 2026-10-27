import test from 'node:test';
import assert from 'node:assert/strict';
import {moveDayPlan} from '../site/js/day-drafts-core.js';
import {restartDayPlan} from '../site/js/day-core.js';

const date='2026-10-26',newDate='2026-10-27';
const active={date,pages:[{id:'page',photoId:'photo',reviewed:true,text:'Lecture corrigée',sections:[{number:'000001234',lines:[{sku:'001234',quantity:12}]}]}],choices:{'000001234':'replace'}};
const orders=[{id:'order',date,number:'000001234',total:3,_eventId:'r1',photoIds:['photo']}];
const days=[{id:'correction',date,manualTotal:7,reason:'Comptage',_eventId:'r2'}];

test('corriger la date déplace tout le bilan et les photos avec corrections sans toucher aux sources',()=>{
  const before=structuredClone({orders,days,active});
  const result=moveDayPlan(date,newDate,orders,days,active);
  assert.deepEqual(result.items.map(x=>[x.type,x.record.id,x.record.date]),[['orders','order',newDate],['days','correction',newDate]]);
  assert.deepEqual(result.draft,{...active,date:newDate});assert.deepEqual(result.backlog,{});
  assert.deepEqual({orders,days,active},before);assert.equal(result.items[1].record.manualTotal,7);
  assert.equal(result.signature,restartDayPlan(date,orders,days,active).signature);
});
test('date occupée par une commande, correction ou photo refusée sans fusion implicite',()=>{
  assert.throws(()=>moveDayPlan(date,newDate,[...orders,{id:'other',date:newDate}],days,active),/déjà une journée/);
  assert.throws(()=>moveDayPlan(date,newDate,orders,[...days,{id:'other',date:newDate,manualTotal:0}],active),/déjà une journée/);
  assert.throws(()=>moveDayPlan(date,newDate,orders,days,active,{[newDate]:{date:newDate,pages:[{id:'other'}]}}),/déjà une journée/);
  assert.throws(()=>moveDayPlan(date,newDate,orders,days,{date:newDate,pages:[{id:'other'}]}),/déjà une journée/);
});
test('déplacer une journée en attente préserve la session active d’une autre date',()=>{
  const current={date:'2026-10-28',pages:[{id:'current'}],choices:{}};
  const result=moveDayPlan(date,newDate,[],[],current,{[date]:active});
  assert.deepEqual(result.draft,current);assert.deepEqual(result.backlog,{[newDate]:{...active,date:newDate}});
  assert.deepEqual(result.items,[]);
});
test('les dates invalides, inchangées et les journées sans données sont refusées',()=>{
  for(const value of ['','2026-02-31','2026-2-1'])assert.throws(()=>moveDayPlan(date,value,orders,days,active),/valide/);
  assert.throws(()=>moveDayPlan(date,date,orders,days,active),/différente/);
  assert.throws(()=>moveDayPlan(date,newDate,[],[],null),/Aucune/);
});
test('un brouillon seul peut changer de date et une session vide de destination est remplacée',()=>{
  const result=moveDayPlan(date,newDate,[],[],{date:newDate,pages:[],choices:{}},{[date]:active});
  assert.deepEqual(result.draft,{...active,date:newDate});assert.deepEqual(result.backlog,{});assert.deepEqual(result.items,[]);
});
test('un bilan déjà validé sans session photo garde son total et ouvre une nouvelle session vide',()=>{
  const result=moveDayPlan(date,newDate,orders,days,null);
  assert.deepEqual(result.draft,{date:newDate,pages:[],choices:{}});
  assert.equal(result.items[0].record.total,3);assert.equal(result.items[1].record.manualTotal,7);
  assert.deepEqual(result.items[0].record.photoIds,['photo']);
});
