import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDayPage,findDayDuplicates,buildDayPlan,distinctPageProof} from '../site/js/day-core.js';
const page=(id,{number='000009123',printed='',rows='001234;12;PACA01\n005678;8;PACA02',tail=''}={})=>{
 const text=`Commande ${number}\n${printed?'Page '+printed+'\n':''}Référence;Quantité préparée;Emplacement\n${rows}\n${tail}`;
 return {id,photoId:id,hash:id,text,sections:parseDayPage(text)};
};
test('doublons : même fichier et même page imprimée ignorés, aucune mutation',()=>{
 const a=page('a',{printed:'1/1'}),b={...structuredClone(a),id:'b'},c={...structuredClone(a),id:'c',hash:'c'},original=structuredClone([a,b,c]);
 const d=findDayDuplicates([a,b,c]);assert.equal(d.pairs.length,3);assert.ok(d.pairs.every(p=>p.automatic));assert.deepEqual([a,b,c],original);
 assert.equal(buildDayPlan([a,b,c],[],'2026-01-05',()=>({unitsPerPick:4})).duplicatePages,2);
});
test('une commande multipage ne devient pas un doublon pour des lignes identiques',()=>{
 const d=findDayDuplicates([page('a',{printed:'1/2'}),page('b',{printed:'2/2'})]);assert.equal(d.pairs.length,0);assert.equal(d.unread,0);
 assert.equal(findDayDuplicates([page('a'),page('b',{number:'000009124'})]).pairs.length,0);
});
test('texte ou lignes identiques sans pagination : comparaison requise, quantités différentes distinguées',()=>{
 const a=page('a'),b=page('b'),c=page('c',{tail:'Note personnelle'});
 assert.equal(findDayDuplicates([a,b]).pairs[0].kind,'text');assert.equal(findDayDuplicates([a,b]).pairs[0].automatic,false);
 assert.equal(findDayDuplicates([a,c]).pairs[0].kind,'rows');assert.equal(findDayDuplicates([a,page('d',{rows:'001234;16;PACA01\n005678;4;PACA02',tail:'Note'})]).pairs.length,0);
});
test('quantités divergentes d’une même page signalées ; pages écartées et feuilles illisibles distinguées',()=>{
 const a=page('a',{printed:'1/1'}),b=page('b',{printed:'1/1',rows:'001234;16;PACA01'}),bad={id:'bad',text:'Texte illisible'};
 const d=findDayDuplicates([a,b,bad]);assert.equal(d.pairs[0].kind,'number');assert.equal(d.pairs[0].automatic,false);assert.equal(d.unread,1);
 assert.equal(findDayDuplicates([a,{...b,excluded:true}]).pairs.length,0);
 const corrected=structuredClone(a);corrected.id='corrected';corrected.hash='corrected';corrected.sections[0].lines[0].quantity=16;
 assert.equal(findDayDuplicates([a,corrected]).pairs[0].automatic,false);assert.equal(buildDayPlan([a,corrected],[],'2026-01-05',()=>({unitsPerPick:4})).duplicatePages,0);
});
test('confirmation distincte liée aux deux lectures, reprise du calcul et invalidation après modification',()=>{
 const a=page('a'),b=page('b');b.distinctPages=[distinctPageProof(b,a)];
 assert.equal(findDayDuplicates([a,b]).pairs[0].distinct,true);assert.equal(findDayDuplicates([b,a]).pairs[0].distinct,true);
 const p=buildDayPlan([a,b],[],'2026-01-05',()=>({unitsPerPick:4}));assert.equal(p.problems.length,0);assert.equal(p.orders[0].sources.length,2);assert.equal(p.orders[0].estimate.total,10);
 const changed=structuredClone(a);changed.text+='\nNote';assert.equal(findDayDuplicates([changed,b]).pairs[0].distinct,false);
 const corrected=structuredClone(b);corrected.sections[0].lines[0].quantity=16;assert.equal(findDayDuplicates([a,corrected]).pairs[0].distinct,false);
});
test('rapprochement commande/enregistrement partagé avec le calcul, sans toucher aux références',()=>{
 const a=page('a'),b=page('b');b.text=b.text.replace('Commande 000009123','N° Enregistrement 000009123001');b.sections=parseDayPage(b.text);
 assert.equal(findDayDuplicates([a,b]).pairs.length,1);assert.equal(b.sections[0].lines[0].sku,'001234');
 const c=page('c',{number:'000009123001'});assert.equal(findDayDuplicates([b,c]).pairs.length,1);
});
test('lignes proches comparées avec multiplicité ; petites ressemblances ne sont pas des doublons',()=>{
 const rows='001234;12;PACA01\n005678;8;PACA02\n009876;4;PACA03\n009875;4;PACA04\n009874;4;PACA05',a=page('a',{rows}),b=page('b',{rows:rows.replace('009874','009873')}),c=page('c',{rows:rows.replace('009874','009873').replace('009875','009872')});
 assert.equal(findDayDuplicates([a,b]).pairs[0].kind,'rows');assert.equal(findDayDuplicates([a,c]).pairs.length,0);
});
