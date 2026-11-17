// Synthetic browser accounts and endpoint only; never touches production.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{}),...(process.env.EK_TEST_BROWSER_EXECUTABLE?{executablePath:process.env.EK_TEST_BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),profileId=crypto.randomUUID(),uploads=[],filters=[],errors=[];let deviceId,failUpload=true;
 await context.route('**/js/session-pin-ui.js',r=>r.fulfill({contentType:'text/javascript',body:"export async function askPin(){return {pin:'0042',confirmation:'0042'}}"}));
 await context.route('https://wcmuffmyozjolaaahhff.supabase.co/functions/v1/pikeo-api',async route=>{
  const req=route.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const p=req.postDataJSON().payload;deviceId=p.deviceId;
  const session={deviceId,profileId,name:'Étienne',role:'admin',owner:true,active:true};let data={},status=200;
  if(p.action==='register')data={session,pin:{configured:true,canEnroll:false}};
  else if(p.action==='user-pin-unlock')data={token:'a'.repeat(64)};
  else if(p.action==='session')data={session};
  else if(p.action==='admin-pin-status')data={configured:true,unlocked:true,expiresAt:new Date(Date.now()+600000).toISOString()};
  else if(p.action==='admin-pin-peers')data={peers:[]};
  else if(p.action==='users')data={users:[{id:profileId,name:'Étienne',is_owner:true,active:true,devices:[]}],audit:[]};
  else if(p.action==='activity-list'){filters.push(p);data={events:[{id:'1',action:'login',source:'server',outcome:'success',device_id:deviceId,actor_name:'Étienne',occurred_at:'2026-11-17T08:00:00Z',received_at:'2026-11-17T08:00:00Z'}],next:null};}
  else if(p.action==='activity-batch'){uploads.push(p);if(failUpload){failUpload=false;status=503;data={error:'synthetic failure'};}else data={saved:true};}
  else if(p.action==='config-get')data={version:0,data:{records:[]}};
  else if(p.action==='inbox')data={messages:[]};
  else if(p.action==='team')data={achievements:[]};
  await route.fulfill({headers,status,json:data});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8765/');
 await page.evaluate(async()=>{const a=await import('/js/session-api.js');await a.login('Étienne',{ownerSecret:'synthetic-only'});});
 await page.goto('http://localhost:8765/#administration');
 await page.getByRole('heading',{name:'Connexions et actions'}).waitFor();
 assert.match(await page.locator('#main').innerText(),/09:00:00/);
 await page.locator('[data-activity-day]').fill('2026-11-17');await page.locator('[data-activity-profile]').selectOption(profileId);
 await page.getByRole('button',{name:'Filtrer',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-activity-day]')?.value==='2026-11-17');
 await page.waitForTimeout(200);assert.equal(filters.at(-1).day,'2026-11-17');assert.equal(filters.at(-1).profileId,profileId);
 await context.setOffline(true);
 await page.evaluate(async()=>{const s=await import('/js/storage.js');await s.save('pending',{id:'audit-offline-test',name:'must-stay-local',quantity:2},'Private text must stay local');});
 await context.setOffline(false);
 await page.evaluate(async()=>{const s=await import('/js/storage.js'),a=await import('/js/session-api.js');await s.flushActivity(a);await s.flushActivity(a);});
 assert.ok(uploads.length>=2);const attempts=uploads.flatMap(p=>p.events).filter(e=>e.resourceId==='audit-offline-test');assert.ok(attempts.length);assert.equal(new Set(attempts.map(e=>e.eventId)).size,1);assert.ok(!JSON.stringify(uploads).includes('must-stay-local'));assert.ok(!JSON.stringify(uploads).includes('Private text'));
 assert.deepEqual(errors,[]);await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/activity-mobile.png',fullPage:true});console.log('Journal admin, heure Paris, filtres, collecte hors ligne et reprise sans contenu privé validés.');
}finally{await browser?.close();server.kill();}
