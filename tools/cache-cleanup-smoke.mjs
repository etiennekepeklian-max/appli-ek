// Synthetic Sheets, files and audio. No real account or work data is queried.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {SHEET_TABS,HEADERS} from '../site/js/core.js';
import {auditContrast} from './contrast-audit.mjs';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',data=>{if(String(data).includes('http://')){clearTimeout(timer);resolve();}});server.on('error',reject);});
const sheet='synthetic-cache-cleanup-sheet-1234567890',tables=new Map(SHEET_TABS.map(tab=>[tab,[HEADERS]])),errors=[];
let browser,page,fail=true;
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:'window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken(){o.callback({access_token:"synthetic",expires_in:3600})}})}}};'}));
 await context.route('https://sheets.googleapis.com/**',async route=>{
  if(fail)return route.fulfill({status:500,json:{error:{message:'Panne fictive de sauvegarde'}}});
  const request=route.request(),url=new URL(request.url());let data={};
  if(url.pathname.endsWith('values:batchGet'))data={valueRanges:url.searchParams.getAll('ranges').map(range=>{const m=range.match(/!A(\d+):L(\d+)/),tab=range.split('!')[0].replaceAll("'","");return {range,values:tables.get(tab).slice(Number(m[1])-1,Number(m[2]))};})};
  else if(url.pathname.endsWith(':append')){const tab=decodeURIComponent(url.pathname.split('/values/')[1]).split('!')[0].replaceAll("'","");tables.get(tab).push(...request.postDataJSON().values);}
  else if(url.pathname.endsWith('values:batchUpdate')){for(const row of request.postDataJSON().data){const tab=row.range.split('!')[0].replaceAll("'",""),start=Number(row.range.match(/!A(\d+)/)[1])-1;tables.get(tab).splice(start,row.values.length,...row.values);}}
  else data={sheets:SHEET_TABS.map(title=>({properties:{title,gridProperties:{rowCount:1000,columnCount:12}}}))};
  return route.fulfill({json:data});
 });
 await context.route('https://www.googleapis.com/**',route=>{
  const request=route.request(),url=new URL(request.url());
  return route.fulfill({json:url.pathname.includes('/upload/')?{id:'synthetic-photo-upload'}:request.method()==='POST'?{id:'synthetic-folder'}:{files:[]}});
 });
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://localhost:8765/#storage');await page.getByRole('button',{name:'Commencer',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
 await page.evaluate(async()=>{await (await import('./js/app.js')).ready;const store=await import('./js/storage.js'),voice=await import('./js/voice-store.js');
  const photoId=await store.storeFile(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>'],{type:'image/svg+xml'}),'photo-fictive.svg','product-photo');
  await store.save('products',{id:'cache-fixture',sku:'000CACHE',name:'Produit de contrôle',photoId});
  await store.setMeta('cache-cleanup-draft',{value:'Brouillon conservé'});localStorage.setItem('cache-cleanup-preference','préférence conservée');
  await voice.saveMemo({id:'voice-cache-fixture',name:'Mémo de contrôle',blob:new Blob(['audio synthétique'],{type:'audio/webm'}),duration:1});
  const root=new URL('./',location.href),cache=await caches.open('ek-shell-v1-cleanup-fixture');
  await cache.put(new URL('cache-fixture-a.bin',root),new Response(new Uint8Array(4096)));
  await (await caches.open('ek-large-assets-v1')).put(new URL('vendor/ocr/cache-fixture-b.bin',root),new Response(new Uint8Array(262144)));
  await (await caches.open('another-app-fixture')).put(new URL('other-fixture.bin',root),new Response('à conserver'));
 });
 const failure=await page.evaluate(async sheet=>{const sync=await import('./js/sync.js');sync.saveConnection({spreadsheetId:sheet});try{await sync.connect();return '';}catch(error){return error.message;}},sheet);
 assert.match(failure,/Panne fictive/);await page.waitForTimeout(500);assert.equal(await page.locator('#dialog[open][data-cache-cleanup-key]').count(),0);
 fail=false;await page.evaluate(()=>{location.hash='stock';});await page.locator('[data-action=new-product]').first().click();
 await page.locator('#dialog [name=name]').fill('Saisie en cours conservée');
 await page.evaluate(async()=>{await (await import('./js/sync.js')).sync();});await page.waitForTimeout(500);
 assert.equal(await page.locator('#dialog-title').innerText(),'Ajouter une référence');assert.equal(await page.locator('#dialog [name=name]').inputValue(),'Saisie en cours conservée');
 await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();
 await page.getByRole('heading',{name:'Libérer de l’espace après la sauvegarde',exact:true}).waitFor();
 assert.equal(await page.locator('[data-cache-cleanup-size]').innerText(),'260 Ko');
 for(const theme of ['light','dark']){
  await page.evaluate(async theme=>{const store=await import('./js/storage.js');await store.save('preferences',{...store.settings(),id:'main',theme});(await import('./js/field-tools.js')).applyTheme();await (await import('./js/sync.js')).sync();},theme);
  for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual((await page.evaluate(auditContrast)).failures,[]);}
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/cache-cleanup-'+theme+'.png',fullPage:true});
 }
 await page.getByRole('button',{name:'Conserver le cache',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(async()=> (await (await caches.open('ek-shell-v1-cleanup-fixture')).keys()).length),1);
 await page.evaluate(async()=>{await (await import('./js/sync.js')).sync();});await page.waitForTimeout(500);assert.equal(await page.locator('#dialog[open][data-cache-cleanup-key]').count(),0);
 await page.evaluate(async()=>{await (await caches.open('ek-shell-v1-cleanup-fixture')).put(new URL('cache-fixture-c.bin',location.href),new Response(new Uint8Array(1024)));await (await import('./js/sync.js')).sync();});
 await page.getByRole('heading',{name:'Libérer de l’espace après la sauvegarde',exact:true}).waitFor();assert.equal(await page.locator('[data-cache-cleanup-size]').innerText(),'261 Ko');
 await page.locator('#dialog .dialog-top [data-action=quickhelp]').click();assert.match(await page.locator('#help-dialog').innerText(),/cache|mémos/i);await page.getByRole('button',{name:'Reprendre',exact:true}).click();assert.equal(await page.locator('[data-cache-cleanup-size]').innerText(),'261 Ko');
 await context.setOffline(true);await page.getByRole('button',{name:'Effacer le cache',exact:true}).click();await page.getByText(/Reconnectez Internet avant de nettoyer le cache/).waitFor();
 assert.equal(await page.evaluate(async()=> (await (await caches.open('ek-shell-v1-cleanup-fixture')).keys()).length),2);
 await context.setOffline(false);await page.evaluate(async()=>{const sync=await import('./js/sync.js');while(sync.activity().busy)await new Promise(r=>setTimeout(r,30));if((await import('./js/storage.js')).pendingEvents().length)await sync.sync();});
 await page.getByRole('button',{name:'Effacer le cache',exact:true}).click();await page.getByText(/Cache effacé : environ 261 Ko/).waitFor();
 const after=await page.evaluate(async()=>{const store=await import('./js/storage.js'),voice=await import('./js/voice-store.js'),product=store.get('products','cache-fixture'),memo=await voice.getMemo('voice-cache-fixture');return {
  name:product.name,sku:product.sku,photo:await (await store.readFile(product.photoId)).blob.text(),memo:await memo.blob.text(),
  draft:await store.meta('cache-cleanup-draft'),preference:localStorage.getItem('cache-cleanup-preference'),cache:(await (await caches.open('ek-shell-v1-cleanup-fixture')).keys()).length,
  ocr:(await (await caches.open('ek-large-assets-v1')).keys()).length,foreign:await (await (await caches.open('another-app-fixture')).match(new URL('other-fixture.bin',location.href))).text()
 };});
 assert.deepEqual(after,{name:'Produit de contrôle',sku:'000CACHE',photo:'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>',memo:'audio synthétique',draft:{value:'Brouillon conservé'},preference:'préférence conservée',cache:0,ocr:0,foreign:'à conserver'});
 await page.getByRole('button',{name:'Terminer',exact:true}).click();assert.deepEqual(errors,[]);
 console.log('Cache après sauvegarde : échec refusé, saisie préservée, estimation, confirmation, annulation, aide, hors connexion, doublons, thèmes et données/photos/mémos conservés.');
 await context.close();
}catch(error){if(page){await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/cache-cleanup-failure.png',fullPage:true}).catch(()=>{});console.error(await page.locator('body').innerText().catch(()=>''));}throw error;}finally{await browser?.close();server.kill();}
