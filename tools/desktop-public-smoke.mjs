import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(Error('Le serveur Pikéo est indisponible.')),15000);
 server.stdout.on('data',buf=>{if(String(buf).includes('http://')){clearTimeout(timeout);resolve();}});
});
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const ctx=await browser.newContext({viewport:{width:1365,height:900},serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8765/bureau.html#home');
 await page.locator('#desktop-sidebar .desk-brand').waitFor();
 assert.match(await page.title(),/Pikéo/);
 assert.equal(await page.locator('body.desktop #desktop-sidebar:visible').count(),1);
 assert.equal(await page.locator('#desktop-sidebar [data-nav=administration]').count(),1,'Le menu administration est présent');
 await page.goto('http://localhost:8765/bureau.html#administration');
 await page.getByRole('heading',{name:/Administration réservée/}).waitFor();
 assert.equal(await page.locator('[data-admin-action=new-user]').count(),0,'Aucune création de compte sans authentification du propriétaire');
 await page.goto('http://localhost:8765/bureau.html#home');
 if(await page.locator('[data-form=onboarding]').isVisible()){
  await page.locator('[data-form=onboarding] [name=name]').fill('Audit bureau');
  await page.locator('[data-form=onboarding] [name=goal]').fill('1800');
  await page.locator('[data-form=onboarding] [type=submit]').click();
  await page.locator('#dialog').waitFor({state:'hidden'});
 }
 await page.locator('#desktop-sidebar [data-nav=pending]').click();
 assert.match(page.url(),/#pending$/);
 await page.getByRole('heading',{name:/Commandes en attente|Manquants/i}).first().waitFor();
 await page.goto('http://localhost:8765/aide-bureau.html');
 await page.getByRole('heading',{name:/Guide du bureau/}).waitFor();
 assert.deepEqual(errors,[]);
 await ctx.close();
 console.log('OK Pikéo Bureau : navigation, manquants, guide et interface non privilégiée.');
}finally{await browser?.close();server.kill();}
