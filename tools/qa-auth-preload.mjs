// Test-only authenticated fixture for business-screen regressions. No real API.
// The separate user-pin-smoke and PostgreSQL contract exercise real login logic.
import {chromium} from 'playwright';
import {verify} from '../backend/pikeo-api/core.mjs';
function wrapRoutes(target){
 const add=target.route.bind(target);
 target.route=async(pattern,handler,...rest)=>add(pattern,typeof pattern==='string'&&(pattern.includes('pikeo-api')||pattern.includes('functions/v1'))?async(route,request)=>{
  if(!route.request().url().includes('/pikeo-api'))return handler(route,request);
  if(!pattern.includes('pikeo-api'))return route.fallback();
  const req=route.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type'};
  const action=req.method()==='POST'?req.postDataJSON()?.payload?.action:null;
  if(['web-access','native-access'].includes(action))return route.fulfill({headers,json:{allowed:true,approved:true}});if(action==='management-access')return route.fulfill({headers,json:{modules:[]}});
  if(action==='activity-list')return route.fulfill({headers,json:{events:[],next:null}});
  if(action==='activity-batch')return route.fulfill({headers,json:{saved:true}});
  if(action==='user-pin-status')return route.fulfill({headers,json:{pin:{configured:true,canEnroll:false}}});
  if(action==='user-pin-unlock'||action==='user-pin-enroll')return route.fulfill({headers,json:{token:'a'.repeat(64)}});
  const fulfill=route.fulfill.bind(route);route.fulfill=async options=>{
   let data=options.json;if(!data&&typeof options.body==='string'){try{data=JSON.parse(options.body);}catch{}}
   if(action==='register'&&data?.session&&!data.pin){data.pin={configured:true,canEnroll:false};options={...options,json:data};delete options.body;}
   return fulfill(options);
  };return handler(route,request);
 }:handler,...rest);
}
const seededPages=new WeakSet();
function seedNavigation(page){
 if(seededPages.has(page))return;seededPages.add(page);const goto=page.goto.bind(page),origins=new Set();
 page.goto=async(url,options)=>{
  const u=new URL(url);
  if(['localhost','127.0.0.1'].includes(u.hostname)&&!origins.has(u.origin)){
   origins.add(u.origin);await goto(u.origin+'/qa-session.html');
   await page.evaluate(async()=>{const api=await import('/js/session-api.js');await api.login('Étienne',{ownerSecret:'synthetic-fixture-only'});});
  }
  return goto(url,options);
 };
}
const installed=new WeakSet();
async function install(context){
 if(installed.has(context))return;installed.add(context);const devices=new Map();
 await context.addInitScript(()=>{
  let remembered;try{remembered=localStorage.getItem('pikeo-active-identity');}catch{}
  const fill=async()=>{if(!navigator.onLine)return;const d=document.querySelector('.personal-pin-dialog');if(!d||d.dataset.fixtureFilled)return;d.dataset.fixtureFilled='1';const user=d.querySelector('[name=username]');if(user){const local=await import('/js/session-store.js');const row=remembered?await local.getIdentity(remembered):null;user.value=row?.name||'Étienne';}for(const i of d.querySelectorAll('input[type=password]')){i.value='0042';i.dispatchEvent(new Event('input',{bubbles:true}));}if(d.isConnected)d.querySelector('form')?.requestSubmit();};new MutationObserver(()=>void fill()).observe(document,{childList:true,subtree:true});
 });
 context.on('page',page=>{wrapRoutes(page);seedNavigation(page);page.on('pageerror',error=>console.error('QA page error',error.stack));page.on('console',msg=>{if(msg.type()==='error')console.error('QA console',msg.text());});});
 await context.route('**/qa-session.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Compte synthétique de test</body></html>'}));
 await context.route('**/js/session-pin-ui.js',route=>route.fulfill({contentType:'text/javascript',body:"export async function askPin(){return {pin:'0042',confirmation:'0042'}}"}));
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
 wrapRoutes(context);
}
const launch=chromium.launch.bind(chromium);
chromium.launch=async(...args)=>{const browser=await launch(...args),newContext=browser.newContext.bind(browser),newPage=browser.newPage.bind(browser);browser.newContext=async(...args)=>{const c=await newContext(...args);await install(c);return c;};browser.newPage=async(...args)=>{const p=await newPage(...args);await install(p.context());wrapRoutes(p);seedNavigation(p);return p;};return browser;};
