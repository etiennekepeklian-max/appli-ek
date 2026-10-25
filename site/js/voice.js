import * as Store from './storage.js';
import * as AudioStore from './voice-store.js';
import {state,esc,icon,pageHeading,btn,modal,closeModal,download,jsonDownload,toast,timestampLabel} from './ui.js';
let recorder,stream,chunks=[],started=0,status='idle',revision=0,stopPromise,pendingMemo,namespace,clockTimer;
const urls=new Set();
const duration=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
function configure(){const next=Store.isDemo()?'demo':'live';if(namespace!==next){namespace=next;AudioStore.useVoiceNamespace(next==='demo');}}
export function voiceView(){return `${pageHeading('Mémos vocaux','Vos notes audio, conservées uniquement sur ce téléphone.')}<section class="card"><h2>Enregistrer un mémo</h2><div class="field section-gap"><label for="memo-name">Nom du mémo</label><input id="memo-name" maxlength="100" placeholder="Ex. Repère pour le réassort"></div><p class="voice-status section-gap" id="voice-live" role="status" aria-live="polite">Prêt à enregistrer</p><div class="actions section-gap"><button class="btn primary full" data-voice-action="record">${icon('mic')}Enregistrer</button><button class="btn primary full" data-voice-action="stop" hidden>${icon('check')}Arrêter et conserver</button><button class="btn full" data-voice-action="retry" hidden>Réessayer l’enregistrement local</button><button class="btn full" data-voice-action="export-pending" hidden>Exporter le mémo en attente</button></div><p class="hint section-gap">Autorisez le microphone. Quitter cet écran ou passer en arrière-plan arrête et conserve le mémo. Aucun service de transcription n’est utilisé.</p><p class="hint">Les audios sont exclus de Google Sheets et de la sauvegarde générale. Exportez-les ici avant de changer de téléphone ou d’effacer les données du navigateur.</p></section><section class="card section-gap"><div class="card-header"><h2>Mes mémos</h2><span class="badge" id="memo-count">…</span></div><div id="voice-list"><p class="hint">Lecture des mémos…</p></div></section><section class="card section-gap"><h2>Sauvegarde des mémos</h2><div class="actions section-gap memo-backup-actions"><button class="btn full" data-voice-action="export-all">${icon('download')}Exporter tous les mémos</button><button class="btn full" data-voice-action="import">${icon('upload')}Importer une sauvegarde de mémos</button></div><p class="hint section-gap">L’export contient les fichiers audio et leurs noms. L’import ajoute les mémos absents sans remplacer ceux déjà présents.</p></section>`;}
function controls(){
 const root=document.querySelector('#main');if(state.route!=='voice')return;
 const active=['starting','recording','saving'].includes(status);
 const record=root.querySelector('[data-voice-action=record]'),stop=root.querySelector('[data-voice-action=stop]'),retry=root.querySelector('[data-voice-action=retry]');if(!record)return;
 record.hidden=status==='recording';record.disabled=active||!!pendingMemo;stop.hidden=status!=='recording';retry.hidden=!pendingMemo;root.querySelector('[data-voice-action=export-pending]').hidden=!pendingMemo;root.querySelector('#memo-name').disabled=active;
 const text=status==='starting'?'Autorisez le microphone…':status==='recording'?`Enregistrement · ${duration((Date.now()-started)/1000)}`:status==='saving'?'Conservation sur le téléphone…':pendingMemo?'Le mémo reste en mémoire. Libérez de l’espace puis réessayez, ou exportez le son ci-dessous.':'Prêt à enregistrer';
 root.querySelector('#voice-live').textContent=text;
 root.querySelector('#voice-live').classList.toggle('recording',status==='recording');
}
function revokePlayers(){for(const url of urls)URL.revokeObjectURL(url);urls.clear();}
export async function mountVoice(){
 configure();controls();await refreshMemos();
}
async function refreshMemos(){
 const root=document.querySelector('#voice-list');if(!root)return;
 const rows=await AudioStore.listMemos();if(!root.isConnected)return;revokePlayers();
 root.innerHTML=rows.length?rows.map(row=>{const url=URL.createObjectURL(row.blob);urls.add(url);return `<article class="memo-card"><h3>${esc(row.name)}</h3><p class="hint">${esc(timestampLabel(row.createdAt))} · ${duration(row.duration)} · ${Math.max(1,Math.round(row.blob.size/1024))} Ko</p><audio controls preload="none" src="${url}" aria-label="Écouter ${esc(row.name)}"></audio><div class="actions section-gap">${['rename','export','share','delete'].map((action,i)=>`<button class="btn small" data-voice-action="${action}" data-id="${esc(row.id)}">${['Renommer','Exporter le son','Partager','Supprimer'][i]}</button>`).join('')}</div></article>`;}).join(''):'<div class="empty"><h3>Aucun mémo pour le moment</h3><p>Gardez vos repères en parlant.</p></div>';
 document.querySelector('#memo-count').textContent=String(rows.length);
}
function release(){stream?.getTracks().forEach(track=>track.stop());stream=null;clearInterval(clockTimer);}
async function record(){
 if(status!=='idle'||pendingMemo)return;configure();
 if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder)throw Error('L’enregistrement audio nécessite un navigateur compatible et une adresse HTTPS.');
 const run=++revision,name=document.querySelector('#memo-name')?.value.trim()||'Mémo du '+new Date().toLocaleString('fr-FR');status='starting';controls();
 try{
  const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
  if(run!==revision||state.route!=='voice'||document.hidden){acquired.getTracks().forEach(t=>t.stop());return;}
  stream=acquired;chunks=[];const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
  recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);started=Date.now();const createdAt=new Date().toISOString();
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onerror=()=>{toast('L’enregistrement a été interrompu. Le son reçu va être conservé.',true);if(recorder?.state!=='inactive')void stopAndSave();};
  stopPromise=new Promise(resolve=>{recorder.onstop=async()=>{
   const blob=new Blob(chunks,{type:recorder.mimeType||chunks[0]?.type||'audio/webm'});recorder=null;chunks=[];release();status='saving';controls();
   try{if(blob.size){pendingMemo={name,createdAt,duration:(Date.now()-started)/1000,blob};await persistMemo();}else toast('Aucun son reçu. Vérifiez le microphone.',true);}catch(e){toast('Le mémo n’a pas pu être conservé : '+e.message,true);}finally{status='idle';controls();resolve();}
  };});
  recorder.start(1000);status='recording';controls();clockTimer=setInterval(()=>{controls();if(Date.now()-started>=30*60*1000){toast('30 minutes atteintes : le mémo est conservé.');void stopAndSave();}},1000);
 }catch(e){release();status='idle';controls();throw Error(e.name==='NotAllowedError'?'Autorisez le microphone dans les réglages du navigateur.':e.name==='NotFoundError'?'Aucun microphone disponible.':e.message||'Impossible de démarrer le microphone.');}
}
async function persistMemo(){
 if(!pendingMemo)return;await AudioStore.saveMemo(pendingMemo);pendingMemo=null;toast('Mémo conservé uniquement sur ce téléphone.');if(state.route==='voice'){const name=document.querySelector('#memo-name');if(name)name.value='';await refreshMemos();}
}
export function stopAndSave(){
 if(status==='starting'){revision++;status='idle';controls();return Promise.resolve();}
 if(recorder?.state==='recording'){status='saving';controls();recorder.stop();}
 return stopPromise||Promise.resolve();
}
export function leaveVoice(){void stopAndSave();revokePlayers();}
function fileFor(row){return new File([row.blob],(row.name.replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,70)||'memo')+'.'+AudioStore.memoExtension(row.blob.type),{type:row.blob.type||'audio/webm'});}
async function action(button){
 const name=button.dataset.voiceAction,id=button.dataset.id;
 if(name==='export-pending'){if(pendingMemo){const file=fileFor(pendingMemo);download(file,file.name);}return;}
 if(name==='record'){await record();return;}
 if(name==='stop'){await stopAndSave();return;}
 if(name==='retry'){await persistMemo();controls();return;}
 if(name==='export-all'){await stopAndSave();if(pendingMemo)throw Error('Conservez ou exportez d’abord le mémo en attente.');jsonDownload(await AudioStore.exportMemos(),'pikeo-memos-'+new Date().toISOString().slice(0,10)+'.json');document.querySelector('#dialog').dataset.helpContext='voice-backup';return;}
 if(name==='import'){
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>350e6)throw Error('Choisissez une sauvegarde de moins de 350 Mo.');const count=await AudioStore.importMemos(JSON.parse(await file.text()));toast(`${count} mémo(s) ajouté(s).`);await refreshMemos();}catch(e){toast(e.message,true);}};input.click();return;
 }
 const row=await AudioStore.getMemo(id);if(!row)throw Error('Ce mémo n’est plus disponible.');
 if(name==='rename'){modal('Renommer le mémo',`<form data-voice-form="rename" data-id="${esc(id)}"><label for="voice-name">Nom du mémo</label><input id="voice-name" name="name" required maxlength="100" value="${esc(row.name)}"><div class="form-actions"><button class="btn primary" type="submit">Enregistrer le nom</button></div></form>`);document.querySelector('#dialog').dataset.helpContext='voice-name';return;}
 if(name==='delete'){modal('Supprimer ce mémo ?',`<p>Le son « ${esc(row.name)} » sera supprimé de ce téléphone. Exportez-le au préalable si vous souhaitez le conserver.</p><div class="form-actions">${btn('Annuler','close-dialog')}<button class="btn danger" data-voice-action="confirm-delete" data-id="${esc(id)}">Supprimer ce mémo</button></div>`);document.querySelector('#dialog').dataset.helpContext='voice-delete';return;}
 if(name==='confirm-delete'){await AudioStore.removeMemo(id);closeModal();await refreshMemos();toast('Mémo supprimé de ce téléphone.');return;}
 const file=fileFor(row);
 if(name==='share'){
  if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:row.name});}catch(e){if(e.name!=='AbortError')throw e;}return;}
  toast('Le partage de fichiers est indisponible ici. Exportez le son puis partagez-le depuis vos fichiers.');
 }
 if(name==='export'||name==='share'){download(file,file.name);document.querySelector('#dialog').dataset.helpContext='voice-backup';}
}
export function installVoice(){
 document.addEventListener('click',e=>{const b=e.target.closest('[data-voice-action]');if(!b)return;e.preventDefault();if(b.disabled)return;Promise.resolve().then(()=>action(b)).catch(error=>toast(error.message,true));});
 document.addEventListener('submit',e=>{const form=e.target.closest('[data-voice-form=rename]');if(!form)return;e.preventDefault();void (async()=>{const row=await AudioStore.getMemo(form.dataset.id);if(!row)throw Error('Mémo introuvable.');const name=form.elements.name.value.trim();if(!name)throw Error('Renseignez un nom.');await AudioStore.saveMemo({...row,name});closeModal();await refreshMemos();})().catch(error=>toast(error.message,true));});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)void stopAndSave();});
 window.addEventListener('beforeunload',e=>{if(['recording','saving'].includes(status)||pendingMemo){e.preventDefault();e.returnValue='';}});
}
