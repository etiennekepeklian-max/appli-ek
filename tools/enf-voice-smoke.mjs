import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {auditContrast} from './contrast-audit.mjs';

const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',data=>{if(String(data).includes('http://')){clearTimeout(timer);resolve();}});});
let browser,page;const errors=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await context.addInitScript(()=>{
  class Recognition{
   constructor(){window.testEnfRecognition=this;}
   start(){if(window.enfMicrophoneThrows)throw Error('Micro indisponible');}
   abort(){this.aborted=true;this.onend?.();}
  }
  window.SpeechRecognition=Recognition;window.enfRecognitionClass=Recognition;
  window.speakEnf=(text,recognition=window.testEnfRecognition)=>{recognition.onresult({results:[Object.assign([{transcript:text}],{isFinal:true})]});recognition.onend?.();};
 });
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://localhost:8765/');await page.getByRole('button',{name:'Commencer',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
 await page.locator('#pikeo-opening').waitFor({state:'hidden'});
 await page.evaluate(async()=>{const store=await import('./js/storage.js');await store.saveBatch([{type:'enfs',record:{id:'voice-enf-a',code:'001234B',name:'Concept étagère-atelier',lines:[{sku:'009911',quantity:2,role:'mere'}]}},{type:'enfs',record:{id:'voice-enf-b',code:'009999',name:'Autre concept fictif',lines:[{sku:'001234B',quantity:1,role:'fille'}]}}],'Exemples fictifs de recherche');});
 await page.locator('.simple-action-grid [data-nav=enfs]').click();await page.locator('#enf-search').waitFor();
 const initial=await page.evaluate(async()=>{const store=await import('./js/storage.js');return {events:store.allEvents().length,records:store.list('enfs')};});
 const search=()=>page.locator('#enf-search'),status=()=>page.locator('[data-enf-voice-status]');
 const reference=()=>page.getByRole('button',{name:'Dicter la référence',exact:true}),name=()=>page.getByRole('button',{name:'Dicter le nom',exact:true});
 await reference().click();assert.equal(await page.getByRole('button',{name:'Arrêter la dictée',exact:true}).getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>window.speakEnf('référence du concept zéro zéro un deux trois quatre bé.'));
 await page.waitForFunction(()=>document.querySelector('#enf-search').value==='001234B'&&document.querySelectorAll('[data-enf-results] article').length===2);
 assert.equal(await page.locator('[data-enf-results] article h2').first().innerText(),'001234B');assert.match(await status().innerText(),/Recherche par référence lancée/);
 await name().click();await page.evaluate(()=>window.speakEnf('Concept etagere atelier.'));
 await page.waitForFunction(()=>document.querySelectorAll('[data-enf-results] article').length===1);assert.equal(await search().inputValue(),'Concept etagere atelier');
 await page.getByRole('button',{name:'Aide pour la recherche vocale des ENF',exact:true}).click();assert.match(await page.locator('#help-dialog').innerText(),/Dicter la référence/);await page.getByRole('button',{name:'Reprendre',exact:true}).click();assert.equal(await search().inputValue(),'Concept etagere atelier');
 await page.getByRole('button',{name:'Voir le contenu',exact:true}).click();assert.match(await page.locator('#dialog-body').innerText(),/009911/);await page.locator('#dialog [data-action=close-dialog]').first().click();
 // A manual edit and a late result cannot replace the user's new search.
 await reference().click();await page.evaluate(()=>window.staleEnfRecognition=window.testEnfRecognition);await search().fill('Autre');
 await page.waitForFunction(()=>document.querySelectorAll('[data-enf-results] article').length===1&&document.querySelector('[data-enf-results] h2').textContent==='009999');
 await page.evaluate(()=>window.speakEnf('zéro zéro un deux trois quatre bé',window.staleEnfRecognition));assert.equal(await search().inputValue(),'Autre');assert.match(await status().innerText(),/modifiée pendant la dictée.*conservée/);
 await name().click();await page.evaluate(()=>window.staleEnfRecognition=window.testEnfRecognition);await page.getByRole('button',{name:'Arrêter la dictée',exact:true}).click();
 await page.evaluate(()=>window.speakEnf('Concept etagere atelier',window.staleEnfRecognition));assert.equal(await search().inputValue(),'Autre');
 await reference().click();await page.evaluate(()=>window.testEnfRecognition.onerror({error:'not-allowed'}));assert.match(await status().innerText(),/Microphone non autorisé/);assert.equal(await search().inputValue(),'Autre');
 await reference().click();await page.evaluate(()=>window.testEnfRecognition.onerror({error:'network'}));assert.match(await status().innerText(),/connexion Internet/);
 await reference().click();await page.evaluate(()=>window.testEnfRecognition.onend());assert.match(await status().innerText(),/Aucune parole/);
 await page.evaluate(()=>window.enfMicrophoneThrows=true);await name().click();assert.match(await status().innerText(),/Impossible de démarrer/);await page.evaluate(()=>window.enfMicrophoneThrows=false);
 await page.evaluate(()=>{window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;});await name().click();assert.match(await status().innerText(),/Dictée indisponible/);assert.equal(await search().inputValue(),'Autre');
 // Prefixed implementations work too; ambiguous grouped numbers do not alter the query.
 await page.evaluate(()=>window.webkitSpeechRecognition=window.enfRecognitionClass);await reference().click();await page.evaluate(()=>window.speakEnf('vingt trois'));assert.equal(await search().inputValue(),'Autre');assert.match(await status().innerText(),/chiffre par chiffre/);
 await name().click();await page.evaluate(()=>window.staleEnfRecognition=window.testEnfRecognition);await reference().click();assert.equal(await page.evaluate(()=>window.staleEnfRecognition.aborted),true);await page.getByRole('button',{name:'Arrêter la dictée',exact:true}).click();
 // Backgrounding and leaving the screen abort the microphone and reject stale callbacks.
 await name().click();await page.evaluate(()=>{window.staleEnfRecognition=window.testEnfRecognition;window.dispatchEvent(new Event('pagehide'));window.speakEnf('Concept etagere atelier',window.staleEnfRecognition);});assert.equal(await search().inputValue(),'Autre');
 await name().click();await page.evaluate(()=>window.staleEnfRecognition=window.testEnfRecognition);await page.locator('#mobile-nav [data-nav=home]').click();await page.locator('.simple-action-grid [data-nav=enfs]').click();await search().fill('Autre');
 await page.evaluate(()=>window.speakEnf('Concept etagere atelier',window.staleEnfRecognition));assert.equal(await search().inputValue(),'Autre');
 // The cached compositions still filter from the keyboard without a network.
 await context.setOffline(true);await search().fill('etagere');await page.waitForFunction(()=>document.querySelectorAll('[data-enf-results] article').length===1&&document.querySelector('[data-enf-results] h2').textContent==='001234B');
 for(const theme of ['light','dark'])for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  assert.ok(await page.evaluate(width=>document.documentElement.scrollWidth<=width+1,width),'Débordement à '+width);
  assert.deepEqual((await page.evaluate(auditContrast)).failures,[]);
  const rects=await page.locator('[data-enf-voice=reference],[data-enf-voice=name]').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return {width:r.width,height:r.height};}));assert.ok(rects.every(r=>r.width>=44&&r.height>=44));
 }
 await page.locator('#mascot-status').waitFor({state:'hidden'});await page.locator('#toast').waitFor({state:'hidden'});
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/enf-voice-mobile-dark.png',fullPage:true});
 await page.evaluate(()=>document.documentElement.dataset.theme='light');await reference().click();await page.screenshot({path:'test-results/enf-voice-listening-light.png',fullPage:true});await page.getByRole('button',{name:'Arrêter la dictée',exact:true}).click();
 await context.setOffline(false);
 const after=await page.evaluate(async()=>{const store=await import('./js/storage.js');return {events:store.allEvents().length,records:store.list('enfs')};});assert.deepEqual(after,initial);
 // A result delivered after a change of storage scope is ignored.
 await name().click();await page.evaluate(async()=>{window.staleEnfRecognition=window.testEnfRecognition;await(await import('./js/storage.js')).openStore(true);window.speakEnf('Autre concept fictif',window.staleEnfRecognition);});assert.equal(await search().inputValue(),'etagere');
 await page.evaluate(()=>window.dispatchEvent(new Event('pikeo-stop-enf-voice')));assert.deepEqual(errors,[]);
 console.log('OK recherche vocale ENF : référence et zéros/lettres, nom et accents, filtrage automatique, aide/contenu, arrêt, saisie protégée, callbacks tardifs, changement de page/espace, refus/absence de micro, clavier hors ligne, contraste clair/sombre et mobile 320/390 px, aucune composition modifiée.');
}catch(error){await mkdir('test-results',{recursive:true});await page?.screenshot({path:'test-results/enf-voice-failure.png',fullPage:true}).catch(()=>{});console.error(await page?.locator('body').innerText().catch(()=>''));throw error;}
finally{await browser?.close();server.kill();}
