import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {VERSION} from '../site/js/core.js';
import {TOOLS} from '../site/js/navigation-core.js';
import {auditContrast} from './contrast-audit.mjs';
import {waitForState} from './poll.mjs';

// Isolated browser and synthetic records. No real session, account or Google write.
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>reject(Error('Serveur indisponible.')),15000);
 server.stdout.on('data',data=>{if(String(data).includes('http://')){clearTimeout(timer);resolve();}});
 server.on('error',reject);
});
const base='http://localhost:8765/',errors=[];
let browser,page;
try{
 await mkdir('test-results',{recursive:true});
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const go=async route=>{await page.goto(base+'#'+route);await page.locator('#app-version').filter({hasText:VERSION}).waitFor();await page.waitForFunction(route=>document.querySelector('#main')?.dataset.view===route,route);};
 const close=async()=>{await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();await page.locator('#dialog').waitFor({state:'hidden'});};
 const homeButton=id=>page.locator(`.simple-action-grid [data-nav="${id}"],.simple-action-grid [data-action="${id}"]`);
 await go('home');await page.getByRole('button',{name:'Commencer',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
 assert.deepEqual(await page.locator('.simple-action-grid button').evaluateAll(rows=>rows.map(r=>r.dataset.nav||r.dataset.action)),['scan','new-pending','enfs','codes','stock','new-order']);
 await page.evaluate(async()=>{
  const s=await import('./js/storage.js');
  await s.saveBatch([
   {type:'products',record:{id:'simple-product',sku:'UI-REF-001',name:'Produit synthétique',location:'PAC001-A'}},
   {type:'enfs',record:{id:'simple-enf',code:'UI-CONCEPT',name:'ENF synthétique',lines:[{role:'meuble',sku:'UI-MEUBLE',quantity:1},{role:'mere',sku:'UI-MERE',quantity:2},{role:'fille',sku:'UI-FILLE',quantity:1}]}}
  ],'Exemples de navigation');
 });

 await homeButton('new-pending').click();
 assert.equal(await page.locator('.pending-optional').evaluate(el=>el.open),false);
 await page.locator('[name=orderNumber]').fill('UI-COMMANDE');await page.locator('[name=sku]').fill('UI-REF-001');await page.locator('[name=quantity]').fill('7');
 await page.locator('#dialog .dialog-top [data-action=quickhelp]').click();await page.getByRole('button',{name:'Reprendre',exact:true}).click();
 assert.equal(await page.locator('[name=orderNumber]').inputValue(),'UI-COMMANDE');assert.equal(await page.locator('[name=quantity]').inputValue(),'7');
 await page.locator('.pending-optional > summary').click();await page.locator('[name=locationType]').selectOption('RES');await page.locator('[name=location]').fill('009-Z');await page.locator('[name=priority]').selectOption('urgent');
 await page.evaluate(async()=>{await(await import('./js/ops.js')).persistDraft();});await close();
 await go('home');await page.reload();await page.getByRole('button',{name:'Reprendre',exact:true}).first().click();
 assert.equal(await page.locator('.pending-optional').evaluate(el=>el.open),true);
 assert.equal(await page.locator('[name=location]').inputValue(),'009-Z');assert.equal(await page.locator('[name=priority]').inputValue(),'urgent');assert.equal(await page.locator('[name=quantity]').inputValue(),'7');
 await page.locator('[data-form=pending] [type=submit]').click();await page.locator('#dialog').waitFor({state:'hidden'});
 assert.deepEqual(await page.evaluate(async()=>{const row=(await import('./js/storage.js')).list('pending').find(r=>r.orderNumber==='UI-COMMANDE');return [row.sku,row.quantity,row.location,row.priority];}),['UI-REF-001',7,'RES009-Z','urgent']);
 await go('home');await page.locator('.simple-waiting-link').click();await page.locator('.pending-card').filter({hasText:'UI-COMMANDE'}).waitFor();

 await go('home');await homeButton('enfs').click();await page.locator('#enf-search').fill('UI-CONCEPT');await page.getByRole('button',{name:'Voir le contenu',exact:true}).click();
 assert.match(await page.locator('#dialog').innerText(),/UI-MEUBLE[\s\S]*UI-MERE[\s\S]*2[\s\S]*UI-FILLE/);await close();
 await go('home');await homeButton('codes').click();await page.locator('[name=value]').fill('000007');await page.locator('[data-form=barcode] [type=submit]').click();
 await page.locator('#barcode-stage').filter({hasText:'000007'}).waitFor();assert.match(await page.locator('#barcode-stage').innerText(),/000007/);
 await go('home');await homeButton('stock').click();await page.locator('[data-filter-search]').fill('UI-REF-001');await page.locator('.product-record').filter({hasText:'Produit synthétique'}).waitFor();
 await go('home');await homeButton('new-order').click();await page.locator('#picking-total').fill('42');
 await page.locator('.simple-route-guide > summary').click();await page.locator('.simple-route-guide [data-action=quickhelp]').click();await page.getByRole('button',{name:'Reprendre',exact:true}).click();assert.equal(await page.locator('#picking-total').inputValue(),'42');
 await go('home');await homeButton('scan').click();await page.waitForFunction(()=>document.querySelector('#main')?.dataset.view==='scan');assert.ok(await page.locator('[data-form=lookup-product]').isVisible());
 for(const route of ['voice','schedule','help']){await go('home');await page.locator(`.simple-essentials [data-nav=${route}]`).click();await page.waitForFunction(route=>document.querySelector('#main')?.dataset.view===route,route);}
 await go('home');await page.locator('[data-action=simple-start]').click();await page.getByRole('heading',{name:'Pikéo en 3 gestes',exact:true}).waitFor();
 await page.locator('#dialog .dialog-top [data-action=quickhelp]').click();await page.getByRole('heading',{name:'Aide · Les trois gestes essentiels',exact:true}).waitFor();await page.getByRole('button',{name:'Reprendre',exact:true}).click();await page.getByRole('button',{name:'J’ai compris',exact:true}).click();
 console.log('Accueil : six actions, neuf pictogrammes, ENF, codes, produit, picking, scanner et prise en main accessibles ; manquant et aide conservent la saisie et les détails du brouillon.');

 await go('more');assert.equal(await page.locator('[data-tool-group]').count(),6);assert.equal(await page.locator('[data-tool-group][open]').count(),0);
 assert.deepEqual((await page.locator('[data-tool-results] .tool-row').evaluateAll(rows=>rows.map(r=>r.dataset.nav||r.dataset.action))).sort(),TOOLS.map(t=>t.id).sort());
 const firstSummary=page.locator('[data-tool-group] > summary').first();await firstSummary.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-tool-group]').first().evaluate(el=>el.open),true);
 await page.locator('#tools-search').fill('mémo vocal');assert.ok(await page.locator('[data-tool-results] [data-nav=voice]').isVisible());assert.equal(await page.locator('[data-tool-group]').count(),0);
 await page.locator('#tools-search').fill('');assert.equal(await page.locator('[data-tool-group][open]').count(),0);
 for(const theme of ['light','dark'])for(const width of [320,390]){
  await page.evaluate(async theme=>{const s=await import('./js/storage.js');await s.save('preferences',{...s.settings(),id:'main',theme});},theme);await page.setViewportSize({width,height:844});
  await go('home');
  const dismiss=page.locator('#undo-bar [data-ops-action=hide-undo]');if(await dismiss.isVisible())await dismiss.click();
  await page.locator('#toast').waitFor({state:'hidden'});await page.locator('#main').focus();
  const boxes=await page.locator('.simple-action-grid button').evaluateAll(rows=>rows.map(r=>{const b=r.getBoundingClientRect();return {width:b.width,height:b.height};}));assert.ok(boxes.every(b=>b.width>=120&&b.height>=160));
  assert.ok(await page.locator('[data-backup-summary]').isVisible());await waitForState(page,()=>{const text=document.querySelector('[data-backup-summary]')?.textContent;return !!text&&!text.includes('Vérification');});
  assert.deepEqual((await page.evaluate(auditContrast)).failures,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`test-results/simple-home-${theme}-${width}.png`,fullPage:true});
  await go('more');for(const summary of await page.locator('[data-tool-group] > summary').all())await summary.click();
  assert.deepEqual((await page.evaluate(auditContrast)).failures,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`test-results/simple-tools-${theme}-${width}.png`,fullPage:true});
 }
 console.log('Outils : inventaire intégral conservé, six catégories au clavier, recherche directe ; gros boutons, contrastes et absence de débordement vérifiés à 320/390 px dans les deux thèmes.');

 await go('home');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const picture=await page.evaluate(async()=>{const image=new Image();image.src='assets/pikeo-actions-canva.png';await image.decode();return [image.naturalWidth,image.naturalHeight];});assert.ok(picture.every(n=>n>=200));
 await context.setOffline(true);await page.reload();await page.locator('.simple-action-grid button').first().waitFor();assert.equal(await page.locator('.simple-action-grid button').count(),6);
 await page.evaluate(async()=>{const image=new Image();image.src='assets/pikeo-actions-canva.png';await image.decode();});
 assert.ok(await page.locator('[data-backup-summary]').isVisible());await waitForState(page,()=>document.querySelector('[data-backup-summary]')?.textContent.toLowerCase().includes('hors'));
 await context.setOffline(false);assert.deepEqual(errors,[]);
 console.log('Hors connexion réel : accueil, illustrations locales et état de sauvegarde disponibles après rechargement, données conservées.');
}catch(error){
 await page?.screenshot({path:'test-results/simple-ui-failure.png',fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw error;
}finally{await browser?.close();server.kill();}
