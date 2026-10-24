import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

// Dedicated test browser and synthetic records only. No account or production data.
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Serveur de test indisponible.')),15000);server.stdout.on('data',data=>{if(String(data).includes('http://')){clearTimeout(timeout);resolve();}});server.on('error',reject);});
let browser,qaPage;const errors=[];
const base='http://localhost:8765/';
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();
  qaPage=page;
  page.on('pageerror',e=>errors.push(e.message));
  const go=async route=>{await page.goto(base+'#'+route);await page.locator('#app-version').filter({hasText:'1.3.0'}).waitFor();await page.waitForFunction(route=>document.querySelector('#main')?.dataset.view===route,route);};
  const state=fn=>page.evaluate(fn);
  await go('home');await page.getByRole('button',{name:'Commencer',exact:true}).click();
  await go('settings');await page.locator('[name=scanSound]').uncheck();await page.locator('[name=scanVibration]').uncheck();await page.getByRole('button',{name:'Enregistrer les options'}).click();await page.waitForFunction(async()=>{const s=await import('./js/storage.js');return s.settings().scanSound===false;});
  assert.equal(await state(async()=>{const s=await import('./js/storage.js');return s.settings().scanSound}),false);
  await page.locator('[name=shortcut0]').selectOption('journal');await page.locator('[name=shortcut1]').selectOption('scan');await page.locator('[name=shortcut2]').selectOption('stock');await page.locator('[name=shortcut3]').selectOption('');await page.getByRole('button',{name:'Enregistrer mon accueil'}).click();await page.waitForFunction(async()=>{const s=await import('./js/storage.js');return s.settings().homeShortcuts?.join(',')==='journal,scan,stock';});
  await go('home');assert.equal(await page.locator('.quick-grid button').count(),3);assert.match(await page.locator('.quick-grid button').first().innerText(),/Journal/);

  await go('locations');await page.getByRole('button',{name:'Importer les emplacements',exact:true}).click();
  await page.locator('[name=csv]').fill('reference;emplacement\n001234;A-01\n001234;B-02\n001234;A-01\nTEST-02;C-03');await page.getByRole('button',{name:'Vérifier avant d’importer'}).click();await page.getByRole('button',{name:'Confirmer cet import'}).click();await page.locator('#dialog').waitFor({state:'hidden'});
  let imported=await state(async()=>{const s=await import('./js/storage.js');return s.list('products').find(p=>p.sku==='001234')});assert.deepEqual(imported.locations,['A-01','B-02']);
  await page.getByRole('button',{name:'Importer les emplacements',exact:true}).click();await page.locator('[name=csv]').fill('reference;emplacement\n001234;Z-99');await page.getByRole('button',{name:'Vérifier avant d’importer'}).click();await page.getByRole('button',{name:'Confirmer cet import'}).click();await page.locator('#dialog').waitFor({state:'hidden'});
  await go('history');await page.getByRole('button',{name:'Annuler la dernière action',exact:true}).click();await page.getByRole('button',{name:'Confirmer l’annulation'}).click();await page.locator('#dialog').waitFor({state:'hidden'});
  imported=await state(async()=>{const s=await import('./js/storage.js');return s.list('products').find(p=>p.sku==='001234')});assert.deepEqual(imported.locations,['A-01','B-02']);
  console.log('OK import CSV multi-emplacements et annulation persistante');

  await go('stock');await page.locator('[data-filter-search]').fill('001234');await page.locator('.product-record').first().locator('[data-action=edit-product]').click();
  await page.locator('[name=name]').fill('Étole Marguerites');await page.locator('[name=aliases]').fill('petit foulard');await page.locator('[name=unitsPerPick]').fill('4');await page.locator('#product-photo').setInputFiles('site/assets/icon-192.png');
  await page.locator('#dialog [data-product-photo][src]').waitFor();await page.locator('[data-form=product] button[type=submit]').click();await page.locator('#dialog').waitFor({state:'hidden'});
  await page.locator('[data-filter-search]').fill('petit foulard');await page.waitForTimeout(250);assert.match(await page.locator('#main').innerText(),/Étole Marguerites/);await page.locator('.product-record .product-photo[src]').waitFor();
  console.log('OK photo produit, alias et recherche tolérante');

  await go('home');await page.locator('[data-nav=more]').click();await page.locator('[data-nav=orders]').click();await page.getByRole('button',{name:'Ajouter une commande',exact:true}).first().click();
  await page.locator('[name=number]').fill('BROUILLON-42');await page.locator('[data-line-field=sku]').fill('001234');await page.locator('[data-line-field=quantity]').fill('12');await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();
  await go('home');await page.getByRole('button',{name:'Reprendre',exact:true}).click();assert.equal(await page.locator('[name=number]').inputValue(),'BROUILLON-42');assert.equal(await page.locator('[data-line-field=quantity]').inputValue(),'12');
  await page.locator('[name=checked]').check();await page.locator('[data-form=order] [type=submit]').click();await page.locator('#dialog').waitFor({state:'hidden'});
  assert.equal(await state(async()=>{const s=await import('./js/storage.js');return s.list('orders').find(r=>r.number==='BROUILLON-42').total}),3);
  assert.equal(await state(async()=>{const s=await import('./js/storage.js');return (await s.drafts()).some(d=>d.value.form==='order')}),false);
  console.log('OK brouillon repris après navigation et suppression après enregistrement');

  await go('scan');await page.locator('[name=code]').fill('INCONNU-TEST');await page.locator('[data-form=lookup-product] [type=submit]').click();
  await page.waitForFunction(async()=>{const s=await import('./js/storage.js');return s.list('unknowns').some(r=>r.code==='INCONNU-TEST')});
  await go('unknowns');assert.match(await page.locator('#main').innerText(),/INCONNU-TEST/);
  console.log('OK codes inconnus conservés');

  await state(async()=>{const s=await import('./js/storage.js'),at=new Date(Date.now()-31*60000).toISOString();await s.saveBatch([{type:'pending',record:{id:'test-w1',sku:'001234',orderNumber:'C-1',quantity:10,received:3,status:'partial',createdAt:at}},{type:'pending',record:{id:'test-w2',sku:'001234',orderNumber:'C-2',quantity:5,received:0,status:'waiting',priority:'urgent',createdAt:at}}],'Test attentes');});
  await go('pending');await page.getByRole('button',{name:'Regrouper par référence',exact:true}).click();assert.match(await page.locator('#main').innerText(),/12 unité/);assert.match(await page.locator('#main').innerText(),/30 min/);
  await page.getByRole('button',{name:'Répartir une réception',exact:true}).click();await page.locator('[data-ops-form=receipt] [name=quantity]').fill('9');await page.getByRole('button',{name:'Proposer la répartition'}).click();await page.getByRole('button',{name:'Confirmer la réception'}).click();await page.locator('#dialog').waitFor({state:'hidden'});
  const received=await state(async()=>{const s=await import('./js/storage.js');return ['test-w1','test-w2'].map(id=>s.get('pending',id).received)});assert.deepEqual(received,[7,5]);
  await go('history');await page.getByRole('button',{name:'Annuler la dernière action',exact:true}).click();await page.getByRole('button',{name:'Confirmer l’annulation'}).click();await page.locator('#dialog').waitFor({state:'hidden'});assert.deepEqual(await state(async()=>{const s=await import('./js/storage.js');return ['test-w1','test-w2'].map(id=>s.get('pending',id).received)}),[3,0]);
  console.log('OK groupement, repère des 30 min, répartition et annulation groupée');

  await go('journal');await page.locator('[name=activities]').fill('Préparation de commandes et contrôle des casiers.');await page.locator('[name=difficulties]').fill('Une référence manquante.');await page.getByRole('button',{name:'Enregistrer le journal',exact:true}).click();await page.waitForFunction(async()=>{const s=await import('./js/storage.js');return s.list('journal').some(r=>r.activities==='Préparation de commandes et contrôle des casiers.');});
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Relire et exporter en PDF'}).click();const pdf=await downloading;await mkdir('test-results',{recursive:true});await pdf.saveAs('test-results/journal-test.pdf');assert.match(pdf.suggestedFilename(),/^journal-ek-/);await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();
  console.log('OK journal hebdomadaire et PDF');

  // Exercise the actual canvas perspective path without loading the OCR models.
  assert.equal(await state(async()=>{const m=await import('./js/photo-tools.js'),c=document.createElement('canvas');c.width=200;c.height=300;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,200,300);const out=await m.rectifyPhoto(c,[{x:5,y:10},{x:190,y:5},{x:180,y:290},{x:10,y:280}]);return out.width>100&&out.height>200}),true);
  assert.equal(await state(async()=>{const s=await import('./js/storage.js'),m=await import('./js/model.js'),p=m.products().find(p=>p.id.startsWith('draeger-'));await s.save('products',{...p,name:'Test correction'},'Test référence publique');await s.undoLast();return m.products().find(r=>r.id===p.id)?.name===p.name;}),true);
  // Conflicting revisions must never be silently undone.
  assert.equal(await state(async()=>{const s=await import('./js/storage.js');await s.save('pending',{id:'conflict',sku:'T',status:'waiting',quantity:2,received:0},'Test conflit');await s.merge([{id:'remote-future',type:'pending',record:{id:'conflict',sku:'T',status:'received',quantity:2,received:2},updatedAt:new Date(Date.now()+60000).toISOString(),schema:1}]);try{await s.undoLast();return false;}catch{return s.get('pending','conflict').status==='received';}}),true);
  console.log('OK redressement réel et protection des modifications concurrentes');

  for(const width of [320,390,480,1280]){
    await page.setViewportSize({width,height:844});
    for(const route of ['home','settings','stock','locations','pending','unknowns','journal']){
      await go(route);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`${route} déborde à ${width}px`);
    }
  }
  await page.setViewportSize({width:390,height:844});await go('pending');await page.screenshot({path:'test-results/mobile-pending.png',fullPage:true});
  await go('journal');await page.screenshot({path:'test-results/mobile-journal.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('OK 28 écrans/largeurs sans débordement et aucune erreur JavaScript');
}catch(error){await mkdir('test-results',{recursive:true});if(qaPage){await qaPage.screenshot({path:'test-results/failure.png',fullPage:true}).catch(()=>{});console.error('État de la page :',await qaPage.locator('body').innerText().catch(()=>''));}throw error;}finally{await browser?.close();server.kill();}
