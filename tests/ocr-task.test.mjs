import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedOCR,abortableOCR} from '../site/js/ocr-task.js';

test('un moteur qui ne répond plus est interrompu et une nouvelle lecture reste possible',async()=>{
  let disposed=0;
  await assert.rejects(boundedOCR(()=>new Promise(()=>{}),{timeoutMs:15,onInterrupt:()=>disposed++}),{name:'OCRTimeoutError',code:'OCR_TIMEOUT'});
  assert.equal(disposed,1);
  assert.equal(await boundedOCR(()=>Promise.resolve('Nouvelle lecture'),{timeoutMs:100}),'Nouvelle lecture');
});
test('mettre en pause interrompt immédiatement la lecture et ignore son résultat tardif',async()=>{
  const controller=new AbortController();let complete,disposed=0;
  const read=boundedOCR(signal=>abortableOCR(new Promise(resolve=>complete=resolve),signal),{signal:controller.signal,timeoutMs:10000,onInterrupt:()=>disposed++});
  await Promise.resolve();controller.abort();
  await assert.rejects(read,{name:'AbortError'});assert.equal(disposed,1);complete('Trop tard');
});
test('une tâche en attente déjà annulée ne démarre pas le moteur',async()=>{
  const controller=new AbortController();controller.abort();let called=false;
  await assert.rejects(boundedOCR(()=>{called=true;},{signal:controller.signal}),{name:'AbortError'});assert.equal(called,false);
});
test('une réussite ne déclenche aucune interruption et les erreurs moteur restent visibles',async()=>{
  let disposed=0;
  assert.equal(await boundedOCR(()=>42,{timeoutMs:20,onInterrupt:()=>disposed++}),42);
  await assert.rejects(boundedOCR(()=>Promise.reject(Error('Moteur indisponible')),{timeoutMs:20}),/Moteur indisponible/);
  assert.equal(disposed,0);
});
