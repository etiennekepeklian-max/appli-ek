import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',d=>{if(String(d).includes('http://')){clearTimeout(t);resolve();}});server.on('error',reject);});
let browser,page;const errors=[],base='http://localhost:8765/';
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow',acceptDownloads:true});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const go=async route=>{await page.goto(base+'#'+route);await page.waitForFunction(r=>document.querySelector('#main')?.dataset.view===r,route);};
 const field=n=>page.locator('#dialog [name="'+n+'"]');
 const action=(name,id)=>page.locator('[data-wb-action="'+name+'"]'+(id?'[data-id="'+id+'"]':''));
 const until=async(fn,arg)=>{const end=Date.now()+15000;while(Date.now()<end){if(await page.evaluate(fn,arg))return;await new Promise(r=>setTimeout(r,50));}throw Error('État attendu non atteint.');};
 const close=async()=>page.locator('#dialog .dialog-top [data-action=close-dialog]').click();
 const save=async()=>{await page.locator('#dialog [data-wb-form=record] [type=submit]').click();await page.locator('#dialog').waitFor({state:'hidden'});};
 await go('post');await page.getByRole('button',{name:'Commencer',exact:true}).click();
 await until(async()=>{const r=await import('./js/recovery.js');return (await r.available()).length>0;});
 assert.match(await page.locator('#main').innerText(),/Aucun matériel imposé/);
 await action('new','equipment').click();await field('title').fill('Contrôle équipement choisi');
 await page.locator('#dialog [data-action=quickhelp]').click();assert.match(await page.locator('#help-dialog').innerText(),/matériel/);
 await page.locator('#help-dialog').getByRole('button',{name:'Reprendre',exact:true}).click();assert.equal(await field('title').inputValue(),'Contrôle équipement choisi');await save();
 await page.locator('[data-wb-equipment]').check();
 await until(async()=>{const s=await import('./js/workbench-store.js');return !!s.list('equipment')[0].checkedDate;});
 await go('instructions');await action('new','instruction').click();await field('title').fill('Consigne test en cours');await close();await action('new','instruction').click();assert.equal(await field('title').inputValue(),'Consigne test en cours');
 await field('sku').fill('00123');await field('author').fill('Auteur de test');await field('source').fill('Procédure fictive');await save();assert.match(await page.locator('#main').innerText(),/Auteur de test/);
 await go('progress');await action('new-goal').click();await field('title').fill('Mieux préparer une reprise');await field('target').fill('2');await save();await action('goal-plus').click();await until(async()=>{const s=await import('./js/workbench-store.js');return s.list('goal')[0]?.progress===1;});
 await action('new','fatigue').click();await field('title').fill('Ressenti privé synthétique');await field('notes').fill('Privé hors Google');await save();
 const payload=await page.evaluate(async()=>{const s=await import('./js/storage.js');return JSON.stringify(await s.exportData());});assert.ok(!payload.includes('Privé hors Google'));
 await page.evaluate(async()=>{const s=await import('./js/storage.js');await s.saveBatch([{type:'pending',record:{id:'wb-a',orderNumber:'TEST-A',sku:'00123',location:'PAC001',status:'received'}},{type:'pending',record:{id:'wb-b',orderNumber:'TEST-A',sku:'00456',location:'RES002',status:'waiting',nextAction:'Vérifier la disponibilité',notes:'Note privée client test'}}],'Cas synthétique');});
 await go('resume');assert.match(await page.locator('#main').innerText(),/1 référence\(s\) attendent/);
 await action('resume-order','TEST-A').click();await field('line').fill('12');await field('bin').fill('Bac 3');await field('next').fill('Reprendre à la ligne 12');await save();assert.match(await page.locator('#main').innerText(),/Bac 3/);
 await go('handoff');await page.locator('[name=selected][value=wb-b]').check();await page.locator('[data-wb-form=handoff] [type=submit]').click();const text=await page.locator('[data-wb-preview]').inputValue();assert.ok(text.includes('Vérifier la disponibilité'));assert.ok(!text.includes('Note privée client test'));await close();
 await go('storage');await action('checkpoint').click();await until(async()=>{const s=await import('./js/workbench-store.js');return (await s.listSnapshots()).length>=2;});
 const snapshot=await page.evaluate(async()=>{const s=await import('./js/workbench-store.js');return (await s.listSnapshots()).find(r=>r.id.startsWith('manual-')).id;});
 await page.evaluate(async()=>{const s=await import('./js/storage.js');await s.save('products',{id:'wb-temporary',sku:'WB-TEMP',name:'Après le point'},'Après le point');});
 await page.locator('[data-wb-snapshots] [data-id="'+snapshot+'"]').waitFor();await action('restore-point',snapshot).click();await action('confirm-restore',snapshot).click();await page.locator('#dialog').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(async()=>{const s=await import('./js/storage.js');return s.get('products','wb-temporary')?.deleted;}),true);
 assert.ok(await page.evaluate(async()=>{const s=await import('./js/storage.js');return s.getEvents('products','wb-temporary').length>=2;}));
 const cryptoResult=await page.evaluate(async()=>{
  const c=await import('./js/secure-core.js'),s=await import('./js/storage.js'),l=await import('./js/workbench-store.js');
  const file=await c.generateRecoveryKey(),key=await c.importRecoveryKey(file),data=await s.exportData(),personal=l.localData(),sealed=await c.sealJSON({data,personal},key);
  let wrong=false;try{await c.openJSON(sealed,await c.importRecoveryKey(await c.generateRecoveryKey()));}catch{wrong=true;}
  const restored=await c.openJSON(sealed,key);return {wrong,hidden:!JSON.stringify(sealed).includes('Privé hors Google'),events:restored.data.events.length,personal:restored.personal.records.length};
 });assert.equal(cryptoResult.wrong,true);assert.equal(cryptoResult.hidden,true);assert.ok(cryptoResult.events>0&&cryptoResult.personal>0);
 const before=await page.evaluate(async()=>{const s=await import('./js/storage.js');return s.allEvents().length;});
 const invalid=await page.evaluate(async()=>{const s=await import('./js/storage.js');try{await s.importData({app:'EK Logistique',schema:1,events:[{id:'should-not-import',type:'products',updatedAt:new Date().toISOString(),record:{id:'invalid-file-import'}}],files:[{id:'broken',data:'invalid'}]});return false;}catch{return true;}});
 assert.equal(invalid,true);assert.equal(await page.evaluate(async()=>{const s=await import('./js/storage.js');return s.allEvents().length;}),before);

 await go('storage');
 await page.locator('[data-legacy-crypto]').evaluate(e=>e.open=true);const keyDownloadPromise=page.waitForEvent('download');await action('create-key').click();const keyDownload=await keyDownloadPromise,keyPath=await keyDownload.path(),keyFile=JSON.parse(await readFile(keyPath,'utf8'));assert.equal(keyFile.app,'PikeoRecoveryKey');await close();
 await page.evaluate(async()=>{const s=await import('./js/workbench-store.js');await s.save('resume',{id:'wb-photo',title:'Repère avec photo',date:'2026-10-25',photo:new Blob([new Uint8Array([1,2,255])],{type:'image/jpeg'})});});
 const downloadPromise=page.waitForEvent('download');await action('encrypted-export').click();const encryptedDownload=await downloadPromise,encryptedPath=await encryptedDownload.path(),encryptedText=await readFile(encryptedPath,'utf8');assert.ok(!encryptedText.includes('Privé hors Google'));assert.ok(!encryptedText.includes('Repère avec photo'));await close();
 await page.evaluate(async()=>{const l=await import('./js/workbench-store.js'),k=await import('./js/secure-session.js');for(const r of l.list('fatigue'))await l.remove(r.id);await l.remove('wb-photo');await k.create();});
 await page.locator('[data-wb-file=encrypted-import]').setInputFiles(encryptedPath);await page.getByText('Clé incorrecte ou fichier modifié. Aucune donnée n’a été restaurée.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(async()=>{const l=await import('./js/workbench-store.js');return l.list('fatigue').length;}),0);
 const chooserPromise=page.waitForEvent('filechooser');await action('load-key').click();const chooser=await chooserPromise;await chooser.setFiles(keyPath);await page.locator('#toast').filter({hasText:'Clé chargée pour cette session.'}).waitFor();
 await page.locator('[data-wb-file=encrypted-import]').setInputFiles(encryptedPath);await action('confirm-import').waitFor();await action('confirm-import').click();await page.locator('#dialog').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(async()=>{const l=await import('./js/workbench-store.js');return l.list('fatigue').length;}),1);
 assert.deepEqual(await page.evaluate(async()=>{const l=await import('./js/workbench-store.js');return Array.from(new Uint8Array(await l.get('wb-photo').photo.arrayBuffer()));}),[1,2,255]);
 const mergedGoal=await page.evaluate(async()=>{const l=await import('./js/workbench-store.js'),original=l.list('goal').find(r=>r.active).id;await l.restoreLocal({records:[{id:'imported-goal',kind:'goal',title:'Autre objectif importé',date:'2026-10-25',target:2,progress:0,active:true,updatedAt:new Date().toISOString()}]});return {original,active:l.list('goal').filter(r=>r.active).map(r=>r.id)};});assert.deepEqual(mergedGoal.active,[mergedGoal.original]);
 await go('personal');await page.locator('[name=hand]').selectOption('left');await page.locator('[name=textSize]').selectOption('large');await page.locator('[data-wb-form=preferences] [type=submit]').click();assert.equal(await page.locator('html').getAttribute('data-hand'),'left');
 for(const theme of ['light','dark']){await page.evaluate(async theme=>{const s=await import('./js/storage.js');await s.save('preferences',{...s.settings(),id:'main',theme},'Thème de test');},theme);for(const width of [320,390]){await page.setViewportSize({width,height:844});for(const route of ['post','resume','instructions','handoff','personal','progress','improvements','storage','diagnostic','training','conflicts','exports']){
  await go(route);assert.ok(await page.locator('#main h1').count());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Débordement '+route+' / '+width+' / '+theme);
  await page.locator('.topbar [data-action=quickhelp]').click();assert.notEqual(await page.locator('#context-help-title').innerText(),'Pikéo');await page.locator('#help-dialog').getByRole('button',{name:'Reprendre',exact:true}).click();
 }
 }}
 await go('diagnostic');await action('diagnostic').click();await page.getByText('lecture et écriture réussies',{exact:false}).waitFor();
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/workbench-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Mon poste : repères, confidentialité, reprise, clé, import atomique, restauration, aide et affichage mobile OK.');
} catch(e){if(page){console.error('Dernier message',await page.locator('#toast').textContent().catch(()=>''));console.error(await page.locator('body').innerText().catch(()=>''));await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/workbench-failure.png',fullPage:true}).catch(()=>{});}throw e;}finally{await browser?.close();server.kill();}
