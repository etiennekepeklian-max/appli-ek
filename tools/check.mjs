import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');let errors=0;
async function walk(dir){for(const name of await readdir(dir)){const file=path.join(dir,name),st=await stat(file);if(st.isDirectory()){if(name!=='vendor')await walk(file);}else if(/\.(mjs|js)$/.test(name)){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0){console.error(r.stderr);errors++;}}}}
await walk(path.join(root,'site'));await walk(path.join(root,'tools'));
const catalogue=JSON.parse(await readFile(path.join(root,'site/data/catalogue.json'),'utf8'));const families=JSON.parse(await readFile(path.join(root,'site/data/families.json'),'utf8'));const ids=new Set(families.families.map(f=>f.id));for(const p of catalogue.products){if(!ids.has(p.familyId))throw Error('Famille produit absente : '+p.familyId);if(p.unitsPerPick!==null&&(!Number.isInteger(p.unitsPerPick)||p.unitsPerPick<1))throw Error('Conditionnement invalide');}
const offline=JSON.parse(await readFile(path.join(root,'site/data/offline-assets.json'),'utf8'));for(const f of offline){await stat(path.join(root,'site',f));}
if(errors)process.exit(1);console.log(`Syntaxe et assets vérifiés. ${catalogue.products.length} variantes, ${families.families.length} familles.`);
