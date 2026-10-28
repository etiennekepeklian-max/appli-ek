import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizePhone,toDialNumber} from '../site/js/reassort-contacts.js';
test('Numéros français normalisés sans valeur en dur dans le projet',()=>{
 assert.equal(normalizePhone('06 12 34 56 78'),'0612345678');
 assert.equal(normalizePhone('+33 6 12 34 56 78'),'0612345678');
 assert.equal(normalizePhone('0033 6 12 34 56 78'),'0612345678');
 assert.equal(toDialNumber('0612345678'),'+33612345678');
 assert.equal(normalizePhone(''),'');
 for(const bad of ['123','abc','06 12 34','+999 66 66 66'])assert.throws(()=>normalizePhone(bad));
});
test('Le téléphone est un réglage local, pas une donnée GitHub ou Google',async()=>{
 const src=await readFile(new URL('../site/js/reassort-contacts.js',import.meta.url),'utf8');
 assert.match(src,/localStorage\.setItem\(KEY/);
 assert.match(src,/contact-serge=/);
 assert.match(src,/sms:/);
 assert.match(src,/tel:/);
 assert.doesNotMatch(src,/sync\(|Store\.save|const\s+serge\s*=\s*['"]0[67]\d{8}/);
});
