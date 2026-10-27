import test from 'node:test';
import assert from 'node:assert/strict';
import {dayPhotoIndex,photoCleanupPlan} from '../site/js/photo-cleanup-core.js';
const image=(id,kind='day-photo',date='2026-01-06')=>({id,name:id+'.png',kind,createdAt:date+'T12:00:00Z',blob:new Blob(['photo'],{type:'image/png'})});
const event=(type,record,day='06')=>({id:record.id+'-'+day,type,record,updatedAt:'2026-01-'+day+'T12:00:00Z'});
const data=(files=[],events=[],metadata=[])=>({files,events,metadata});
test('nettoyage : date métier prioritaire, dates multiples sélectionnées, calculs immuables',()=>{
 const source=data([image('a'),image('b')],[event('orders',{id:'order',date:'2026-01-05',photoIds:['a'],total:12})]),copy=structuredClone(source);
 const plan=photoCleanupPlan(source,[],['2026-01-05']);assert.deepEqual(plan.manifest.map(f=>f.id),['a']);assert.equal(plan.bytes,5);assert.deepEqual(source,copy);
 assert.deepEqual(photoCleanupPlan(source,[],['2026-01-05','2026-01-06']).manifest.map(f=>f.id),['a','b']);
});
test('nettoyage : brouillons courants/anciens, produits, ENF et fichiers partagés protégés',()=>{
 const files=['active','backlog','product','enf','shared'].map(id=>image(id));
 const events=[event('products',{id:'p',photoId:'product'}),event('enfs',{id:'e',photoIds:['enf']}),event('orders',{id:'a',date:'2026-01-05',photoIds:['shared']}),event('orders',{id:'b',date:'2026-01-06',photoIds:['shared']})];
 const metadata=[{key:'day-capture',value:{date:'2026-01-05',pages:[{photoId:'active'}]}},{key:'day-capture-backlog',value:{'2026-01-05':{date:'2026-01-05',pages:[{photoId:'backlog'}]}}}];
 const plan=photoCleanupPlan(data(files,events,metadata),[],['2026-01-05','2026-01-06']);assert.deepEqual(plan.manifest.map(f=>f.id),['shared']);assert.equal(plan.blocked.length,4);
 assert.equal(photoCleanupPlan(data(files,events,metadata),[],['2026-01-05']).count,0);
});
test('nettoyage : copies de versions incluses au choix, fichiers présents uniquement dans les copies',()=>{
 const current=data([image('a')]),snapshots=[{id:'s',data:data([image('a'),image('only-copy')])}];
 const all=photoCleanupPlan(current,snapshots,['2026-01-06']);assert.equal(all.count,2);assert.equal(all.copyCount,2);assert.equal(all.bytes,15);
 const live=photoCleanupPlan(current,snapshots,['2026-01-06'],{copies:false});assert.equal(live.count,1);assert.equal(live.bytes,5);assert.equal(live.copyCount,0);
});
test('nettoyage : voix, polices, photos privées et images sans lien avec une commande exclues',()=>{
 const source=data([image('product','product-photo'),image('random','photo'),image('voice','voice'),image('font','font'),{...image('audio'),blob:new Blob(['audio'],{type:'audio/webm'})}]);
 assert.equal(dayPhotoIndex(source).length,0);assert.throws(()=>photoCleanupPlan(source,[],[]),/date/);assert.throws(()=>photoCleanupPlan(source,[],['2026-02-30']),/date/);
});
test('nettoyage : correction de date prioritaire sur le document initial et une ancienne copie',()=>{
 const source=data([image('a')],[event('documents',{id:'a',dayDate:'2026-01-05'}),event('orders',{id:'o',date:'2026-01-06',photoIds:['a']})]);
 const snapshots=[{id:'old',data:data([image('a')],[event('orders',{id:'o',date:'2026-01-05',photoIds:['a']})])}];
 assert.deepEqual(dayPhotoIndex(source,snapshots)[0].dates,['2026-01-06']);assert.equal(photoCleanupPlan(source,snapshots,['2026-01-05']).count,0);
 const draftOnly=data([image('a')],[event('documents',{id:'a',dayDate:'2026-01-05'})],[{key:'day-photo-dates',value:{a:'2026-01-06'}}]);assert.deepEqual(dayPhotoIndex(draftOnly)[0].dates,['2026-01-06']);
});
test('nettoyage : référence ancienne de commande et signature périmée',()=>{
 const source=data([image('legacy','photo')],[event('orders',{id:'o',date:'2026-01-05',photoIds:['legacy']})]),before=photoCleanupPlan(source,[],['2026-01-05']);assert.equal(before.count,1);
 source.metadata.push({key:'day-capture',value:{date:'2026-01-05',pages:[{photoId:'legacy'}]}});assert.notEqual(photoCleanupPlan(source,[],['2026-01-05']).signature,before.signature);
});
