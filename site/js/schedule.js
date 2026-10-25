import * as Store from './storage.js';
import {readAlertAcks,writeAlertAcks} from './alert-acks.js';
import {DEFAULT_SCHEDULE,validateSchedule,scheduleEvents,dueReminders,zonedParts} from './schedule-core.js';
import {state,esc,icon,pageHeading,field,check,toast} from './ui.js';
const settingsKey=()=>`ek-work-schedule-${Store.isDemo()?'demo':'live'}`;
const ledgerKey=()=>settingsKey()+'-alerts';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
export function currentSchedule(){try{return validateSchedule(read(settingsKey(),DEFAULT_SCHEDULE));}catch{return structuredClone(DEFAULT_SCHEDULE);}}
function ledger(){const data=read(ledgerKey(),{});return {seen:data.seen||{},active:Array.isArray(data.active)?data.active:[]};}
function saveLedger(data){localStorage.setItem(ledgerKey(),JSON.stringify(data));}
let lastKeys='',testActive=false;
export function scheduleView(){
 const s=currentSchedule(),events=scheduleEvents(s),days=[[1,'Lundi'],[2,'Mardi'],[3,'Mercredi'],[4,'Jeudi'],[5,'Vendredi'],[6,'Samedi'],[0,'Dimanche']];
 return `${pageHeading('Horaires et alertes','Un rappel huit minutes avant chaque début et chaque fin.')}<section class="card"><div class="card-header"><h2>Mes six rappels</h2><span class="badge">Heure de Paris</span></div><div class="schedule-list">${events.map(e=>`<div class="schedule-row"><span><strong>${esc(e.label)}</strong><small>À ${e.time}</small></span><span class="reminder-time">${e.reminder}<small>Rappel</small></span></div>`).join('')}</div><div class="info-note section-gap"><strong>Version web : garder Pikéo ouverte et visible.</strong><p>Les alertes et la vibration répétée fonctionnent ici tant que le navigateur les autorise. Écran verrouillé ou application fermée, elles ne sont pas garanties. Le relais Android sera ajouté lors de la migration Godot.</p></div><p class="hint section-gap">L’alerte reste affichée jusqu’à « Arrêter l’alerte ». La vibration reprend à votre retour dans Pikéo si elle n’a pas été arrêtée.</p><div class="actions section-gap schedule-actions"><button class="btn primary full" data-schedule-action="permissions">${icon('clock')}Autoriser les notifications</button><button class="btn full" data-schedule-action="test">${icon('clock')}Tester une alerte et l’arrêt</button></div><p class="hint" id="schedule-permission"></p></section><section class="card section-gap"><h2>Mes horaires de travail</h2><form data-schedule-form><div class="form-grid section-gap"><div class="field full">${check('enabled','Activer les rappels sur ce téléphone',s.enabled)}</div><fieldset class="full schedule-days"><legend>Jours travaillés</legend>${days.map(([day,label])=>check('days',label,s.days.includes(day),`value="${day}"`)).join('')}</fieldset>${field('start','Prise de poste',s.start,{type:'time',required:true})}${field('end','Fin de journée',s.end,{type:'time',required:true})}${field('breakStart','Début de pause',s.breakStart,{type:'time',required:true})}${field('breakMinutes','Durée de la pause (min)',s.breakMinutes,{type:'number',required:true})}${field('lunchStart','Début du déjeuner',s.lunchStart,{type:'time',required:true})}${field('lunchMinutes','Durée du déjeuner (min)',s.lunchMinutes,{type:'number',required:true})}</div><p class="hint section-gap">Le préavis reste de 8 minutes. Lundi à vendredi par défaut ; modifiez les jours ici. Ces réglages restent propres à ce téléphone.</p><div class="error-message" data-schedule-error hidden role="alert"></div><div class="form-actions"><button class="btn primary" type="submit">Enregistrer mes horaires</button></div></form></section>`;
}
export function scheduleHome(){const s=currentSchedule();return `<section class="card section-gap home-schedule"><h2>Mes horaires</h2><p class="hint">${s.start} → ${s.end} · pause ${s.breakStart} · déjeuner ${s.lunchStart}</p><p class="hint">${s.enabled?'Rappels à −8 min lorsque Pikéo est ouverte.':'Rappels désactivés sur ce téléphone.'}</p><button class="btn full section-gap" data-nav="schedule">${icon('clock')}Horaires et alertes</button></section>`;}
function refreshPermission(){const el=document.querySelector('#schedule-permission');if(el)el.textContent=!('Notification' in window)?'Les notifications système ne sont pas disponibles ici. L’alerte dans Pikéo reste accessible.':Notification.permission==='granted'?'Notifications autorisées. Testez aussi la vibration sur votre téléphone.':Notification.permission==='denied'?'Notifications bloquées : autorisez-les dans les réglages du navigateur.':'Autorisation de notification à accorder avec le bouton ci-dessus.';}
export function mountSchedule(){refreshPermission();}
function showActive(){
 const rows=ledger().active,keys=rows.map(r=>r.key).join('|')+(testActive?':test':'');
 let panel=document.querySelector('#work-alert');
 if(!rows.length&&!testActive){panel?.remove();document.querySelectorAll('.work-alert-inline').forEach(el=>el.remove());if(lastKeys)navigator.vibrate?.(0);lastKeys='';return;}
 if(keys!==lastKeys||!panel){
  panel?.remove();panel=document.createElement('aside');panel.id='work-alert';panel.className='work-alert';panel.setAttribute('role','alert');panel.dataset.helpContext='schedule-alert';
  panel.innerHTML=`<strong>${testActive?'Test d’alerte':rows.map(r=>esc(r.label)+' à '+esc(r.time)).join('<br>')}</strong><p>${testActive?'La vibration se répète tant que Pikéo est visible.':'Rappel de votre horaire de travail.'}</p><div class="actions"><button class="btn primary" data-schedule-action="${testActive?'stop-test':'stop'}">Arrêter l’alerte</button><button class="btn" data-action="quickhelp" data-help-context="schedule-alert" aria-label="Aide pour cette alerte">?</button></div>`;document.body.append(panel);lastKeys=keys;
 }
 // Native dialogs make the page inert. Keep Stop reachable inside them without
 // replacing the form, closing its dialog, or losing its current input.
 for(const dialog of document.querySelectorAll('dialog[open]')){
  let inline=dialog.querySelector('.work-alert-inline');
  if(!inline){inline=document.createElement('div');inline.className='work-alert-inline';inline.setAttribute('role','status');dialog.append(inline);}
  if(inline.dataset.alertKeys!==keys){inline.dataset.alertKeys=keys;inline.innerHTML=`<strong>${testActive?'Test d’alerte':rows.map(r=>esc(r.label)+' à '+esc(r.time)).join(' · ')}</strong><button class="btn primary" data-schedule-action="${testActive?'stop-test':'stop'}">Arrêter l’alerte</button>`;}
 }
 if(!document.hidden)try{navigator.vibrate?.(1500);}catch{}
}
async function notify(rows){
 if(!('Notification' in window)||Notification.permission!=='granted'||Store.isDemo())return;
 try{
  const registration=await navigator.serviceWorker?.getRegistration();
  if(registration)await registration.showNotification('Pikéo · '+rows.map(r=>r.label).join(', '),{body:rows.map(r=>`${r.label} à ${r.time}`).join('\n')+' · Arrêter avec le bouton de la notification.',tag:'pikeo-work-alert',requireInteraction:true,vibrate:[1000,200,1000],data:{kind:'work-alert',keys:rows.map(r=>r.key)},actions:[{action:'stop-work-alert',title:'Arrêter l’alerte'}]});
 }catch{ /* The in-app alert remains usable if system notifications fail. */ }
}
export function tickSchedule(now=new Date()){
 if(Store.isDemo()){if(testActive)showActive();return;}
 const data=ledger(),due=dueReminders(currentSchedule(),now,data.seen);
 if(due.length){testActive=false;for(const row of due){data.seen[row.key]='issued';data.active.push(row);}const cutoff=new Date(now.getTime()-35*864e5).toISOString().slice(0,10);for(const key of Object.keys(data.seen))if(key.slice(0,10)<cutoff&&!data.active.some(a=>a.key===key))delete data.seen[key];saveLedger(data);void notify(data.active);}
 showActive();
}
export async function stopWorkAlerts(keys){
 const data=ledger();testActive=false;const selected=new Set(keys||data.active.map(r=>r.key));for(const key of selected)data.seen[key]='ack';data.active=data.active.filter(row=>!selected.has(row.key));saveLedger(data);showActive();
 try{const registration=await navigator.serviceWorker?.getRegistration();const notifications=await registration?.getNotifications({tag:'pikeo-work-alert'});for(const notification of notifications||[])notification.close();}catch{}
 if(!Store.isDemo())await writeAlertAcks([...selected]);
}
export function migrationReview(){return '';}
export async function installSchedule({render}){
 document.addEventListener('click',e=>{const b=e.target.closest('[data-schedule-action]');if(!b)return;e.preventDefault();const action=b.dataset.scheduleAction;
  void (async()=>{
   if(action==='stop'){await stopWorkAlerts();return;}
   if(action==='stop-test'){testActive=false;showActive();return;}
   if(action==='test'){if(ledger().active.length)throw Error('Un rappel est déjà en cours. Arrêtez-le avant de tester.');testActive=true;showActive();return;}
   if(action==='permissions'){if(!('Notification' in window)){refreshPermission();return;}if(Notification.permission==='default')await Notification.requestPermission();refreshPermission();if(Notification.permission==='granted')toast('Notifications autorisées. Testez la vibration ci-dessous.');return;}
   if(action.startsWith('godot-')){localStorage.setItem('ek-godot-review',JSON.stringify({status:action==='godot-review'?'review':'later',at:new Date().toISOString()}));render();toast(action==='godot-review'?'Demande de bilan final enregistrée. La migration reste à valider ensemble.':'Évolutions en cours : Godot reste prévu pour la fin.');}
  })().catch(error=>toast(error.message,true));
 });
 document.addEventListener('submit',e=>{const form=e.target.closest('[data-schedule-form]');if(!form)return;e.preventDefault();try{const data=new FormData(form),s=validateSchedule({...Object.fromEntries(data),enabled:data.has('enabled'),days:data.getAll('days')});localStorage.setItem(settingsKey(),JSON.stringify(s));if(!s.enabled)void stopWorkAlerts();render();toast('Horaires enregistrés sur ce téléphone.');tickSchedule();}catch(error){form.querySelector('[data-schedule-error]').textContent=error.message;form.querySelector('[data-schedule-error]').hidden=false;}});
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='STOP_WORK_ALERT')void stopWorkAlerts(e.data.keys);});
 window.addEventListener('storage',e=>{if(e.key===ledgerKey())showActive();});
 const reconcile=async()=>{try{const keys=await readAlertAcks();if(!Store.isDemo()&&keys.length){const data=ledger(),selected=new Set(keys);for(const key of selected)data.seen[key]='ack';data.active=data.active.filter(row=>!selected.has(row.key));saveLedger(data);}}catch{}tickSchedule();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)navigator.vibrate?.(0);else void reconcile();});
 await reconcile();setInterval(()=>tickSchedule(),1000);
}
