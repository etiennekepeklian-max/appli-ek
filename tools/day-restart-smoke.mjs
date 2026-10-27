import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {auditContrast} from './contrast-audit.mjs';
import {waitForState} from './poll.mjs';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',d=>{if(String(d).includes('http://')){clearTimeout(t);resolve();}});server.on('error',reject);});
let browser,page;const errors=[],base='http://localhost:8765/',date='2026-10-26';
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'Commencer',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
 await page.evaluate(async date=>{
  const s=await import('./js/storage.js'),u=await import('./js/ui.js');u.state.date=date;
  const photo=await s.storeFile(new Blob(['synthetic image'],{type:'image/jpeg'}),'synthetic.jpg','day-photo');window.restartPhoto=photo;
  await s.saveBatch([{type:'products',record:{id:'restart-product',sku:'RESTART-SKU',name:'Article confirmé',familyId:'cartes',unitsPerPick:4,location:'PACA01',locations:['PACA01']}},
    {type:'orders',record:{id:'restart-a',number:'RESTART001',date,status:'completed',total:2,calculationStatus:'verified',lines:[],photoIds:[photo]}},
    {type:'orders',record:{id:'restart-b',number:'RESTART002',date,status:'completed',total:3,calculationStatus:'verified',lines:[]}},
    {type:'orders',record:{id:'restart-other',number:'RESTART-OTHER',date:'2026-10-25',status:'completed',total:9}},
    {type:'days',record:{id:'restart-correction',date,manualTotal:8,reason:'Exemple de test'}},
    {type:'pending',record:{id:'restart-pending',orderNumber:'RESTART001',sku:'RESTART-SKU',status:'waiting'}}]);
  await s.setMeta('day-capture',{date,pages:[{id:'old-draft',photoId:photo}],choices:{}});location.hash='orders';
 },date);
 await page.waitForFunction(()=>document.querySelector('#main')?.dataset.view==='orders');
 const restart=async()=>{await page.getByText('Gérer cette journée',{exact:true}).evaluate(el=>el.parentElement.open=true);await page.locator('#main [data-day-action=restart]').click();await page.locator('[data-day-form=restart]').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('[data-day-form=restart] [name=confirmed]')?.disabled===false);};
 const confirm=async()=>{await page.locator('[data-day-form=restart] [name=confirmed]').check();await page.locator('[data-day-form=restart] [type=submit]').click();await page.locator('#dialog').waitFor({state:'hidden'});await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});};
 const close=()=>page.locator('#dialog .dialog-top [data-action=close-dialog]').click();
 const undo=async()=>{await page.locator('[data-ops-action=quick-undo]').click();await page.getByRole('button',{name:'Confirmer l’annulation',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});};
 await restart();assert.match(await page.locator('#dialog-body').innerText(),/2 commande\(s\) · 8 picking/);
 await page.locator('[name=confirmed]').check();await page.getByRole('button',{name:'Aide pour cette action',exact:true}).click();assert.match(await page.locator('#help-dialog').innerText(),/Supprimer une journée/);await page.getByRole('button',{name:'Reprendre',exact:true}).click();assert.equal(await page.locator('[name=confirmed]').isChecked(),true);
 await confirm();assert.equal(await page.locator('.day-page').count(),0);
 const cancelled=await page.evaluate(async date=>{const s=await import('./js/storage.js');return {orders:s.list('orders').filter(o=>o.date===date).length,days:s.list('days').filter(o=>o.date===date).length,other:s.get('orders','restart-other').total,pending:s.get('pending','restart-pending').status,product:s.get('products','restart-product').location,photo:!!await s.readFile(window.restartPhoto),draft:await s.meta('day-capture')};},date);
 assert.deepEqual(cancelled,{orders:0,days:0,other:9,pending:'waiting',product:'PACA01',photo:true,draft:{date,pages:[],choices:{}}});
 await close();await undo();
 assert.equal(await page.evaluate(async()=>{const s=await import('./js/storage.js');return (await s.meta('day-capture')).pages[0].id;}),'old-draft');
 assert.equal(await page.evaluate(async()=>{const s=await import('./js/storage.js');return s.get('days','restart-correction').manualTotal;}),8);
 console.log('OK annulation de journée et correction atomiques, fichiers/catalogue/autres dates conservés ; annulation inverse avec brouillon restauré');
 await restart();await confirm();await close();
 await page.evaluate(async date=>{await(await import('./js/storage.js')).setMeta('day-capture',{date,pages:[{id:'fresh-photo'}],choices:{}});},date);await undo();
 assert.equal(await page.evaluate(async()=>(await(await import('./js/storage.js')).meta('day-capture')).pages[0].id),'fresh-photo');
 await restart();
 await page.evaluate(async()=>{const s=await import('./js/storage.js');await s.save('orders',{...s.get('orders','restart-a'),total:17},'Modification concurrente de test');});
 await page.locator('[name=confirmed]').check();await page.locator('[data-day-form=restart] [type=submit]').click();await page.getByText('La journée ou les photos ont changé. Relisez le récapitulatif avant de recommencer.',{exact:true}).waitFor();await close();
 assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).get('orders','restart-a').deleted),undefined);
 await page.evaluate(async()=>{await(await import('./js/storage.js')).setMeta('day-capture',{date:'2026-10-25',pages:[{id:'other-day-photo'}],choices:{}});});
 await restart();assert.equal(await page.locator('[data-day-form=restart] [type=submit]').isDisabled(),false);await confirm();await close();assert.equal(await page.evaluate(async()=>(await(await import('./js/storage.js')).meta('day-capture-backlog'))['2026-10-25'].pages[0].id),'other-day-photo');await undo();
 console.log('OK nouvelles photos préservées pendant annulation inverse, modification concurrente refusée et autre brouillon protégé');
 await page.evaluate(async date=>{await(await import('./js/storage.js')).setMeta('day-capture',{date,pages:[],choices:{}});},date);
 for(const theme of ['light','dark'])for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.evaluate(async theme=>{const s=await import('./js/storage.js');await s.save('preferences',{...s.settings(),id:'main',theme});},theme);await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await restart();const audit=await page.evaluate(auditContrast);assert.deepEqual(audit.failures,[],theme+' '+width);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await close();
 }
 await restart();await confirm();await close();
 await page.evaluate(async date=>{const s=await import('./js/storage.js'),core=await import('./js/day-core.js');const text='Commande RESTART001\nPage 1/1\nReference;Quantite preparee\nRESTART-SKU;8';await s.setMeta('day-capture',{date,pages:[{id:'rephoto',hash:'rephoto',photoId:window.restartPhoto,text,sections:core.parseDayPage(text),reviewed:true}],choices:{}});await(await import('./js/day-capture.js')).openDay();},date);
 await page.locator('[data-day-form=save] [name=confirmed]').check();await page.getByRole('button',{name:'Enregistrer toutes les commandes retenues',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
 await waitForState(page,async date=>{const s=await import('./js/storage.js');return s.list('orders').filter(o=>o.date===date).length===1;},date);
 const final=await page.evaluate(async date=>{const s=await import('./js/storage.js'),c=await import('./js/core.js');const stats=c.dailyStats(date,s.list('orders'),s.list('days'));return {total:stats.total,commands:stats.commands,correction:!!stats.correction,old:s.get('orders','restart-a').deleted,history:s.getEvents('orders','restart-a').length};},date);
 assert.deepEqual({...final,history:undefined},{total:2,commands:1,correction:false,old:true,history:undefined});assert.ok(final.history>1);
 const recovery=await page.evaluate(async date=>{
  const s=await import('./js/storage.js'),{restartDayPlan}=await import('./js/day-core.js'),active={date:'2026-10-27',pages:[{id:'today-to-keep',photoId:window.restartPhoto}],choices:{}};
  await s.setMeta('day-capture',active);const backlog=await s.meta('day-capture-backlog'),p=restartDayPlan(date,s.list('orders'),s.list('days'),active,backlog);
  await s.restartDay(date,p.signature,s.scope());const undo=await s.undoInfo();await s.setMeta('day-capture',{date,pages:[{id:'fresh-target-photo'}],choices:{}});await s.undoLast(undo.id);
  const snapshot=await s.snapshotData();await s.setMeta('day-capture-backlog',{});await s.restoreFilesAndDrafts(snapshot);
  return {current:(await s.meta('day-capture')).pages[0].id,other:(await s.meta('day-capture-backlog'))['2026-10-27'].pages[0].id};
 },date);assert.deepEqual(recovery,{current:'fresh-target-photo',other:'today-to-keep'});
 console.log('OK annulation après nouvelles photos : les deux journées restent conservées ; points de restauration multijournées compatibles');
 assert.deepEqual(errors,[]);console.log('OK photos refaites : ancien total non compté deux fois, historique conservé, clair/sombre 320/390 px');
}catch(error){await mkdir('test-results',{recursive:true});await page?.screenshot({path:'test-results/day-restart-failure.png',fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw error;}finally{await browser?.close();server.kill();}
