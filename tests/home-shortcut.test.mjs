import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('le raccourci Ajouter un manquant pointe vers le formulaire direct', async () => {
  const manifest=JSON.parse(await readFile(new URL('../site/manifest.webmanifest',import.meta.url),'utf8'));
  const shortcut=manifest.shortcuts.find(entry=>entry.url==='./#ajouter-manquant');
  assert.ok(shortcut,'Raccourci PWA manquant');
  assert.equal(shortcut.name,'Ajouter un manquant');
  const app=await readFile(new URL('../site/js/app.js',import.meta.url),'utf8');
  assert.match(app,/if\(target==='ajouter-manquant'\)\{\s*navigate\('pending',\{preserveHash:true\}\);\s*if\(Store\.settings\(\)\.welcomed\)pendingForm\(\);/);
  assert.match(app,/state\.route=requestedHash==='ajouter-manquant'\?'pending'/);
  assert.match(app,/else if\(requestedHash==='ajouter-manquant'\)pendingForm\(\)/);
  assert.match(app,/window\.addEventListener\('hashchange',openHashShortcut\)/);
  assert.match(app,/!params\.preserveHash/);
});
