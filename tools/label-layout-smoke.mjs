import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const server=spawn(process.execPath,['tools/serve.mjs']);await new Promise(r=>server.stdout.once('data',r));let browser;
try{
 browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://localhost:8765/#codes');await page.locator('#main[data-view=codes]').waitFor();await page.evaluate(()=>document.querySelector('#dialog')?.close());
 await page.locator('#code-input').fill('001234');await page.locator('[name=designation]').fill('Cartes cadeaux <test>');await page.locator('[name=quantity]').fill('24');await page.locator('form[data-form=barcode] button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('#barcode-stage svg')?.textContent.includes('Quantité : 24'));
 const result=await page.evaluate(async()=>{const {state}=await import('/js/ui.js');const {svgPNG}=await import('/js/features.js');return {svg:state.generated.svg,payload:state.generated.payload,png:(await svgPNG(state.generated.svg)).startsWith('data:image/png')};});
 assert.equal(result.payload,'001234');assert.ok(result.svg.includes('Cartes cadeaux &lt;test&gt;'));assert.ok(result.svg.includes('propriété intellectuelle'));assert.ok(result.png);
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);for(const route of ['home','codes','more','settings','help']){await page.goto('http://localhost:8765/#'+route);await page.locator('#main[data-view='+route+']').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} déborde à ${width} (${theme})`);}}}
 console.log('Étiquette SVG/PNG et référence vérifiées ; cinq écrans sans débordement à trois largeurs, dans les deux thèmes.');
}finally{await browser?.close();server.kill();}
