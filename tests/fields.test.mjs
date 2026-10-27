import test from 'node:test';
import assert from 'node:assert/strict';
import {splitLocation,locationValue,referenceMatches,googleConnectionInput} from '../site/js/field-core.js';
import fs from 'node:fs';

test('PAC/PAD/RES : zéros conservés, aucun double préfixe, changement de zone et adresse vide',()=>{
  assert.deepEqual(splitLocation('PAC001-A'),{type:'PAC',address:'001-A'});
  assert.equal(locationValue('001-A','PAC'),'PAC001-A');assert.equal(locationValue('PAC001-A','PAC'),'PAC001-A');
  assert.equal(locationValue('PAC001-A','RES'),'RES001-A');assert.equal(locationValue('res0002','PAD'),'PAD0002');
  assert.equal(locationValue('A-01'),'A-01');assert.equal(locationValue('','RES'),'');assert.equal(locationValue('PAC','PAC'),'');assert.throws(()=>locationValue('001','AUTRE'));
});
const ps=[{id:'a',sku:'001234',name:'Carte rose',barcode:'1234567890123'},{id:'b',sku:'001235',name:'Carte bleue'},{id:'c',sku:'001234',name:'Carte rose',barcode:'1234567890999'}];
test('référence : confirmation exacte, EAN reconnu, suggestions et zéros initiaux',()=>{
  assert.equal(referenceMatches('001234',ps).status,'found');assert.equal(referenceMatches('001234',ps).exact.length,1);
  assert.equal(referenceMatches('1234567890123',ps).exact[0].sku,'001234');assert.equal(referenceMatches('1234',ps).status,'unknown');
  assert.equal(referenceMatches('001',ps).suggestions.length,3);assert.equal(referenceMatches('',ps).status,'empty');
  assert.equal(referenceMatches('001234',[...ps,{id:'other',sku:'001234',name:'Produit différent'}]).status,'ambiguous');
});
test('connexion Google : URL et identifiant seuls, client OAuth et domaine vérifiés',()=>{
  const id='12345678901234567890_abc',client='12345-example.apps.googleusercontent.com';
  assert.deepEqual(googleConnectionInput(client,'https://docs.google.com/spreadsheets/d/'+id+'/edit#gid=0'),{clientId:client,spreadsheetId:id});
  assert.equal(googleConnectionInput('',id).spreadsheetId,id);assert.equal(googleConnectionInput(client,'').spreadsheetId,'');
  assert.throws(()=>googleConnectionInput('mauvais',id));assert.throws(()=>googleConnectionInput(client,'https://example.com/spreadsheets/d/'+id));assert.throws(()=>googleConnectionInput(client,'123'));
});
test('référence : codes article et alternatives reconnus sans choix arbitraire ; index équivalent',()=>{
 const rows=[{id:'a',sku:'001234',name:'Article A',articleCode:'007777',referenceCodes:['ALT-001']},{id:'b',sku:'001235',name:'Article B',articleCode:'007777'}];
 assert.equal(referenceMatches('ALT-001',rows).exact[0].id,'a');assert.equal(referenceMatches('007777',rows).status,'ambiguous');assert.equal(referenceMatches('7777',rows).status,'unknown');
 for(const value of ['ALT-001','007777','001234','NOT-FOUND']){const exact=rows.filter(p=>[p.sku,p.articleCode,...(p.referenceCodes||[])].includes(value));assert.deepEqual(referenceMatches(value,rows,exact),referenceMatches(value,rows));}
 assert.equal(referenceMatches('00',Array.from({length:100},(_,i)=>({sku:'001'+i,name:'Test'}))).suggestions.length,5);
});
test('familles détaillées restaurées, anciennes cartes masquées et rattachées au groupe Cartes',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../site/data/families.json',import.meta.url),'utf8'));
  assert.equal(data.families.find(f=>f.id==='accessoires-gourdes').parentId,'accessoires');assert.equal(data.families.find(f=>f.id==='cadeaux-emballages-cadeaux').parentId,'cadeaux');
  assert.equal(data.families.find(f=>f.id==='cadeaux').name,'Cadeaux');assert.ok(data.families.some(f=>f.id==='cartes'));
  assert.ok(data.families.filter(f=>f.id.startsWith('papeterie-cartes-')).every(f=>f.hidden&&f.parentId==='cartes'));
});
