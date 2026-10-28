import test from 'node:test';
import assert from 'node:assert/strict';
import {TOOL_GROUPS,TOOLS,searchTools,prioritizeProducts} from '../site/js/navigation-core.js';

test('each tool is present exactly once and has a readable group and description',()=>{
 assert.equal(new Set(TOOLS.map(t=>t.id)).size,TOOLS.length);
 assert.ok(TOOLS.length>35);
 assert.ok(TOOLS.every(t=>t.title&&t.description&&TOOL_GROUPS.some(([g])=>g===t.group)));
});
test('finder uses workplace words, accents and multiple words',()=>{
 for(const [query,id] of [['enf','enfs'],['mode sombre','personal'],['réassort JC','pending'],['memo vocal','voice'],['csv','locations'],['fin journée','orders'],['annuler','history'],['messagerie','chat']])assert.ok(searchTools(query).some(t=>t.id===id),query);
 assert.deepEqual(searchTools('<script>'),[]);
 assert.deepEqual(searchTools('zzzzzz-nothing'),[]);
});
test('finder routes do not turn a request for help into an external send',()=>{
 const jc=searchTools('JC');assert.ok(jc.length);assert.ok(jc.every(t=>!/^send/.test(t.id)));
 assert.deepEqual(TOOLS.filter(t=>t.action).map(t=>t.id),['new-pending','import-catalogue-photo']);
});
test('exact references and EAN come before prefixes and names, without stripping zeros',()=>{
 const rows=[{sku:'12',name:'0012 in name'},{sku:'001234'},{sku:'0012'},{sku:'X',barcode:'0012'},{sku:'001256'}];
 assert.deepEqual(prioritizeProducts(rows,'0012').map(t=>t.sku),['0012','X','001234','001256','12']);
 assert.deepEqual(prioritizeProducts(rows,'12').map(t=>t.sku),['12','001234','0012','X','001256']);
 assert.equal(prioritizeProducts(rows,''),rows);
 assert.deepEqual(rows.map(t=>t.sku),['12','001234','0012','X','001256']);
});
