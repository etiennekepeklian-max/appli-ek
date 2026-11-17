import {readFile} from 'node:fs/promises';
// Only historical isolated regressions. entry-management-smoke uses actual entry code.
export async function installLegacyEntry(context){
 if(context.__legacyEntryInstalled)return;context.__legacyEntryInstalled=true;
 const original=context.route.bind(context);
 await original('**/js/app.js*',async route=>{let source=await readFile(new URL('../site/js/app.js',import.meta.url),'utf8');source=source.replace(/try\{if\(!SessionAPI.current\(\)\).*?await SessionAPI.init\(\);/s,'try{await SessionAPI.init();');return route.fulfill({contentType:'text/javascript',body:source});});
 await original('**/js/entry.js*',route=>route.fulfill({contentType:'text/javascript',body:"import * as API from '/js/session-api.js';export async function authenticate(){return API.init();}export async function boot(){const a=await import('/js/app.js');await a.ready;return a;}"}));
 context.route=async(pattern,handler,...rest)=>original(pattern,typeof pattern==='string'&&pattern.includes('pikeo-api')?async(route,...args)=>{if(route.request().method()==='POST'){const p=route.request().postDataJSON()?.payload;if(['web-access','native-access','management-access'].includes(p?.action))return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{allowed:true,approved:true,modules:[]}});}return handler(route,...args);}:handler,...rest);
}
