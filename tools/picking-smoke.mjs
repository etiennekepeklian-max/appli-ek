import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {auditContrast} from './contrast-audit.mjs';
import {VERSION} from '../site/js/core.js';

const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',s=>{if(String(s).includes('http://')){clearTimeout(timer);resolve();}});server.on('error',reject);});
let browser,page;const errors=[],requests=[];
try{
  browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('ek-work-schedule-live',JSON.stringify({enabled:false})));
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto('http://localhost:8765/');await page.getByRole('button',{name:'Commencer',exact:true}).click();
  await page.locator('.simple-action-grid [data-action=new-order]').click();await page.locator('[data-form=picking-day]').waitFor();
  assert.equal(await page.locator('#dialog').getAttribute('open'),null);assert.equal(await page.locator('[data-day-action=camera],#batch-gallery').count(),0);
  const select=async date=>{await page.locator('#day-select').fill(date);await page.locator('#day-select').dispatchEvent('change');await page.waitForFunction(date=>document.querySelector('[data-form=picking-day] [name=date]')?.value===date,date);};
  const fill=async(name,value)=>page.locator('[data-form=picking-day] [name='+name+']').fill(value);
  const read=()=>page.evaluate(async()=>{const s=await import('./js/storage.js');return {days:s.list('days'),orders:s.list('orders'),events:s.getEvents('days'),draft:await s.meta('day-capture')};});
  const save=async total=>{await page.locator('[data-form=picking-day] [type=submit]').click();await page.waitForFunction(async({date,total})=>{const s=await import('./js/storage.js');return s.list('days').some(d=>d.date===date&&d.manualTotal===total);},{date:await page.locator('#day-select').inputValue(),total});await page.waitForFunction(()=>document.querySelector('[data-form=picking-day] [name=revision]')?.value);};
  await select('2026-10-26');await fill('manualTotal','1400');await page.locator('[data-form=picking-day] details').evaluate(d=>d.open=true);
  await fill('manualCommands','18');await fill('manualParcels','0');await fill('manualPallets','2');await fill('manualWeightKg','125,5');await fill('reason','Bilan manager fictif');
  await page.locator('[data-action=quickhelp]').first().click();assert.match(await page.locator('#help-dialog').innerText(),/Sauvegarder/);await page.getByRole('button',{name:'Reprendre',exact:true}).click();assert.equal(await page.locator('#picking-total').inputValue(),'1400');
  assert.equal((await read()).days.length,0);await save(1400);
  let saved=await read();assert.equal(saved.days.length,1);assert.equal(saved.days[0].manualWeightKg,125.5);assert.equal(saved.days[0].manualParcels,0);assert.equal(saved.orders.length,0);
  assert.equal((await page.locator('.picking-chart circle').count()),1);
  await page.reload();await page.locator('#app-version').filter({hasText:VERSION}).waitFor();await select('2026-10-26');assert.equal(await page.locator('#picking-total').inputValue(),'1400');
  await fill('manualTotal','1500');assert.equal((await read()).days[0].manualTotal,1400);
  await page.getByRole('button',{name:'14 j',exact:true}).click();assert.equal(await page.locator('#picking-total').inputValue(),'1500');assert.equal(await page.locator('[data-form=picking-day] [name=manualParcels]').inputValue(),'0');
  await save(1500);saved=await read();assert.equal(saved.days.length,1);assert.equal(saved.events.length,2);assert.equal(saved.days[0].manualCommands,18);
  await page.locator('[data-ops-action=quick-undo]').click();if(await page.getByRole('button',{name:'Confirmer l’annulation',exact:true}).count())await page.getByRole('button',{name:'Confirmer l’annulation',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#picking-total')?.value==='1400');
  console.log('OK saisie manuelle, sauvegarde explicite, aide, rechargement, correction de la même date et annulation avec historique');
  await select('2026-10-27');assert.equal(await page.locator('#picking-total').inputValue(),'');await fill('manualTotal','0');await save(0);
  assert.equal(await page.locator('[data-picking-summary=total]').innerText(),'1 400');assert.equal(await page.locator('[data-picking-summary=average]').innerText(),'700');
  await page.locator('#picking-metric').selectOption('commands');assert.equal(await page.locator('[data-picking-summary=average]').innerText(),'18');
  await page.locator('#picking-metric').selectOption('parcels');assert.equal(await page.locator('[data-picking-summary=total]').innerText(),'0');
  assert.equal((await read()).days.find(d=>d.date==='2026-10-27').manualCommands,null);
  await page.getByRole('button',{name:'Modifier la journée du 26 octobre',exact:true}).click();assert.equal(await page.locator('#day-select').inputValue(),'2026-10-26');assert.equal(await page.locator('#picking-total').inputValue(),'1400');
  // Dates remain independent even when another date has unsaved input.
  await fill('manualTotal','999');await select('2026-10-27');assert.equal(await page.locator('#picking-total').inputValue(),'0');await select('2026-10-26');assert.equal(await page.locator('#picking-total').inputValue(),'1400');
  console.log('OK zéros distincts des valeurs absentes, cinq indicateurs, moyenne sur jours renseignés et modification depuis l’historique');
  // Old orders and photo drafts stay intact; manual totals take precedence.
  await page.evaluate(async()=>{const s=await import('./js/storage.js');await s.save('orders',{id:'legacy-picking',number:'OLD',date:'2026-10-25',status:'completed',total:100,calculationStatus:'estimated'});await s.setMeta('day-capture',{date:'2026-10-25',pages:[{id:'unread',photoId:'legacy-photo'}],choices:{}});});
  await select('2026-10-25');assert.equal(await page.locator('#picking-total').inputValue(),'100');assert.equal(await page.locator('[data-day-action=resume],.draft-banner').count(),0);await fill('manualTotal','1700');await save(1700);assert.equal((await read()).orders[0].total,100);assert.equal((await read()).draft.pages.length,1);
  const stale=await page.evaluate(async()=>{const s=await import('./js/storage.js'),f=document.querySelector('[data-form=picking-day]'),input=Object.fromEntries(new FormData(f));await s.savePickingDay({...input,manualTotal:'1800'});try{await s.savePickingDay({...input,manualTotal:'1900'});return false;}catch{return true;}});assert.equal(stale,true);await select('2026-10-25');assert.equal(await page.locator('#picking-total').inputValue(),'1800');
  const wrongSession=await page.evaluate(async()=>{const s=await import('./js/storage.js');try{await s.savePickingDay({date:'2026-10-25',manualTotal:1,scope:'wrong'});return false;}catch{return true;}});assert.equal(wrongSession,true);
  await page.getByText('Gérer cette journée',{exact:true}).click();await page.getByRole('button',{name:'Modifier la date',exact:true}).click();await page.locator('#day-new-date').fill('2026-10-24');await page.getByRole('button',{name:'Sauvegarder la date',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});assert.equal(await page.locator('#day-select').inputValue(),'2026-10-24');assert.equal((await read()).draft.date,'2026-10-24');
  await page.getByText('Gérer cette journée',{exact:true}).click();await page.getByRole('button',{name:'Supprimer cette journée',exact:true}).click();await page.getByRole('button',{name:'Conserver cette journée',exact:true}).click();assert.equal((await read()).days.find(d=>d.date==='2026-10-24').manualTotal,1800);
  await page.getByRole('button',{name:'Supprimer cette journée',exact:true}).click();await page.locator('[data-day-form=restart] [name=confirmed]').check();await page.getByRole('button',{name:'Supprimer et recommencer',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});assert.equal(await page.locator('#picking-total').inputValue(),'');assert.equal((await read()).days.some(d=>d.date==='2026-10-26'),true);await fill('manualTotal','200');await save(200);
  console.log('OK anciens bilans et photos conservés, écrasement concurrent refusé, changement de date, suppression confirmée et recréation manuelle');
  await context.setOffline(true);await fill('manualTotal','250');await save(250);await context.setOffline(false);
  await select('2026-10-27');await page.locator('#picking-metric').selectOption('total');
  for(const theme of ['light','dark'])for(const width of [320,390]){
    await page.setViewportSize({width,height:844});await page.evaluate(async theme=>{const s=await import('./js/storage.js');await s.save('preferences',{...s.settings(),id:'main',theme});},theme);
    await page.getByRole('button',{name:'90 j',exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual((await page.evaluate(auditContrast)).failures,[],theme+' '+width);
  }
  await page.getByRole('button',{name:'7 j',exact:true}).click();assert.equal(await page.locator('.picking-chart circle').count(),3);assert.equal(await page.locator('[data-picking-summary=total]').innerText(),'1 650');
  await mkdir('test-results',{recursive:true});await page.locator('.chart-section').screenshot({path:'test-results/picking-chart-dark.png'});await page.screenshot({path:'test-results/picking-mobile-dark.png',fullPage:true});
  assert.equal(requests.some(url=>/vendor\/ocr\//.test(url)),false);assert.deepEqual(errors,[]);
  console.log('OK fonctionnement hors ligne, mobile 320/390 clair/sombre, aucune ouverture OCR ni erreur JavaScript');
}catch(error){await mkdir('test-results',{recursive:true});await page?.screenshot({path:'test-results/picking-failure.png',fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw error;}
finally{await browser?.close();server.kill();}
