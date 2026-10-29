// All identities are synthetic; signed account calls are intercepted locally.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {bureauFixture,seedBureauSession} from './bureau-fixture.mjs';
import {auditContrast} from './contrast-audit.mjs';
const base='http://localhost:8765/';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Serveur indisponible.')),15000);server.stdout.on('data',data=>{if(String(data).includes('http://')){clearTimeout(t);resolve();}});});
let browser,page;const errors=[];
const locked=async page=>{await page.locator('#bureau-access-gate[data-ready]').waitFor({state:'visible'});assert.equal(await page.locator('.app-shell').isVisible(),false);assert.equal(await page.locator('#desktop-sidebar').isVisible(),false);assert.equal(await page.getByRole('button',{name:'Annuler',exact:true}).count(),0,'Aucune notification ni action métier visible derrière le verrouillage.');};
const more=async page=>{await page.goto(base+'index.html#more');await page.locator('[data-tool-directory]').waitFor();};
const noLink=async page=>assert.equal(await page.locator('a[href^="bureau.html"]').count(),0);
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 for(const role of ['personal','operator','viewer','admin']){
  const context=await browser.newContext({viewport:{width:1365,height:900},serviceWorkers:'block'});
  const fixture=await bureauFixture(context,role);page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  if(role!=='personal')await seedBureauSession(page,role==='operator'?'Étienne':'Profil fictif '+role);
  let imports=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/js/app.js')imports++;});
  let release;if(role==='admin')fixture.hold=new Promise(resolve=>{release=resolve;});
  await page.goto(base+'bureau.html#stock');
  await locked(page);assert.equal(imports,0,'Pas de chargement de l’application avant autorisation.');
  if(role!=='admin'){
   await page.getByRole('button',{name:'? Aide pour cet accès',exact:true}).click();await page.getByRole('heading',{name:'Accéder à Pikéo Bureau'}).waitFor();
   for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual((await page.evaluate(auditContrast)).failures,[]);}
   await more(page);if(await page.locator('[data-form=onboarding]').count()){await page.getByRole('button',{name:'Commencer',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});}
   await noLink(page);await page.goto(base+'aide-bureau.html');await page.getByRole('heading',{name:'Pikéo · Guide du bureau'}).waitFor();await noLink(page);
   if(role==='operator'){
    await page.evaluate(async()=>{const api=await import('./js/session-api.js');await api.init();const row=api.current();row.role='admin';row.owner=true;await (await import('./js/session-store.js')).saveIdentity(row);});
    const before=imports;await page.goto(base+'bureau.html#administration');await locked(page);await page.getByText('Pikéo Bureau est réservé aux administrateurs.',{exact:true}).waitFor();assert.equal(imports,before);
   }
  }else{
   fixture.hold=null;release();await page.locator('#main[data-view=stock]').waitFor();await page.locator('#bureau-access-gate').waitFor({state:'hidden'});
   if(await page.locator('[data-form=onboarding]').count()){await page.getByRole('button',{name:'Commencer',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});}
   await more(page);await page.locator('[data-bureau-links] a[href="bureau.html#home"]').waitFor();
   await page.goto(base+'bureau.html#orders');await page.locator('#main[data-view=orders]').waitFor();
   await page.locator('#picking-total').fill('137');
   await page.evaluate(async()=>{const s=await import('./js/storage.js');await s.save('products',{id:'preserved',sku:'000KEEP',name:'Fiche conservée'});});
   await context.setOffline(true);await locked(page);assert.equal(await page.locator('#picking-total').inputValue(),'137');
   await page.getByRole('button',{name:'? Aide pour cet accès',exact:true}).click();assert.equal(await page.locator('#picking-total').inputValue(),'137');
   await context.setOffline(false);await page.locator('#bureau-access-gate').waitFor({state:'hidden'});assert.equal(await page.locator('#picking-total').inputValue(),'137');
   fixture.role='operator';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await locked(page);await page.getByText('Pikéo Bureau est réservé aux administrateurs.',{exact:true}).waitFor();
   assert.equal(await page.evaluate(async()=>!!(await import('./js/storage.js')).get('products','preserved')),true);
   fixture.role='admin';await page.locator('[data-bureau-retry]').click();await page.locator('#bureau-access-gate').waitFor({state:'hidden'});assert.equal(await page.locator('#picking-total').inputValue(),'137');
   fixture.active=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await locked(page);await page.getByText('Cet accès a été retiré.',{exact:true}).waitFor();
   fixture.active=true;fixture.profileActive=false;await page.locator('[data-bureau-retry]').click();await page.getByText('Cet accès a été retiré.',{exact:true}).waitFor();
   fixture.profileActive=true;fixture.unavailable=true;await page.locator('[data-bureau-retry]').click();await page.getByText('Service temporairement indisponible.',{exact:true}).waitFor();
   await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/bureau-access-locked.png',fullPage:true});
   fixture.unavailable=false;await page.locator('[data-bureau-retry]').click();await page.locator('#bureau-access-gate').waitFor({state:'hidden'});
   await page.evaluate(async()=>{(await import('./js/session-api.js')).personal();});await locked(page);
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Bureau administrateur : lien conditionnel, nom Étienne sans privilège, accès direct, rôle local falsifié, serveur attendu, retrait, suspension, hors ligne, panne, retour, aide, saisie/données conservées, clair/sombre et 320 px OK.');
}catch(error){if(page){console.error(await page.locator('body').innerText().catch(()=>''));await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/bureau-access-failure.png',fullPage:true}).catch(()=>{});}throw error;}finally{await browser?.close();server.kill();}
