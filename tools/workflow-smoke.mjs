import {waitForState} from './poll.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {SHEETS} from '../site/js/core.js';

// Isolated browser, synthetic records and a simulated Google server only.
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',d=>{if(String(d).includes('http://')){clearTimeout(timer);resolve();}});server.on('error',reject);});
const base='http://localhost:8765/',sheet='synthetic-sheet-12345678901234567890',remote=new Map(Object.values(SHEETS).map(title=>[title,[]]));
let testKey;
let browser,page,failNext=false,duringAppend,appends=0,releaseLookup;const errors=[];
const read=(fn,arg)=>page.evaluate(fn,arg);
const go=async route=>{await page.goto(base+'#'+route);await page.locator('#app-version').filter({hasText:'1.11.0'}).waitFor();await page.waitForFunction(route=>document.querySelector('#main')?.dataset.view===route,route);};
const close=async()=>{await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();};
const field=name=>page.locator('#dialog [name="'+name+'"]');
const save=async type=>{await page.locator('[data-form="'+type+'"] [type=submit]').click();await page.locator('#dialog').waitFor({state:'hidden'});};
async function googleRoutes(context){
 await context.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:'window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken(){o.callback({access_token:"synthetic-test-token",expires_in:3600})}})}}};'}));
 await context.route('https://sheets.googleapis.com/**',async route=>{
  if(failNext){failNext=false;return route.abort('failed');}
  const request=route.request(),url=new URL(request.url());let body={};
  if(url.pathname.endsWith(':append')){
   appends++;const tab=decodeURIComponent(url.pathname.split('/values/')[1]).split('!')[0].replaceAll("'",'').replace(':append','');
   const data=request.postDataJSON();remote.get(tab).push(...data.values);if(duringAppend){const task=duringAppend;duringAppend=null;await task();}body={updates:{updatedRows:data.values.length}};
  }else if(url.pathname.endsWith('values:batchGet')){
   body={valueRanges:url.searchParams.getAll('ranges').map(range=>{const tab=range.split('!')[0].replaceAll("'",''),start=Number(range.match(/!A(\d+)/)[1])-2;return {range,values:remote.get(tab).slice(start,start+2500)};})};
  }else if(request.method()==='GET')body={sheets:[...remote].map(([title,rows])=>({properties:{title,gridProperties:{rowCount:Math.max(2,rows.length+1)}}}))};
  else throw Error('Appel Google inattendu dans le test : '+url.pathname);
  return route.fulfill({json:body});
 });
}
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});await googleRoutes(context);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await go('home');await page.getByRole('button',{name:'Commencer',exact:true}).click();
 assert.deepEqual(await page.locator('#mobile-nav button').allTextContents(),['Accueil','Codes','Manquants','Produits','Plus']);
 assert.equal(await page.locator('.chart-wrap').count(),0);
 await page.locator('[data-backup-kind=local]').waitFor();
 await read(async()=>{const s=await import('./js/storage.js');await s.saveBatch([{type:'products',record:{id:'flow-a',sku:'FLOW001',name:'Carnet test ergonomie',familyId:'papeterie-carnets-et-blocs-notes',unitsPerPick:4,location:'PAC001-A',locations:['PAC001-A','RES002-B'],preferredLocation:'RES002-B'}},{type:'products',record:{id:'flow-b',sku:'FLOW002',name:'Carte test ergonomie',familyId:'cartes',unitsPerPick:4}},{type:'locations',record:{id:'flow-loc',name:'PAD009-C',zone:'Autre',notes:'Casier témoin'}}],'Données synthétiques');});
 await go('pending');await page.getByRole('button',{name:'Noter un manquant',exact:true}).first().click();await field('orderNumber').fill('CMD-001');await field('sku').fill('FLOW001');await field('location').waitFor();await page.waitForFunction(()=>document.querySelector('[name=location]').value==='002-B');assert.equal(await field('locationType').inputValue(),'RES');
 await page.getByRole('button',{name:'Enregistrer et ajouter un autre manquant'}).click();await page.waitForFunction(()=>document.querySelector('[name=sku]')?.value==='');assert.equal(await field('orderNumber').inputValue(),'CMD-001');assert.equal(await field('location').inputValue(),'');assert.equal(await field('notes').inputValue(),'');
 await field('sku').fill('FLOW002');await save('pending');assert.equal(await read(async()=>{const s=await import('./js/storage.js');return s.list('pending').filter(r=>r.orderNumber==='CMD-001').length}),2);
 console.log('OK enchaînement des manquants et préférence explicite entre plusieurs emplacements');

 await context.grantPermissions(['clipboard-read','clipboard-write']);
 const jcCard=page.locator('.pending-card').filter({hasText:'RES002-B'});
 await jcCard.getByRole('button',{name:'Message pour JC',exact:true}).click();
 const expectedJC='JC, j’ai besoin de la référence FLOW001 pour poursuivre ma préparation. Emplacement concerné : RES002-B. Peux-tu aller chercher l’article ? Merci !';
 assert.equal(await page.locator('[data-jc-message]').inputValue(),expectedJC);
 await page.locator('#dialog [data-action=quickhelp]').click();assert.match(await page.locator('#context-help-title').innerText(),/message pour JC/);await page.locator('#help-dialog').getByRole('button',{name:'Reprendre',exact:true}).click();
 await page.getByRole('button',{name:'Copier le message',exact:true}).click();await page.getByText('Message copié.',{exact:true}).waitFor();assert.equal(await read(()=>navigator.clipboard.readText()),expectedJC);await close();
 await page.locator('.pending-card').filter({hasText:'FLOW002'}).getByRole('button',{name:'Message pour JC',exact:true}).click();await page.getByRole('button',{name:'Compléter la fiche',exact:true}).click();assert.equal(await field('sku').inputValue(),'FLOW002');
 await field('orderNumber').fill('SAISIE-CONSERVEE');await page.locator('#dialog [data-action=quickhelp]').click();assert.match(await page.locator('#context-help-title').innerText(),/manquant/);await page.keyboard.press('Escape');await page.locator('#help-dialog').waitFor({state:'hidden'});assert.equal(await field('orderNumber').inputValue(),'SAISIE-CONSERVEE');assert.equal(await page.locator('#dialog').getAttribute('open'),'');await close();
 console.log('OK modèle JC, copie réelle, casier absent et aide sans perte de saisie');


 await page.getByRole('button',{name:'Noter un manquant',exact:true}).first().click();await field('orderNumber').fill('CMD-001');await field('sku').fill('FLOW001');await page.locator('[data-pending-duplicates]:not([hidden])').waitFor();await page.locator('[data-form=pending] [type=submit]').click();await page.locator('[data-form-error]:not([hidden])').waitFor();assert.match(await page.locator('[data-form-error]').innerText(),/déjà signalée/);
 await page.getByRole('button',{name:'Ouvrir l’attente existante'}).click();assert.ok(await page.locator('[data-form=pending]').getAttribute('data-id'));await close();
 await page.getByRole('button',{name:'Noter un manquant',exact:true}).first().click();await field('orderNumber').fill('CMD-001');await field('sku').fill('FLOW001');await field('allowDuplicate').check();await field('locationType').selectOption('PAD');await field('location').fill('003-C');await field('notes').fill('Second casier concerné');await save('pending');
 assert.equal(await read(async()=>{const s=await import('./js/storage.js');return s.list('pending').filter(r=>r.orderNumber==='CMD-001'&&r.sku==='FLOW001').length}),2);
 const first=page.locator('.pending-card').filter({hasText:'RES002-B'});await first.getByRole('button',{name:'Reçu',exact:true}).click();await first.getByRole('button',{name:'Commande terminée',exact:true}).click();await page.getByText('Une autre référence de cette commande attend encore son réassort.',{exact:true}).waitFor();
 assert.equal(await read(async()=>{const s=await import('./js/storage.js');return s.list('pending').find(r=>r.orderNumber==='CMD-001'&&r.location==='RES002-B').status}),'received');
 for(const id of await page.locator('[data-action=pending-received]').evaluateAll(rows=>rows.map(r=>r.dataset.id))){await page.locator('[data-action=pending-received][data-id="'+id+'"]').click();await waitForState(page,async id=>{const s=await import('./js/storage.js');return s.get('pending',id).status==='received'},id);}await page.locator('.pending-card').getByRole('button',{name:'Commande terminée',exact:true}).first().click();await waitForState(page,async()=>{const s=await import('./js/storage.js');return s.list('pending').filter(r=>r.orderNumber==='CMD-001').every(r=>r.status==='done')});
 console.log('OK doublons ouverts, exception justifiée et clôture de commande protégée puis groupée');

 await page.getByRole('button',{name:'Noter un manquant',exact:true}).first().click();await field('orderNumber').fill('CMD-SCAN');await page.getByRole('button',{name:'Scanner la référence',exact:true}).click();await page.locator('[name=code]').fill('FLOW001');await page.locator('[data-form=lookup-product] [type=submit]').click();await page.getByRole('button',{name:'Utiliser pour le manquant'}).click();assert.equal(await field('orderNumber').inputValue(),'CMD-SCAN');await page.waitForFunction(()=>document.querySelector('[data-form=pending] [name=sku]')?.value==='FLOW001');await save('pending');
 await go('stock');await page.locator('[data-filter-search]').fill('FLOW001');await page.locator('.product-record[data-id=flow-a]').click();await page.getByRole('button',{name:'Corriger l’emplacement',exact:true}).click();await field('preferredLocation').selectOption('PAC001-A');await save('product');
 await go('pending');await page.getByRole('button',{name:'Noter un manquant',exact:true}).first().click();await field('orderNumber').fill('CMD-PREF');await field('sku').fill('FLOW001');await page.waitForFunction(()=>document.querySelector('[name=location]').value==='001-A');assert.equal(await field('locationType').inputValue(),'PAC');await close();
 console.log('OK scanner dans le contexte du manquant et modification de l’emplacement habituel');

 await go('home');await page.locator('#common-search').fill('PAD009-C');await page.locator('[data-form=search-workspace] [type=submit]').click();await page.getByRole('button',{name:'Afficher le code',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#barcode-stage')?.textContent.includes('PAD009-C'));assert.equal(await page.locator('[name=barcodePurpose]').inputValue(),'location');
 await go('complete');await page.locator('#view-filter').selectOption('location');await page.locator('[data-filter-search]').fill('FLOW002');await page.getByRole('heading',{name:'FLOW002',exact:true}).waitFor();assert.match(await page.locator('#main').innerText(),/Emplacement absent/);
 await go('more');assert.equal(await page.locator('#main details.tool-section').getAttribute('open'),null);await page.getByText('Contrôles de stock',{exact:true}).click();await page.locator('[data-nav=replenishments]').click();await page.getByRole('button',{name:'Ajouter un réglage'}).click();await field('sku').fill('FLOW001');await field('location').fill('PAC001-A');await field('min').fill('2');await field('max').fill('20');await field('current').fill('1');await save('replenishment');
 assert.match(await page.locator('#main').innerText(),/Constaté le/);assert.equal(await read(async()=>{const s=await import('./js/storage.js');return s.list('replenishments')[0].economic}),null);
 console.log('OK recherche commune, code d’emplacement, liste à compléter et constat daté sans niveau économique obligatoire');
 // A slow optional web lookup must not lock another form after SPA navigation.
 let lookupDone=false;
 await context.route('https://fr.checkout.draegerparis.com/search/suggest.json?**',async route=>{await new Promise(resolve=>{releaseLookup=resolve;});lookupDone=true;await route.fulfill({json:{resources:{results:{products:[]}}}}).catch(()=>{});});
 await go('scan');await page.locator('[name=code]').fill('SLOW-UNKNOWN');const looking=page.waitForRequest(r=>r.url().includes('/search/suggest.json?'));await page.locator('[data-form=lookup-product] [type=submit]').click();await looking;
 await page.locator('#mobile-nav [data-nav=pending]').click();await page.getByRole('button',{name:'Noter un manquant',exact:true}).first().click();await field('orderNumber').fill('CMD-WHILE-LOOKUP');await field('sku').fill('FLOW002');await page.locator('[data-form=pending] [type=submit]').click();await page.locator('#dialog').waitFor({state:'hidden',timeout:3000});assert.equal(lookupDone,false);releaseLookup();await context.unroute('https://fr.checkout.draegerparis.com/search/suggest.json?**');
 console.log('OK une recherche réseau en cours ne bloque pas l’enregistrement d’un autre formulaire');


 await go('settings');testKey=await read(async()=>{const c=await import('./js/secure-core.js'),s=await import('./js/secure-session.js');const f=await c.generateRecoveryKey();await s.unlock(f);return f;});await page.locator('[data-form=settings] [name=name]').fill('Prénom non enregistré');await read(async()=>{const s=await import('./js/storage.js');await s.save('products',{...s.get('products','flow-b'),notes:'Actualisation en arrière-plan'},'Test saisie en cours');});assert.equal(await page.locator('[data-form=settings] [name=name]').inputValue(),'Prénom non enregistré');await page.locator('[name=spreadsheetId]').fill(sheet);await page.locator('[data-google-connect]').click();await page.locator('[data-backup-kind=synced]').waitFor();assert.equal(await read(async()=>{const s=await import('./js/storage.js');return s.pendingEvents().length}),0);assert.ok(appends>0);assert.ok([...remote.values()].flat().some(row=>row[7]==='FLOW001'));
 failNext=true;await read(async()=>{const s=await import('./js/storage.js');await s.save('products',{...s.get('products','flow-a'),notes:'À transmettre après coupure'},'Test coupure');});
 await page.locator('[data-backup-kind=error]').waitFor();assert.ok(await read(async()=>{const s=await import('./js/storage.js');return s.pendingEvents().length})>0);await page.locator('[data-google-connect]').click();await page.locator('[data-backup-kind=synced]').waitFor();
 duringAppend=()=>read(async()=>{const s=await import('./js/storage.js');await s.save('products',{...s.get('products','flow-a'),notes:'Modification pendant l’envoi'},'Test concurrence');});
 await read(async()=>{const s=await import('./js/storage.js');await s.save('products',{...s.get('products','flow-a'),notes:'Début de l’envoi'},'Test envoi');});await page.locator('[data-google-connect]').click();await page.locator('[data-backup-kind=pending]').waitFor();assert.ok(await read(async()=>{const s=await import('./js/storage.js');return s.pendingEvents().length})>0);await page.locator('[data-google-connect]').click();await page.locator('[data-backup-kind=synced]').waitFor();
 console.log('OK vraie logique Google sur serveur simulé : envoi, coupure, reprise et modification pendant la sauvegarde');

 const context2=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await googleRoutes(context2);const second=await context2.newPage();await second.goto(base+'#settings');await second.getByRole('button',{name:'Commencer',exact:true}).click();await second.locator('#dialog').waitFor({state:'hidden'});await second.evaluate(async key=>{const s=await import('./js/secure-session.js');await s.unlock(key);},testKey);await second.locator('[name=spreadsheetId]').fill(sheet);await second.locator('[data-google-connect]').click();await second.locator('[data-backup-kind=synced]').waitFor().catch(async e=>{console.error('Deuxième appareil :',await second.locator('body').innerText());throw e;});
 assert.equal(await second.evaluate(async()=>{const s=await import('./js/storage.js');return s.get('products','flow-a').preferredLocation}),'PAC001-A');
 await second.evaluate(async()=>{const s=await import('./js/storage.js');await s.save('products',{...s.get('products','flow-a'),name:'Carnet corrigé sur appareil 2'},'Deuxième appareil');});await second.locator('[data-google-connect]').click();await second.locator('[data-backup-kind=synced]').waitFor();await page.locator('[data-google-connect]').click();await waitForState(page,async()=>{const s=await import('./js/storage.js');return s.get('products','flow-a')?.name==='Carnet corrigé sur appareil 2'});await context2.close();
 console.log('OK fusion de deux appareils avec historique et emplacement habituel conservés');

 await go('pending');await page.getByRole('button',{name:'Noter un manquant',exact:true}).first().click();await field('orderNumber').fill('CMD-OFFLINE');await field('sku').fill('FLOW002');await close();await go('home');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Reprendre',exact:true}).first().click();assert.equal(await field('orderNumber').inputValue(),'CMD-OFFLINE');await close();await page.locator('[data-backup-kind=offline]').waitFor();await context.setOffline(false);
 console.log('OK rechargement hors ligne réel avec service worker et brouillon conservé');
 await mkdir('test-results',{recursive:true});await go('home');await page.screenshot({path:'test-results/workflow-home.png',fullPage:true});await go('complete');await page.locator('[data-filter-search]').fill('FLOW');await page.waitForTimeout(200);await page.screenshot({path:'test-results/workflow-complete.png',fullPage:true});
 for(const width of [320,390,480,1280]){await page.setViewportSize({width,height:844});for(const route of ['home','stock','complete','more','orders','settings']){await go(route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,route+' à '+width+' px');}}

 await page.setViewportSize({width:390,height:844});
 const helpRoutes=['home','codes','scan','pending','orders','stock','families','locations','complete','unknowns','movements','inventories','issues','replenishments','history','journal','settings','more','help'];
 for(const theme of ['light','dark']){
  await page.evaluate(async theme=>{const s=await import('./js/storage.js');await s.save('preferences',{...s.settings(),id:'main',theme},'Test thème');},theme);
  for(const route of helpRoutes){await go(route);assert.equal(await page.locator('html').getAttribute('data-theme'),theme);await page.locator('.topbar [data-action=quickhelp]').click();await page.locator('#help-dialog[open]').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,route+' / '+theme);assert.ok((await page.locator('#help-dialog .step').count())>=2);await page.locator('#help-dialog').getByRole('button',{name:'Reprendre',exact:true}).click();}
  await go('home');assert.match(await page.title(),/Pikéo/);await page.screenshot({path:'test-results/pikeo-home-'+theme+'.png',fullPage:true});
 }
 console.log('OK aide sur 19 écrans en clair/sombre et identité Pikéo');
 assert.deepEqual(errors,[]);console.log('OK 24 contrôles supplémentaires de largeur et aucune erreur JavaScript');
}catch(error){await mkdir('test-results',{recursive:true});await page?.screenshot({path:'test-results/workflow-failure.png',fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw error;}finally{releaseLookup?.();await browser?.close();server.kill();}
