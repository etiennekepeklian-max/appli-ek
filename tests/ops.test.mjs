import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLocationImport,parseDelimited,matchesSearch,pendingGroups,allocateReceipt,isOverdue,WAIT_LIMIT,weekDates,weeklySummary,quadTransform,validQuad,productLocations} from '../site/js/ops-core.js';

test('emplacements CSV : zéros, plusieurs casiers, BOM et doublons',()=>{
  const p=parseLocationImport('\uFEFFreference;emplacement\r\n001234;A-01\r\n001234;B-02\r\n001234;A-01');
  assert.equal(p.referenceCount,1);assert.equal(p.duplicates,1);assert.deepEqual(p.links,[{sku:'001234',location:'A-01'},{sku:'001234',location:'B-02'}]);
});
test('CSV virgule/tabulation et cellules entre guillemets',()=>{
  assert.deepEqual(parseDelimited('reference,emplacement\n"REF;A","Casier, B"'),[['reference','emplacement'],['REF;A','Casier, B']]);
  assert.equal(parseLocationImport('Référence\tCasier\n001\t02').links[0].sku,'001');
  assert.deepEqual(parseDelimited('a;b\n"texte\nmultiligne";"guillemet "" ici"'),[['a','b'],['texte\nmultiligne','guillemet " ici']]);
});
test('CSV invalide refusé intégralement avant mutation',()=>{
  for(const value of ['reference;emplacement','foo;bar\n1;2','reference;emplacement\n01;A\n02;','reference;emplacement\n01;A;B','reference;emplacement\n"01;A','reference;emplacement\n01;\uFFFD'])assert.throws(()=>parseLocationImport(value));
});
test('recherche ignore accents, espaces et tirets sans enlever les zéros',()=>{
  const p={sku:'001-234',barcode:'123456',name:'Étole Marguerites',aliases:'petit foulard'};
  assert.equal(matchesSearch(p,['sku','barcode','name','aliases'],'001234'),true);
  assert.equal(matchesSearch(p,['sku','barcode','name','aliases'],'etole marguerite'),true);
  assert.equal(matchesSearch(p,['sku','barcode','name','aliases'],'petit foulard'),true);
  assert.equal(matchesSearch(p,['sku','barcode','name'],'autre'),false);
  assert.equal(productLocations({location:'a',locations:['B','A']} ).length,2);
});
const origin=Date.parse('2026-10-24T08:00:00Z');
const row=(id,quantity,received=0,extra={})=>({id,sku:'001',quantity,received,status:received?'partial':'waiting',createdAt:new Date(origin).toISOString(),orderNumber:id,...extra});
test('réassort : seuil exact 30 min, reçu/clôturé exclus, ancienneté initiale conservée',()=>{
  assert.equal(isOverdue(row('A',10),origin+WAIT_LIMIT-1),false);
  assert.equal(isOverdue(row('A',10),origin+WAIT_LIMIT),true);
  assert.equal(isOverdue(row('A',10,4,{updatedAt:new Date(origin+1000).toISOString()}),origin+WAIT_LIMIT),true);
  assert.equal(isOverdue(row('A',10,10,{status:'received'}),origin+WAIT_LIMIT),false);
  assert.equal(isOverdue(row('A',10,0,{status:'done'}),origin+WAIT_LIMIT),false);
});
test('regroupement : quantité restante, détail des commandes et exclusion des réassorts reçus',()=>{
  const g=pendingGroups([row('A',10,3),row('B',5),row('C',9,9,{status:'received'})],origin+WAIT_LIMIT);
  assert.equal(g[0].remaining,12);assert.equal(g[0].rows.length,2);assert.equal(g[0].overdue,true);
});
test('répartition sans sur-réception : priorité puis ancienneté, quantité reçue additive',()=>{
  const rows=[row('A',10,3),row('B',5,0,{priority:'urgent'}),row('C',20,0,{createdAt:new Date(origin+1000).toISOString()})];
  const plan=allocateReceipt(rows,9);assert.deepEqual(plan.map(r=>[r.id,r.allocated,r.received]),[['B',5,5],['A',4,7]]);
  assert.equal(rows[0].received,3);assert.throws(()=>allocateReceipt(rows,33));assert.throws(()=>allocateReceipt(rows,0));assert.throws(()=>allocateReceipt(rows,2.5));
});
test('journal : lundi-dimanche, changement d’année et total journalier corrigé',()=>{
  assert.deepEqual(weekDates('2027-01-01'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
  assert.throws(()=>weekDates('2026-02-30'));
  const s=weeklySummary('2026-10-24',[{date:'2026-10-23',status:'completed',total:10,calculationStatus:'estimated'}],[{date:'2026-10-23',manualTotal:12}],[],[],1800);
  assert.equal(s.total,12);assert.equal(s.days,1);assert.equal(s.commands,1);
});
test('redressement perspective : coins projetés exactement et quadrilatère croisé refusé',()=>{
  const p=[{x:10,y:20},{x:300,y:40},{x:250,y:400},{x:40,y:350}],f=quadTransform(p);
  for(const [i,[u,v]] of [[0,[0,0]],[1,[1,0]],[2,[1,1]],[3,[0,1]]]){const r=f(u,v);assert.ok(Math.abs(r.x-p[i].x)<1e-7);assert.ok(Math.abs(r.y-p[i].y)<1e-7);}
  assert.equal(validQuad([p[0],p[2],p[1],p[3]]),false);assert.throws(()=>quadTransform([p[0],p[2],p[1],p[3]]));
});
