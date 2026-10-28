import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const get=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Pikéo Web : mascotte originale, version 1.17.1, animation choisie n°1',async()=>{
 const [html,css,js,manifest]=await Promise.all(['site/index.html','site/opening.css','site/js/opening.js','site/data/offline-assets.json'].map(get));
 assert.match(html,/id="pikeo-opening"/);
 assert.match(html,/Scannez\. Préparez\. Avancez\./);
 assert.match(html,/opening\.css/);assert.match(html,/js\/opening\.js/);
 assert.match(html,/pikeo-v=1\.17\.1/);
 assert.match(css,/mascot-default\.svg/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/2\.4s/);
 assert.match(js,/pikeo-shortcut/);
 assert.match(js,/setTimeout\(end,2400\)/);
 const offline=JSON.parse(manifest);
 assert.ok(offline.includes('opening.css'));
 assert.ok(offline.includes('js/opening.js'));
});
