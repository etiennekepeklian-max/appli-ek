// Read-only production check with a generic public word, never a work reference.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {searchProductWeb} from '../site/js/product-lookup-client.js';
const result=await searchProductWeb('CARTE');
const picture=result.candidates.find(p=>p.imageUrl);assert.ok(picture,'Une source publique doit fournir une photo de produit.');
const browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
try{
 const page=await browser.newPage();
 const size=await Promise.race([page.evaluate(url=>new Promise((resolve,reject)=>{const image=new Image();image.referrerPolicy='no-referrer';image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(Error('Photo publique inaccessible'));image.src=url;}),picture.imageUrl),new Promise((_,reject)=>setTimeout(()=>reject(Error('Photo publique trop lente')),15000))]);
 assert.ok(size.width>0&&size.height>0);assert.ok(size.width<=480,'La photo Shopify doit être réduite pour le téléphone.');
 console.log('Recherche publique en production : résultats, source et photo redimensionnée vérifiés en lecture seule.');
}finally{await browser.close();}
