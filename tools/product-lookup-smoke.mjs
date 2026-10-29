// Synthetic products and a mocked lookup service; never queries real work references.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {auditContrast} from './contrast-audit.mjs';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',data=>{if(String(data).includes('http://')){clearTimeout(timer);resolve();}});server.on('error',reject);});
let browser,page,release;const errors=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 for(const desktop of [false,true]){
  const context=await browser.newContext({viewport:desktop?{width:1365,height:900}:{width:390,height:844},serviceWorkers:'block'});
  const requests=[];
  const candidate=(sku,barcode='')=>({name:'Carte Internet de test',sku,barcode,sourceKind:'draeger',sourceUrl:'https://fr.checkout.draegerparis.com/products/fixture',retrievedAt:'2026-10-29T09:00:00Z'});
  await context.route('**/functions/v1/**',async route=>{
   if(!route.request().url().endsWith('/pikeo-product-lookup'))return route.abort();
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});
   const body=route.request().postDataJSON();assert.deepEqual(Object.keys(body),['code']);requests.push(body.code);
   if(body.code==='SLOW-LOOKUP')await new Promise(resolve=>{release=resolve;});
   if(body.code==='QUOTA-LOOKUP')return route.fulfill({status:429,json:{error:'Quota de test atteint'}});
   const candidates=body.code==='000WEB1'?[candidate('000WEB1','4006381333931')]:body.code==='012345678905'?[candidate('AMB-1','012345678905')]:body.code==='OFFLINE-LOOKUP'?[candidate('OFFLINE-LOOKUP')]:[];
   await route.fulfill({json:{candidates,warnings:[]}}).catch(()=>{});
  });
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8765/'+(desktop?'bureau.html':'')+'#scan');
  await page.getByRole('button',{name:'Commencer',exact:true}).click();
  const lookup=async code=>{await page.locator('[name=code]').fill(code);await page.locator('[data-form=lookup-product] [type=submit]').click();};
  const rows=()=>page.evaluate(async()=>{const s=await import('./js/storage.js');return s.list('products');});
  await lookup('000WEB1');await page.getByRole('button',{name:'Vérifier avant ajout',exact:true}).waitFor();
  assert.equal((await rows()).length,0);assert.equal(await page.locator('[data-web-lookup] a').first().getAttribute('href'),'https://fr.checkout.draegerparis.com/products/fixture');
  await page.evaluate(async()=>{const identity=await import('./js/identity-context.js');identity.setIdentity({id:'viewer-test',role:'viewer',scope:'live'});const access=await import('./js/access-ui.js');access.guard(document);});
  assert.equal(await page.getByRole('button',{name:'Vérifier avant ajout',exact:true}).isEnabled(),false);
  await page.evaluate(async()=>{const identity=await import('./js/identity-context.js');identity.setIdentity(null);const access=await import('./js/access-ui.js');access.guard(document);});
  await page.getByRole('button',{name:'Vérifier avant ajout',exact:true}).click();
  assert.equal(await page.locator('#dialog [name=sku]').inputValue(),'000WEB1');
  assert.equal(await page.locator('#dialog [name=barcode]').inputValue(),'4006381333931');
  assert.equal(await page.locator('#dialog [name=unitsPerPick]').inputValue(),'');
  assert.equal(await page.locator('#dialog [name=location]').inputValue(),'');
  await page.locator('#dialog .dialog-top [data-action=quickhelp]').click();
  assert.match(await page.locator('#help-dialog').innerText(),/Internet|Web/);
  await page.getByRole('button',{name:'Reprendre',exact:true}).click();
  assert.equal(await page.locator('#dialog [name=sku]').inputValue(),'000WEB1');
  await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();assert.equal((await rows()).length,0);
  await page.getByRole('button',{name:'Vérifier avant ajout',exact:true}).click();
  await page.locator('#dialog [data-form=product] [type=submit]').click();await page.locator('#dialog').waitFor({state:'hidden'});
  const saved=(await rows()).find(r=>r.sku==='000WEB1');assert.ok(saved);assert.equal(saved.sourceUrl,'https://fr.checkout.draegerparis.com/products/fixture');assert.ok(saved.lookupValidatedAt);
  const before=requests.length;await lookup('000WEB1');await page.getByRole('heading',{name:'Carte Internet de test',exact:true}).waitFor();assert.equal(requests.length,before);
  await page.evaluate(async()=>{const s=await import('./js/storage.js');for(const id of ['AMB-1','AMB-2'])await s.save('products',{id,sku:id,barcode:'012345678905',name:'Ancien '+id,location:'PAC A-01',unitsPerPick:5});});
  await lookup('012345678905');await page.getByRole('button',{name:'Relire la fiche AMB-1',exact:true}).waitFor();
  assert.match(await page.locator('#scan-result').innerText(),/Correspondance incertaine/);assert.equal((await rows()).length,3);
  await page.getByRole('button',{name:'Relire la fiche AMB-1',exact:true}).click();assert.equal(await page.locator('#dialog [name=name]').inputValue(),'Ancien AMB-1');
  assert.equal(await page.locator('#dialog [name=unitsPerPick]').inputValue(),'5');await page.locator('#dialog [name=name]').fill('Nom relu explicitement');
  await page.locator('#dialog [data-form=product] [type=submit]').click();await page.locator('#dialog').waitFor({state:'hidden'});
  const amended=await rows();assert.equal(amended.length,3);assert.equal(amended.find(r=>r.id==='AMB-1').name,'Nom relu explicitement');assert.equal(amended.find(r=>r.id==='AMB-2').name,'Ancien AMB-2');
  assert.equal(await page.evaluate(async()=>{const s=await import('./js/storage.js');return s.list('unknowns').find(r=>r.code==='012345678905')?.status;}),'open');
  await lookup('SLOW-LOOKUP');await page.locator('[data-web-lookup]').getByRole('heading',{name:'Recherche Internet en cours…',exact:true}).waitFor();
  await lookup('QUOTA-LOOKUP');await page.getByText('Quota de test atteint',{exact:true}).waitFor();release?.();release=null;
  assert.equal(await page.locator('#scan-result .mono').first().innerText(),'QUOTA-LOOKUP');
  await context.setOffline(true);const offlineCalls=requests.length;await lookup('OFFLINE-LOOKUP');await page.getByText(/Hors connexion : le code reste/).waitFor();assert.equal(requests.length,offlineCalls);
  await context.setOffline(false);await page.getByRole('button',{name:'Vérifier avant ajout',exact:true}).waitFor();assert.equal(requests.at(-1),'OFFLINE-LOOKUP');
  const staleKey=await page.locator('[data-action=review-web-product]').first().getAttribute('data-lookup-key');await lookup('QUOTA-LOOKUP');await page.getByText('Quota de test atteint',{exact:true}).waitFor();
  assert.equal(await page.evaluate(async key=>{const p=await import('./js/product-lookup.js');try{p.webProductProposal(0,null,key);return false;}catch{return true;}},staleKey),true);
  for(const theme of ['light','dark']){
   await page.evaluate(async theme=>{const s=await import('./js/storage.js');await s.save('preferences',{...s.settings(),id:'main',theme});const f=await import('./js/field-tools.js');f.applyTheme();},theme);
   await lookup('012345678905');await page.getByRole('button',{name:'Relire la fiche AMB-1',exact:true}).waitFor();
   for(const width of desktop?[1365]:[320,390]){
    await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    const contrast=await page.evaluate(auditContrast);assert.deepEqual(contrast.failures,[]);
   }
   await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/lookup-'+(desktop?'desktop':'mobile')+'-'+theme+'.png',fullPage:true});
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Recherche produit : inconnus, ambiguïtés, source, confirmation, aide, doublons, conservation, réponses tardives, hors ligne, mobile/bureau et contraste OK.');
}catch(error){if(page){await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/lookup-failure.png',fullPage:true}).catch(()=>{});console.error(await page.locator('body').innerText().catch(()=>''));}throw error;}finally{release?.();await browser?.close();server.kill();}
