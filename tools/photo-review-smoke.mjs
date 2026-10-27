import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {auditContrast} from './contrast-audit.mjs';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',s=>{if(String(s).includes('http://')){clearTimeout(timer);resolve();}});});
let browser,page;const errors=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{window.viewerURLs={created:[],revoked:[]};const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);window.viewerURLs.created.push(url);return url;};URL.revokeObjectURL=url=>{window.viewerURLs.revoked.push(url);return revoke(url);};});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:8765/');await page.getByRole('button',{name:'Commencer',exact:true}).click();
 const initial=await page.evaluate(async()=>{
  const s=await import('./js/storage.js'),{parseDayPage}=await import('./js/day-core.js'),c=document.createElement('canvas');c.width=1000;c.height=1500;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='black';ctx.font='36px Arial';ctx.fillText('FEUILLE DE TEST — 9123',60,90);ctx.font='24px Arial';for(let i=0;i<25;i++)ctx.fillText('PAC A01     12     001234     Produit de test',60,160+i*45);
  const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png')),file=await s.storeFile(blob,'test.png','day-photo');
  const make=(id,number,printed='',tail='')=>{const text=`Commande ${number}\n${printed?'Page '+printed+'\n':''}Référence;Quantité préparée;Emplacement\n001234;12;PACA01\n005678;8;PACA02\n${tail}`;return {id,photoId:file,hash:id,text,sections:parseDayPage(text),reviewed:true,parseVersion:2};};
  const pages=[make('a','000009123'),make('b','000009123','','Note de la seconde photo'),make('c','000009124','1/2'),make('d','000009124','2/2')];
  await s.setMeta('day-capture',{date:'2026-01-05',pages,choices:{}});return {file,files:(await s.files()).length,draft:await s.meta('day-capture'),bytes:blob.size};
 });
 await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});await page.getByRole('button',{name:'Vérifier les doublons',exact:true}).click();
 assert.equal(await page.locator('.day-duplicate-pair').count(),1);assert.match(await page.locator('#batch-duplicates').innerText(),/Photos 1 et 2/);
 // The save guard also runs when a user has skipped the comparison button.
 await page.locator('#day-batch-save [name=confirmed]').check();await page.locator('#day-batch-save [type=submit]').click();await page.locator('#day-batch-save [data-form-error]').filter({hasText:'Vérifiez les doublons possibles'}).waitFor();
 await page.locator('[data-day-action=edit][data-id=a]').first().click();await page.locator('[name=number0]').fill('0099999');
 const unsaved=await page.locator('[name=lines0]').inputValue();await page.getByRole('button',{name:'Agrandir la photo en plein écran',exact:true}).click();
 await page.locator('.photo-viewer img').evaluate(img=>img.decode());
 assert.ok(await page.locator('.photo-viewer').evaluate(el=>Math.abs(el.getBoundingClientRect().width-innerWidth)<2&&Math.abs(el.getBoundingClientRect().height-innerHeight)<2));
 await page.getByRole('button',{name:'Agrandir le zoom',exact:true}).click();assert.equal(await page.locator('.photo-viewer output').innerText(),'150 %');
 const cdp=await context.newCDPSession(page),box=await page.locator('.photo-viewer-scroll').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-25,y:cy},{x:cx+25,y:cy}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-50,y:cy},{x:cx+50,y:cy}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await page.locator('.photo-viewer output').innerText(),'300 %');
 await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx-80,cy-110);await page.mouse.up();assert.ok(await page.locator('.photo-viewer-scroll').evaluate(el=>el.scrollTop>0));
 await page.getByRole('button',{name:'Tourner',exact:true}).click();assert.match(await page.locator('.photo-viewer img').getAttribute('style'),/rotate\(90deg\)/);assert.equal(await page.locator('.photo-viewer output').innerText(),'100 %');
 await page.getByRole('button',{name:'Aide pour agrandir la photo',exact:true}).click();assert.match(await page.locator('#help-dialog').innerText(),/saisie intacte/);await page.getByRole('button',{name:'Reprendre',exact:true}).click();
 for(const theme of ['light','dark'])for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await page.locator('.photo-viewer').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&[...el.querySelectorAll('button')].every(b=>b.getBoundingClientRect().right<=innerWidth+1))); assert.deepEqual((await page.evaluate(auditContrast)).failures,[]);
 }
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/photo-viewer-mobile.png'});
 await page.keyboard.press('Escape');assert.equal(await page.locator('.photo-viewer').count(),0);assert.equal(await page.locator('[name=number0]').inputValue(),'0099999');assert.equal(await page.locator('[name=lines0]').inputValue(),unsaved);
 const urlState=await page.evaluate(()=>window.viewerURLs);assert.ok(urlState.revoked.includes(urlState.created.at(-1)));
 await context.setOffline(true);await page.getByRole('button',{name:'Agrandir la photo en plein écran',exact:true}).click();await page.locator('.photo-viewer img').evaluate(img=>img.decode());await page.getByRole('button',{name:'Fermer la photo',exact:true}).click();await context.setOffline(false);
 assert.equal(await page.locator('[name=number0]').inputValue(),'0099999');await page.getByRole('button',{name:'Retour aux photos',exact:true}).click();
 await page.getByRole('button',{name:'Ce sont deux pages différentes',exact:true}).click();await page.locator('#dialog .dialog-top [data-action=quickhelp]').click();assert.match(await page.locator('#help-dialog').innerText(),/Contrôler les doublons/);await page.getByRole('button',{name:'Reprendre',exact:true}).click();
 await page.locator('[data-day-form=distinct] [name=confirmed]').check();await page.getByRole('button',{name:'Conserver les deux pages',exact:true}).click();await page.locator('#batch-duplicates').filter({hasText:'Deux pages différentes confirmées.'}).waitFor();
 await page.reload();await page.locator('#main[data-view]').waitFor();await page.evaluate(async()=>{await(await import('./js/day-capture.js')).openDay();});await page.getByRole('button',{name:'Vérifier les doublons',exact:true}).click();assert.match(await page.locator('#batch-duplicates').innerText(),/Deux pages différentes confirmées/);
 await page.getByRole('button',{name:'Écarter photo 2',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.day-duplicate-pair').length===0);await page.locator('[data-day-action=include][data-id=b]').click();await page.locator('#batch-duplicates').filter({hasText:'Deux pages différentes confirmées.'}).waitFor();
 const after=await page.evaluate(async()=>{const s=await import('./js/storage.js');return {draft:await s.meta('day-capture'),files:(await s.files()).length,orders:s.list('orders').length,bytes:(await s.readFile((await s.meta('day-capture')).pages[0].photoId)).blob.size};});
 assert.equal(after.files,initial.files);assert.equal(after.orders,0);assert.equal(after.bytes,initial.bytes);assert.equal(after.draft.pages.length,4);for(let i=0;i<4;i++)assert.deepEqual(after.draft.pages[i].sections,initial.draft.pages[i].sections);
 await page.screenshot({path:'test-results/duplicate-review-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('OK contrôle des doublons, garde avant sauvegarde, pages multiples, confirmation durable et exclusion réversible ; plein écran, pincement, déplacement, rotation, hors ligne et corrections intactes ; contraste 320/390 clair/sombre');
}catch(error){await mkdir('test-results',{recursive:true});await page?.screenshot({path:'test-results/photo-review-failure.png',fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw error;}finally{await browser?.close();server.kill();}
