import test from 'node:test';
import assert from 'node:assert/strict';
import {orderKey,refKey,dailyStats} from '../site/js/core.js';
import {parseDayPage,buildDayPlan,dayRecord,restartDayPlan} from '../site/js/day-core.js';

const date='2026-10-26',resolve=()=>({unitsPerPick:4});
const page=(id,header,n)=>({id,hash:id,text:header+'\nPage '+n+'\nReference;Quantite preparee\nTEST001;8'});
test('commande et enregistrement groupés, zéros de présentation et suffixe conservés en preuve',()=>{
  const a=page('a','Commande : 000009123 / 001','1'),b=page('b','N° Enregistrement : 000009123001 Cde ECR : TEST','2');
  const p=buildDayPlan([a,b],[],date,resolve);
  assert.equal(p.orders.length,1);assert.equal(p.problems.length,0);assert.equal(p.orders[0].number,'000009123');assert.equal(p.orders[0].estimate.total,4);
  assert.equal(p.orders[0].sources[1].identities[0].value,'000009123001');assert.equal(p.orders[0].incomplete,undefined);
  assert.equal(orderKey('000009123 /001'),'9123');assert.equal(orderKey('9123'),'9123');assert.equal(refKey('000009123'),'000009123');
});
test('les deux en-têtes d’une page ne créent pas deux commandes ; bon de préparation et référence client distincts',()=>{
  const s=parseDayPage('BON DE PREPARATION N° 000067890\nN° Enregistrement : 000009123001 Cde ECR : TEST Réf Commande client : CLIENT-ABC\nCommande : 000009123 /001\nPage 1\nReference;Quantite preparee\nTEST001;8');
  assert.equal(s.length,1);assert.equal(s[0].number,'000009123');assert.equal(s[0].identities.length,2);assert.equal(s[0].needsReview,false);
  const orphan=parseDayPage('Bon de preparation N° 000067890\nRef Commande client : CLIENT-ABC\nReference;Quantite preparee\nTEST001;8');assert.equal(orphan[0].number,'');
});
test('numéro sur la ligne suivante et ancien numéro manuscrit court rapprochés',()=>{
  const a=page('a','N° Enregistrement :\n000009123001','1/1');
  const old={...dayRecord(buildDayPlan([a],[],date,resolve).orders[0],date),id:'old',number:'9123',_eventId:'v1'};
  const p=buildDayPlan([a],[old],date,resolve);assert.equal(p.orders[0].mode,'skip');assert.equal(p.orders[0].number,'9123');
  assert.equal(dailyStats(date,[{number:'000009123/001',date,status:'completed',total:1},{number:'9123',date,status:'completed',total:1}],[]).commands,1);
});
test('désaccord entre commande et enregistrement signalé sans inventer une autre commande',()=>{
  const s=parseDayPage('Commande 000009123/001\nEnregistrement 000009124001\nReference;Quantite preparee\nTEST001;8');
  assert.equal(s.length,1);assert.equal(s[0].number,'000009123');assert.equal(s[0].identityConflict,true);assert.equal(s[0].needsReview,true);
});
test('trous dans les pages numérotées repérés même sans nombre total imprimé',()=>{
  const p=buildDayPlan([page('a','Commande 000009123/001','1'),page('c','Enregistrement 000009123001','3')],[],date,resolve);
  assert.equal(p.orders[0].incomplete,true);
});
test('une nouvelle photo d’une page déjà enregistrée ne peut pas être ajoutée une seconde fois',()=>{
  const a=page('a','Commande 000009123/001','1/1'),old={...dayRecord(buildDayPlan([a],[],date,resolve).orders[0],date),id:'old'};
  const b=page('b','Enregistrement 000009123001','1/1');assert.equal(buildDayPlan([b],[old],date,resolve).orders[0].mode,'skip');
  b.text=b.text.replace('TEST001;8','TEST001;12');const p=buildDayPlan([b],[old],date,resolve);
  assert.equal(p.orders[0].mode,'exists');assert.equal(p.orders[0].appendLines,undefined);assert.throws(()=>dayRecord(p.orders[0],date,'append'));
});
test('reprise : seulement commandes et corrections de la date, sans mutation des sources',()=>{
  const orders=[{id:'a',number:'TEST001',date,status:'completed',total:3,_eventId:'v1'},{id:'b',number:'TEST002',date:'2026-10-25',status:'completed',total:7}],days=[{id:'d',date,manualTotal:5,_eventId:'v2'}],draft={date,pages:[{id:'photo',photoId:'file'}],choices:{}};
  const p=restartDayPlan(date,orders,days,draft);assert.deepEqual(p.items.map(x=>[x.type,x.record.id,x.record.deleted]),[['orders','a',true],['days','d',true]]);
  assert.equal(p.total,5);assert.equal(p.commands,1);assert.equal(p.photos,1);assert.equal(p.otherDraft,false);assert.deepEqual(p.nextSession,{date,pages:[],choices:{}});assert.equal(orders[0].deleted,undefined);assert.equal(draft.pages.length,1);
  assert.notEqual(restartDayPlan(date,[{...orders[0],_eventId:'v3'}],days,draft).signature,p.signature);
  assert.notEqual(restartDayPlan(date,orders,days,{...draft,pages:[]}).signature,p.signature);
});
test('date invalide rejetée, autre brouillon protégé et journée vide distincte',()=>{
  assert.throws(()=>restartDayPlan('2026-02-31',[],[],null),/valide/);
  assert.equal(restartDayPlan(date,[],[],{date:'2026-10-25',pages:[{id:'other'}]}).otherDraft,true);
  assert.equal(restartDayPlan(date,[],[],null).items.length,0);
});
