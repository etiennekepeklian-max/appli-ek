import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
const get=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Choix 1 : deux interfaces avec la mascotte Pikéo et le slogan choisi',async()=>{
 const [a,b,css,js]=await Promise.all(['site/index.html','site/bureau.html','site/opening.css','site/js/opening.js'].map(get));
 for(const html of [a,b]){assert.match(html,/id="pikeo-opening"/);assert.match(html,/Scannez\. Préparez\. Avancez\./);assert.match(html,/opening\.css/);assert.match(html,/js\/opening\.js/);}
 assert.match(css,/mascot-default\.svg/);assert.match(css,/pointer-events:none/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/2\.4s/);
 assert.match(js,/pikeo-shortcut/);assert.match(js,/setTimeout\(end,2400\)/);
});
