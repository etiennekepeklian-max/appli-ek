import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {auditContrast} from './contrast-audit.mjs';
import {waitForState} from './poll.mjs';

const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',s=>{if(String(s).includes('http://')){clearTimeout(timer);resolve();}});server.on('error',reject);});
let browser;const errors=[],report=[],failures=[],base='http://localhost:8765/';
try{
 await mkdir('test-results',{recursive:true});
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/data/catalogue.json',async route=>{await gate;await route.continue();});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('#mascot-status').waitFor({state:'visible'});
 assert.equal(await page.locator('.mascot-deposit').evaluate(el=>getComputedStyle(el).animationName),'mascot-deposit');
 assert.equal(await page.locator('#mascot-status').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 release();await page.locator('#app-version').filter({hasText:'1.16.0'}).waitFor();await page.unroute('**/data/catalogue.json');
 await page.getByRole('button',{name:'Commencer',exact:true}).click();
 const go=async route=>{await page.goto(base+'#'+route);await page.waitForFunction(route=>document.querySelector('#main')?.dataset.view===route,route);};
 const audit=async(label)=>{const result=await page.evaluate(auditContrast);report.push({label,checked:result.checked,min:result.min});failures.push(...result.failures.map(f=>({label,...f})));};

 // Both typed terms and the help return preserve the operator's search.
 await page.getByRole('button',{name:'Trouver une fonction',exact:true}).click();await page.locator('#global-tools-search').fill('mode sombre');
 assert.equal(await page.locator('[data-tool-results] .tool-row').count(),1);
 await page.getByRole('button',{name:'Aide pour cette action',exact:true}).click();
 assert.match(await page.locator('#help-dialog').innerText(),/Trouver une fonction/);
 await page.getByRole('button',{name:'Reprendre',exact:true}).click();assert.equal(await page.locator('#global-tools-search').inputValue(),'mode sombre');
 await page.locator('[data-tool-results] [data-nav=personal]').click();
 await page.locator('[name=theme]').selectOption('dark');await page.locator('[data-wb-form=preferences] [type=submit]').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 await go('home');assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
 assert.equal(await page.locator('.quick-grid button').count(),4);
 assert.ok(await page.locator('.home-enf-link [data-nav=enfs]').isVisible());
 assert.ok((await page.locator('.quick-grid').boundingBox()).y<(await page.locator('.common-search').boundingBox()).y);
 console.log('OK accueil compact, ENF visible, recherche globale et aide sans perte de saisie');

 await go('more');await page.locator('#tools-search').fill('memo vocal');assert.equal(await page.locator('[data-tool-results] [data-nav=voice]').count(),1);
 await page.locator('#tools-search').fill('ZZZINEXISTANT');assert.match(await page.locator('#tools-search-results').innerText(),/Aucun outil trouvé/);
 await page.locator('#tools-search').fill('manquant');await page.locator('#tools-search-results [data-action=new-pending]').click();await page.locator('[data-form=pending]').waitFor();await audit('dark missing-item dialog');
 await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();
 // A search debounce must not repaint the next screen with the old query.
 await go('stock');await page.locator('[data-filter-search]').fill('QUICKSEARCH');await page.locator('#mobile-nav [data-nav=pending]').click();
 await waitForState(page,()=>document.querySelector('#main')?.dataset.view==='pending');
 await page.waitForTimeout(180);assert.equal(await page.evaluate(async()=>(await import('./js/ui.js')).state.query),'');

 await page.evaluate(async()=>{const s=await import('./js/storage.js');await s.save('products',{id:'ux-product',sku:'0000123',name:'Article de test',familyId:'cartes',location:'PAC0007',locations:['PAC0007']},'Fixture ergonomie');});
 await go('stock');await page.locator('[data-filter-search]').fill('0000123');await page.locator('.product-record').filter({hasText:'Article de test'}).waitFor();
 assert.match(await page.locator('.product-record').first().innerText(),/PAC0007/);
 await page.locator('.product-record').first().click();await audit('dark product detail');
 await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();
 await page.locator('#main [data-action=edit-product][data-id=ux-product]').click();await audit('dark product editor');
 await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();

 // Real outstanding tasks display a walk; failures clean up without blocking the app.
 await page.evaluate(async()=>{window.finishTestLoad=(await import('./js/mascot.js')).begin('Chargement de test…');});
 await page.locator('#mascot-status.mascot-loading').waitFor({state:'visible'});
 await page.evaluate(()=>window.finishTestLoad());await page.locator('#mascot-status').waitFor({state:'hidden'});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.mascot-sprite').first().evaluate(el=>getComputedStyle(el).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
 const sprite=await page.evaluate(async()=>{const im=new Image();im.src='assets/mascot-default.svg';await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);return {width:im.width,height:im.height,alpha:x.getImageData(0,0,1,1).data[3]};});
 assert.deepEqual(sprite,{width:1536,height:1024,alpha:0});

 await go('personal');
 const synthetic=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1536;c.height=1024;const x=c.getContext('2d');x.fillStyle='#27834a';x.fillRect(80,80,80,160);return c.toDataURL('image/png').split(',')[1];});
 await page.locator('[data-wb-file=mascot]').setInputFiles({name:'synthetic-mascot.png',mimeType:'image/png',buffer:Buffer.from(synthetic,'base64')});
 await waitForState(page,async()=>!!(await import('./js/workbench-store.js')).get('personal-mascot'));
 assert.match(await page.locator('#main').innerText(),/Ma mascotte personnelle est active/);
 assert.match(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--mascot-sheet')),/blob:/);
 assert.equal(await page.evaluate(async()=>(await import('./js/storage.js')).list('documents').length),0);
 await page.getByRole('button',{name:'Utiliser la mascotte générique',exact:true}).click();
 await waitForState(page,async()=>!(await import('./js/workbench-store.js')).get('personal-mascot'));
 assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--mascot-sheet')),'');
 console.log('OK emplacements dans les résultats, chargements réels, transparence et réduction des animations');

 const routes=['home','more','codes','pending','stock','enfs','orders','locations','families','movements','inventories','issues','replenishments','history','settings','post','resume','instructions','handoff','personal','progress','improvements','storage','diagnostic','training','exports','users','chat','team','voice','schedule','unknowns','journal','complete','conflicts','weward','archive','help'];
 for(const theme of ['light','dark']){
  await go('personal');await page.locator('[name=theme]').selectOption(theme);await page.locator('[data-wb-form=preferences] [type=submit]').click();await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   for(const route of routes){await go(route);await audit(`${theme} ${width}px ${route}`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} overflows at ${width}px`);}
   await go('home');await page.screenshot({path:`test-results/ux-${theme}-${width}-home.png`,fullPage:true});
   await page.getByRole('button',{name:'Trouver une fonction',exact:true}).click();await page.locator('#global-tools-search').fill('photo');await audit(`${theme} ${width}px global finder`);await page.screenshot({path:`test-results/ux-${theme}-${width}-finder.png`,fullPage:true});
   await page.locator('#dialog .dialog-top [data-action=close-dialog]').click();
  }
 }
 // An operator can choose their appearance without gaining configuration rights.
 await page.evaluate(async()=>{(await import('./js/identity-context.js')).setIdentity({id:'ux-operator',name:'Test opérateur',role:'operator'});});
 await page.locator('#mobile-nav [data-nav=more]').click();await page.locator('#tools-search').fill('mode sombre');await page.locator('#main [data-tool-results] [data-nav=personal]').click();await page.locator('[name=theme]').selectOption('light');await page.locator('[data-wb-form=preferences] [type=submit]').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 assert.equal(await page.evaluate(async()=>(await import('./js/identity-context.js')).canConfigure()),false);
 await mkdir('test-results',{recursive:true});await writeFile('test-results/contrast-audit.json',JSON.stringify({report,failures},null,2));
 if(failures.length)console.log('CONTRAST_FAILURES',JSON.stringify(failures));
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[],'Contraste des textes rendus insuffisant (voir contrast-audit.json)');
 console.log(`OK ${report.length} vues contrôlées, ${report.reduce((n,r)=>n+r.checked,0)} textes/champs mesurés, modes clair/sombre, 320/390 px, préférences opérateur`);
}finally{await browser?.close();server.kill();}
