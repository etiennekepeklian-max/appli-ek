import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site');
const core=await readFile(path.join(root,'js/core.js'),'utf8'),version=core.match(/VERSION\s*=\s*['"]([^'"]+)/)?.[1];if(!version)throw Error('Version absente');
await writeFile(path.join(root,'release.json'),JSON.stringify({version})+'\n');
const paths=[];async function walk(dir){for(const e of await readdir(path.join(root,dir),{withFileTypes:true})){const relative=path.posix.join(dir,e.name);if(e.isDirectory())await walk(relative);else if(!relative.includes('licenses/')&&!relative.endsWith('.md')&&!['sw.js','data/offline-assets.json'].includes(relative))paths.push(relative);}}
await walk('');paths.sort();await writeFile(path.join(root,'data/offline-assets.json'),JSON.stringify(paths,null,2)+'\n');
const hash=createHash('sha256');for(const file of paths.filter(p=>!p.includes('vendor/ocr/')))hash.update(await readFile(path.join(root,file)));const digest=hash.digest('hex').slice(0,12);const sw=await readFile(path.join(root,'sw.js'),'utf8');await writeFile(path.join(root,'sw.js'),sw.replace(/const APP_VERSION='[^']+';/,`const APP_VERSION='${version}';`).replace(/const SHELL='[^']+';/,`const SHELL='ek-shell-v1-${digest}';`));console.log(`Cache PWA préparé : ${digest} (${paths.length} fichiers).`);
