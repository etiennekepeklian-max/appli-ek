import test from 'node:test';
import assert from 'node:assert/strict';

test('Google : une première connexion sans feuille permet ensuite de créer sa base',async()=>{
  const saved=new Map(),events=[],originals=new Map(['localStorage','window','google','navigator'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  try{
    const client={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken(){options.callback({access_token:'synthetic-test-token',expires_in:3600});}})}}};
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}});
    Object.defineProperty(globalThis,'window',{configurable:true,value:{google:client,dispatchEvent:e=>events.push(e)}});
    Object.defineProperty(globalThis,'google',{configurable:true,value:client});Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
    const sync=await import('../site/js/sync.js');sync.saveConnection({clientId:''});assert.equal(sync.connection().clientId,sync.DEFAULT_CLIENT_ID);sync.saveConnection({clientId:'synthetic.apps.googleusercontent.com',spreadsheetId:''});
    const r=await sync.connect();assert.equal(r.pendingDatabase,true);assert.equal(sync.connected(),true);sync.disconnect();assert.equal(sync.connected(),false);
  }finally{for(const [key,value]of originals){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}}
});
