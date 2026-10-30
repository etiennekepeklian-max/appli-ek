import test from 'node:test';import assert from 'node:assert/strict';
import {parseEnfText,validateEnf,combineEnfLines,searchEnfs,enfVoiceQuery} from '../site/js/enf-core.js';
import {makeEvent,rowForEvent,eventFromRow,SHEETS,SHEET_TABS} from '../site/js/core.js';
import {mergeSharedEnfs} from '../backend/pikeo-api/core.mjs';
const catalogue=[{sku:'001234',name:'Carte',barcode:'0001112223333'},{sku:'009876',name:'Autre carte'}];
test('ENF : code et références conservent les zéros, quantités séparées des descriptions',()=>{const r=parseEnfText('Code ENF : 000042\nRéférence Quantité\n001234 ; 4\n009876 Carte anniversaire 18 ans 12',catalogue);assert.equal(r.code,'000042');assert.deepEqual(r.lines.map(l=>[l.sku,l.quantity]),[['001234','4'],['009876','12']]);assert.ok(r.lines[1].issues.some(s=>s.includes('Plusieurs nombres')));});
test('ENF : un code compact garde son préfixe et son tiret',()=>{assert.equal(parseEnfText('ENF-0042\n001234 8',catalogue).code,'ENF-0042');assert.equal(parseEnfText('ENF000042\n001234 8',catalogue).code,'ENF000042');});
test('ENF : EAN reconnu, référence OCR inconnue et quantité illisible restent explicites',()=>{const r=parseEnfText('ENF : 000042\n0001112223333 6\n00O123 Carte illisible',catalogue);assert.equal(r.lines[0].sku,'001234');assert.equal(r.lines[0].quantity,'6');assert.equal(r.lines[1].sku,'00O123');assert.equal(r.lines[1].quantity,'');assert.ok(r.lines[1].issues.includes('Quantité non reconnue'));});
test('ENF : doublons non additionnés silencieusement, regroupement volontaire',()=>{const rows=parseEnfText('ENF : 000042\n001234 4\n001234 6',catalogue).lines;assert.equal(rows.length,2);assert.throws(()=>validateEnf({code:'000042',lines:rows}),/répétée/);assert.deepEqual(validateEnf({code:'000042',lines:combineEnfLines(rows)}).lines,[{sku:'001234',quantity:10}]);});
test('ENF : valeurs invalides refusées, quantité vide jamais remplacée par un',()=>{for(const quantity of ['',0,-1,1.5,'x',1000001])assert.throws(()=>validateEnf({code:'000042',lines:[{sku:'001234',quantity}]}));assert.throws(()=>validateEnf({code:'',lines:[{sku:'001234',quantity:4}]}));assert.equal(validateEnf({code:'000042',lines:[{sku:'001234',quantity:'04'}]}).lines[0].quantity,4);});
test('ENF : une révision Google reste lisible dans produit sans cinquième onglet',()=>{const e=makeEvent('enfs',{id:'enf-1',...validateEnf({code:'000042',lines:[{sku:'001234',quantity:4}]})},'ENF vérifié','Test','test-device');assert.equal(SHEETS.enfs,'produit');assert.equal(SHEET_TABS.length,4);const got=eventFromRow(rowForEvent(e));assert.equal(got.type,'enfs');assert.deepEqual(got.record.lines,[{sku:'001234',quantity:4}]);});
test('ENF partagé : une ancienne publication ne retire pas une nouvelle composition',()=>{const enf={type:'enfs',record:{id:'enf-1',code:'000042',lines:[{sku:'001234',quantity:4}]}},current={records:[enf]},incoming={records:[{type:'products',record:{id:'p1'}}]};const r=mergeSharedEnfs(incoming,current);assert.deepEqual(r.records,[incoming.records[0],enf]);assert.equal(incoming.records.length,1);});
test('ENF partagé : une révision ou un retrait explicite remplace la version précédente',()=>{const previous={type:'enfs',record:{id:'enf-1',code:'000042'}},next={type:'enfs',record:{id:'enf-1',deleted:true}};assert.deepEqual(mergeSharedEnfs({records:[next]},{records:[previous]}).records,[next]);});
test('ENF concept : meuble, mère en deux exemplaires et toutes les filles conservent leur rôle',()=>{
 const lines=[{sku:'00880000',quantity:1,role:'meuble'},{sku:'001234',quantity:2,role:'mere'},...['000001','000002','000003','000004','000005','000006'].map(sku=>({sku,quantity:1,role:'fille'}))];
 const clean=validateEnf({code:'C-001',name:'Concept test',lines});assert.deepEqual(clean.lines,lines);
 assert.deepEqual(eventFromRow(rowForEvent(makeEvent('enfs',{id:'concept-test',...clean},'Test','Test','device'))).record.lines,lines);
});
test('ENF concept : même référence en mère et en fille conservée, répétition du même rôle refusée',()=>{
 const lines=[{sku:'001234',quantity:1,role:'mere'},{sku:'001234',quantity:1,role:'fille'}];
 assert.deepEqual(validateEnf({code:'C-001',lines}).lines,lines);
 assert.throws(()=>validateEnf({code:'C-001',lines:[...lines,lines[1]]}),/répétée/);
 assert.deepEqual(combineEnfLines([...lines,{sku:'001234',quantity:2,role:'fille'}]),[lines[0],{sku:'001234',quantity:3,role:'fille'}]);
 assert.throws(()=>validateEnf({code:'C-001',lines:[{sku:'001234',quantity:1,role:'autre'}]}),/type de référence/);
});
test('ENF concept : recherche par concept, nom ou dernière fille, code exact prioritaire',()=>{
 const rows=[{id:'a',code:'C-000',name:'Autre',lines:[{sku:'C-001'}]},{id:'b',code:'C-001',name:'Concept Test',lines:[{sku:'000006'}]},{id:'c',code:'C-002',deleted:true,lines:[{sku:'000006'}]}];
 assert.deepEqual(searchEnfs(rows,'C-001').map(r=>r.id),['b','a']);assert.deepEqual(searchEnfs(rows,'000006').map(r=>r.id),['b']);assert.deepEqual(searchEnfs(rows,'concept test').map(r=>r.id),['b']);assert.equal(searchEnfs(rows,'inconnu').length,0);
});
test('Recherche vocale ENF : référence dictée, zéros et suffixe lettre conservés',()=>{
 for(const text of ['zéro zéro un deux trois quatre bé','référence du concept zéro zéro un deux trois quatre bé.','00 12 34 B'])assert.equal(enfVoiceQuery(text,'reference'),'001234B');
 assert.equal(enfVoiceQuery('REF001234','reference'),'REF001234');
 assert.equal(enfVoiceQuery('code concept zéro zéro neuf tiret cé','reference'),'009-C');
 for(const text of ['','vingt trois','cent vingt quatre'])assert.throws(()=>enfVoiceQuery(text,'reference'));
});
test('Recherche vocale ENF : nom conservé et retrouvé malgré accents ou ponctuation',()=>{
 const rows=[{id:'name',code:'C-008',name:'Concept étagère-atelier',lines:[]},{id:'other',code:'C-009',name:'Autre',lines:[]}];
 const name=enfVoiceQuery('nom du concept Concept etagere atelier.','name');assert.equal(name,'Concept etagere atelier');
 assert.deepEqual(searchEnfs(rows,name).map(r=>r.id),['name']);
 assert.equal(enfVoiceQuery('Concept un deux trois','name'),'Concept un deux trois');
 assert.throws(()=>enfVoiceQuery('nom du concept','name'));
 assert.throws(()=>enfVoiceQuery('x'.repeat(141),'name'));
});
