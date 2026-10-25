import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const site=path.resolve('site'),base='http://localhost:8767/';
let legacy='1.5.0',published=false,advertised='1.12.0',browser;
const errors=[];
const legacyWorker=()=>"const CACHE="+JSON.stringify('ek-shell-legacy-'+legacy)+";self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./js/core.js'])).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(e.request.mode==='navigate'?fetch(e.request):caches.match(e.request).then(c=>c||fetch(e.request)));});";
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,base),file=path.resolve(site,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(site+path.sep))throw Error('Path');
 let data=await readFile(file),type=path.extname(file);
 if(url.pathname==='/release.json')data=Buffer.from(JSON.stringify({version:advertised}));
 if(!published&&url.pathname==='/sw.js')data=Buffer.from(legacyWorker());
 if(!published&&url.pathname==='/js/core.js')data=Buffer.from(data.toString().replace("'1.12.0'","'"+legacy+"'"));
 if(!published&&(url.pathname==='/index.html'||url.pathname==='/'))data=Buffer.from(data.toString().replace(/<script type="module">[\s\S]*?<\/script>/,'<script type="module" src="js/app.js"></script>'));
 res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png','.wasm':'application/wasm'}[type]||'application/octet-stream'),'Cache-Control':'no-cache'});res.end(data);
 }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(8767,'127.0.0.1',r));
async function current(page,version){await page.waitForFunction(v=>document.querySelector('#app-version')?.textContent===v,version,{timeout:45000});}
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 for(const old of ['1.5.0','1.7.0']){
 legacy=old;published=false;advertised='1.12.0';const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await current(page,old);await page.getByRole('button',{name:'Commencer',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
 await page.evaluate(async()=>{const s=await import('./js/storage.js');await s.save('pending',{id:'update-test',orderNumber:'000123',sku:'00999',location:'PAC001',status:'waiting'},'Test conservation');await s.setMeta('draft:pending:new',{form:'pending',data:{sku:'00777'}});await s.storeFile(new Blob(['octets conservés'],{type:'text/plain'}),'preuve.txt','photo');const v=await import('./js/voice-store.js');await v.saveMemo({id:'voice-update',name:'Mémo conservé',createdAt:new Date().toISOString(),duration:2,blob:new Blob(['audio synthétique'],{type:'audio/webm'})});localStorage.setItem('update-keep','oui');await navigator.serviceWorker.register('sw.js',{type:'module',updateViaCache:'none'});await navigator.serviceWorker.ready;});
 await page.reload();await current(page,old);published=true;
 if(old==='1.5.0'){await page.goto(base+'actualiser.html');await page.getByRole('button',{name:'Installer la dernière version'}).click();}else await page.reload();
 await current(page,'1.12.0');
 const retained=await page.evaluate(async()=>{const s=await import('./js/storage.js'),v=await import('./js/voice-store.js');return {sku:s.get('pending','update-test').sku,draft:(await s.meta('draft:pending:new')).data.sku,files:await Promise.all((await s.files()).map(async f=>await f.blob.text())),voice:await (await v.getMemo('voice-update')).blob.text(),pref:localStorage.getItem('update-keep'),caches:await caches.keys()};});
 console.log('Migration',old,JSON.stringify({caches:retained.caches,worker:await page.evaluate(async()=>{const u=await import('./js/updates.js');return {version:await u.workerVersion(navigator.serviceWorker.controller),state:navigator.serviceWorker.controller?.state};})}));
 await page.waitForFunction(async()=>!(await caches.keys()).some(c=>c.startsWith('ek-shell-legacy')),{},{timeout:10000});
 assert.equal(retained.sku,'00999');assert.equal(retained.draft,'00777');assert.ok(retained.files.includes('octets conservés'));assert.equal(retained.voice,'audio synthétique');assert.equal(retained.pref,'oui');
 await page.locator('#check-update').click();await page.getByText('Pikéo 1.12.0 est à jour sur cet appareil.').waitFor();
 await context.setOffline(true);await page.reload();await current(page,'1.12.0');assert.equal(await page.evaluate(async()=>{const s=await import('./js/storage.js');return s.get('pending','update-test').sku;}),'00999');await context.setOffline(false);
 // A later publication must not reload or discard an open draft.
 advertised='1.12.1';await page.goto(base+'#pending');await current(page,'1.12.0');
 await page.getByRole('button',{name:'Noter un manquant',exact:true}).first().click();await page.locator('#dialog [name=sku]').fill('0000888');
 await page.locator('#check-update').evaluate(e=>e.click());await page.locator('#pikeo-update').getByRole('button',{name:'Appliquer la mise à jour'}).evaluate(e=>e.click());
 await page.getByText('Terminez ou fermez la saisie en cours, puis appliquez la mise à jour. Elle ne sera pas interrompue.').waitFor();assert.equal(await page.locator('#dialog [name=sku]').inputValue(),'0000888');assert.equal(await page.locator('#app-version').textContent(),'1.12.0');
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/update-'+old+'.png'});await context.close();
 }
 published=true;advertised='1.12.0';
 const previews=await browser.newContext({viewport:{width:320,height:800}}),preview=await previews.newPage();preview.on('pageerror',e=>errors.push(e.message));await preview.goto(base+'propositions-mascotte.html');assert.equal(await preview.locator('[data-choice]').count(),5);for(const card of await preview.locator('[data-choice]').all()){await card.getByRole('button',{name:'Rejouer'}).click();await card.locator('svg').waitFor();}assert.ok(await preview.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await preview.emulateMedia({reducedMotion:'reduce'});await preview.locator('[data-choice="1"] button').click();assert.equal(await preview.locator('[data-choice="1"] .arm').evaluate(e=>getComputedStyle(e).animationName),'none');await preview.screenshot({path:'test-results/mascotte-propositions.png',fullPage:true});await previews.close();
 assert.deepEqual(errors,[]);console.log('Mises à jour OK : anciennes copies 1.5/1.7, réparation, données/photos/mémos/brouillons conservés, hors ligne et formulaire protégé.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
