import * as API from './session-api.js';
import {VERSION} from './core.js';
import {helpFor} from './help-core.js';

let app,loading,checking,expiry;
const gate=document.querySelector('#bureau-access-gate');
function lock(message){
 document.body.dataset.bureauLocked='1';gate.hidden=false;
 gate.querySelector('[data-bureau-status]').textContent=message;
 for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
 void app?.pauseBureau?.().catch(()=>{});
}
async function open(){
 if(!API.bureauAllowed())throw Error('Vérifiez à nouveau votre session administrateur.');
 delete document.body.dataset.bureauLocked;gate.hidden=true;
 if(!loading){
  const version=new URL(import.meta.url).search;
  loading=import('./app.js'+version).then(async module=>{app=module;await app.ready;});
 }
 await loading;
}
async function verify(){
 if(checking)return checking;
 checking=(async()=>{
  const button=gate.querySelector('[data-bureau-retry]');button.disabled=true;
  try{
   await API.authorizeBureau();
   clearTimeout(expiry);
   expiry=setTimeout(()=>{lock('Les droits doivent être vérifiés à nouveau.');if(!document.hidden)void verify();},60000);
   await open();
  }catch(error){lock(error.message);}
  finally{button.disabled=false;checking=null;}
 })();
 return checking;
}
async function start(){
 document.getElementById('app-version').textContent=VERSION;
 const [title,steps]=helpFor({context:'bureau-access'}),help=gate.querySelector('[data-bureau-help]');
 const heading=document.createElement('h2');heading.textContent=title;help.append(heading);
 for(const step of steps){const p=document.createElement('p');p.textContent=step;help.append(p);}
 gate.querySelector('[data-bureau-help-toggle]').addEventListener('click',event=>{help.hidden=!help.hidden;event.currentTarget.setAttribute('aria-expanded',String(!help.hidden));});
 gate.querySelector('[data-bureau-retry]').addEventListener('click',()=>void verify());
 window.addEventListener('pikeo-session',()=>{if(!API.bureauAllowed())lock('Pikéo Bureau est réservé à une session administrateur vérifiée.');});
 window.addEventListener('offline',()=>lock('Connectez cet ordinateur à Internet pour vérifier les droits administrateur.'));
 const resume=()=>{lock('Vérification des droits administrateur…');void verify();};
 window.addEventListener('online',resume);
 window.addEventListener('focus',resume);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume();});
 setInterval(()=>{if(!document.hidden&&navigator.onLine)void verify();},30000);
 // Block application shortcuts while the gate is shown; its own controls and
 // links remain available. Existing forms stay in the DOM, with their values.
 for(const name of ['click','submit','keydown'])document.addEventListener(name,event=>{
  if(document.body.dataset.bureauLocked&& !gate.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 gate.dataset.ready='1';
 try{await API.init();await verify();}catch(error){lock(error.message);}
}
export const ready=start();
export async function prepareUpdate(){await app?.prepareUpdate?.();}
