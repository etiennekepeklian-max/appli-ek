import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDayPage,buildDayPlan,dayRecord} from '../site/js/day-core.js';
import {pickingRule,inferFamily,inFamily} from '../site/js/catalogue-core.js';
import {isWaiting,isOverdue,WAIT_LIMIT} from '../site/js/ops-core.js';
import {dailyStats} from '../site/js/core.js';

const fs=[{id:'cartes',name:'Cartes',unitsPerPick:4},{id:'noel',name:'Noël',parentId:'cartes'},{id:'bijoux',name:'Bijoux',unitsPerPick:2}];
const resolver=sku=>({sku,unitsPerPick:null,effectiveUnitsPerPick:sku==='EXCEPTION'?6:4,pickingRule:{label:'Famille : Cartes'}});
const text=(number,page,lines='001234;12')=>`Commande N° ${number}\nPage ${page}\nReference;Quantite preparee\n${lines}`;
const photo=(id,number,page,lines)=>({id,hash:id,photoId:'photo-'+id,text:text(number,page,lines)});

test('picking : exception produit, type, famille parente, absence et cycle',()=>{
  assert.equal(pickingRule({familyId:'noel',unitsPerPick:6},fs).units,6);
  assert.equal(pickingRule({familyId:'noel'},fs).units,4);
  assert.equal(pickingRule({familyId:'noel'},[...fs.map(f=>f.id==='noel'?{...f,unitsPerPick:8}:f)]).units,8);
  assert.equal(pickingRule({familyId:'inconnu'},fs).units,null);
  assert.equal(pickingRule({familyId:'a'},[{id:'a',parentId:'b'},{id:'b',parentId:'a'}]).units,null);
  assert.equal(inFamily({familyId:'noel'},'cartes',fs),true);
});
test('classement : choix explicite conservé, cartes regroupées et porte-cartes distingués',()=>{
  assert.equal(inferFamily({familyId:'personnel',name:'Carte rose'}),'personnel');
  assert.equal(inferFamily({familyId:'a-classer',name:'Carte de félicitations'}),'cartes');
  assert.equal(inferFamily({name:'Porte-cartes bleu'}),'sacs-porte-cartes');
  assert.equal(inferFamily({name:'Produit non identifié'}),'a-classer');
});
test('lecture groupée : numéros, pages et quantités préparées plutôt que commandées',()=>{
  const p=parseDayPage('Commande N° 000123\nPage 1/2\nReference;Designation;Quantite commandee;Quantite preparee\n001234;Carte;16;12');
  assert.equal(p[0].number,'000123');assert.equal(p[0].pageNumber,1);assert.equal(p[0].pageCount,2);
  assert.equal(p[0].lines[0].quantity,12);assert.equal(p[0].lines[0].sku,'001234');assert.equal(p[0].needsReview,false);
});
test('plusieurs commandes par page et préambule non compté',()=>{
  const s=parseDayPage('Adresse livraison\nDate 24/10/2026\n'+text('C001','1/1')+'\n'+text('C002','1/1','EXCEPTION;12'));
  assert.deepEqual(s.map(s=>s.number),['C001','C002']);assert.equal(s[1].lines[0].sku,'EXCEPTION');
});
test('tableau OCR réduit à un seul espace, deux colonnes de quantités et descriptions chiffrées',()=>{
  const p=parseDayPage('Commande N° C001\nPage 1/1\nReference Designation Quantite commandee Quantite preparee\n001234 Carte 8 pieces 16 12');
  assert.equal(p[0].lines[0].sku,'001234');assert.equal(p[0].lines[0].quantity,12);assert.equal(p[0].needsReview,false);
  const simple=parseDayPage('Commande C001\nReference Quantite preparee\nDAY001 12');assert.equal(simple[0].lines[0].quantity,12);
});
test('regroupement de plusieurs pages et arrondi par ligne avec règles figées',()=>{
  const p=buildDayPlan([photo('a','C001','1/2'),photo('b','C001','2/2','EXCEPTION;12')],[],'2026-10-24',resolver);
  assert.equal(p.problems.length,0);assert.equal(p.orders.length,1);assert.equal(p.orders[0].incomplete,undefined);
  const r=dayRecord(p.orders[0],'2026-10-24');assert.equal(r.total,5);assert.deepEqual(r.lines.map(l=>l.pack),[4,6]);assert.equal(r.photoIds.length,2);
});
test('photo et page reprises en double : un seul comptage',()=>{
  const a=photo('a','C001','1/1'),b={...a,id:'b'},c={...a,id:'c',hash:'c'};
  const p=buildDayPlan([a,b,c],[],'2026-10-24',resolver);assert.equal(p.duplicatePages,2);assert.equal(p.orders[0].estimate.total,3);
});
test('numéro OCR ambigu signalé et correction conservée lors du réimport de la même photo',()=>{
  const a=photo('a','JOURO01','1/1');assert.equal(parseDayPage(a.text)[0].needsReview,true);
  const old={...dayRecord(buildDayPlan([{...a,reviewed:true,sections:[{...parseDayPage(a.text)[0],number:'JOUR001'}]}],[],'2026-10-24',resolver).orders[0],'2026-10-24'),id:'old'};
  const p=buildDayPlan([a],[old],'2026-10-24',resolver);assert.equal(p.orders[0].number,'JOUR001');assert.equal(p.orders[0].mode,'skip');assert.equal(p.problems.length,0);
});
test('conflit de contenu et pages identiques sans numéro ne sont pas dédupliqués en silence',()=>{
  const p=buildDayPlan([photo('a','C001','1/1'),photo('b','C001','1/1','001234;16')],[],'2026-10-24',resolver);assert.match(p.problems[0].message,/Deux lectures/);
  const a={...photo('a','C001','1/1'),text:'Commande C001\nReference;Quantite preparee\n001234;12'},b={...a,id:'b',hash:'b'};
  assert.match(buildDayPlan([a,b],[],'2026-10-24',resolver).problems[0].message,/Deux pages identiques/);
});
test('réimport enregistré ignoré ; ajout de nouvelles pages sans recompter les anciennes',()=>{
  const a=photo('a','C001','1/2'),b=photo('b','C001','2/2','001234;8'),first=buildDayPlan([a],[],'2026-10-24',resolver);
  const old={...dayRecord(first.orders[0],'2026-10-24'),id:'old',_eventId:'v1'};
  const again=buildDayPlan([a],[old],'2026-10-24',resolver);assert.equal(again.orders[0].mode,'skip');assert.equal(dayRecord(again.orders[0],'2026-10-24'),null);
  const all=buildDayPlan([a,b],[old],'2026-10-24',resolver);assert.equal(all.orders[0].mode,'exists');
  assert.equal(dayRecord(all.orders[0],'2026-10-24','append').total,5);assert.equal(old.total,3);
  assert.throws(()=>dayRecord(all.orders[0],'2026-10-24'));
});
test('ancienne commande sans sources : remplacement explicite, autre journée protégée',()=>{
  const p=buildDayPlan([photo('a','C001','1/1')],[{id:'old',number:'C001',date:'2026-10-24',lines:[],total:10}],'2026-10-24',resolver);
  assert.equal(p.orders[0].mode,'exists');assert.throws(()=>dayRecord(p.orders[0],'2026-10-24','append'));assert.equal(dayRecord(p.orders[0],'2026-10-24','replace').total,3);
  const other=buildDayPlan([photo('a','C001','1/1')],[{number:'C001',date:'2026-10-23'}],'2026-10-24',resolver);assert.equal(other.orders[0].mode,'other-day');assert.throws(()=>dayRecord(other.orders[0],'2026-10-24','replace'));
});
test('photos illisibles, référence inconnue, règle absente et pages manquantes signalées',()=>{
  assert.match(buildDayPlan([{id:'x',text:'Texte illisible'}],[],'2026-10-24',resolver).problems[0].message,/Numéro/);
  const p=buildDayPlan([photo('a','C001','1/2')],[],'2026-10-24',()=>null);assert.equal(p.orders[0].incomplete,true);assert.deepEqual(p.orders[0].reviewPages,['a']);assert.equal(p.orders[0].estimate.unknown,1);
});
test('manquants sans quantité : reçus/clôturés exclus, anciens partiels encore suivis',()=>{
  const p={status:'waiting',createdAt:'2026-10-24T08:00:00Z'};assert.equal(isWaiting(p),true);assert.equal(isOverdue(p,Date.parse(p.createdAt)+WAIT_LIMIT),true);
  assert.equal(isWaiting({...p,status:'partial',quantity:9,received:2}),true);assert.equal(isWaiting({...p,status:'received'}),false);assert.equal(isWaiting({...p,status:'done'}),false);
});
test('le bilan compte les numéros de commande distincts',()=>{
  const s=dailyStats('2026-10-24',[{id:'a',number:'C001',date:'2026-10-24',status:'completed',total:2},{id:'b',number:'C001',date:'2026-10-24',status:'completed',total:3}],[],1800);assert.equal(s.commands,1);
});
