import test from 'node:test';
import assert from 'node:assert/strict';
import {localLookupStatus,isGTIN,sameBarcode,normalizeCandidate,candidateMatches,productIdentityConflict,safeProductImageURL} from '../site/js/product-lookup-core.js';
import {createProductLookup} from '../backend/product-lookup/search.mjs';
const barcode='4006381333931';
const candidate={name:'Carte de test',sku:'000123',barcode,sourceKind:'draeger',sourceUrl:'https://fr.checkout.draegerparis.com/products/test',retrievedAt:'2026-10-29T09:00:00Z'};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers});
const request=code=>new Request('https://example.test/lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
test('absence, doublons et fiche sans nom déclenchent une recherche ; un résultat certain reste local',()=>{
 assert.equal(localLookupStatus([]),'missing');assert.equal(localLookupStatus([{name:'Carte'}]),'known');
 assert.equal(localLookupStatus([{name:'Carte'},{name:'Autre variante'}]),'ambiguous');
 assert.equal(localLookupStatus([{name:'000123',namePending:true}]),'ambiguous');assert.equal(localLookupStatus([{name:' '}]),'ambiguous');
});
test('EAN conservés, équivalence UPC/GTIN validée sans confondre les références internes',()=>{
 assert.equal(isGTIN(barcode),true);assert.equal(isGTIN('4006381333932'),false);assert.equal(isGTIN('000123'),false);
 assert.equal(sameBarcode('012345678905','0012345678905'),true);assert.equal(sameBarcode('000123','123'),false);
 assert.equal(normalizeCandidate(candidate,'000123').sku,'000123');assert.equal(normalizeCandidate(candidate,'000123').exact,true);
 assert.equal(normalizeCandidate(candidate,'000124').exact,false);
});
test('sources non vérifiables et liens actifs refusés',()=>{
 for(const sourceUrl of ['javascript:alert(1)','https://evil.test/products/test','https://user:secret@fr.checkout.draegerparis.com/products/test'])assert.equal(normalizeCandidate({...candidate,sourceUrl},'000123'),null);
 assert.equal(normalizeCandidate({...candidate,name:''},'000123'),null);
});
test('proposition compare SKU et EAN ; une mise à jour sans nouveau conflit garde les variantes historiques',()=>{
 const rows=[{id:'a',sku:'000123',barcode},{id:'b',sku:'OTHER',barcode:'012345678905'}];
 assert.equal(candidateMatches(candidate,rows)[0].id,'a');
 assert.equal(productIdentityConflict({sku:'NEW',barcode},null,rows).id,'a');
 assert.equal(productIdentityConflict({...rows[0],barcode:'0012345678905'},rows[0],rows).id,'b');
 assert.equal(productIdentityConflict(rows[0],rows[0],rows),undefined);
});
test('relais : détail de variante exact, champs factuels seuls, requête répétée mutualisée',async()=>{
 const urls=[];const handle=createProductLookup({fetcher:async url=>{urls.push(url);return url.includes('/search/')?json({resources:{results:{products:[{handle:'test'}]}}}):json({title:'Carte de test',vendor:'Draeger',variants:[{id:1,sku:'000123',barcode},{id:2,sku:'000124',barcode:'OTHER'}]});}});
 const first=await handle(request('000123')),second=await handle(request('000123'));assert.equal(first.status,200);
 const data=await first.json();assert.equal(data.candidates.length,1);assert.equal(data.candidates[0].sku,'000123');assert.equal(data.candidates[0].exact,true);
 assert.equal(data.candidates[0].unitsPerPick,undefined);assert.equal(data.candidates[0].location,undefined);assert.equal((await second.json()).candidates.length,1);assert.equal(urls.length,2);
});
test('relais : une piste de variante reste incertaine, sans inventer le code lu',async()=>{
 const handle=createProductLookup({fetcher:async url=>url.includes('/search/')?json({resources:{results:{products:[{handle:'test'}]}}}):json({title:'Carte',variants:[{sku:'000999',barcode:''}]})});
 const data=await(await handle(request('000123'))).json();assert.equal(data.candidates[0].exact,false);assert.equal(data.candidates[0].barcode,'');
});
test('relais : EAN hors catalogue consulté en externe sans inventer de SKU',async()=>{
 const handle=createProductLookup({fetcher:async url=>url.includes('suggest.json')?json({resources:{results:{products:[]}}}):json({items:[{ean:barcode,title:'Produit externe',brand:'Marque'},{ean:'OTHER',title:'Mauvaise variante'}]})});
 const data=await(await handle(request(barcode))).json();assert.equal(data.candidates.length,1);assert.equal(data.candidates[0].sourceKind,'upcitemdb');assert.equal(data.candidates[0].sku,'');assert.equal(data.candidates[0].exact,true);
});
test('relais : quota externe arrête les tentatives et signale la limite',async()=>{
 let external=0;const handle=createProductLookup({fetcher:async url=>{if(url.includes('suggest.json'))return json({resources:{results:{products:[]}}});external++;return json({},429,{'x-ratelimit-reset':String(Math.floor(Date.now()/1000)+300)});}});
 const data=await(await handle(request(barcode))).json();assert.equal(data.status,'partial');assert.match(data.warnings.join(' '),/limite/);
 await handle(request('012345678905'));assert.equal(external,1);
});
test('relais : codes invalides, corps volumineux, méthodes et débit sont bornés avant le réseau',async()=>{
 let calls=0;const handle=createProductLookup({fetcher:async()=>{calls++;return json({resources:{results:{products:[]}}});}});
 assert.equal((await handle(request('https://evil.test/'))).status,400);
 assert.equal((await handle(request('A'.repeat(3000)))).status,413);assert.equal(calls,0);
 assert.equal((await handle(new Request('https://example.test',{method:'DELETE'}))).status,405);
 const preflight=await handle(new Request('https://example.test',{method:'OPTIONS'}));assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'*');
 for(let i=0;i<12;i++)assert.equal((await handle(request('TEST-'+i))).status,200);
 assert.equal((await handle(request('TEST-LAST'))).status,429);
});

test('relais : un EAN absent de la base externe est distinct d’une panne',async()=>{
 const handle=createProductLookup({fetcher:async url=>url.includes('suggest.json')?json({resources:{results:{products:[]}}}):json({},404)});
 const data=await(await handle(request(barcode))).json();assert.equal(data.status,'complete');assert.deepEqual(data.warnings,[]);assert.deepEqual(data.candidates,[]);
});
test('relais : les réponses démesurées sont interrompues et signalées',async()=>{
 const handle=createProductLookup({fetcher:async()=>json({padding:'x'.repeat(512001)})});
 const data=await(await handle(request('SYNTHETIC'))).json();assert.equal(data.status,'partial');assert.deepEqual(data.candidates,[]);
 assert.equal(normalizeCandidate({...candidate,sourceUrl:'https://fr.checkout.draegerparis.com:8443/products/test'},'000123'),null);
});

test('photos publiques : HTTPS, adresses publiques et miniatures Shopify bornées',()=>{
 const url=safeProductImageURL('//cdn.shopify.com/s/files/1/test.jpg?v=1&width=2400&crop=center#fragment');
 assert.equal(new URL(url).searchParams.get('width'),'480');assert.equal(new URL(url).searchParams.get('height'),'480');
 assert.equal(new URL(url).searchParams.has('crop'),false);assert.equal(new URL(url).hash,'');
 assert.equal(safeProductImageURL(url),url);
 for(const image of ['data:image/png;base64,abc','javascript:alert(1)','http://images.example.com/a.jpg','https://localhost/a','https://127.0.0.1/a','https://[::1]/a','https://router.lan/a','https://user:secret@images.example.com/a','https://images.example.com:8443/a'])
  assert.equal(safeProductImageURL(image),'');
 assert.equal(normalizeCandidate({...candidate,imageUrl:url},'000123').imageUrl,url);
 assert.equal(normalizeCandidate({...candidate,imageUrl:'javascript:alert(1)'},'000123').imageUrl,'');
});
test('photo de variante prioritaire et photo du produit conservée en repli',async()=>{
 const make=featured=>createProductLookup({fetcher:async url=>url.includes('suggest.json')?json({resources:{results:{products:[{handle:'photo-test'}]}}}):json({title:'Carte photographiée',featured_image:'//cdn.shopify.com/s/files/1/common.jpg',variants:[{sku:'000123',barcode,featured_image:featured}]})});
 const variant=await(await make({src:'//cdn.shopify.com/s/files/1/variant.jpg'})(request('000123'))).json();
 assert.match(variant.candidates[0].imageUrl,/variant\.jpg/);assert.equal(new URL(variant.candidates[0].imageUrl).searchParams.get('width'),'480');
 const common=await(await make(null)(request('000123'))).json();assert.match(common.candidates[0].imageUrl,/common\.jpg/);
});
test('photo externe optionnelle : la première adresse sûre est retenue sans téléchargement par le relais',async()=>{
 const urls=[];const handle=createProductLookup({fetcher:async url=>{urls.push(url);return url.includes('suggest.json')?json({resources:{results:{products:[]}}}):json({items:[{ean:barcode,title:'Produit externe',images:['javascript:alert(1)','https://images.example.com/product.jpg']}]});}});
 const data=await(await handle(request(barcode))).json();assert.equal(data.candidates[0].imageUrl,'https://images.example.com/product.jpg');assert.equal(urls.length,2);
});
