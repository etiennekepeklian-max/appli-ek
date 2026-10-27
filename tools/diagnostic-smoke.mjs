import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {auditContrast} from './contrast-audit.mjs';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',data=>{if(String(data).includes('http://')){clearTimeout(timer);resolve();}});server.on('error',reject);});
let browser,page;const base='http://localhost:8765/',errors=[],writes=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(request.method()!=='GET')writes.push(request.url());});
 const go=async route=>{await page.goto(base+'#'+route);await page.waitForFunction(route=>document.querySelector('#main')?.dataset.view===route,route);};
 const finish=()=>page.waitForFunction(()=>document.querySelector('[data-diagnostic-results]')?.getAttribute('aria-busy')==='false'&&document.querySelectorAll('[data-diagnostic-id]').length>0,{},{timeout:120000});
 const run=async()=>{await page.locator('[data-wb-action=diagnostic]').click();await finish();};
 await go('home');await page.getByRole('button',{name:'Commencer',exact:true}).click();
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.evaluate(async()=>{const s=await import('./js/storage.js');await s.save('pending',{id:'diagnostic-keep',orderNumber:'TEST-KEEP',sku:'001234',location:'PAC001-A',status:'waiting'},'Donnée synthétique à conserver');await s.setMeta('day-capture',{date:'2026-01-05',pages:[{id:'keep-page',text:'Brouillon conservé'}],choices:{}});});
 const before=await page.evaluate(async()=>{const s=await import('./js/storage.js');return {data:await s.exportData(),draft:await s.meta('day-capture'),undo:await s.undoInfo()};});
 await page.locator('#mobile-nav [data-nav=more]').click();await page.locator('#tools-search').fill('diagnostic');await page.locator('[data-tool-results] [data-nav=diagnostic]').click();
 await page.locator('.topbar [data-action=quickhelp]').click();assert.match(await page.locator('#help-dialog').innerText(),/Vérifier l’application/);await page.getByRole('button',{name:'Reprendre',exact:true}).click();
 await run();assert.equal(await page.locator('[data-diagnostic-status=fail]').count(),0);assert.ok(await page.locator('[data-diagnostic-status=pass]').count()>=20);assert.ok(await page.locator('[data-diagnostic-status=manual]').count()>=3);
 assert.equal(await page.locator('[data-diagnostic-id=cache]').getAttribute('data-diagnostic-status'),'warn');
 const after=await page.evaluate(async()=>{const s=await import('./js/storage.js');return {data:await s.exportData(),draft:await s.meta('day-capture'),undo:await s.undoInfo(),testDBs:(await indexedDB.databases()).filter(d=>d.name.startsWith('pikeo-diagnostic-'))};});
 delete before.data.exportedAt;delete after.data.exportedAt;assert.deepEqual(after.data,before.data);assert.deepEqual(after.draft,before.draft);assert.deepEqual(after.undo,before.undo);assert.deepEqual(after.testDBs,[]);assert.deepEqual(writes,[]);
 await page.reload();await page.locator('[data-diagnostic-id=pages]').waitFor();assert.equal(await page.locator('[data-diagnostic-status=fail]').count(),0);
 await page.evaluate(async()=>{const l=await import('./js/workbench-store.js'),r=await l.meta('application-diagnostic-v1');r.rows[0].route='scan';r.rows[0].linkLabel='<img src=x onerror="window.diagnosticInjected=true">';await l.setMeta('application-diagnostic-v1',r);});
 await page.reload();await page.locator('[data-diagnostic-id=storage]').waitFor();assert.equal(await page.locator('[data-diagnostic-results] img').count(),0);assert.equal(await page.evaluate(()=>window.diagnosticInjected),undefined);
 await page.evaluate(async()=>{const l=await import('./js/workbench-store.js');await l.setMeta('application-diagnostic-v1',{schema:1,version:'1.15.1',at:'invalid',rows:[]});});await page.reload();await page.getByText('Aucun contrôle enregistré pour cette session. Lancez une vérification.',{exact:true}).waitFor();await run();assert.equal(await page.locator('[data-diagnostic-status=fail]').count(),0);
 console.log('OK diagnostic accessible, tests réels de formats, rapport relu, brouillon/annulation/données préservés et aucune écriture réseau');

 // Exact lookup cache must follow edits, aliases, ambiguity and logical deletion.
 const index=await page.evaluate(async()=>{const s=await import('./js/storage.js'),m=await import('./js/model.js');await s.save('products',{id:'index-test',sku:'DIAG-001',articleCode:'DIAG-ALIAS',name:'Index test'});const first=m.findProducts('DIAG-ALIAS').length;await s.save('products',{id:'index-test',sku:'DIAG-002',name:'Index modifié'});const old=m.findProducts('DIAG-ALIAS').length,now=m.findProducts('DIAG-002').length;await s.save('products',{id:'index-test',deleted:true});return {first,old,now,deleted:m.findProducts('DIAG-002').length};});assert.deepEqual(index,{first:1,old:0,now:1,deleted:0});
 await go('diagnostic');
 await page.evaluate(()=>{window.originalBarcode=window.JsBarcode;window.JsBarcode=undefined;});await run();assert.equal(await page.locator('[data-diagnostic-id=documents]').getAttribute('data-diagnostic-status'),'fail');assert.equal(await page.locator('[data-diagnostic-id=delivery]').getAttribute('data-diagnostic-status'),'manual');await page.evaluate(()=>window.JsBarcode=window.originalBarcode);
 const removed=await page.evaluate(async()=>{const channel=new MessageChannel(),info=await new Promise(resolve=>{channel.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage({type:'PIKEO_DIAGNOSTIC'},[channel.port2]);}),cache=await caches.open(info.shellCache),url=new URL('js/navigation.js',document.baseURI).href,r=await cache.match(url);window.removedDiagnosticAsset={cache:info.shellCache,url,response:r};await cache.delete(url);return !!r;});assert.ok(removed);await run();assert.equal(await page.locator('[data-diagnostic-id=cache]').getAttribute('data-diagnostic-status'),'fail');
 await page.evaluate(async()=>{const r=window.removedDiagnosticAsset;await(await caches.open(r.cache)).put(r.url,r.response);});
 console.log('OK défauts injectés signalés en échec, contrôles suivants poursuivis et index actualisé après modification/suppression');

 await page.locator('[data-action=cache-ocr]').click();await page.getByText('La lecture des photos est prête hors ligne.',{exact:true}).waitFor({timeout:120000});
 const assets=await page.evaluate(async()=>{const {OCR_ASSETS,redundantOCRAsset}=await import('./js/offline-core.js'),cache=await caches.open('ek-large-assets-v1'),keys=(await cache.keys()).map(r=>r.url);return {missing:OCR_ASSETS.filter(p=>!keys.includes(new URL(p,document.baseURI).href)),redundant:keys.filter(u=>redundantOCRAsset(new URL(u).pathname.slice(1)))};});assert.deepEqual(assets,{missing:[],redundant:[]});
 await context.setOffline(true);await page.reload();await page.locator('[data-wb-action=diagnostic]').waitFor();await run();assert.equal(await page.locator('[data-diagnostic-status=fail]').count(),0);assert.equal(await page.locator('[data-diagnostic-id=cache]').getAttribute('data-diagnostic-status'),'pass');
 const checkedAt=await page.evaluate(async()=>(await(await import('./js/workbench-store.js')).meta('application-diagnostic-v1')).at);
 await page.locator('[data-wb-action=diagnostic-ocr]').click();await finish();assert.equal(await page.locator('[data-diagnostic-id=ocr-live]').getAttribute('data-diagnostic-status'),'pass');
 const photoReport=await page.evaluate(async()=>(await import('./js/workbench-store.js')).meta('application-diagnostic-v1'));assert.equal(photoReport.at,checkedAt);assert.ok(photoReport.photoAt>=checkedAt);
 const fallback=await page.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=160;const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,1000,160);c.fillStyle='black';c.font='bold 64px Arial';c.fillText('REFERENCE 001234',30,100);const absolute=p=>new URL(p,document.baseURI).href;const worker=await Tesseract.createWorker(['fra','eng'],1,{workerPath:absolute('vendor/ocr/worker.min.js'),corePath:absolute('vendor/ocr/core/tesseract-core-lstm.wasm.js'),langPath:absolute('vendor/ocr/lang'),workerBlobURL:false,gzip:true});try{return (await worker.recognize(canvas)).data.text;}finally{await worker.terminate();}});assert.match(fallback,/001234/);
 console.log('OK contrôle et OCR réellement hors ligne ; lecture avec moteur sélectionné automatiquement et moteur sans SIMD ; huit ressources préparées');

 await page.evaluate(async()=>{const identity=await import('./js/identity-context.js'),s=await import('./js/storage.js'),w=await import('./js/workbench.js');identity.setIdentity({scope:'user-diagnostic-test',name:'Opérateur fictif',role:'operator'});await s.openStore(false);await w.open(false);});
 await page.locator('[data-nav=more]').first().click();await page.locator('#tools-search').fill('diagnostic');await page.locator('[data-nav=diagnostic]').first().click();assert.equal(await page.locator('[data-diagnostic-id]').count(),0);
 await page.evaluate(async()=>{const identity=await import('./js/identity-context.js'),s=await import('./js/storage.js'),w=await import('./js/workbench.js');identity.setIdentity(null);await s.openStore(false);await w.open(false);});
 await page.locator('[data-nav=more]').first().click();await page.locator('#tools-search').fill('diagnostic');await page.locator('[data-nav=diagnostic]').first().click();await page.locator('[data-diagnostic-id=ocr-live]').waitFor();
 for(const theme of ['light','dark'])for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.evaluate(async theme=>{const s=await import('./js/storage.js');await s.save('preferences',{...s.settings(),id:'main',theme});},theme);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const audit=await page.evaluate(auditContrast);assert.deepEqual(audit.failures,[],'Contraste diagnostic '+theme+' '+width);
 }
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/diagnostic-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('OK bilan séparé entre sessions et diagnostic lisible à 320/390 px en clair/sombre, sans erreur JavaScript');
}catch(error){await mkdir('test-results',{recursive:true});await page?.screenshot({path:'test-results/diagnostic-failure.png',fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw error;}finally{await browser?.close();server.kill();}
