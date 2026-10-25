import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {SHEET_TABS,rowForEvent} from '../site/js/core.js';
const server=spawn(process.execPath,['tools/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Serveur indisponible')),15000);server.stdout.on('data',d=>{if(String(d).includes('http://')){clearTimeout(t);resolve();}});server.on('error',reject);});
const base='http://localhost:8765/',oldSheet='legacy-synthetic-12345678901234567890',tables=new Map(),uploads=new Map(),errors=[];let appends=0,requests=0,created=0,browser;
const tabs=()=>new Map(SHEET_TABS.map(t=>[t,[]]));tables.set(oldSheet,tabs());
tables.get(oldSheet).get('produit').push(rowForEvent({id:'legacy-event',type:'products',updatedAt:'2026-10-20T12:00:00Z',record:{id:'legacy-product',sku:'00001',name:'Ancien produit synthétique'}}));
async function routes(context){
 await context.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:'window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken(){o.callback({access_token:"synthetic-token",expires_in:3600})}})}}};'}));
 await context.route('https://sheets.googleapis.com/**',async r=>{
  requests++;const req=r.request(),url=new URL(req.url()),parts=url.pathname.split('/'),id=parts[3];let body={};
  if(req.method()==='POST'&&url.pathname==='/v4/spreadsheets'){const next='encrypted-synthetic-'+String(++created).padStart(25,'0');tables.set(next,tabs());body={spreadsheetId:next};}
  else if(url.pathname.endsWith(':append')){const tab=decodeURIComponent(url.pathname.split('/values/')[1]).split('!')[0].replaceAll("'",'');const data=req.postDataJSON();tables.get(id).get(tab).push(...data.values);appends++;body={updates:{updatedRows:data.values.length}};}
  else if(url.pathname.endsWith('values:batchGet'))body={valueRanges:url.searchParams.getAll('ranges').map(range=>({range,values:tables.get(id).get(range.split('!')[0].replaceAll("'",'')).slice(Number(range.match(/!A(\d+)/)[1])-2)}))};
  else if(req.method()==='GET')body={sheets:[...tables.get(id)].map(([title,rows])=>({properties:{title,gridProperties:{rowCount:Math.max(2,rows.length+1)}}}))};
  await r.fulfill({json:body});
 });
 await context.route('https://www.googleapis.com/**',async r=>{
  const req=r.request(),url=new URL(req.url());let body={};
  if(url.pathname.includes('/upload/')){
   const text=req.postDataBuffer().toString('utf8'),parts=text.split(/\r\n\r\n/),metadata=JSON.parse(parts[1].split('\r\n--')[0]),sealed=JSON.parse(parts[2].split('\r\n--')[0]),id='doc-'+(uploads.size+1);uploads.set(id,{metadata,sealed});body={id};
  }else if(url.searchParams.get('alt')==='media'){const doc=uploads.get(url.pathname.split('/').at(-1));if(!doc)return r.fulfill({status:404,json:{}});return r.fulfill({json:doc.sealed});}
  else if(req.method()==='POST')body={id:'folder-synthetic',name:'Pikéo — Documents'};
  else {const q=url.searchParams.get('q')||'';body={files:q.includes('mimeType')?[]:[...uploads].filter(([,u])=>Object.entries(u.metadata.appProperties).every(([key,value])=>q.includes("key='"+key+"' and value='"+value+"'"))).map(([id])=>({id}))};}
  await r.fulfill({json:body});
 });
}
try{
 browser=await chromium.launch({headless:true,...(process.env.EK_TEST_BROWSER_CHANNEL?{channel:process.env.EK_TEST_BROWSER_CHANNEL}:{})});
 const c=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await routes(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'#storage');await p.getByRole('button',{name:'Commencer',exact:true}).click();await p.locator('#dialog').waitFor({state:'hidden'});
 const missing=await p.evaluate(async sheet=>{const s=await import('./js/sync.js');s.saveConnection({spreadsheetId:sheet});try{await s.connect();return '';}catch(e){return e.message;}},oldSheet);assert.match(missing,/clé personnelle/);assert.equal(requests,0);
 const setup=await p.evaluate(async()=>{
  const secrets=await import('./js/secure-session.js'),s=await import('./js/storage.js');const keyFile=await secrets.create(),id=await s.storeFile(new Blob([new Uint8Array([0,3,8,255,128])],{type:'image/png'}),'CLIENT-SECRET-photo.png','photo');await s.save('products',{id:'cloud-product',sku:'00999',name:'Donnée métier confidentielle',photoId:id},'Test synthétique');
  return {keyFile,id};
 });
 await p.evaluate(async()=>{const s=await import('./js/sync.js');await s.sync();});assert.ok(appends>0);assert.equal(uploads.size,1);assert.ok(!JSON.stringify([...uploads]).includes('CLIENT-SECRET'));
 const rows=tables.get(oldSheet).get('produit');assert.ok(rows.slice(1).every(r=>r.slice(1,10).every(v=>v==='')&&!r.join('').includes('00999')));
 assert.equal(await p.evaluate(async()=>{const s=await import('./js/sync.js');return s.activity().legacyCount;}),1);
 const c2=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await routes(c2);const p2=await c2.newPage();p2.on('pageerror',e=>errors.push(e.message));await p2.goto(base+'#storage');await p2.getByRole('button',{name:'Commencer',exact:true}).click();await p2.locator('#dialog').waitFor({state:'hidden'});
 await p2.evaluate(async({keyFile,sheet})=>{const k=await import('./js/secure-session.js'),s=await import('./js/sync.js');await k.unlock(keyFile);s.saveConnection({spreadsheetId:sheet});await s.connect();await s.restoreCloudFiles();},{keyFile:setup.keyFile,sheet:oldSheet});
 assert.deepEqual(await p2.evaluate(async id=>{const s=await import('./js/storage.js'),f=await s.readFile(id);return {name:f.name,type:f.blob.type,bytes:Array.from(new Uint8Array(await f.blob.arrayBuffer()))};},setup.id),{name:'CLIENT-SECRET-photo.png',type:'image/png',bytes:[0,3,8,255,128]});
 const sentBefore=appends;const wrong=await p2.evaluate(async()=>{const k=await import('./js/secure-session.js'),s=await import('./js/sync.js');await k.create();try{await s.sync();return '';}catch(e){return e.message;}});assert.match(wrong,/Clé incorrecte/);assert.equal(appends,sentBefore);
 await p.evaluate(async()=>{const s=await import('./js/sync.js');await s.prepareEncryptedMigration();});
 await p.locator('[data-wb-action=prepare-google-migration]').click();await p.locator('[data-wb-action=confirm-google-migration]').waitFor();await p.locator('[data-wb-action=confirm-google-migration]').click();await p.locator('#dialog').waitFor({state:'hidden'});
 const newSheet=await p.evaluate(async()=>{const s=await import('./js/sync.js');return s.connection().spreadsheetId;});assert.notEqual(newSheet,oldSheet);assert.ok(tables.get(oldSheet).get('produit').some(r=>r[1]==='legacy-product'));assert.ok([...tables.get(newSheet).values()].flat().every(r=>r.slice(1,10).every(v=>v==='')&&JSON.parse(r[10]+(r[11]||'')).app==='PikeoEncrypted'));assert.equal(uploads.size,2);
 assert.deepEqual(errors,[]);console.log('Google simulé : aucun envoi sans clé, lecture historique, données/documents chiffrés, restauration binaire sur appareil 2, mauvaise clé sans écriture et nouvelle base sans détruire l’ancienne OK.');
 await c.close();await c2.close();
}finally{await browser?.close();server.kill();}
