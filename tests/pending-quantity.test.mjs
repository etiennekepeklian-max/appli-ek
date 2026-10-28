import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {number} from '../site/js/core.js';
import {pendingGroups} from '../site/js/ops-core.js';
import {jcMessage} from '../site/js/help-core.js';

test('une quantité de manquant doit être un entier positif, une ancienne fiche peut rester vide',()=>{
  assert.equal(number('12',{min:1,integer:true}),12);
  for(const value of ['0','-1','1.5','abc',''])assert.throws(()=>number(value,{min:1,integer:true}));
  assert.equal(number('',{min:1,integer:true,optional:true}),null);
});

test('les anciennes fiches sans quantité restent visibles sans fausser le regroupement',()=>{
  const groups=pendingGroups([
    {id:'legacy',sku:'00123',orderNumber:'C-1',status:'waiting',location:'PAC01'},
    {id:'new',sku:'00123',orderNumber:'C-2',status:'waiting',quantity:7,received:0},
  ]);
  assert.equal(groups.length,1);
  assert.equal(groups[0].rows.length,2);
  assert.equal(groups[0].remaining,7);
});

test('le message pour JC indique la quantité lorsqu’elle est renseignée',()=>{
  assert.match(jcMessage({sku:'00123',location:'PAC01',orderNumber:'C-02',quantity:12}),/Il me manque 12 unité\(s\) pour la commande C-02/);
  assert.doesNotMatch(jcMessage({sku:'00123',location:'PAC01'}),/\d+ unité\(s\)|PAC01/);
});

test('le formulaire et la sauvegarde rendent la quantité disponible sans migration des enregistrements',async()=>{
  const app=await readFile(new URL('../site/js/app.js',import.meta.url),'utf8');
  const views=await readFile(new URL('../site/js/views.js',import.meta.url),'utf8');
  assert.match(app,/field\('quantity','Quantité manquante',row\.quantity\?\?''/);
  assert.match(app,/required:!row\.id/);
  assert.match(app,/quantity=number\(d\.quantity,\{min:1,integer:true,optional:!!id\}\)/);
  assert.match(app,/\.\.\.previous,id,orderNumber,sku,quantity,location/);
  assert.match(views,/p\.quantity==null\?'Quantité non renseignée'/);
  assert.match(app,/headers=\['Commande','Référence','Quantité manquante'/);
});
