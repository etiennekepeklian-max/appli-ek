import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',d=>{if(String(d).includes('http://')){clearTimeout(timer);resolve();}});server.on('error',reject);});
let browser,page;const errors=[],outbound=[];
const base='http://localhost:8765/';
try{
 browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'],...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['camera','microphone'],serviceWorkers:'allow'});
 await context.addInitScript(()=>{
  window.testVibrations=[];navigator.vibrate=pattern=>{window.testVibrations.push(pattern);return true;};
  window.testStreams=[];window.testCaptureRequests=[];const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=async constraints=>{window.testCaptureRequests.push(constraints);const stream=await capture(constraints);window.testStreams.push(stream);return stream;};
 });
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base))outbound.push(r.url());});
 const go=async route=>{await page.goto(base+'#'+route);await page.waitForFunction(route=>document.querySelector('#main')?.dataset.view===route,route);};
 await go('home');await page.getByRole('button',{name:'Commencer',exact:true}).click();
 await page.locator('[data-nav=more]').click();await page.getByRole('button',{name:/Horaires et alertes/}).click();
 assert.deepEqual(await page.locator('.reminder-time').allTextContents(),['07:52Rappel','10:07Rappel','10:22Rappel','12:22Rappel','13:07Rappel','15:52Rappel']);
 await page.getByRole('button',{name:'Tester une alerte et l’arrêt'}).click();await page.locator('#work-alert').waitFor();
 await page.locator('#mobile-nav [data-nav=home]').click();assert.equal(await page.locator('#work-alert').isVisible(),true);
 await page.locator('#work-alert [data-action=quickhelp]').click();assert.match(await page.locator('#context-help-title').innerText(),/rappel/);await page.locator('#help-dialog').getByRole('button',{name:'Reprendre',exact:true}).click();
 await page.getByRole('button',{name:'Arrêter l’alerte',exact:true}).click();await page.locator('#work-alert').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>window.testVibrations.at(-1)),0);
 const dueAt='2026-10-26T06:52:00Z';await page.evaluate(async at=>{const s=await import('./js/schedule.js');s.tickSchedule(new Date(at));},dueAt);await page.locator('#work-alert').waitFor();
 await go('schedule');await page.locator('#work-alert').waitFor();await page.getByRole('button',{name:'Arrêter l’alerte',exact:true}).click();
 await page.evaluate(async at=>{const s=await import('./js/schedule.js');s.tickSchedule(new Date(at));},dueAt);assert.equal(await page.locator('#work-alert').count(),0);
 await go('schedule');await page.evaluate(async at=>{const s=await import('./js/schedule.js');s.tickSchedule(new Date(at));},dueAt);assert.equal(await page.locator('#work-alert').count(),0);
 await page.locator('[name=breakMinutes]').fill('20');await page.getByRole('button',{name:'Enregistrer mes horaires'}).click();await page.waitForFunction(()=>document.querySelectorAll('.reminder-time')[2]?.textContent==='10:27Rappel');
 await page.locator('#mobile-nav [data-nav=pending]').click();await page.getByRole('button',{name:'Noter un manquant',exact:true}).first().click();await page.locator('#dialog [name=orderNumber]').fill('FORMULAIRE-CONSERVE');
 await page.evaluate(async()=>{const s=await import('./js/schedule.js');s.tickSchedule(new Date('2026-10-26T09:07:00Z'));});await page.locator('#dialog .work-alert-inline').waitFor();await page.locator('#dialog .work-alert-inline').getByRole('button',{name:'Arrêter l’alerte'}).click();assert.equal(await page.locator('#dialog [name=orderNumber]').inputValue(),'FORMULAIRE-CONSERVE');assert.equal(await page.locator('#dialog').getAttribute('open'),'');await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();
 console.log('OK horaires, navigation pendant alerte, vibration répétée simulée, arrêt et acquittement persistant');

 await go('scan');await page.waitForFunction(()=>!!document.querySelector('#scan-video')?.srcObject?.active);
 assert.equal(await page.getByRole('button',{name:'Ouvrir la caméra',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>window.testCaptureRequests[0].audio),false);
 await page.locator('#mobile-nav [data-nav=home]').click();assert.equal(await page.evaluate(()=>window.testStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true);
 console.log('OK caméra réellement ouverte automatiquement avec périphérique synthétique et arrêt à la navigation');

 await go('voice');await page.locator('#memo-count').filter({hasText:'0'}).waitFor();await page.locator('#memo-name').fill('Mémo privé de test');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.getByRole('button',{name:'Arrêter et conserver'}).waitFor();
 await page.waitForFunction(()=>document.querySelector('#voice-live')?.textContent.includes('0:01'));
 await page.getByRole('button',{name:'Arrêter et conserver'}).click();await page.locator('.memo-card').waitFor();
 assert.match(await page.locator('.memo-card h3').innerText(),/Mémo privé de test/);await page.locator('audio').evaluate(el=>el.play());await page.waitForFunction(()=>document.querySelector('audio')?.currentTime>0);await page.locator('audio').evaluate(el=>el.pause());
 assert.equal(await page.evaluate(()=>window.testStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true);
 const audio=await page.evaluate(async()=>{const v=await import('./js/voice-store.js'),s=await import('./js/storage.js'),rows=await v.listMemos(),backup=await s.exportData();return {id:rows[0].id,bytes:rows[0].blob.size,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await rows[0].blob.arrayBuffer()))).join(','),generalHasMemo:JSON.stringify(backup).includes('Mémo privé de test'),googleFiles:(await s.files()).filter(f=>f.blob.type.startsWith('audio/')).length};});
 assert.ok(audio.bytes>0);assert.equal(audio.generalHasMemo,false);assert.equal(audio.googleFiles,0);
 await page.getByRole('button',{name:'Renommer',exact:true}).click();await page.locator('#voice-name').fill('Repère local renommé');await page.locator('[data-voice-form] [type=submit]').click();await page.locator('.memo-card h3').filter({hasText:'Repère local renommé'}).waitFor();
 const backup=await page.evaluate(async()=>{const v=await import('./js/voice-store.js');return v.exportMemos();});
 await go('voice');await page.locator('.memo-card h3').filter({hasText:'Repère local renommé'}).waitFor();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exporter le son',exact:true}).click();assert.match((await download).suggestedFilename(),/\.(webm|m4a|ogg)$/);await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();
 await page.getByRole('button',{name:'Supprimer',exact:true}).click();await page.getByRole('button',{name:'Supprimer ce mémo',exact:true}).click();await page.locator('#memo-count').filter({hasText:'0'}).waitFor();
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Importer une sauvegarde de mémos',exact:true}).click();await (await chooser).setFiles({name:'test-memos.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.locator('.memo-card').waitFor();
 const restored=await page.evaluate(async data=>{const v=await import('./js/voice-store.js'),second=await v.importMemos(data),rows=await v.listMemos();return {count:rows.length,second,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await rows[0].blob.arrayBuffer()))).join(',')};},backup);
 assert.equal(restored.count,1);assert.equal(restored.second,0);assert.equal(restored.hash,audio.hash);
 await go('voice');await page.locator('.memo-card').waitFor();await page.locator('#memo-name').fill('Sauvé en quittant');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.getByRole('button',{name:'Arrêter et conserver'}).waitFor();await page.waitForFunction(()=>document.querySelector('#voice-live')?.textContent.includes('0:01'));await page.locator('#mobile-nav [data-nav=home]').click();
 await page.waitForFunction(async()=>{const v=await import('./js/voice-store.js');return (await v.listMemos()).length===2;});
 await go('voice');await page.locator('#memo-count').filter({hasText:'2'}).waitFor();
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.locator('#memo-count').filter({hasText:'2'}).waitFor();await context.setOffline(false);
 assert.deepEqual(outbound.filter(url=>/^https:\/\/(sheets\.googleapis|www\.googleapis|accounts\.google)/.test(url)),[]);
 console.log('OK véritable audio synthétique : écoute, renommage, fichier exporté, restauration binaire identique, dédoublonnage, arrêt à la navigation, hors ligne et exclusion Google/backup général');

 await mkdir('test-results',{recursive:true});
 for(const theme of ['light','dark'])for(const width of [320,390,480,1280]){
  await page.setViewportSize({width,height:844});await page.evaluate(async theme=>{const s=await import('./js/storage.js');await s.save('preferences',{...s.settings(),id:'main',theme},'Test thème');},theme);
  for(const route of ['schedule','voice','more','settings']){await go(route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,route+' '+theme+' '+width);await page.locator('.topbar [data-action=quickhelp]').click();assert.ok(await page.locator('#help-dialog .step').count()>=2);await page.locator('#help-dialog').getByRole('button',{name:'Reprendre',exact:true}).click();if(width===390&&['schedule','voice'].includes(route))await page.screenshot({path:`test-results/pikeo-${route}-${theme}.png`,fullPage:true});}
 }
 assert.deepEqual(errors,[]);console.log('OK nouveaux parcours et aide en clair/sombre, 32 couples écran/largeur sans débordement');
}catch(error){await mkdir('test-results',{recursive:true});await page?.screenshot({path:'test-results/day-tools-failure.png',fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw error;}finally{await browser?.close();server.kill();}
