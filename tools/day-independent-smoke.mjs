import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {auditContrast} from './contrast-audit.mjs';

const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',s=>{if(String(s).includes('http://')){clearTimeout(timer);resolve();}});});
let browser,page;const errors=[];
try{
  browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{window.hangReads=true;window.ocrCalls=0;window.ocrWorkers=0;window.ocrTerminated=0;});
  await context.route('**/vendor/ocr/tesseract.min.js',route=>route.fulfill({contentType:'text/javascript',body:`window.Tesseract={createWorker:async()=>{
    window.ocrWorkers++;
    if(window.hangInit)await new Promise(resolve=>window.releaseInit=resolve);
    return {terminate:async()=>{window.ocrTerminated++;},recognize:async()=>{
      window.ocrCalls++;if(window.hangReads)await new Promise(()=>{});
      return {data:{text:'Commande : 000008888 /001\\nPage 1/1\\nAdresse;Quantité préparée;Article;Désignation\\nPAC A01;12;DAY-INDEPENDENT-SKU;Produit fictif'}};
    }};
  }};` }));
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8765/');await page.getByRole('button',{name:'Commencer',exact:true}).click();
  const initial=await page.evaluate(async()=>{
    const s=await import('./js/storage.js'),{localDate}=await import('./js/core.js'),canvas=document.createElement('canvas');canvas.width=160;canvas.height=220;canvas.getContext('2d').fillRect(0,0,160,220);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve)),photoId=await s.storeFile(blob,'hier-fictif.png','day-photo'),today=localDate(),d=new Date();d.setDate(d.getDate()-1);const yesterday=localDate(d);
    const draft={date:yesterday,pages:[{id:'yesterday-reviewed',photoId,text:'Texte déjà corrigé',reviewed:true,sections:[{number:'000001234',lines:[{sku:'OLD-TEST',quantity:8}]}]}],choices:{'000001234':'skip'}};
    await s.setMeta('day-capture',draft);await s.save('products',{id:'independent-product',sku:'DAY-INDEPENDENT-SKU',name:'Produit fictif',unitsPerPick:4},'Produit de test');
    await(await import('./js/day-capture.js')).openDay();
    return {today,yesterday,draft,picture:canvas.toDataURL('image/png').split(',')[1]};
  });
  const activeDate=date=>page.waitForFunction(async date=>(await(await import('./js/storage.js')).meta('day-capture'))?.date===date&&!document.querySelector('[data-day-action=camera]')?.disabled,date);
  await page.locator('#dialog').getByRole('button',{name:'Photographier aujourd’hui',exact:true}).click();await activeDate(initial.today);
  assert.deepEqual(await page.evaluate(async date=>(await(await import('./js/storage.js')).meta('day-capture-backlog'))[date],initial.yesterday),initial.draft);
  await page.locator('#batch-gallery').setInputFiles({name:'aujourdhui-fictif.png',mimeType:'image/png',buffer:Buffer.from(initial.picture,'base64')});
  await page.waitForFunction(async()=>(await(await import('./js/storage.js')).meta('day-capture'))?.pages.length===1&&!document.querySelector('[data-day-action=analyse]')?.disabled);
  assert.equal(await page.evaluate(()=>window.ocrCalls),0);
  const todayPhoto=await page.evaluate(async()=>(await(await import('./js/storage.js')).meta('day-capture')).pages[0].photoId);
  await page.getByRole('button',{name:'Terminer les photos et analyser',exact:true}).click();await page.waitForFunction(()=>window.ocrCalls===1);
  assert.equal(await page.locator('#dialog').getByRole('button',{name:'Mettre l’analyse en pause',exact:true}).isEnabled(),true);
  // Changing dates interrupts the running read, rather than redating its photos.
  await page.locator('#batch-date').fill(initial.yesterday);await page.locator('#batch-date').dispatchEvent('change');await activeDate(initial.yesterday);
  assert.deepEqual(await page.evaluate(async()=>(await(await import('./js/storage.js')).meta('day-capture'))),initial.draft);
  assert.equal(await page.evaluate(()=>window.ocrTerminated),1);
  assert.equal(await page.evaluate(async date=>(await(await import('./js/storage.js')).meta('day-capture-backlog'))[date].pages[0].photoId,initial.today),todayPhoto);
  await page.locator('#batch-date').fill(initial.today);await page.locator('#batch-date').dispatchEvent('change');await activeDate(initial.today);
  await page.getByRole('button',{name:'Terminer les photos et analyser',exact:true}).click();await page.waitForFunction(()=>window.ocrCalls===2);
  await page.locator('#dialog').getByRole('button',{name:'Mettre l’analyse en pause',exact:true}).click();await page.locator('#batch-progress').filter({hasText:'Analyse mise en pause'}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('[data-day-action=analyse]').disabled);
  assert.equal(await page.evaluate(()=>window.ocrTerminated),2);
  await page.evaluate(()=>{window.hangReads=false;});
  await page.getByRole('button',{name:'Terminer les photos et analyser',exact:true}).click();await page.locator('#batch-progress').filter({hasText:'Analyse terminée : 1 photo(s) relue(s), 0 échec(s).'}).waitFor();
  assert.equal(await page.evaluate(()=>window.ocrWorkers),3);
  const reading=await page.evaluate(async()=>(await(await import('./js/storage.js')).meta('day-capture')).pages[0]);
  assert.equal(reading.photoId,todayPhoto);assert.equal(reading.sections[0].number,'000008888');assert.equal(reading.sections[0].lines[0].quantity,12);
  if(await page.locator('[data-day-action=edit]').count()){
    await page.locator('[data-day-action=edit]').first().click();await page.locator('[name=reviewed]').check();await page.getByRole('button',{name:'Valider cette page',exact:true}).click();
  }
  await page.locator('[data-day-form=save] [name=confirmed]').check();await page.getByRole('button',{name:'Enregistrer toutes les commandes retenues',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
  const saved=await page.evaluate(async()=>{const s=await import('./js/storage.js');return {draft:await s.meta('day-capture'),waiting:await s.dayDrafts(),orders:s.list('orders'),files:(await s.files()).length};});
  assert.equal(saved.draft,null);assert.deepEqual(saved.waiting,[initial.draft]);assert.equal(saved.orders.length,1);assert.equal(saved.orders[0].date,initial.today);assert.equal(saved.orders[0].total,3);assert.equal(saved.files,2);
  await page.reload();await page.locator('#main[data-view]').waitFor();assert.equal(await page.locator('[data-day-action=resume]').count(),0);await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});
  await page.locator('#batch-date').fill(initial.yesterday);await page.locator('#batch-date').dispatchEvent('change');await activeDate(initial.yesterday);
  assert.deepEqual(await page.evaluate(async()=>(await(await import('./js/storage.js')).meta('day-capture'))),initial.draft);
  await page.getByRole('button',{name:'Aide pour cette action',exact:true}).click();assert.match(await page.locator('#help-dialog').innerText(),/Journées indépendantes/);await page.getByRole('button',{name:'Reprendre',exact:true}).click();
  console.log('OK journées indépendantes, changement de date pendant OCR, pause/reprise, validation d’aujourd’hui avant hier, rechargement et aide sans perte de photos ni corrections');
  // Use a shortened deadline to exercise the production timeout and worker reset.
  await page.evaluate(()=>{window.hangReads=true;});
  const deadline=await page.evaluate(async picture=>{
    const blob=new Blob([Uint8Array.from(atob(picture),c=>c.charCodeAt(0))],{type:'image/png'}),{recognizePhoto}=await import('./js/features.js');
    try{await recognizePhoto(blob,()=>{},{order:true,timeoutMs:150});return 'unexpected';}catch(error){return error.code;}
  },initial.picture);
  assert.equal(deadline,'OCR_TIMEOUT');
  await page.evaluate(()=>{window.hangReads=false;window.hangInit=true;});
  const lateInit=await page.evaluate(async picture=>{
    const blob=new Blob([Uint8Array.from(atob(picture),c=>c.charCodeAt(0))],{type:'image/png'}),{recognizePhoto}=await import('./js/features.js');
    try{await recognizePhoto(blob,()=>{},{order:true,timeoutMs:150});return 'unexpected';}catch(error){return error.code;}
  },initial.picture);assert.equal(lateInit,'OCR_TIMEOUT');
  const terminated=await page.evaluate(()=>{window.hangInit=false;return window.ocrTerminated;});
  await page.evaluate(()=>window.releaseInit());await page.waitForFunction(n=>window.ocrTerminated===n+1,terminated);
  const recovered=await page.evaluate(async picture=>{const blob=new Blob([Uint8Array.from(atob(picture),c=>c.charCodeAt(0))],{type:'image/png'});return(await import('./js/features.js')).recognizePhoto(blob,()=>{},{order:true});},initial.picture);
  assert.match(recovered,/000008888/);
  console.log('OK délai dépassé, moteur recréé, initialisation tardive libérée et nouvelle lecture possible');
  for(const theme of ['light','dark'])for(const width of [320,390]){
    await page.setViewportSize({width,height:844});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual((await page.evaluate(auditContrast)).failures,[],theme+' '+width);
  }
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/day-independent-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
}catch(error){await mkdir('test-results',{recursive:true});await page?.screenshot({path:'test-results/day-independent-failure.png',fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw error;}
finally{await browser?.close();server.kill();}
