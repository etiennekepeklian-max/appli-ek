import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {auditContrast} from './contrast-audit.mjs';

const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',s=>{if(String(s).includes('http://')){clearTimeout(timer);resolve();}});server.on('error',reject);});
let browser,page;const errors=[],date='2026-10-26',newDate='2026-10-27';
try{
  browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>localStorage.setItem('ek-work-schedule-live',JSON.stringify({enabled:false})));
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8765/');await page.getByRole('button',{name:'Commencer',exact:true}).click();
  const initial=await page.evaluate(async date=>{
    const s=await import('./js/storage.js'),u=await import('./js/ui.js');
    const photo=await s.storeFile(new Blob(['photo fictive'],{type:'image/jpeg'}),'journee-fictive.jpg','day-photo');
    const draft={date,pages:[{id:'page',photoId:photo,text:'Lecture conservée',reviewed:true,sections:[{number:'000001234',lines:[{sku:'001234',quantity:12}]}]}],choices:{'000001234':'skip'}};
    await s.saveBatch([{type:'orders',record:{id:'move-order',date,number:'000001234',total:3,status:'completed',photoIds:[photo]}},{type:'days',record:{id:'day-2026-10-26',date,manualTotal:7,reason:'Total corrigé'}},{type:'orders',record:{id:'keep-other',date:'2026-10-25',number:'OTHER',total:11,status:'completed'}}]);
    await s.setMeta('day-capture',draft);u.state.date=date;await(await import('./js/day-capture.js')).openDay();return {draft,photo};
  },date);
  const dialog=()=>page.locator('#dialog');
  const close=()=>page.locator('#dialog .dialog-top [data-action=close-dialog]').click();
  const read=()=>page.evaluate(async()=>{const s=await import('./js/storage.js');return {draft:await s.meta('day-capture'),backlog:await s.meta('day-capture-backlog'),order:s.get('orders','move-order'),correction:s.get('days','day-2026-10-26'),other:s.get('orders','keep-other'),files:(await s.files()).length};});
  const change=async()=>{await dialog().getByRole('button',{name:'Modifier la date',exact:true}).click();await page.locator('#day-new-date').waitFor();await page.waitForFunction(()=>!document.querySelector('#day-new-date')?.disabled);};
  const save=()=>page.getByRole('button',{name:'Sauvegarder la date',exact:true}).click();
  await change();await page.locator('#day-new-date').fill(newDate);await close();assert.deepEqual((await read()).draft,initial.draft);
  await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});await change();await page.locator('#day-new-date').fill('2026-10-25');await save();await page.locator('[data-form-error]').filter({hasText:'Cette date contient déjà'}).waitFor();assert.equal((await read()).order.date,date);
  await page.locator('#day-new-date').fill(newDate);await page.getByRole('button',{name:'Aide pour cette action',exact:true}).click();assert.match(await page.locator('#help-dialog').innerText(),/Sauvegarder la date/);await page.getByRole('button',{name:'Reprendre',exact:true}).click();assert.equal(await page.locator('#day-new-date').inputValue(),newDate);
  await save();await page.locator('#batch-date').waitFor();assert.equal(await page.locator('#batch-date').inputValue(),newDate);
  const moved=await read();assert.deepEqual(moved.draft,{...initial.draft,date:newDate});assert.equal(moved.order.date,newDate);assert.equal(moved.correction.date,newDate);assert.equal(moved.correction.manualTotal,7);assert.equal(moved.other.date,'2026-10-25');assert.equal(moved.files,1);
  await close();await page.reload();await page.locator('.draft-banner').waitFor();await page.locator('.draft-banner [data-day-action=resume]').click();assert.deepEqual((await read()).draft,{...initial.draft,date:newDate});
  console.log('OK date changée après sauvegarde seulement : photos/corrections/commandes déplacées ensemble, aide et rechargement, date occupée refusée');
  // Deleting a saved day resets its draft and balance. Cancel remains harmless.
  await dialog().getByRole('button',{name:'Supprimer cette journée',exact:true}).click();await page.locator('[data-day-form=restart]').waitFor();await page.getByRole('button',{name:'Conserver cette journée',exact:true}).click();assert.notEqual((await read()).order.deleted,true);
  await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});
  const remove=async()=>{await dialog().getByRole('button',{name:'Supprimer cette journée',exact:true}).click();await page.locator('[data-day-form=restart] [name=confirmed]').check();await page.getByRole('button',{name:'Supprimer et recommencer',exact:true}).click();await page.locator('#batch-date').waitFor();};
  await remove();const removed=await read();assert.equal(removed.order.deleted,true);assert.equal(removed.correction.deleted,true);assert.deepEqual(removed.draft,{date:newDate,pages:[],choices:{}});assert.equal(removed.other.deleted,undefined);assert.equal(removed.files,1);
  await close();await page.locator('[data-ops-action=quick-undo]').click();await page.getByRole('button',{name:'Confirmer l’annulation',exact:true}).click();await dialog().waitFor({state:'hidden'});assert.deepEqual((await read()).draft,moved.draft);assert.notEqual((await read()).order.deleted,true);
  console.log('OK suppression confirmée d’une journée validée, recréation vide et annulation inverse ; autres dates et fichiers conservés');
  // A photo-only day uses the same atomic undo mechanism without inventing orders.
  await page.evaluate(async photoId=>{const s=await import('./js/storage.js');await s.setMeta('day-capture-backlog',{'2026-10-28':{date:'2026-10-28',pages:[{id:'keep-photo',photoId}],choices:{}}});await s.setMeta('day-capture',{date:'2026-10-29',pages:[{id:'unread',photoId}],choices:{}});await(await import('./js/day-capture.js')).openDay();},initial.photo);
  const photoOnly=(await read()).draft;await remove();assert.deepEqual((await read()).draft,{date:'2026-10-29',pages:[],choices:{}});await close();
  await page.locator('[data-ops-action=quick-undo]').click();await page.getByRole('button',{name:'Confirmer l’annulation',exact:true}).click();await dialog().waitFor({state:'hidden'});assert.deepEqual((await read()).draft,photoOnly);assert.equal((await read()).backlog['2026-10-28'].pages[0].id,'keep-photo');
  await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});await change();await page.locator('#day-new-date').fill('2026-10-30');await save();await page.locator('#batch-date').waitFor();assert.deepEqual((await read()).draft,{...photoOnly,date:'2026-10-30'});
  const guards=await page.evaluate(async()=>{
    const s=await import('./js/storage.js'),c=await import('./js/day-core.js');const info=await s.undoInfo();const current=await s.meta('day-capture');await s.setMeta('day-capture',{...current,pages:[...current.pages,{id:'new-after-move'}]});
    let undoRefused=false;try{await s.undoLast(info.id);}catch{undoRefused=true;}
    const p=c.restartDayPlan(current.date,s.list('orders'),s.list('days'),await s.meta('day-capture'),await s.meta('day-capture-backlog'));
    await s.setMeta('day-capture',{...current,pages:[...current.pages,{id:'concurrent'}]});let moveRefused=false;try{await s.moveDay(current.date,'2026-10-31',p.signature,s.scope());}catch{moveRefused=true;}
    return {undoRefused,moveRefused,current:await s.meta('day-capture')};
  });assert.equal(guards.undoRefused,true);assert.equal(guards.moveRefused,true);assert.equal(guards.current.date,'2026-10-30');assert.equal(guards.current.pages[1].id,'concurrent');
  console.log('OK journée sans analyse supprimable, annulable et déplaçable ; nouvelles photos et modifications concurrentes protégées');
  await close();await page.evaluate(async()=>{const u=await import('./js/ui.js');u.state.date='2026-10-25';location.hash='orders';});await page.waitForFunction(()=>document.querySelector('#main')?.dataset.view==='orders');
  await page.locator('#day-select').fill('2026-10-25');await page.locator('#day-select').dispatchEvent('change');await page.locator('#main [data-day-action=change-date]').click();await page.locator('#day-new-date').fill('2026-10-24');await save();await dialog().waitFor({state:'hidden'});assert.equal((await read()).other.date,'2026-10-24');assert.equal((await read()).draft.date,'2026-10-30');
  for(const theme of ['light','dark'])for(const width of [320,390]){
    await page.setViewportSize({width,height:844});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await page.locator('#main [data-day-action=change-date]').click();await page.locator('#day-new-date').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual((await page.evaluate(auditContrast)).failures,[],theme+' '+width);await close();
  }
  await page.evaluate(async()=>{const s=await import('./js/storage.js'),u=await import('./js/ui.js');await s.setMeta('day-capture',null);u.state.date='2026-10-24';await(await import('./js/day-capture.js')).openDay();});
  await change();await page.locator('#day-new-date').fill('2026-10-23');await save();await page.locator('#batch-date').waitFor();assert.equal(await page.locator('#batch-date').inputValue(),'2026-10-23');await close();
  await page.locator('[data-ops-action=quick-undo]').click();await page.locator('#undo-bar').waitFor({state:'hidden'});assert.equal((await read()).other.date,'2026-10-24');assert.equal((await read()).draft,null);
  await page.locator('#day-select').fill(date);await page.locator('#day-select').dispatchEvent('change');await page.getByRole('button',{name:'Corriger le total du jour',exact:true}).click();
  await page.locator('[data-form=day-correction] [name=manualTotal]').fill('9');await page.locator('[data-form=day-correction] [name=reason]').fill('Nouveau total de la date d’origine');await page.locator('[data-form=day-correction] [type=submit]').click();await dialog().waitFor({state:'hidden'});
  const recreated=await page.evaluate(async({date,newDate})=>{const s=await import('./js/storage.js');return {old:s.list('days').find(d=>d.date===date),moved:s.list('days').find(d=>d.date===newDate)};},{date,newDate});
  assert.equal(recreated.old.manualTotal,9);assert.equal(recreated.moved.manualTotal,7);assert.notEqual(recreated.old.id,recreated.moved.id);
  console.log('OK recréer un total à l’ancienne date ne remplace pas le bilan déplacé, y compris avec les identifiants historiques');
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/day-management-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log('OK déplacement depuis Ma journée sans toucher à la session active ; clair/sombre mobile 320/390 px');
}catch(error){await mkdir('test-results',{recursive:true});await page?.screenshot({path:'test-results/day-management-failure.png',fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw error;}
finally{await browser?.close();server.kill();}
