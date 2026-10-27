import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {VERSION} from '../site/js/core.js';
import {OCR_ASSETS,redundantOCRAsset} from '../site/js/offline-core.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),site=path.join(root,'site');
const json=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const sources=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='vendor')await walk(file);}else if(/\.(mjs|js|ts|html|css)$/.test(entry.name))sources.push(file);}}
for(const dir of ['site','tools','backend','tests'])await walk(path.join(root,dir));
let modules=0,dependencies=0;
for(const file of sources){
 const source=await readFile(file,'utf8');
 if(/\.(mjs|js|ts)$/.test(file)){
  const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:source,encoding:'utf8'});assert.equal(result.status,0,result.stderr);modules++;
 }
 const specs=[...source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.[^"']+)["']/g)].map(m=>m[1]);
 if(/\.(html|css)$/.test(file))specs.push(...[...source.matchAll(/(?:\b(?:src|href)=["']|url\(["']?)([^"'\s)>]+)/g)].map(m=>m[1]).filter(s=>!s.startsWith('#')&&!/^(?:https?:|data:)/.test(s)));
 for(const spec of specs){const local=spec.split(/[?#]/)[0];if(!local)continue;
  // Browser callbacks in smoke scripts import relative to the served page.
  const base=file.includes(path.sep+'tools'+path.sep)&&local.startsWith('./js/')?site:path.dirname(file),target=path.resolve(base,local);
  assert.ok(target.startsWith(root+path.sep),'Dépendance hors projet');const info=await stat(target);assert.ok(info.isFile()||file.endsWith('.html')&&info.isDirectory()&&(await stat(path.join(target,'index.html'))).isFile(),'Fichier absent : '+spec+' dans '+file);dependencies++;
 }
}
const catalogue=await json('site/data/catalogue.json'),families=await json('site/data/families.json');
const ids=new Set(families.families.map(f=>f.id));assert.equal(ids.size,families.families.length,'Identifiant famille répété');
const byId=new Map(families.families.map(f=>[f.id,f]));
for(const family of byId.values()){const seen=new Set();let current=family;while(current){assert.ok(!seen.has(current.id),'Cycle de familles');seen.add(current.id);if(current.parentId)assert.ok(ids.has(current.parentId),'Famille parente absente');current=byId.get(current.parentId);}}
assert.equal(new Set(catalogue.products.map(p=>p.id)).size,catalogue.products.length,'Identifiant produit répété');
for(const p of catalogue.products){assert.ok(ids.has(p.familyId),'Famille produit absente');assert.ok(typeof p.sku==='string','La référence doit conserver ses zéros');assert.ok(p.unitsPerPick===null||Number.isInteger(p.unitsPerPick)&&p.unitsPerPick>0,'Conditionnement invalide');}
const offline=await json('site/data/offline-assets.json');assert.equal(new Set(offline).size,offline.length,'Ressource hors ligne répétée');
for(const file of offline){assert.ok(!file.startsWith('/')&&!file.includes('..'),'Chemin hors ligne invalide');await stat(path.join(site,file));assert.ok(!redundantOCRAsset(file),'Ressource OCR redondante');}
for(const file of OCR_ASSETS)assert.ok(offline.includes(file),'Moteur ou langue OCR absent');
for(const file of OCR_ASSETS.filter(p=>p.endsWith('.wasm.js')))assert.ok((await readFile(path.join(site,file),'utf8')).includes('data:application/octet-stream;base64,'),'Moteur non autonome');
const vendor=await json('site/vendor/manifest.json');
for(const asset of vendor.assets){const bytes=await readFile(path.join(site,'vendor',asset.file));assert.equal(bytes.length,asset.bytes,asset.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,'Intégrité fournisseur : '+asset.file);}
for(const file of ['package.json','site/package.json','site/release.json'])assert.equal((await json(file)).version,VERSION,'Version incohérente : '+file);
for(const file of ['site/index.html','site/actualiser.html'])assert.ok((await readFile(path.join(root,file),'utf8')).includes('pikeo-v='+VERSION),'Version entrée incohérente : '+file);
assert.ok((await readFile(path.join(site,'sw.js'),'utf8')).includes("APP_VERSION='"+VERSION+"'"),'Version cache incohérente');
console.log(`${modules} modules : syntaxe et ${dependencies} dépendances vérifiées. ${vendor.assets.length} empreintes fournisseur valides.`);
console.log(`${catalogue.products.length} variantes, ${families.families.length} familles sans cycle ; cache, moteurs OCR et versions cohérents.`);
