import * as Store from './storage.js';
import * as Sync from './sync.js';
import {esc,modal,closeModal,onModalClose,toast} from './ui.js';
import {inspectAppCache,clearAppCache,formatCacheBytes} from './cache-cleanup-core.js';

let installed=false,queued=null,current=null,timer,measuring=false,lastFingerprint='',sequence=0;
const validBackup=backup=>!!backup&&Store.scope()===backup.scope&&Sync.connection().spreadsheetId===backup.sheetId&&!Store.isDemo()&&!Sync.activity().busy&&!Sync.activity().error&&Store.pendingEvents().length===0;
const canOpen=()=>!document.hidden&&!document.querySelector('dialog[open],form[data-editing="1"]')&&!document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]');
function schedule(){clearTimeout(timer);if(queued&&!current&&!measuring)timer=setTimeout(()=>void offer(),350);}
function release(key){if(current?.key!==key)return;current.abort?.abort();current=null;const dialog=document.querySelector('#dialog');if(dialog?.dataset.cacheCleanupKey===key)delete dialog.dataset.cacheCleanupKey;schedule();}
async function offer(){
 if(!queued||current||measuring||!canOpen())return;
 const backup=queued;if(!validBackup(backup)){queued=null;return;}
 measuring=true;
 try{
  const plan=await inspectAppCache({previousFingerprint:lastFingerprint});
  if(queued!==backup||!validBackup(backup))return;
  if(!plan.supported||plan.unchanged||!plan.bytes){queued=null;return;}
  if(!canOpen())return;
  const key=String(++sequence);lastFingerprint=plan.fingerprint;queued=null;current={key,plan,backup,clearing:false};
  modal('Libérer de l’espace après la sauvegarde',`<p class="dialog-intro">Votre sauvegarde Google est terminée.</p><p class="section-gap">Espace libérable estimé : <strong data-cache-cleanup-size>${esc(formatCacheBytes(plan.bytes))}</strong>.</p><p class="section-gap">Les fichiers techniques de Pikéo seront supprimés du cache. Une connexion Internet sera nécessaire pour les télécharger à nouveau et retrouver toutes les fonctions hors connexion.</p><p class="hint section-gap">Vos fiches, photos, brouillons, mémos vocaux et préférences restent sur cet appareil. L’espace réellement récupéré dépend du navigateur.</p><p class="error-message" data-cache-cleanup-error role="alert" hidden></p><div class="form-actions"><button type="button" class="btn" data-cache-cleanup-action="cancel">Conserver le cache</button><button type="button" class="btn danger" data-cache-cleanup-action="confirm">Effacer le cache</button></div>`);
  const dialog=document.querySelector('#dialog');dialog.dataset.helpContext='cache-cleanup';dialog.dataset.cacheCleanupKey=key;
  onModalClose(()=>release(key));dialog.addEventListener('close',()=>release(key),{once:true});
 }catch{queued=null;toast('Sauvegarde terminée. Le cache ne peut pas être mesuré sur cet appareil.',true);}
 finally{measuring=false;if(queued&&queued!==backup)schedule();}
}
async function confirmCleanup(){
 const state=current,dialog=document.querySelector('#dialog');if(!state||state.clearing||!dialog?.open||dialog.dataset.cacheCleanupKey!==state.key)return;
 const error=dialog.querySelector('[data-cache-cleanup-error]');
 if(!validBackup(state.backup)||navigator.onLine===false){
  lastFingerprint='';if(error){error.hidden=false;error.textContent=navigator.onLine===false?'Reconnectez Internet avant de nettoyer le cache. Les fichiers hors connexion devront être téléchargés de nouveau.':'Une nouvelle modification attend une sauvegarde. Fermez cette fenêtre puis synchronisez de nouveau.';}return;
 }
 state.clearing=true;state.abort=new AbortController();dialog.querySelectorAll('[data-cache-cleanup-action]').forEach(b=>b.disabled=true);
 try{
  const result=await clearAppCache(state.plan,{signal:state.abort.signal});
  if(current!==state||!dialog.open)return;
  const message=result.removed?'Cache effacé : environ '+formatCacheBytes(result.bytes)+' de fichiers retirés.':'Les fichiers proposés ont déjà été retirés du cache.';
  document.querySelector('#dialog-body').innerHTML=`<p class="dialog-intro" role="status">${esc(message)}</p><p class="section-gap">Vos données personnelles et métier sont conservées. Les fichiers techniques se téléchargeront à nouveau avec Internet lorsque vous en aurez besoin.</p>${result.failed?'<p class="hint section-gap">Certains fichiers n’ont pas pu être retirés. Ils sont conservés.</p>':''}<div class="form-actions"><button type="button" class="btn primary" data-cache-cleanup-action="cancel">Terminer</button></div>`;
 }catch(e){state.clearing=false;if(error){error.hidden=false;error.textContent=e.message;}dialog.querySelectorAll('[data-cache-cleanup-action]').forEach(b=>b.disabled=false);}
}
export function installCacheCleanup(){
 if(installed)return;installed=true;
 window.addEventListener('ek-sync',event=>{
  const detail=event.detail||{};
  if(detail.error){queued=null;return;}
  if(!detail.success||detail.remaining!==0||!detail.scope||!detail.sheetId)return;
  queued={scope:detail.scope,sheetId:detail.sheetId};schedule();
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-cache-cleanup-action]');if(!button||!current)return;
  event.preventDefault();if(button.dataset.cacheCleanupAction==='cancel')closeModal();else void confirmCleanup();
 });
 const observer=new MutationObserver(()=>{if(queued&&!current&&!measuring)schedule();});
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','data-editing']});
 document.addEventListener('focusout',schedule);document.addEventListener('visibilitychange',schedule);window.addEventListener('online',schedule);
}
