// Synthetic local UI only; never controls a real music app or creates a real user.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {auditContrast} from './contrast-audit.mjs';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',d=>{if(String(d).includes('http://')){clearTimeout(timer);resolve();}});server.on('error',reject);});
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const errors=[];
 for(const desktop of [false,true]){
  const context=await browser.newContext({viewport:desktop?{width:1365,height:900}:{width:390,height:844},serviceWorkers:'block'});
  await context.route('**/functions/v1/**',route=>route.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8765/'+(desktop?'bureau.html':''));
  await page.locator('#dialog[open] [name=name]').fill('Test musique');
  await page.locator('#dialog #media-dock [data-media-action=toggle]').click();
  await page.getByRole('heading',{name:'Musique du téléphone',exact:true}).waitFor();
  assert.match(await page.locator('[data-media-status]').innerText(),/pas disponible dans la version web/);
  assert.equal(await page.locator('[data-media-action=panel-toggle]').isVisible(),false);
  assert.equal(await page.locator('[data-media-action=access]').isVisible(),false);
  await page.getByRole('button',{name:'Aide pour la musique',exact:true}).click();
  await page.getByRole('heading',{name:'Aide · Commander la musique du téléphone',exact:true}).waitFor();
  await page.getByRole('button',{name:'Reprendre',exact:true}).click();
  await page.getByRole('button',{name:'Fermer les commandes musique',exact:true}).click();
  assert.equal(await page.locator('#dialog [name=name]').inputValue(),'Test musique');
  await page.getByRole('button',{name:'Commencer',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#media-dock')?.parentElement===document.body);
  for(const theme of ['light','dark']){
   await page.emulateMedia({colorScheme:theme});
   for(const route of ['home','pending','orders','stock','voice','help']){
    await page.goto('http://localhost:8765/'+(desktop?'bureau.html':'')+'#'+route);
    await page.locator('#media-dock [data-media-action=toggle]').waitFor();
    const layout=await page.locator('#media-dock').evaluate(d=>{const r=d.getBoundingClientRect(),n=document.querySelector('#mobile-nav'),b=n?.getBoundingClientRect();return {width:innerWidth,height:innerHeight,left:r.left,right:r.right,top:r.top,bottom:r.bottom,navTop:b&&b.height?b.top:innerHeight};});
    assert.ok(layout.left>=0&&layout.right<=layout.width&&layout.top>=0&&layout.bottom<=layout.navTop,'Bouton visible hors de la navigation');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   }
   await page.locator('[data-media-action=toggle]').click();
   const contrast=await page.evaluate(auditContrast);assert.deepEqual(contrast.failures,[]);
   await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/media-'+(desktop?'desktop':'mobile')+'-'+theme+'.png',fullPage:true});
   await page.getByRole('button',{name:'Fermer les commandes musique',exact:true}).click();
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Musique : mobile/bureau, six écrans, modes clair/sombre, limites web, aide et saisie préservée OK.');
}finally{await browser?.close();server.kill();}
