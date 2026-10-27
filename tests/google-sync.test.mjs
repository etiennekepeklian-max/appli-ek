import test from 'node:test';
import assert from 'node:assert/strict';

test('Google : une première connexion sans feuille permet ensuite de créer sa base',async()=>{
  const saved=new Map(),events=[],originals=new Map(['localStorage','window','google','navigator','fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  try{
    const client={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken(){options.callback({access_token:'synthetic-test-token',expires_in:3600});}})}}};
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}});
    Object.defineProperty(globalThis,'window',{configurable:true,value:{google:client,dispatchEvent:e=>events.push(e)}});
    Object.defineProperty(globalThis,'google',{configurable:true,value:client});Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
    const sync=await import('../site/js/sync.js');sync.saveConnection({clientId:''});assert.equal(sync.connection().clientId,sync.DEFAULT_CLIENT_ID);sync.saveConnection({clientId:'synthetic.apps.googleusercontent.com',spreadsheetId:''});
    const r=await sync.connect();assert.equal(r.pendingDatabase,true);assert.equal(sync.connected(),true);
    const calls=[];let tabs=['produit','manquant','objectif picking','historique'];Object.defineProperty(globalThis,'fetch',{configurable:true,value:async(url,options)=>{calls.push({url,options});return Response.json({sheets:tabs.map(title=>({properties:{title}}))});}});
    sync.saveConnection({spreadsheetId:'synthetic-sheet-12345678901234567890'});assert.match((await sync.checkConnection()).detail,/quatre onglets/);assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.body,undefined);
    tabs=['produit'];await assert.rejects(sync.checkConnection(),/Onglet Google absent/);assert.ok(calls.every(c=>c.options.method==='GET'));
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});assert.equal((await sync.checkConnection()).status,'warn');assert.equal(calls.length,2);
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});sync.disconnect();assert.equal(sync.connected(),false);assert.equal((await sync.checkConnection()).status,'manual');assert.equal(calls.length,2);
  }finally{for(const [key,value]of originals){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}}
});
