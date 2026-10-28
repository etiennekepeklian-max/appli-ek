import test from 'node:test';
import assert from 'node:assert/strict';
import {readShortcut,SHORTCUTS} from '../site/js/android-shortcuts-core.js';
test('Les quatre raccourcis sont définis dans le bon ordre métier',()=>{
 assert.deepEqual(Object.keys(SHORTCUTS),['barcode','missing','products','enf']);
});
test('Le raccourci PWA manquant ouvre bien le formulaire',()=>{
 assert.deepEqual(readShortcut('https://example.test/pikeo/?pikeo-shortcut=missing#pending'),{id:'missing',route:'pending',openForm:true});
});
test('Les destinations widget Android correspondent aux routes web',()=>{
 for(const [id,route] of [['barcode','codes'],['missing','pending'],['products','stock'],['enf','enfs']]){
  assert.equal(readShortcut('pikeo://shortcut/'+id)?.route,route);
 }
});
test('Les commandes inconnues ou non appariées sont ignorées',()=>{
 for(const url of ['pikeo://shortcut/admin','pikeo://other/missing','javascript:alert(1)','pikeo://shortcut/missing/extra','https://example.test/?pikeo-shortcut=delete','%%%'])assert.equal(readShortcut(url),null);
});
