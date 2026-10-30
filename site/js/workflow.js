import * as Store from './storage.js';
import * as Sync from './sync.js';
import {products} from './model.js';
import {completionRows,completionLabels,backupPresentation} from './workflow-core.js';
import {state,esc,btn,nav,pageHeading,searchbox,fmt,timestampLabel} from './ui.js';

export const backupPanel=()=>'<section class="card backup-panel" aria-label="État de sauvegarde"><h2>Sauvegarde</h2><div data-backup-status role="status" aria-live="polite">Vérification de la sauvegarde…</div></section>';
export const secondaryMenu=(content,label='Autres actions')=>`<details class="secondary-menu"><summary>${esc(label)}</summary><div class="actions section-gap">${content}</div></details>`;
let backupRevision=0;
export async function refreshBackup(){
  const revision=++backupRevision,namespace=Store.isDemo(),sheet=Sync.connection().spreadsheetId;
  const [lastSync,lastSheet]=await Promise.all([Store.meta('lastSync'),Store.meta('lastSyncSheet')]);
  if(revision!==backupRevision||namespace!==Store.isDemo())return;
  const runtime=Sync.activity(),pending=Store.pendingEvents().length,documents=Store.list('documents').filter(d=>!d.driveId).length;
  const info={demo:namespace,online:navigator.onLine,configured:!!sheet,connected:Sync.connected(),busy:runtime.busy,error:runtime.error,pending,documents,lastSync:lastSheet===sheet?lastSync:null};
  const display=backupPresentation(info),action={configure:['Configurer','google-settings'],connect:['Connecter mon compte','connect-google'],retry:[Sync.connected()?'Réessayer':'Reconnecter mon compte',Sync.connected()?'sync':'connect-google'],sync:['Synchroniser maintenant','sync']}[display.action];
  for(const summary of document.querySelectorAll('[data-backup-summary]'))summary.textContent=display.title;
  for(const slot of document.querySelectorAll('[data-backup-status]')){
    slot.dataset.backupKind=display.kind;
    slot.innerHTML=`<p><strong>${esc(display.title)}</strong></p>${!namespace?`<p class="hint section-gap">${pending} modification(s) et ${documents} document(s) à envoyer.<br>Dernière sauvegarde réussie pour cette base : ${info.lastSync?esc(timestampLabel(info.lastSync)):'aucune sur cet appareil'}.</p>${runtime.error?`<p class="error-message section-gap">${esc(runtime.error)}</p>`:''}${action&&!slot.closest('#google-settings')?`<div class="actions section-gap">${btn(action[0],action[1],'sync','primary small')}</div>`:''}`:'<p class="hint">Les exemples ne sont pas envoyés sur Google.</p>'}`;
  }
  const googleButton=document.querySelector('[data-form="google-settings"] [data-google-connect]');
  if(googleButton){googleButton.dataset.action=Sync.connected()?'sync':'connect-google';googleButton.textContent=Sync.connected()?'Synchroniser maintenant':'Connecter mon compte';googleButton.disabled=runtime.busy;}
  for(const el of document.querySelectorAll('[data-google-disconnect]'))el.hidden=!Sync.connected();
}
export function completionView(){
  const all=products(),rows=completionRows(all,state.filter,state.query),pageSize=20,page=Math.min(state.page,Math.max(0,Math.ceil(rows.length/pageSize)-1));
  const unknowns=Store.list('unknowns').filter(r=>r.status!=='resolved');
  return `${pageHeading('À compléter','Fiabilisez les références au fil des besoins, sans tout renseigner d’un coup.',nav('Produits','stock','box'))}<div class="filters">${searchbox(state.query,'Référence, nom ou emplacement…')}<select id="view-filter" aria-label="Information à compléter"><option value="all">Toutes les informations manquantes</option>${Object.entries(completionLabels).map(([value,label])=>`<option value="${value}" ${state.filter===value?'selected':''}>${label}</option>`).join('')}</select></div>${unknowns.length?`<section class="card section-gap"><h2>${unknowns.length} code(s) à identifier</h2><p class="hint">Les lectures inconnues sont conservées pour être associées au bon produit.</p>${nav('Identifier les codes inconnus','unknowns','scan','section-gap')}</section>`:''}<p class="hint section-gap">${fmt(rows.length)} référence(s) à compléter dans ce filtre. Les références utiles au poste peuvent être traitées en premier.</p><div class="record-list section-gap">${rows.slice(page*pageSize,(page+1)*pageSize).map(({product:p,missing})=>`<article class="record-card"><h2>${esc(p.sku)}</h2><p>${esc(p.name)}</p><p class="hint">${missing.map(m=>completionLabels[m]).join(' · ')}</p><div class="actions section-gap">${btn('Compléter la fiche','edit-product','edit','small',`data-id="${esc(p.id)}"`)}${btn('Voir la fiche','view-product','box','small',`data-id="${esc(p.id)}"`)}</div></article>`).join('')||'<section class="card"><p>Aucune référence à compléter pour ce filtre.</p></section>'}</div><div class="page-info"><span>Page ${page+1} / ${Math.max(1,Math.ceil(rows.length/pageSize))}</span><div class="actions">${btn('Précédent','catalogue-prev','arrowleft','small',page===0?'disabled':'')}${btn('Suivant','catalogue-next','arrowright','small',(page+1)*pageSize>=rows.length?'disabled':'')}</div></div>`;
}
export function enhanceWorkflow(root,route){
  if(['home','settings'].includes(route))void refreshBackup();
  if(route==='scan'&&state.scanTarget)root.insertAdjacentHTML('afterbegin',`<section class="card scan-return"><p>Scannez la référence à reporter dans votre manquant.</p>${btn('Revenir au manquant','return-to-pending','arrowleft','small section-gap')}</section>`);
}
export function installWorkflow(){
  const editing=e=>{const form=e.target.closest('#main form');if(form)form.dataset.editing='1';};document.addEventListener('input',editing);document.addEventListener('change',editing);
  window.addEventListener('ek-sync',()=>void refreshBackup());
  window.addEventListener('online',()=>void refreshBackup());
  window.addEventListener('offline',()=>void refreshBackup());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshBackup();});
  setInterval(()=>{if(!document.hidden&&document.querySelector('[data-backup-status]'))void refreshBackup();},30000);
}

// Keep in-progress main-page fields when a background sync refreshes the view.
export function formDrafts(root){
 return [...root.querySelectorAll('form[data-form],form[data-ops-form]')].filter(f=>f.dataset.editing==='1').map(f=>({kind:f.dataset.form?'form':'opsForm',name:f.dataset.form||f.dataset.opsForm,fields:[...f.elements].filter(el=>el.name&&el.type!=='file').map(el=>({name:el.name,value:el.value,checked:el.type==='checkbox'?el.checked:null}))}));
}
export function restoreFormDrafts(root,drafts){
 for(const draft of drafts){const form=[...root.querySelectorAll('form')].find(f=>f.dataset[draft.kind]===draft.name);if(!form)continue;for(const field of draft.fields){const input=[...form.elements].find(el=>el.name===field.name);if(input){if(field.checked!==null)input.checked=field.checked;else input.value=field.value;}}form.dataset.editing='1';}
}
