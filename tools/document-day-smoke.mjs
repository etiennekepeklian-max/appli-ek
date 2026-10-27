import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {waitForState} from './poll.mjs';
import {auditContrast} from './contrast-audit.mjs';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',d=>{if(String(d).includes('http://')){clearTimeout(timer);resolve();}});server.on('error',reject);});
let browser,page;const errors=[],base='http://localhost:8765/';
try{
 browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'],...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['camera'],serviceWorkers:'block'});
 await context.addInitScript(()=>{
   window.ImageCapture=undefined;window.docStreams=[];window.ocrCalls=0;
   const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   navigator.mediaDevices.getUserMedia=async constraints=>{const s=await capture(constraints);window.docStreams.push(s);return s;};
   window.dayOcrGate=new Promise(resolve=>window.releaseDayOcr=resolve);
 });
 // Delay the worker to exercise navigation, not recognition accuracy. The UI smoke
 // suite separately runs the real local OCR engine on synthetic printed sheets.
 await context.route('**/vendor/ocr/tesseract.min.js',route=>route.fulfill({contentType:'application/javascript',body:
   "window.Tesseract={createWorker:async()=>({recognize:async()=>{const n=++window.ocrCalls;await window.dayOcrGate;return {data:{text:'Commande DOC001\\nPage '+n+'/2\\nAdresse;Quantité;Article;Désignation Article;Code alpha\\n'+(n===1?'PAC A01;12;DOC-KNOWN;Carte relue;CA':'RES 0007;6;DOC-NEW;Carte nouvelle;CA')}};}})};"}));
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'Commencer',exact:true}).click();
 await page.evaluate(async()=>{const s=await import('./js/storage.js');await s.save('families',{id:'doc-family',name:'Famille test',unitsPerPick:4});await s.save('products',{id:'doc-known',sku:'DOC-KNOWN',name:'Nom confirmé',familyId:'doc-family',location:'PAD0001',locations:['PAD0001']});});
 const go=async route=>{await page.locator('#mobile-nav [data-nav='+route+']').click();await page.waitForFunction(route=>document.querySelector('#main')?.dataset.view===route,route);};
 await page.evaluate(()=>location.hash='orders');await page.waitForFunction(()=>document.querySelector('#main')?.dataset.view==='orders');
 await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});
 await page.locator('[data-day-action=camera]').click();await page.waitForFunction(()=>!!document.querySelector('[data-day-camera] video')?.videoWidth);
 for(let n=1;n<=2;n++){
   await page.locator('[data-day-action=snapshot]').click();
   await waitForState(page,async n=>{const s=await import('./js/storage.js');return (await s.meta('day-capture'))?.pages.length===n&&!document.querySelector('[data-day-action=snapshot]')?.disabled;},n);
 }
 assert.equal(await page.evaluate(()=>window.docStreams.length),1);assert.equal(await page.evaluate(()=>window.docStreams[0].active),true);
 await page.locator('[data-day-action=camera-stop]').click();assert.equal(await page.evaluate(()=>window.docStreams[0].getTracks().every(t=>t.readyState==='ended')),true);
 await page.locator('[data-day-action=analyse]').click();await page.waitForFunction(()=>window.ocrCalls===1);
 await page.locator('[data-day-action=background]').click();await page.locator('#dialog').waitFor({state:'hidden'});
 assert.equal(await page.locator('#main').getAttribute('data-view'),'orders');assert.equal(await page.locator('[data-day-running]').count(),0);
 await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});await page.locator('#dialog').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-day-action=analyse]').isDisabled(),true);
 await page.getByRole('button',{name:'Aide pour cette action',exact:true}).click();await page.getByRole('button',{name:'Reprendre',exact:true}).click();
 await page.locator('[data-day-action=background]').click();await go('home');await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});
 await page.evaluate(()=>window.releaseDayOcr());await page.locator('#batch-progress').filter({hasText:/Analyse terminée/}).waitFor();
 console.log('OK caméra continue : deux photos, un flux, arrêt ; retour Ma journée et Accueil pendant la lecture, reprise et aide');
 // Read both pages and retain the metadata in the editor.
 const ids=await page.evaluate(async()=>(await(await import('./js/storage.js')).meta('day-capture')).pages.map(p=>p.id));
 for(const id of ids){
  await page.locator('#batch-pages [data-day-action=edit][data-id="'+id+'"]').click();
  assert.match(await page.locator('[name=lines0]').inputValue(),/;(PACA01|RES0007);/);
  await page.locator('[name=reviewed]').check();await page.getByRole('button',{name:'Valider cette page',exact:true}).click();
 }
 assert.match(await page.locator('#batch-summary').innerText(),/1 référence\(s\) à créer/);
 await page.locator('[data-day-form=save] [name=confirmed]').check();await page.getByRole('button',{name:'Enregistrer toutes les commandes retenues',exact:true}).click();
 await page.locator('#dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#main')?.dataset.view==='orders');
 const saved=await page.evaluate(async()=>{const s=await import('./js/storage.js');return {order:s.list('orders').find(o=>o.number==='DOC001'),known:s.get('products','doc-known'),created:s.list('products').find(p=>p.sku==='DOC-NEW'),draft:await s.meta('day-capture')};});
 assert.equal(saved.order.total,4);assert.equal(saved.order.unknownLines,1);assert.equal(saved.order.lines[0].pack,4);
 assert.equal(saved.known.name,'Nom confirmé');assert.deepEqual(saved.known.locations,['PAD0001','PACA01']);assert.equal(saved.created.location,'RES0007');assert.equal(saved.created.unitsPerPick,null);assert.equal(saved.created.alphaCode,'CA');assert.equal(saved.draft,null);
 await page.evaluate(async()=>{await(await import('./js/storage.js')).undoLast();});
 assert.equal(await page.evaluate(async()=>{const s=await import('./js/storage.js');return s.list('orders').some(o=>o.number==='DOC001')||s.list('products').some(p=>p.sku==='DOC-NEW');}),false);
 assert.deepEqual(await page.evaluate(async()=>(await import('./js/storage.js')).get('products','doc-known').locations),['PAD0001']);
 console.log('OK catalogue et commandes enregistrés puis annulés ensemble, références/adresses préservées, règle absente explicitement estimée');
 for(const theme of ['light','dark'])for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.evaluate(async theme=>{const s=await import('./js/storage.js');await s.save('preferences',{...s.settings(),id:'main',theme});},theme);
  await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});await page.locator('[data-day-action=camera]').click();await page.waitForFunction(()=>!!document.querySelector('[data-day-camera] video')?.videoWidth);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const audit=await page.evaluate(auditContrast);assert.deepEqual(audit.failures,[],'Contraste caméra '+theme+' '+width);
  await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();assert.equal(await page.evaluate(()=>window.docStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true);
 }
 assert.deepEqual(errors,[]);console.log('OK caméra et aide 320/390 px, clair/sombre, aucune erreur JavaScript ni flux oublié');
}catch(error){await mkdir('test-results',{recursive:true});await page?.screenshot({path:'test-results/document-day-failure.png',fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw error;}finally{await browser?.close();server.kill();}
