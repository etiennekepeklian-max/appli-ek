import test from 'node:test';
import assert from 'node:assert/strict';
import {businessChecks,runChecks,summarize} from '../site/js/diagnostic-core.js';
import {OCR_ASSETS,redundantOCRAsset} from '../site/js/offline-core.js';

for(const check of businessChecks())test('Diagnostic sur exemples fictifs : '+check.label,()=>check.run());
test('Un contrôle en échec est signalé et ne masque pas les suivants',async()=>{
 const seen=[],result=await runChecks([{id:'a',label:'A',run(){throw Error('secret à ne pas afficher');}},{id:'b',label:'B',run:()=>({status:'manual',detail:'Essai requis'})},{id:'c',label:'C',run:()=>{}}],{onResult:row=>seen.push(row.id)});
 assert.equal(result.cancelled,false);assert.deepEqual(seen,['a','b','c']);assert.deepEqual(summarize(result.rows),{passed:1,failed:1,warnings:0,manual:1});assert.ok(!JSON.stringify(result).includes('secret'));
});
test('Un changement de session arrête les contrôles et leurs mises à jour',async()=>{
 let current=true;const seen=[],result=await runChecks([{id:'a',run(){current=false;}},{id:'b',run(){throw Error('Ne doit pas être appelé');}}],{current:()=>current,onResult:r=>seen.push(r)});
 assert.equal(result.cancelled,true);assert.deepEqual(result.rows,[]);assert.deepEqual(seen,[]);
});
test('Cache OCR allégé : les quatre moteurs autonomes et les deux langues restent',()=>{
 assert.equal(OCR_ASSETS.length,8);assert.equal(OCR_ASSETS.filter(p=>p.endsWith('.wasm.js')).length,4);assert.equal(new Set(OCR_ASSETS).size,8);assert.ok(OCR_ASSETS.every(p=>!redundantOCRAsset(p)));
 for(const suffix of ['','-simd','-lstm','-simd-lstm']){assert.ok(redundantOCRAsset('vendor/ocr/core/tesseract-core'+suffix+'.wasm'));assert.ok(redundantOCRAsset('vendor/ocr/core/tesseract-core'+suffix+'.js'));}
 assert.equal(redundantOCRAsset('vendor/ocr/worker.min.js'),false);assert.equal(redundantOCRAsset('js/core.js'),false);
});
