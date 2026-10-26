import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDayPage,buildDayPlan,dayRecord,sheetQuantity,sheetLocation} from '../site/js/day-core.js';
import {catalogueProposal,productIndex,lineProduct} from '../site/js/day-catalogue-core.js';
import {matchProduct} from '../site/js/catalogue-core.js';
import {layoutText} from '../site/js/ocr-layout-core.js';

const date='2026-10-26';
const sheet=rows=>'Commande TEST001\nPage 1/1\nAdresse;Quantité;Article;Désignation Article;Code alpha\n'+rows;
test('quantités lisibles barrées ou entourées comptées, ambiguïtés non devinées',()=>{
  for(const [value,n] of [['6',6],['~6~',6],['(12)',12],['⑥',6],['⑫',12],['6 manquant',6],['0',0]])assert.equal(sheetQuantity(value),n,value);
  for(const value of ['6/12','6 + 6','-6','+6','1O','?','-',''])assert.equal(sheetQuantity(value),null,value);
});
test('colonnes de feuille : adresse, quantité, article, désignation, alpha et page',()=>{
  const p=parseDayPage(sheet('PAC A01B10;~12~;001234;Carte de test;CA'))[0];
  assert.equal(p.number,'TEST001');assert.equal(p.pageNumber,1);assert.equal(p.lines[0].sku,'001234');
  assert.equal(p.lines[0].quantity,12);assert.equal(p.lines[0].location,'PACA01B10');assert.equal(p.lines[0].designation,'Carte de test');assert.equal(p.lines[0].alphaCode,'CA');assert.equal(p.lines[0].needsReview,true);
  assert.equal(sheetLocation('RES 0007-A'),'RES0007-A');assert.equal(sheetLocation('XYZ0007'),'');
});
test('trait de marqueur descriptif sans effet sur le calcul, quantité manquante entourée conservée',()=>{
  const p=parseDayPage(sheet('PAC A01B10;12;001234;Carte repère au marqueur;CA\nPAD C02B10;(6) manquant;005678;Carte;CA'))[0];
  const plan=buildDayPlan([{id:'a',hash:'a',reviewed:true,sections:[p]}],[],date,()=>({unitsPerPick:6}));
  assert.equal(plan.orders[0].estimate.total,3);assert.equal(dayRecord(plan.orders[0],date).total,3);
});
test('quantité illisible conservée pour relecture et non supprimée du bilan',()=>{
  const sections=parseDayPage(sheet('PAC A01B10;?;001234;Carte;CA')),p=buildDayPlan([{id:'a',hash:'a',sections}],[],date,()=>({unitsPerPick:6}));
  assert.equal(sections[0].lines[0].quantity,null);assert.match(p.problems[0].message,/quantité invalide/);
});
test('zéro préparé reste zéro sauf manquant explicitement marqué et à relire',()=>{
  const text='Commande TEST001\nReference;Quantite commandee;Quantite preparee;Designation\n001234;12;0;Manquant\n005678;12;0;Carte';
  const p=parseDayPage(text)[0];assert.equal(p.lines.length,1);assert.equal(p.lines[0].quantity,12);assert.equal(p.lines[0].quantitySource,'missing-ordered');assert.equal(p.lines[0].needsReview,true);
});
test('lignes avec adresse conservées si un en-tête est absent',()=>{
  const p=parseDayPage('Commande TEST001\nPage_2\nPAC A01B10  12  001234  Carte de test')[0];
  assert.equal(p.pageNumber,2);assert.equal(p.pageCount,null);assert.equal(p.lines[0].quantity,12);assert.equal(p.lines[0].location,'PACA01B10');assert.equal(p.needsReview,true);
});
test('catalogue : compléter les adresses sans écraser le nom ni la règle et créer les inconnus sans conditionnement inventé',()=>{
  const products=[{id:'p',sku:'001234',name:'Nom vérifié',familyId:'cartes',unitsPerPick:6,location:'RES0001',locations:['RES0001'],preferredLocation:'RES0001',_eventId:'v1'}];
  const groups=[{lines:[{sku:'001234',location:'PACA01B10',designation:'Nom OCR',alphaCode:'CA',quantity:12},{sku:'005678',location:'PADC02B10',designation:'Carte nouvelle',alphaCode:'CA',quantity:48}]}];
  const p=catalogueProposal(groups,products);assert.equal(p.created,1);assert.equal(p.updated,1);assert.deepEqual(p.problems,[]);
  const known=p.items.find(x=>x.record.id==='p').record;assert.equal(known.name,'Nom vérifié');assert.equal(known.unitsPerPick,6);assert.equal(known.location,'RES0001');assert.equal(known.preferredLocation,'RES0001');assert.deepEqual(known.locations,['RES0001','PACA01B10']);
  const added=p.items.find(x=>x.record.sku==='005678').record;assert.equal(added.unitsPerPick,null);assert.equal(added.familyId,'cartes');assert.equal(added.alphaCode,'CA');
  assert.deepEqual(products[0].locations,['RES0001']);assert.equal(products[0].articleCode,undefined);
});
test('deux lignes et plusieurs adresses d’une nouvelle référence donnent une seule écriture ; alpha commun ne fusionne rien',()=>{
  const rows=[{lines:[{sku:'001234',location:'PACA01',alphaCode:'CA'},{sku:'001234',location:'RES0001',alphaCode:'CA'},{sku:'005678',location:'PACA02',alphaCode:'CA'}]}];
  const p=catalogueProposal(rows,[]);assert.equal(p.items.length,2);assert.equal(p.created,2);assert.equal(p.items[0].record.locations.length,2);
  assert.equal(lineProduct({sku:'999999',alphaCode:'CA'},productIndex(p.items.map(x=>x.record))),null);
  assert.equal(lineProduct({sku:'001234'},productIndex(p.items.map(x=>x.record))).sku,'001234');
});
test('EAN, code article et références alternatives restent exacts et les ambiguïtés sont signalées',()=>{
  const rows=[{id:'a',sku:'SHOP-A',barcode:'000123456',articleCode:'001234',referenceCodes:['ALT-A']},{id:'b',sku:'SHOP-B',articleCode:'001234'}];
  assert.equal(matchProduct('000123456',rows).id,'a');assert.equal(matchProduct('ALT-A',rows).id,'a');assert.equal(matchProduct('001234',rows),null);
  assert.equal(catalogueProposal([{lines:[{sku:'001234'}]}],rows).problems.length,1);
  assert.equal(catalogueProposal([{lines:[{sku:'001234'}]}],[],{reservedIds:['sheet-001234']}).items[0].record.id,'sheet-001234-2');
});
test('règles de famille utilisées et figées, sans confondre quantité et prises',()=>{
  const sections=parseDayPage(sheet('PAC A01;12;001234;Carte;CA')),p=buildDayPlan([{id:'a',hash:'a',reviewed:true,sections}],[],date,()=>({effectiveUnitsPerPick:4,pickingRule:{label:'Famille'}}));
  const r=dayRecord(p.orders[0],date);assert.equal(r.total,3);assert.equal(r.lines[0].quantity,12);assert.equal(r.lines[0].pack,4);assert.equal(r.lines[0].location,'PACA01');
});
test('TSV lu par colonnes reconstruit en lignes physiques avec en-têtes et nombres de désignation',()=>{
  const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const word=(left,top,text,width=80)=>['5',1,1,1,1,1,left,top,width,20,96,text].join('\t');
  const tsv=[header,word(300,10,'Article'),word(300,50,'001234'),word(10,10,'Adresse'),word(10,50,'PAC'),word(52,50,'A01',35),word(180,10,'Quantité'),word(180,50,'12'),word(440,50,'Carte'),word(530,50,'30',25),word(568,50,'ans',30)].join('\n');
  const text=layoutText(tsv,'fallback');assert.match(text,/Adresse\s{2,}Quantité\s{2,}Article/);assert.match(text,/PAC A01\s{2,}12\s{2,}001234\s{2,}Carte 30 ans/);
  assert.equal(layoutText('', 'Texte de secours'),'Texte de secours');
});
