import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{}),...(process.env.EK_TEST_BROWSER_EXECUTABLE?{executablePath:process.env.EK_TEST_BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 let configured=false,expectedPin='',resets=0,requests=[],bureauMode=false;
 await context.route('https://wcmuffmyozjolaaahhff.supabase.co/functions/v1/pikeo-api',async route=>{
  const req=route.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const p=req.postDataJSON().payload;requests.push(p);let data={},status=200;
  if(p.action==='register')data={session:{deviceId:p.deviceId,profileId:'profile',name:p.name,role:bureauMode?'admin':'operator',owner:bureauMode},pin:{configured,canEnroll:!configured}};
  else if(p.action==='user-pin-status')data={pin:{configured,canEnroll:!configured}};
  else if(p.action==='user-pin-enroll'){assert.equal(p.pin,p.confirmation);assert.match(p.pin,/^\d{4}$/);configured=true;expectedPin=p.pin;data={token:'a'.repeat(64)};}
  else if(p.action==='user-pin-unlock'){if(p.pin===expectedPin)data={token:'a'.repeat(64)};else{status=401;data={error:'Code incorrect.'};}}
  else if(p.action==='session')data={session:{deviceId:p.deviceId,profileId:'profile',name:'Collègue test',role:bureauMode?'admin':'operator',owner:bureauMode}};
  else if(p.action==='bureau-access')data={session:{deviceId:p.deviceId,profileId:'profile',name:'Collègue test',role:'admin',owner:true,active:true},expiresAt:new Date(Date.now()+60000).toISOString()};
  else if(p.action==='config-get')data={version:0,data:{records:[]}};
  else if(p.action==='users'||p.action==='user-pin-reset'){resets++;status=403;data={error:'Seul Étienne peut gérer les utilisateurs.'};}
  await route.fulfill({status,headers,json:data});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/#users');
 await page.locator('[name=username]').fill('Collègue test');await page.locator('[data-session-form=login] [type=submit]').click();
 const dialog=page.locator('.personal-pin-dialog');await dialog.waitFor();assert.equal(await page.evaluate(async()=> (await import('./js/session-api.js')).current()),null);
 await dialog.locator('[name=personalPin]').fill('0042');await dialog.locator('[name=personalPinConfirmation]').fill('0043');await dialog.getByRole('button',{name:'Enregistrer mon code et entrer'}).click();await page.getByText('Les deux codes doivent être identiques.').waitFor();assert.equal(requests.filter(p=>p.action==='user-pin-enroll').length,0);
 await dialog.locator('[name=personalPinConfirmation]').fill('0042');await dialog.getByRole('button',{name:'Enregistrer mon code et entrer'}).click();await page.waitForFunction(()=>document.querySelector('#main')?.dataset.view==='home');
 assert.equal(await page.evaluate(async()=> (await import('./js/session-api.js')).current().name),'Collègue test');
 await page.reload();await dialog.waitFor();assert.equal(await dialog.locator('[name=personalPinConfirmation]').count(),0);
 await dialog.locator('[name=personalPin]').fill('9999');await dialog.getByRole('button',{name:'Entrer',exact:true}).click();await page.getByText('Code incorrect.',{exact:true}).waitFor();
 await dialog.locator('[name=personalPin]').fill('0042');await dialog.getByRole('button',{name:'Entrer',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#main')?.dataset.view==='home');
 const denied=await page.evaluate(async()=>{try{await (await import('./js/session-api.js')).request('user-pin-reset',{target:crypto.randomUUID()});}catch(e){return e.status;}});assert.equal(denied,403);assert.equal(resets,1);
 const stored=await page.evaluate(()=>JSON.stringify(localStorage));assert.ok(!stored.includes('0042'));assert.ok(!stored.includes('a'.repeat(64)));assert.deepEqual(errors,[]);
 bureauMode=true;await page.goto('http://127.0.0.1:8765/bureau.html#home');await dialog.waitFor();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await dialog.isVisible(),true);await dialog.locator('[name=personalPin]').fill('0042');await dialog.getByRole('button',{name:'Entrer',exact:true}).click();await page.locator('#bureau-access-gate').waitFor({state:'hidden'});await page.locator('#main[data-view=home]').waitFor();assert.deepEqual(errors,[]);
 console.log('Mobile et Bureau : création obligatoire, confirmation, zéros initiaux, réouverture, mauvais code, restriction admin et absence de code/jeton dans localStorage validés.');
}finally{await browser?.close();server.kill();}
