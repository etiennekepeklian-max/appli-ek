import {withOwnership} from './ownership.js';
import * as API from './session-api.js';
import {VERSION} from './core.js';
function showEntryContent(state){const main=document.querySelector('#main');if(main)main.dataset.entryState=state;const loader=document.getElementById('mascot-status');if(loader)loader.hidden=true;}
function credentials(error=''){
 showEntryContent('login');
 return new Promise(resolve=>{
  const d=document.createElement('dialog');d.className='personal-pin-dialog entry-login';
  const h=document.createElement('h1');h.textContent='Connexion à Pikéo';d.append(h);
  const p=document.createElement('p');p.textContent='Identifiant et code personnel requis à chaque ouverture.';d.append(p);
  const form=document.createElement('form');form.dataset.entryLogin='';form.autocomplete='off';
  for(const [name,label,type] of [['username','Identifiant','text'],['password','Code personnel à quatre chiffres','password']]){const l=document.createElement('label');l.className='field section-gap';l.textContent=label;const i=document.createElement('input');i.name=name;i.type=type;i.required=true;i.autocomplete='off';if(type==='password'){i.inputMode='numeric';i.pattern='[0-9]{4}';i.maxLength=4;}else{i.maxLength=40;}l.append(i);form.append(l);}
  const msg=document.createElement('p');msg.setAttribute('role','alert');msg.className='error-message';msg.textContent=error;form.append(msg);
  const help=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Première connexion, code oublié et accès Étienne';help.append(summary);const text=document.createElement('p');text.textContent='Première connexion : choisissez votre code, puis confirmez-le dans la fenêtre suivante. En cas d’oubli, Étienne seul autorise la réinitialisation. La connexion nécessite Internet. Les nouveaux appareils Android doivent être autorisés une fois par Étienne. Le web est réservé au propriétaire ; un export de transition conserve vos anciennes données.';help.append(text);
  const label=document.createElement('label');label.className='field';label.textContent='Étienne : fichier privé d’activation';const file=document.createElement('input');file.type='file';file.accept='.json';label.append(file);help.append(label);form.append(help);
  const submit=document.createElement('button');submit.type='submit';submit.className='btn primary full section-gap';submit.textContent='Ouvrir ma session';form.append(submit);d.append(form);
  d.addEventListener('cancel',e=>e.preventDefault());form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;submit.disabled=true;try{let ownerSecret;if(file.files?.[0]){if(file.files[0].size>16384)throw Error('Fichier privé invalide.');const data=JSON.parse(await file.files[0].text());if(data.app!=='PikeoAdminAccess'||data.endpoint!==API.ENDPOINT||typeof data.secret!=='string')throw Error('Fichier privé invalide.');ownerSecret=data.secret;}const values={name:form.elements.username.value,pin:form.elements.password.value,ownerSecret};form.elements.password.value='';d.close();d.remove();resolve(values);}catch(err){msg.textContent=err.message;submit.disabled=false;}};
  document.body.append(d);d.showModal();form.elements.username.focus();
 });
}
export async function authenticate({webOnly=false}={}){
 await (globalThis.PikeoIntroReady||Promise.resolve());let error='';API.personal();
 while(true){const values=await credentials(error);try{await API.login(values.name,{pin:values.pin,ownerSecret:values.ownerSecret,deferPlatform:true});values.pin='';values.ownerSecret='';if(globalThis.PikeoNative&&!webOnly){const a=await API.request('native-access');if(!a.approved&&!a.owner){const approved=await pendingDevice(a);if(!approved){API.personal();error='Pour l’accès propriétaire Étienne, importez votre fichier privé dans les détails de connexion.';continue;}}}else await API.request('web-access');return API.current();}catch(e){if(e.status===403&&API.current()&&!API.current().owner&&!globalThis.PikeoNative){await migrationOnly(e.message);return null;}error=e.message;API.personal();}}
}
async function pendingDevice(access){
 showEntryContent('device-approval');
 const main=document.querySelector('#main');main.replaceChildren();const box=document.createElement('section');box.className='card';const h=document.createElement('h1');h.textContent='Autorisation Android nécessaire';const p=document.createElement('p');p.setAttribute('role','status');p.textContent='Cet appareil attend l’autorisation d’Étienne. Empreinte : '+(access.fingerprint||'').slice(0,16);const help=document.createElement('p');help.textContent='Vous êtes Étienne ? Revenez à la connexion et importez votre fichier privé d’activation dans « Première connexion, code oublié et accès Étienne ». Votre nom seul n’accorde pas les droits propriétaire.';const b=document.createElement('button');b.className='btn primary';b.textContent='Vérifier mon autorisation';const back=document.createElement('button');back.className='btn section-gap';back.textContent='Revenir à la connexion';box.append(h,p,help,b,back);main.append(box);
 return new Promise(resolve=>{back.onclick=()=>resolve(false);b.onclick=async()=>{b.disabled=true;back.disabled=true;try{const next=await API.request('native-access');if(next.approved||next.owner)resolve(true);else p.textContent='Cet appareil attend encore l’autorisation d’Étienne. Empreinte : '+(next.fingerprint||'').slice(0,16);}catch(e){p.textContent=e.message;}finally{b.disabled=false;back.disabled=false;}};});
}
async function migrationOnly(message){
 showEntryContent('migration');
 document.getElementById('pikeo-opening')?.remove();const main=document.querySelector('#main');main.replaceChildren();const h=document.createElement('h1');h.textContent='Pikéo passe sur Android';const p=document.createElement('p');p.textContent=message+' Vos données locales restent conservées. Exportez-les avant de changer d’application.';main.append(h,p);
 const data=document.createElement('button');data.className='btn primary section-gap';data.textContent='Exporter mes données pour Android';main.append(data);
 data.onclick=async()=>{try{const store=await import('./storage.js');await store.openStore(false);const backup=await store.exportData();const blob=new Blob([JSON.stringify(withOwnership(backup))],{type:'application/json'}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='Pikeo-migration-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(e){p.textContent=e.message;}};
 const audio=document.createElement('button');audio.className='btn section-gap';audio.textContent='Exporter mes mémos séparément';main.append(audio);audio.onclick=async()=>{try{const voice=await import('./voice-store.js');const output=await voice.exportMemos();const blob=new Blob([JSON.stringify(withOwnership(output))],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Pikeo-memos-migration.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);}catch(e){p.textContent=e.message;}};
 const note=document.createElement('p');note.textContent='L’APK sera remis par Étienne. Aucun ancien fichier ni aucune photo n’est supprimé.';main.append(note);
}
export async function boot(){
 document.getElementById('app-version').textContent=VERSION;
 const user=await authenticate();if(!user)return {ready:Promise.resolve(),prepareUpdate:async()=>{}};
 showEntryContent('opening');
 const app=await import('./app.js');await app.ready;return app;
}
