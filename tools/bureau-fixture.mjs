// Signed synthetic sessions. Never calls a real account API.
import assert from 'node:assert/strict';
import {verify} from '../backend/pikeo-api/core.mjs';
import {permissionsFor} from '../site/js/permissions-core.js';
export const sessionEndpoint='https://wcmuffmyozjolaaahhff.supabase.co/functions/v1/pikeo-api';
export async function bureauFixture(context,role='admin'){
 const state={role,active:true,profileActive:true,unavailable:false,requests:[],devices:new Map(),nonces:new Set(),hold:null};
 await context.route(sessionEndpoint,async route=>{
  const request=route.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const {payload:p,signature}=request.postDataJSON();state.requests.push(p.action);
  if(state.unavailable)return route.fulfill({status:503,headers,json:{error:'Service temporairement indisponible.'}});
  if(p.action==='bureau-access'&&state.hold)await state.hold;
  let d=state.devices.get(p.deviceId),status=200,data;
  const session=()=>({deviceId:p.deviceId,name:d.name,profileId:'synthetic-profile',role:state.role,owner:false,active:true,permissions:permissionsFor({role:state.role})});
  if(!await verify(p,signature,p.action==='register'?p.signingKey:d?.key)){status=401;data={error:'Signature invalide.'};}
  else if(state.nonces.has(p.nonce)){status=409;data={error:'Demande déjà traitée.'};}
  else if(!state.active||!state.profileActive){status=401;data={error:'Cet accès a été retiré.'};}
  else{
   state.nonces.add(p.nonce);
   if(p.action==='register'){d={name:p.name,key:p.signingKey};state.devices.set(p.deviceId,d);data={session:session()};}
   else if(p.action==='session')data={session:session()};
   else if(p.action==='bureau-access'){
    if(state.role!=='admin'){status=403;data={error:'Pikéo Bureau est réservé aux administrateurs.'};}
    else data={session:session(),expiresAt:new Date(Date.now()+60000).toISOString()};
   }else if(p.action==='config-get')data={version:0,data:{records:[]}};
   else if(p.action==='admin-pin-status')data={configured:false,unlocked:false};
   else {status=400;data={error:'Action non prévue par la simulation.'};}
  }
  await route.fulfill({status,headers,json:data}).catch(()=>{});
 });
 return state;
}
export async function seedBureauSession(page,name='Administrateur fictif'){
 await page.goto('http://localhost:8765/index.html#users');
 await page.evaluate(async name=>{await (await import('./js/app.js')).ready;await (await import('./js/session-api.js')).login(name);},name);
 assert.ok(await page.evaluate(()=>!!localStorage.getItem('pikeo-active-identity')));
}
