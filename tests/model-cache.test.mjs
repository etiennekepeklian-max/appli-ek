import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEvent} from '../site/js/core.js';
import * as Store from '../site/js/storage.js';
import {findProducts,products} from '../site/js/model.js';

test('Le catalogue et son index suivent chaque passage entre données personnelles et démonstration',async()=>{
 const originals=new Map(['indexedDB','localStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const records=kind=>[makeEvent('products',{id:kind,sku:kind==='live'?'LOCAL-001':'DEMO-001',articleCode:kind+'-alias',name:'Produit fictif '+kind},'Test','Exemple','device')];
 try{
  const values=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}});
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(name){
   const q={},rows=records(name.includes('demo')?'demo':'live');q.result={close(){},transaction(){return {objectStore(){return {getAll(){const r={};queueMicrotask(()=>{r.result=rows;r.onsuccess();});return r;}};}};}};
   queueMicrotask(()=>q.onsuccess());return q;
  }}});
  await Store.openStore(false);assert.equal(findProducts('LOCAL-001').length,1);assert.equal(findProducts('live-alias').length,1);
  await Store.openStore(true);assert.equal(findProducts('LOCAL-001').length,0);assert.equal(findProducts('live-alias').length,0);assert.equal(findProducts('DEMO-001').length,1);assert.deepEqual(products().map(p=>p.id),['demo']);
  await Store.openStore(false);assert.equal(findProducts('DEMO-001').length,0);assert.equal(findProducts('demo-alias').length,0);assert.equal(findProducts('LOCAL-001').length,1);assert.deepEqual(products().map(p=>p.id),['live']);
 }finally{for(const [key,value]of originals){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}}
});
