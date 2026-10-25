// Updates change application files only. Never erase user databases or preferences.
const root=new URL('../',import.meta.url),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function bounded(promise,ms){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Le réseau met trop de temps à répondre.')),ms);})]);}finally{clearTimeout(timer);}}
const versionPattern=/^\d+\.\d+\.\d+$/;
let registration,appModule,checking,applying=false,currentVersion='',availableVersion='';
export async function workerVersion(worker){
 if(!worker)return '';
 return new Promise(resolve=>{const channel=new MessageChannel();const finish=value=>{clearTimeout(timer);channel.port1.close();resolve(value);};const timer=setTimeout(()=>finish(''),300);channel.port1.onmessage=e=>finish(e.data?.type==='PIKEO_VERSION'?e.data.version:'');try{worker.postMessage({type:'PIKEO_VERSION'},[channel.port2]);}catch{finish('');}});
}
export async function latestVersion(){
 const response=await fetch(new URL('release.json?check='+Date.now(),root),{cache:'no-store',signal:AbortSignal.timeout(4000)});
 if(!response.ok)throw Error('Vérification indisponible. Vos données restent sur cet appareil.');
 const data=await response.json();if(!versionPattern.test(data.version))throw Error('Version publiée illisible.');return data.version;
}
async function ensureWorker(version){
 if(!('serviceWorker' in navigator)||location.hostname==='terminal.local')return false;
 registration=await bounded(navigator.serviceWorker.register(new URL('sw.js',root),{type:'module',scope:root.pathname,updateViaCache:'none'}),6000);
 if(await workerVersion(navigator.serviceWorker.controller)===version)return true;
 await Promise.race([registration.update().catch(()=>{}),sleep(4000)]);
 const until=Date.now()+16000;
 while(Date.now()<until){
  if(registration.waiting)registration.waiting.postMessage('SKIP_WAITING');
  if(await workerVersion(navigator.serviceWorker.controller)===version)return true;
  if(!registration.installing&&!registration.waiting&&await workerVersion(registration.active)===version){await sleep(80);continue;}
  await sleep(120);
 }
 return false;
}
function styles(version){for(const link of document.querySelectorAll('link[rel=stylesheet]')){const url=new URL(link.href);if(url.origin===root.origin){url.searchParams.set('pikeo-v',version);link.href=url.href;}}}
function banner(message,update=false){
 let box=document.getElementById('pikeo-update');if(!box){box=document.createElement('section');box.id='pikeo-update';box.className='card pikeo-update';box.setAttribute('role','status');document.querySelector('#main').before(box);}
 box.replaceChildren();const label=document.createElement('p');label.textContent=message;box.append(label);
 const actions=document.createElement('div');actions.className='actions section-gap';box.append(actions);
 if(update){const button=document.createElement('button');button.type='button';button.className='btn primary';button.textContent='Appliquer la mise à jour';button.disabled=applying;button.addEventListener('click',()=>void applyUpdate());actions.append(button);}
 const help=document.createElement('button');help.type='button';help.className='btn';help.textContent='Aide';help.dataset.action='help-update';actions.append(help);
 const close=document.createElement('button');close.type='button';close.className='btn';close.textContent='Plus tard';close.addEventListener('click',()=>box.remove());actions.append(close);
}
async function check(manual=false){
 if(checking)return checking;
 checking=(async()=>{try{availableVersion=await latestVersion();if(availableVersion!==currentVersion)banner('Version '+availableVersion+' disponible. Votre version ouverte : '+currentVersion+'.',true);else if(manual)banner('Pikéo '+currentVersion+' est à jour sur cet appareil.');}catch(e){if(manual)banner('Impossible de vérifier maintenant. La version '+currentVersion+' reste utilisable. Réessayez avec Internet.');}})().finally(()=>checking=null);return checking;
}
async function applyUpdate(){
 if(applying)return;
 if(document.querySelector('dialog[open],main form')){banner('Terminez ou fermez la saisie en cours, puis appliquez la mise à jour. Elle ne sera pas interrompue.',true);return;}
 applying=true;banner('Sauvegarde locale et préparation de la mise à jour…');
 try{
  if(appModule?.prepareUpdate)await appModule.prepareUpdate();
  availableVersion=await latestVersion();
  if(!await ensureWorker(availableVersion))throw Error('Le téléchargement n’est pas terminé. Gardez Internet et réessayez.');
  const target=new URL(root);target.hash=location.hash;target.searchParams.set('pikeo-v',availableVersion);location.replace(target.href);
 }catch(e){applying=false;banner(e.message+' Les données sont conservées.',true);}
}
export async function launch(load,expected){
 let target=expected,ready=await workerVersion(navigator.serviceWorker?.controller)===expected;
 if(!ready&&navigator.onLine){try{target=await latestVersion();}catch{}try{ready=await ensureWorker(target);}catch{}}
 // Before importing modules, activate a complete shell. A running form is never reloaded.
 if(ready)styles(target);
 appModule=await load(ready?target:'');if(appModule.ready)await appModule.ready;
 for(let i=0;i<100&&!document.getElementById('app-version')?.textContent;i++)await sleep(50);
 currentVersion=document.getElementById('app-version')?.textContent||expected;
 document.getElementById('check-update')?.addEventListener('click',()=>void check(true));
 if(ready&&navigator.onLine)void check();
 if(navigator.onLine&&currentVersion!==target){availableVersion=target;banner('Votre copie locale '+currentVersion+' attend la version '+target+'. Gardez Internet puis appliquez la mise à jour.',true);}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});window.addEventListener('online',()=>void check());setInterval(()=>{if(!document.hidden)void check();},300000);
}
export async function repair(expected){
 const status=document.getElementById('update-status'),button=document.getElementById('repair-update');button.disabled=true;status.textContent='Téléchargement de la version complète…';
 try{if(!navigator.onLine)throw Error('Connectez cet appareil à Internet, puis réessayez.');const version=await latestVersion();if(!await ensureWorker(version))throw Error('Mise à jour encore indisponible. Fermez les autres fenêtres Pikéo puis réessayez.');status.textContent='Version '+version+' prête. Ouverture…';const target=new URL(root);target.searchParams.set('pikeo-v',version);location.replace(target.href);}catch(e){status.textContent=e.message+' Aucune donnée personnelle n’a été effacée.';button.disabled=false;}
}
