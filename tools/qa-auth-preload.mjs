// Test-only authenticated fixture for business-screen regressions. No real API.
// The separate user-pin-smoke and PostgreSQL contract exercise real login logic.
import {chromium} from 'playwright';
import {verify} from '../backend/pikeo-api/core.mjs';
const installed=new WeakSet();
async function install(context){
 if(installed.has(context))return;installed.add(context);const devices=new Map();
 await context.route('**/js/qa-session-bootstrap.js',route=>route.fulfill({contentType:'text/javascript',body:"import * as API from '/js/session-api.js';await API.login('Étienne',{ownerSecret:'synthetic-fixture-only'});"}));
 await context.route('**/js/session-pin-ui.js',route=>route.fulfill({contentType:'text/javascript',body:"export async function askPin(){return {pin:'0042',confirmation:'0042'}}"}));
 await context.route('**/js/app.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:"import '/js/qa-session-bootstrap.js';\n"+await r.text()});});
 await context.route('https://wcmuffmyozjolaaahhff.supabase.co/functions/v1/pikeo-api',async route=>{
  const req=route.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const {payload:p,signature}=req.postDataJSON();let d=devices.get(p.deviceId),data,status=200;
  if(!await verify(p,signature,p.action==='register'?p.signingKey:d?.key)){status=401;data={error:'Signature fictive invalide.'};}
  else{
   if(p.action==='register'){d={key:p.signingKey};devices.set(p.deviceId,d);}
   const session={deviceId:p.deviceId,profileId:'fixture-owner',name:'Étienne',role:'admin',owner:true,active:true};
   if(p.action==='register')data={session,pin:{configured:true,canEnroll:false}};
   else if(p.action==='user-pin-status')data={pin:{configured:true,canEnroll:false}};
   else if(p.action==='user-pin-unlock')data={token:'a'.repeat(64)};
   else if(p.action==='session')data={session};
   else if(p.action==='bureau-access')data={session,expiresAt:new Date(Date.now()+60000).toISOString()};
   else if(p.action==='config-get')data={version:0,data:{records:[]}};
   else if(p.action==='admin-pin-status')data={configured:true,unlocked:true,locked:false};
   else if(p.action==='admin-pin-peers')data={peers:[]};
   else if(p.action==='users')data={users:[],audit:[]};
   else if(p.action==='devices')data={devices:[]};
   else data={saved:true};
  }
  await route.fulfill({status,headers,json:data});
 });
}
const launch=chromium.launch.bind(chromium);
chromium.launch=async(...args)=>{const browser=await launch(...args),newContext=browser.newContext.bind(browser),newPage=browser.newPage.bind(browser);browser.newContext=async(...args)=>{const c=await newContext(...args);await install(c);return c;};browser.newPage=async(...args)=>{const p=await newPage(...args);await install(p.context());return p;};return browser;};
