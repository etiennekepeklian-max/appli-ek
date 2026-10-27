import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePendingVoice} from '../site/js/pending-voice-core.js';
test('dictée : deux identifiants étiquetés, ordre inversé et zéros conservés',()=>{
 assert.deepEqual(parsePendingVoice('Commande 0000123 référence 001234'),{orderNumber:'0000123',sku:'001234',warnings:[]});
 const reverse=parsePendingVoice('Référence zéro zéro un deux trois quatre, numéro de commande zéro zéro zéro un deux trois');assert.equal(reverse.sku,'001234');assert.equal(reverse.orderNumber,'000123');
 assert.equal(parsePendingVoice('commande 0000123 article SA13056').sku,'SA13056');
});
test('dictée : nombres en groupes, préfixe zéro et référence alphanumérique épelée',()=>{
 const result=parsePendingVoice('commande deux mille vingt trois référence zéro zéro six cent douze');assert.equal(result.orderNumber,'2023');assert.equal(result.sku,'00612');
 assert.equal(parsePendingVoice('commande 1234 référence S A un trois zéro cinq six').sku,'SA13056');
 assert.equal(parsePendingVoice('commande 1234 référence bé zéro zéro un deux').sku,'B0012');
});
test('dictée : pas de numéros devinés, contradictions et texte ordinaire refusés',()=>{
 const missing=parsePendingVoice('1234 001234');assert.equal(missing.orderNumber,'');assert.equal(missing.sku,'');assert.equal(missing.warnings.length,2);
 const conflict=parsePendingVoice('commande 1234 référence 001234 commande 5678');assert.equal(conflict.orderNumber,'');assert.equal(conflict.sku,'001234');
 assert.equal(parsePendingVoice('commande 1234 référence article inconnu').sku,'');assert.equal(parsePendingVoice('commande 1234 référence pour moi 001234').sku,'');
});
test('dictée : ponctuation, contexte supplémentaire et politesse ne deviennent pas une référence',()=>{
 const result=parsePendingVoice('Il me manque commande 000.0123 référence 00 12 34 emplacement PAC01 merci');assert.equal(result.orderNumber,'0000123');assert.equal(result.sku,'001234');
 assert.equal(parsePendingVoice('commande 1234 référence 001234 merci beaucoup.').sku,'001234');
});
