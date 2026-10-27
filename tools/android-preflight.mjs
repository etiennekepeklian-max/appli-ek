// Read-only checks: prepare without requiring Android Studio or installing a package.
import {readFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const json=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const conf=await json('capacitor.config.json');
assert.equal(conf.appName,'Pikéo');
assert.match(conf.appId,/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/i);
assert.equal(conf.webDir,'site');
assert.ok(!conf.server?.url,'Une URL distante ne doit pas remplacer le contenu de l’APK');
const html=await readFile(join(root,conf.webDir,'index.html'),'utf8');
assert.match(html,/<head(?:\s|>)/i);
assert.match(html,/assets\/mascot-default\.svg/);
for(const file of ['index.html','js/app.js','js/android-shortcuts-core.js','assets/mascot-default.svg','manifest.webmanifest','data/offline-assets.json']){
 assert.ok((await stat(join(root,conf.webDir,file))).isFile(),file+' manquant');
}
const manifest=await json('site/manifest.webmanifest');
const shortcuts=manifest.shortcuts||[];
assert.equal(shortcuts.length,4,'Quatre raccourcis sont requis');
for(const target of ['barcode','missing','products','enf'])
 assert.ok(shortcuts.some(s=>new URL(s.url,'https://pikeo.invalid/').searchParams.get('pikeo-shortcut')===target),target+' manquant');
const offline=await json('site/data/offline-assets.json');
assert.ok(offline.includes('js/android-shortcuts-core.js'));
console.log('Préparation Capacitor : structure statique, mascotte existante et 4 raccourcis valides.');
console.log('Aucun APK créé, aucun stockage utilisateur modifié.');
