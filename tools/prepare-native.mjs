import {cp,mkdir,readFile,writeFile,rm,access} from 'node:fs/promises';
import {build} from '../native/node_modules/esbuild/lib/main.js';
const dir=new URL('../native/',import.meta.url),www=new URL('www/',dir);
await rm(www,{recursive:true,force:true});await mkdir(www,{recursive:true});
await cp(new URL('../site/',import.meta.url),www,{recursive:true});
await build({entryPoints:[new URL('bridge.mjs',dir).pathname],bundle:true,format:'iife',minify:true,outfile:new URL('pikeo-native.js',www).pathname});
for(const file of ['index.html','bureau.html']){let html=await readFile(new URL(file,www),'utf8');html=html.replace('</head>','<script src="pikeo-native.js"></script></head>');await writeFile(new URL(file,www),html);}
await rm(new URL('sw.js',www),{force:true});
const gif=new URL('branding/IntroK.gif',dir);try{await access(gif);await cp(gif,new URL('assets/IntroK.gif',www));}catch{console.log('IntroK.gif sera incorporé avant signature finale.');}
console.log('Web Android préparé, sans service worker ni mise à jour distante du code natif.');
