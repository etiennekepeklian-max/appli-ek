import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HELP,helpFor,jcMessage} from '../site/js/help-core.js';

test('Le modèle choisi pour JC conserve la référence, les zéros et le casier',()=>{
 assert.equal(jcMessage({sku:'001234',location:'PAC001-A'},'Étienne'),'S'il te plaît, peux-tu chercher la référence 001234 ? Emplacement concerné : PAC001-A. Merci !\n\nÉtienne');
 assert.match(jcMessage({sku:'001234',location:'PAC001-A'},'Étienne',{reminder:true}),/où en est le réassort/);
 assert.throws(()=>jcMessage({sku:'001234'}),/emplacement/);
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
