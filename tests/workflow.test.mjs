import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingDuplicates,validatePendingDuplicate,preferredLocation,completionRows,backupPresentation,dayAttention} from '../site/js/workflow-core.js';

test('doublons : même commande/référence même avec autre casier, EAN canonisé par l’appelant, anciennes clôtures exclues',()=>{
  const rows=[{id:'a',orderNumber:'0012',sku:'AB01',location:'PAC01',status:'partial'},{id:'b',orderNumber:'0012',sku:'AB01',status:'received'},{id:'c',orderNumber:'0012',sku:'AB01',status:'done'},{id:'d',orderNumber:'12',sku:'AB01',status:'waiting'}];
  assert.deepEqual(pendingDuplicates(rows,{orderNumber:' 0012 ',sku:'ab01',location:'RES02'}).map(r=>r.id),['a','b']);
  assert.deepEqual(pendingDuplicates(rows,{id:'a',orderNumber:'0012',sku:'AB01'}).map(r=>r.id),['b']);
  assert.deepEqual(pendingDuplicates(rows,{orderNumber:'',sku:'AB01'}),[]);
  const duplicates=[rows[0]];
  assert.throws(()=>validatePendingDuplicate(duplicates,'RES02',false,''),/déjà signalée/);
  assert.throws(()=>validatePendingDuplicate(duplicates,'PAC01',true,'Autre besoin'),/casier différent/);
  assert.throws(()=>validatePendingDuplicate(duplicates,'RES02',true,''),/Précisez/);
  assert.doesNotThrow(()=>validatePendingDuplicate(duplicates,'RES02',true,'Deuxième casier à contrôler'));
});
test('emplacement habituel : aucun choix arbitraire entre plusieurs zones, préférence disparue ignorée',()=>{
  const p={location:'RES001',locations:['RES001','PAC002']};
  assert.equal(preferredLocation(p),'');
  assert.equal(preferredLocation({...p,preferredLocation:'PAC002'}),'PAC002');
  assert.equal(preferredLocation({...p,preferredLocation:'PAD999'}),'');
  assert.equal(preferredLocation({locations:['PAD0007']}),'PAD0007');
});
test('à compléter : règles héritées reconnues, filtres et recherche par adresse',()=>{
  const products=[{id:'a',sku:'001',name:'Carte',familyId:'cartes',effectiveUnitsPerPick:4,location:'PAC001'}, {id:'b',sku:'002',name:'Référence 002',namePending:true,locations:['RES002'],familyId:'a-classer',effectiveUnitsPerPick:null}];
  assert.deepEqual(completionRows(products).map(r=>r.product.id),['b']);
  assert.deepEqual(completionRows(products,'rule','res002')[0].missing,['identity','rule','family']);
  assert.equal(completionRows(products,'location').length,0);
});
test('sauvegarde : connexion distincte de sauvegarde, hors ligne/échec et changements encore en attente',()=>{
  const ready={configured:true,connected:true,lastSync:'2026-10-25T08:00:00Z'};
  assert.equal(backupPresentation(ready).kind,'synced');
  assert.equal(backupPresentation({...ready,pending:1}).kind,'pending');
  assert.equal(backupPresentation({...ready,documents:1}).kind,'pending');
  assert.equal(backupPresentation({...ready,connected:false}).kind,'disconnected');
  assert.equal(backupPresentation({...ready,online:false}).kind,'offline');
  assert.equal(backupPresentation({...ready,error:'Erreur réseau'}).action,'retry');
  assert.equal(backupPresentation({...ready,configured:false}).action,'configure');
  assert.equal(backupPresentation({...ready,demo:true,pending:10}).action,null);
});
test('bilan : anomalies et ajout de pages distingués des commandes lisibles',()=>{
  const group={reviewPages:[],estimate:{unknown:0},mode:'new'};
  assert.deepEqual(dayAttention(group,'new'),[]);
  assert.deepEqual(dayAttention({...group,reviewPages:['p1'],estimate:{unknown:1}},'new'),['Page(s) à relire','Règle(s) de picking absente(s)']);
  assert.deepEqual(dayAttention({...group,mode:'exists',incomplete:true,appendIncomplete:false},'append'),['Commande déjà enregistrée']);
});
