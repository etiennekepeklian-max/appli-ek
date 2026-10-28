import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>reject(Error('Serveur de test indisponible')),15000);
 server.stdout.on('data',v=>{if(String(v).includes('http://')){clearTimeout(timer);resolve();}});
});
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const base='http://localhost:8765/';
 await page.goto(base);await page.getByRole('button',{name:'Commencer',exact:true}).click();
 await page.locator('#dialog').waitFor({state:'hidden'});
 // Fresh ENF without photo: save and see detail immediately.
 await page.goto(base+'#enfs');
 await page.getByRole('button',{name:'Photographier une feuille ENF'}).click();
 await page.locator('[data-enf-form] [name=code]').fill('ENF-TEST-0001');
 await page.getByRole('button',{name:'Ajouter une référence'}).click();
 await page.locator('[data-enf-sku]').fill('001234');
 await page.locator('[data-enf-qty]').fill('2');
 await page.locator('[data-enf-form] [name=reviewed]').check();
 await page.getByRole('button',{name:'Enregistrer l’ENF',exact:true}).click();
 await page.getByRole('heading',{name:'ENF ENF-TEST-0001'}).waitFor();
 await page.locator('#dialog [data-action=close-dialog]').click();
 // Catalogue photo review, not write on OCR alone.
 await page.goto(base+'#stock');
 await page.goto(base+'#more');
 await page.locator('[data-action="import-catalogue-photo"]').click();
 await page.locator('[data-photo-catalogue-text]').fill('Référence;Nom;Emplacement\n001234;Carte test;PAC001-A\n009876;Carnet test;RES002-B');
 await page.getByRole('button',{name:'Vérifier les lignes'}).click();
 assert.equal(await page.locator('[data-photo-catalogue-row]').count(),2);
 assert.equal(await page.evaluate(async()=>{const s=await import('./js/storage.js');return s.list('products').filter(p=>['001234','009876'].includes(p.sku)).length;}),0);
 await page.locator('[data-photo-catalogue-review] [name=reviewed]').check();
 await page.getByRole('button',{name:'Importer les lignes vérifiées'}).click();
 await page.locator('#dialog').waitFor({state:'hidden'});
 const saved=await page.evaluate(async()=>{const s=await import('./js/storage.js');return s.list('products').filter(p=>['001234','009876'].includes(p.sku)).map(p=>[p.sku,p.location]);});
 assert.deepEqual(saved.sort((a,b)=>a[0].localeCompare(b[0])),[['001234','PAC001-A'],['009876','RES002-B']]);
 // A recognized location clears its previously unknown code.
 await page.evaluate(async()=>{const ops=await import('./js/ops.js');await ops.recordUnknown('PAD009-Z');});
 await page.goto(base+'#unknowns');
 await page.getByRole('button',{name:'Identifier cet emplacement'}).click();
 await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
 await page.locator('#dialog').waitFor({state:'hidden'});
 const unknown=await page.evaluate(async()=>{const s=await import('./js/storage.js');return s.list('unknowns').find(r=>r.code==='PAD009-Z')?.status;});
 assert.equal(unknown,'resolved');
 // The web help is a real navigable public static page.
  assert.deepEqual(errors,[]);
 await context.close();
 console.log('Parcours Pikéo OK : ENF manuel + détail, photo avec revue, code emplacement et aide bureau.');
}finally{await browser?.close();server.kill();}
