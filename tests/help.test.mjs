import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HELP,helpFor,jcMessage} from '../site/js/help-core.js';

test('Le message est adressable à Serge ou JC sans casier obligatoire',()=>{
 assert.equal(jcMessage({sku:'001234',location:'PAC001-A'}),'Bonjour, pourrais-tu m’aider à réassortir la référence 001234 pour que je puisse poursuivre ma préparation ? Merci d’avance !');
 assert.equal(jcMessage({sku:'001234',quantity:4}),'Bonjour, pourrais-tu m’aider à réassortir la référence 001234 pour que je puisse poursuivre ma préparation ? Quantité manquante : 4 unité(s). Merci d’avance !');
 assert.doesNotMatch(jcMessage({sku:'001234',location:'PAC001-A',quantity:4}),/PAC001-A|[Ee]mplacement/);
 assert.doesNotThrow(()=>jcMessage({sku:'001234'}));
 assert.throws(()=>jcMessage({location:'RES001-A'}),/référence/);
});
test('Chaque route dispose de sa propre aide ; un formulaire prime sur la route',async()=>{
 const source=await readFile(new URL('../site/js/views.js',import.meta.url),'utf8');
 const routes=source.match(/export const titles=\{([^\n]+)\}/)[1].matchAll(/(\w+):/g);
 for(const [,route] of routes)assert.ok(HELP[route],`Aide absente : ${route}`);
 assert.equal(helpFor({route:'home',context:'pending'}),HELP.pending);
 assert.equal(helpFor({route:'pending',context:'message-jc'}),HELP['message-jc']);
 assert.equal(helpFor({route:'orders',context:'page'}),HELP['day-page']);
 assert.equal(helpFor({route:'home',action:'help-code'}),HELP.codes);
});
