import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCataloguePhotoText,reviewPhotoRows,validPhotoLocation} from '../site/js/catalogue-photo-core.js';
const known=[{id:'p-old',sku:'001234',name:'Carte',location:'PAC001-A'}];
test('Photos : préserve les zéros, PAC/PAD/RES et détecte les divergences',()=>{
 const rows=parseCataloguePhotoText('Référence;Nom;Emplacement\n001234;Carte;PAC001-A\n009876;Carnet;RES002-B\n010001 Stylo PAD003-C',known);
 assert.deepEqual(rows.map(r=>[r.sku,r.location]),[['001234','PAC001-A'],['009876','RES002-B'],['010001','PAD003-C']]);
 assert.equal(rows[0].existingId,'p-old');assert.ok(rows.every(r=>!r.warnings.length));
});
test('Photos : anomalies visibles et aucune acceptation sans correction',()=>{
 const rows=parseCataloguePhotoText('001234;Autre nom;BAD\n001234;Autre nom;BAD',known);
 assert.ok(rows[0].warnings.some(w=>w.includes('Nom différent')));
 assert.ok(rows[1].warnings.some(w=>w.includes('répétée')));
 assert.equal(validPhotoLocation('PAC-A-20'),true);assert.equal(validPhotoLocation('A-20'),false);
 assert.throws(()=>reviewPhotoRows(rows.map(r=>({...r,action:'update'})),known),/Corrigez/);
});
test('Photos : validation explicite des modifications existantes',()=>{
 const rows=parseCataloguePhotoText('001234;Nouveau nom;PAD005-C',known);
 assert.throws(()=>reviewPhotoRows(rows.map(r=>({...r,action:'update'})),known),/Confirmez/);
 assert.equal(reviewPhotoRows(rows.map(r=>({...r,action:'update',confirmName:true})),known).length,1);
});
