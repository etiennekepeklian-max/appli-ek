import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {auditContrast} from './contrast-audit.mjs';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',s=>{if(String(s).includes('http://')){clearTimeout(timer);resolve();}});});
let browser,page;const errors=[],base='http://localhost:8765/';
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'Commencer',exact:true}).click();
 const pictures=await page.evaluate(()=>{
  const result=[];
  for(const angle of [0,90,180,270]){
   const source=document.createElement('canvas');source.width=1200;source.height=1600;const c=source.getContext('2d');c.fillStyle='white';c.fillRect(0,0,1200,1600);c.fillStyle='black';c.font='bold 30px Arial';
   c.fillText('BON DE PREPARATION N° 000067890',55,85);c.font='24px Arial';c.fillText('MAGASIN DE TEST',55,145);c.fillText('Réf Commande client : CLIENT-TEST',55,195);
   c.fillText(angle===0?'Commande : 000009123 /001':'N° Enregistrement : 000009123001',55,280);c.fillText('Page '+(angle/90+1)+'/4',950,280);
   const cols=[55,310,480,720];['Adresse','Quantité','Article','Désignation Article'].forEach((text,i)=>c.fillText(text,cols[i],360));
   for(let i=0;i<5;i++)['PAC A0'+i,'12','00123'+i,'Carte de test'].forEach((text,j)=>c.fillText(text,cols[j],420+i*65));
   c.strokeStyle='#777';c.lineWidth=3;c.beginPath();c.moveTo(1150,260);c.lineTo(800,750);c.stroke();
   const out=document.createElement('canvas'),turned=angle===90||angle===270;out.width=turned?1600:1200;out.height=turned?1200:1600;const d=out.getContext('2d');d.translate(out.width/2,out.height/2);d.rotate(angle*Math.PI/180);d.drawImage(source,-600,-800);result.push(out.toDataURL('image/png').split(',')[1]);
  }return result;
 });
 const read=[];
 for(const picture of pictures){
  const result=await page.evaluate(async encoded=>{const blob=new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:'image/png'}),{recognizePhoto}=await import('./js/features.js'),{parseDayPage}=await import('./js/day-core.js');return parseDayPage(await recognizePhoto(blob,()=>{},{table:true,order:true}));},picture);
  assert.equal(result.length,1);assert.equal(result[0].number,'000009123');assert.equal(result[0].lines.length,5);assert.ok(result[0].lines.every(l=>l.quantity===12));read.push(result);
 }
 const grouped=await page.evaluate(async read=>{const {buildDayPlan}=await import('./js/day-core.js');return buildDayPlan(read.map((sections,i)=>({id:'test-'+i,hash:'test-'+i,sections,reviewed:true})),[],'2026-01-05',()=>({unitsPerPick:4}));},read);assert.equal(grouped.orders.length,1);assert.equal(grouped.orders[0].estimate.total,60);assert.equal(grouped.orders[0].incomplete,undefined);
 const compatible=await page.evaluate(async encoded=>{const previous=window.createImageBitmap;window.createImageBitmap=undefined;try{const blob=new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:'image/png'}),{recognizePhoto}=await import('./js/features.js'),{parseDayPage}=await import('./js/day-core.js');return parseDayPage(await recognizePhoto(blob,()=>{},{table:true,order:true}))[0].number;}finally{window.createImageBitmap=previous;}},pictures[0]);assert.equal(compatible,'000009123');
 console.log('OK OCR réel : quatre orientations, commande/enregistrement, cinq lignes par page, regroupement sans numéro de bon ni référence client');
 await context.close();

 const retry=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true});await retry.addInitScript(()=>{window.retryCalls=0;window.retryGate=new Promise(resolve=>window.releaseRetry=resolve);});
 await retry.route('**/vendor/ocr/tesseract.min.js',route=>route.fulfill({contentType:'text/javascript',body:"window.Tesseract={createWorker:async()=>({recognize:async()=>{window.retryCalls++;await window.retryGate;return {data:{text:'N° Enregistrement : 000009123001\\nPage 1/1\\nAdresse;Quantité;Article;Désignation\\nPAC A01;12;001234;Carte'}};}})};"}));
 page=await retry.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.getByRole('button',{name:'Commencer',exact:true}).click();
 const initial=await page.evaluate(async picture=>{const s=await import('./js/storage.js'),{parseDayPage}=await import('./js/day-core.js');const id=await s.storeFile(new Blob([Uint8Array.from(atob(picture),c=>c.charCodeAt(0))],{type:'image/png'}),'test.png','day-photo');const pages=[...Array.from({length:3},(_,i)=>({id:'retry-'+i,photoId:id,hash:'retry-'+i,text:'Texte ancien illisible',sections:[{number:'',lines:[]}],reviewed:false})),{id:'manual',photoId:id,hash:'manual',text:'Ancienne lecture à conserver',sections:[{number:'MANUAL001',lines:[{sku:'MANUAL-SKU',quantity:7}]}],reviewed:true},{id:'known',photoId:id,hash:'known',text:'Commande KEEP001\nReference;Quantite\nKEEP-SKU;4',sections:parseDayPage('Commande KEEP001\nReference;Quantite\nKEEP-SKU;4'),reviewed:false}];await s.setMeta('day-capture',{date:'2026-01-05',pages,choices:{}});return {file:id,manual:pages[3],fileCount:(await s.files()).length};},pictures[0]);
 await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});await page.locator('[data-day-action=retry]').click();await page.waitForFunction(()=>window.retryCalls===1);
 await page.locator('[data-day-action=background]').click();await page.waitForFunction(()=>document.querySelector('#main')?.dataset.view==='orders');await page.evaluate(()=>window.releaseRetry());
 await page.waitForFunction(async()=>{const s=await import('./js/storage.js'),draft=await s.meta('day-capture');return draft.pages.slice(0,3).every(p=>p.sections?.[0]?.number==='000009123');},{},{timeout:60000});
 await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});await page.waitForFunction(()=>!document.querySelector('[data-day-action=analyse]')?.disabled);
 const result=await page.evaluate(async()=>{const s=await import('./js/storage.js'),d=await s.meta('day-capture');return {pages:d.pages,files:(await s.files()).length,events:s.list('orders').length,calls:window.retryCalls};});assert.equal(result.calls,3);assert.equal(result.files,initial.fileCount);assert.deepEqual(result.pages[3],initial.manual);assert.equal(result.pages[4].sections[0].number,'KEEP001');assert.equal(result.events,0);assert.ok(result.pages.every(p=>p.photoId===initial.file));
 assert.equal(await page.locator('[data-day-action=retry]').count(),0);
 await retry.addInitScript(()=>{window.retryGate=Promise.resolve();});
 const protectedPages=await page.evaluate(async()=>{const s=await import('./js/storage.js'),draft=await s.meta('day-capture');const excluded={...structuredClone(draft.pages[4]),id:'excluded',hash:'excluded',excluded:true};draft.pages.push(excluded);await s.setMeta('day-capture',draft);return {manual:draft.pages[3],excluded};});
 await page.reload();await page.locator('#main[data-view]').waitFor();await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});
 const relaunch=page.getByRole('button',{name:'Relancer l’analyse des photos',exact:true});await relaunch.waitFor();
 assert.ok(await relaunch.evaluate(el=>el.getBoundingClientRect().top<document.querySelector('[data-day-action=camera]').getBoundingClientRect().top));
 await relaunch.click();await page.locator('#batch-progress').filter({hasText:'Analyse terminée : 4 photo(s) relue(s), 0 échec(s).'}).waitFor();
 const allRead=await page.evaluate(async()=>{const s=await import('./js/storage.js');return {draft:await s.meta('day-capture'),files:(await s.files()).length,orders:s.list('orders').length,calls:window.retryCalls};});
 assert.equal(allRead.calls,4);assert.equal(allRead.files,initial.fileCount);assert.equal(allRead.orders,0);assert.equal(allRead.draft.pages.length,6);assert.deepEqual(allRead.draft.pages[3],protectedPages.manual);assert.deepEqual(allRead.draft.pages[5],protectedPages.excluded);assert.equal(allRead.draft.pages[4].sections[0].number,'000009123');
 await page.locator('[data-day-action=retry-page][data-id=known]').click();await page.locator('#batch-progress').filter({hasText:'Analyse terminée : 1 photo(s) relue(s), 0 échec(s).'}).waitFor();assert.equal(await page.evaluate(()=>window.retryCalls),5);
 // A failed retry must not let a later, shorter reading erase a better one.
 const stronger=await page.evaluate(async()=>{const s=await import('./js/storage.js'),{parseDayPage}=await import('./js/day-core.js'),draft=await s.meta('day-capture'),p=draft.pages[4];p.text='N° Enregistrement : 000009123001\nPage 1/1\nAdresse;Quantité;Article;Désignation\nPAC A01;12;001234;Carte\nPAC A02;8;005678;Carnet';p.sections=parseDayPage(p.text);p.error='Ancienne tentative échouée';await s.setMeta('day-capture',draft);return {text:p.text,sections:p.sections};});
 await page.reload();await page.locator('#main[data-view]').waitFor();await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});await page.locator('[data-day-action=retry-page][data-id=known]').click();await page.locator('#batch-progress').filter({hasText:'Analyse terminée : 1 photo(s) relue(s), 0 échec(s).'}).waitFor();
 const retained=await page.evaluate(async()=>{const s=await import('./js/storage.js');return (await s.meta('day-capture')).pages[4];});assert.equal(retained.text,stronger.text);assert.deepEqual(retained.sections,stronger.sections);assert.equal(retained.error,null);
 await page.reload();await page.locator('#main[data-view]').waitFor();await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});await page.locator('[data-day-action=reanalyse]').waitFor();
 await page.locator('#dialog .dialog-top [data-action=quickhelp]').click();assert.match(await page.locator('#help-dialog').innerText(),/Relire les pages non reconnues/);await page.getByRole('button',{name:'Reprendre',exact:true}).click();
 for(const theme of ['light','dark'])for(const width of [320,390]){await page.setViewportSize({width,height:844});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual((await page.evaluate(auditContrast)).failures,[]);}
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/order-retry-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('OK relance globale et par page, brouillon rechargé, corrections/exclusions/meilleures lectures/fichiers conservés, aucun doublon ni commande créée, navigation pendant OCR, aide et mobile clair/sombre');
}catch(error){await mkdir('test-results',{recursive:true});await page?.screenshot({path:'test-results/order-ocr-failure.png',fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw error;}finally{await browser?.close();server.kill();}
