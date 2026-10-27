import {dayAttention} from './workflow-core.js';
import * as Store from './storage.js';
import {products} from './model.js';
import {catalogueProposal,lineProduct,productIndex} from './day-catalogue-core.js';
import * as Identity from './identity-context.js';
import {DocumentCamera} from './document-camera.js';
import {cameraErrorMessage} from './camera.js';
import {parseDayPage,buildDayPlan,dayRecord,sheetLocation,sheetQuantity,restartDayPlan,findDayDuplicates,distinctPageProof} from './day-core.js';
import {needsOrderRetry,assessOrderText,ORDER_READER_VERSION} from './order-ocr-core.js';
import {recognizePhoto} from './features.js';
import {editDocumentPhoto} from './photo-tools.js';
import {showPhotoViewer} from './photo-viewer.js';
import {state,esc,field,check,modal,closeModal,toast,formError,dateLabel,fmt,onModalClose} from './ui.js';
import {uid,localDate,refKey,orderKey} from './core.js';

let app,session,busy=false,namespace,queue=Promise.resolve(),revision=0,planStamp,capture,restartPreview,datePreview,progressText='',duplicatesOpen=false,activeOperation=Promise.resolve(),analysisController,switching=false,otherDrafts=[];
const button=(label,action,attrs='')=>`<button type="button" class="btn ${['analyse','reanalyse','camera','snapshot'].includes(action)?'primary':''} ${['camera','reanalyse'].includes(action)?'full':''}" data-day-action="${action}" ${attrs}>${label}</button>`;
const persist=()=>{const value=structuredClone(session),space=namespace;queue=queue.catch(()=>{}).then(()=>{if(space!==Store.scope())throw Error('L’espace de travail a changé.');return Store.setMeta('day-capture',value);});return queue;};
const sameSpace=()=>namespace===Store.scope();
function setBusy(value){busy=value;syncBusy();}
function syncBusy(){for(const el of document.querySelectorAll('#dialog [data-day-action],#main [data-day-action],#dialog [data-day-files],#dialog [data-day-form] input,#dialog [data-day-form] textarea,#dialog [data-day-form] [type=submit],#batch-date,#dialog [data-day-choice]')){
  const allowed=['background','camera-stop','resume'].includes(el.dataset.dayAction)||analysisController&&(['pause-analysis','today','switch-day'].includes(el.dataset.dayAction)||el.id==='batch-date');
  el.disabled=!!((busy&&!allowed)||el.dataset.idleDisabled==='1');
  if(el.dataset.dayAction==='pause-analysis')el.hidden=!analysisController;
}}
function setProgress(text){progressText=text;for(const el of document.querySelectorAll('#batch-progress,[data-day-running]'))el.textContent=text;}
function stopCapture(){capture?.stop();capture=null;document.querySelector('[data-day-camera]')?.replaceChildren();const start=document.querySelector('[data-day-action=camera]');if(start)start.hidden=false;}
export async function flush(){stopCapture();analysisController?.abort();await activeOperation.catch(()=>{});await queue.catch(()=>{});}
async function openCapture(){
  stopCapture();guard();const host=document.querySelector('[data-day-camera]');if(!host)return;
  host.innerHTML='<video autoplay playsinline muted aria-label="Cadrage de la feuille"></video><p class="hint">Cadrez une feuille entière et nette. Photographiez, puis passez à la suivante.</p><div class="document-camera-actions">'+button('Photographier cette page','snapshot')+button('Terminer les photos','camera-stop')+'</div>';
  const camera=new DocumentCamera({recall:()=>localStorage.getItem('ek-document-camera-'+namespace)||'',remember:id=>localStorage.setItem('ek-document-camera-'+namespace,id)});capture=camera;
  try{if(!await camera.open(host.querySelector('video')))return;if(capture!==camera||!sameSpace()){camera.stop();return;}document.querySelector('[data-day-action=camera]').hidden=true;host.scrollIntoView({block:'nearest'});}
  catch(error){stopCapture();throw Error(cameraErrorMessage(error)+' La galerie et l’appareil photo de secours restent disponibles.');}
}

function guard(){if(!sameSpace())throw Error('L’espace de travail a changé. Rouvrez la session de photos.');}
async function prepareRestart(date){
  await queue.catch(()=>{});namespace=Store.scope();const draft=await Store.meta('day-capture'),backlog=await Store.meta('day-capture-backlog');guard();
  const p=restartDayPlan(date,Store.list('orders'),Store.list('days'),draft,backlog);
  if(!p.items.length&&!p.photos)throw Error('Aucune commande, correction ou photo pour cette journée.');
  restartPreview={date,signature:p.signature,space:namespace,photoSession:!!document.querySelector('#dialog[open] #batch-date')};
  modal('Supprimer la journée du '+dateLabel(date)+' ?',`<span hidden data-help-context="day-restart"></span><p><strong>${p.commands==null?'Commandes non renseignées':p.commands+' commande(s)'} · ${fmt(p.total)} picking(s) · ${p.photos} photo(s) en cours${p.corrections?' · total corrigé manuellement':''}</strong></p><p>Les commandes, la correction du bilan et la session de photos de cette date seront retirées. Vous pourrez recréer la journée depuis le début en saisissant les chiffres reçus.</p><p>Le catalogue, les emplacements, les autres journées et les mémos sont conservés. Les anciennes valeurs restent dans l’historique ; les fichiers photo ne sont pas supprimés.</p>${p.otherDraft?'<p class="info-note">Les photos de l’autre journée restent dans Journées à reprendre. Vous pourrez les compléter plus tard.</p>':''}<form data-day-form="restart">${check('confirmed','Je confirme la suppression de cette journée pour la recréer depuis le début.',false,'required')}<p class="hint">Le bouton Annuler permet de rétablir l’ancien bilan. Si de nouvelles photos ont été prises entre-temps, elles sont conservées.</p><div data-form-error class="error-message" hidden></div><div class="form-actions"><button type="button" class="btn" data-action="close-dialog">Conserver cette journée</button><button type="submit" class="btn danger">Supprimer et recommencer</button></div></form>`,true);syncBusy();
}
async function prepareDateChange(date){
  const photoSession=!!document.querySelector('#dialog[open] #batch-date');
  await queue.catch(()=>{});namespace=Store.scope();
  const p=restartDayPlan(date,Store.list('orders'),Store.list('days'),await Store.meta('day-capture'),await Store.meta('day-capture-backlog'));guard();
  if(!p.items.length&&!p.photos)throw Error('Aucune commande, correction ou photo pour cette journée.');
  datePreview={date,signature:p.signature,space:namespace,photoSession};
  modal('Modifier la date de la journée',`<span hidden data-help-context="day-date"></span><p>Journée du <strong>${dateLabel(date)}</strong> : ${p.commands==null?'Commandes non renseignées':p.commands+' commande(s)'}, ${p.photos} photo(s) en cours${p.corrections?' et un total corrigé':''}.</p><p>Les commandes, les photos et leurs corrections seront déplacées ensemble. Une date déjà occupée ne sera pas écrasée.</p><form data-day-form="date">${field('newDate','Nouvelle date',date,{type:'date',id:'day-new-date',required:true})}<p class="hint">La date change uniquement après Sauvegarder la date.</p><div data-form-error class="error-message" hidden></div><div class="form-actions">${photoSession?button('Conserver la date','resume'):'<button type="button" class="btn" data-action="close-dialog">Conserver la date</button>'}<button type="submit" class="btn primary">Sauvegarder la date</button></div></form>`,true);syncBusy();
}
async function saveDate(form,data){
  if(!datePreview)throw Error('Rouvrez la modification de date.');
  const preview=datePreview,newDate=String(data.get('newDate')||'');
  await Store.moveDay(preview.date,newDate,preview.signature,preview.space);guard();
  session=await Store.meta('day-capture');if(preview.photoSession&&session?.date!==newDate)session=await Store.switchDayDraft(newDate,preview.space);
  otherDrafts=await Store.dayDrafts();datePreview=null;progressText='';duplicatesOpen=false;
  state.date=newDate;app.navigate('orders');if(preview.photoSession)showSession();
  toast('Date sauvegardée. Photos, corrections et commandes conservées.');
}
async function confirmRestart(form){
  if(!restartPreview||!form.elements.confirmed.checked)throw Error('Confirmez la journée à recommencer.');
  const preview=restartPreview;
  session=await Store.restartDay(preview.date,preview.signature,preview.space);namespace=preview.space;progressText='';restartPreview=null;
  otherDrafts=await Store.dayDrafts();
  state.date=preview.date;app.navigate('orders');if(preview.photoSession)showSession();toast('Journée supprimée. Vous pouvez renseigner de nouveaux chiffres.');
}
const plan=()=>{const index=productIndex(products());return buildDayPlan(session.pages,Store.list('orders'),session.date,(sku,line)=>lineProduct(line||{sku},index));};
function proposedCatalogue(p){
  const groups=p.orders.filter(g=>choice(g)!=='skip'&&g.mode!=='skip').map(g=>({...g,lines:choice(g)==='append'?g.appendLines||[]:g.lines}));
  return catalogueProposal(groups,products(),{reservedIds:Store.list('products',{includeDeleted:true}).map(p=>p.id)});
}
const mayUpdateCatalogue=()=>Store.isDemo()||Identity.canConfigure();
function catalogueSummary(catalogue){
  if(!mayUpdateCatalogue())return '<p class="info-note">Les informations des articles restent dans vos commandes. Un administrateur peut compléter le catalogue.</p>';
  return '<section class="info-note"><strong>Catalogue : '+catalogue.created+' référence(s) à créer, '+catalogue.updated+' fiche(s) à compléter.</strong><p>Les adresses déjà connues sont conservées. Les quantités par picking ne sont pas déduites des feuilles.</p>'+check('updateCatalogue','Ajouter les références, désignations, codes alpha et nouvelles adresses relus au catalogue.',true,'form="day-batch-save"')+catalogue.problems.map(x=>'<p class="error-message">'+esc(x)+'</p>').join('')+'</section>';
}

const choice=g=>session.choices[g.number]||(g.mode==='new'?'new':'skip');

export async function openDay(){
  if(busy){guard();showSession();return;}
  await queue.catch(()=>{});namespace=Store.scope();progressText='';session=await Store.meta('day-capture')||{date:state.date||localDate(),pages:[],choices:{}};
  otherDrafts=await Store.dayDrafts();session.choices||={};guard();let refreshed=false;for(const page of session.pages)if(!page.reviewed&&!page.error&&page.text&&page.parseVersion!==ORDER_READER_VERSION){page.sections=parseDayPage(page.text);page.parseVersion=ORDER_READER_VERSION;refreshed=true;}if(refreshed)await persist();showSession();
}
async function changeDay(date){
  if(switching||busy&&!analysisController)return;
  switching=true;
  try{
    stopCapture();if(analysisController){analysisController.abort();await activeOperation.catch(()=>{});}
    setBusy(true);await queue.catch(()=>{});namespace=Store.scope();
    session=await Store.switchDayDraft(date,namespace);guard();session.choices||={};otherDrafts=await Store.dayDrafts();
    progressText='';duplicatesOpen=false;showSession();
  }finally{switching=false;setBusy(false);}
}
function dayPicker(){
  const waiting=otherDrafts.filter(d=>d.date!==session.date);
  return `<section class="info-note section-gap" data-help-context="day-drafts"><p>Chaque journée est indépendante. Gardez vos photos maintenant, analysez et validez plus tard.</p>${session.date!==localDate()?button('Photographier aujourd’hui','today'):''}${waiting.length?`<details class="section-gap"><summary>Journées à reprendre (${waiting.length})</summary><div class="actions section-gap">${waiting.map(d=>button(dateLabel(d.date)+' · '+d.pages.length+' photo(s)','switch-day',`data-date="${esc(d.date)}"`)).join('')}</div></details>`:''}</section>`;
}
function showSession(){
  modal('Enregistrer ma journée',`<span hidden data-help-context="day-drafts"></span><p class="dialog-intro">Photographiez toutes les feuilles à la suite. Les numéros de commande et d’enregistrement désignent la même commande ; ils servent à regrouper ses pages.</p>${field('dayDate','Ouvrir la journée du',session.date,{type:'date',id:'batch-date'})}<div class="actions section-gap">${button('Modifier la date','change-date',`data-date="${esc(session.date)}"`)}${button('Supprimer cette journée','restart',`data-date="${esc(session.date)}"`)}</div>${dayPicker()}<div id="batch-retry"></div><section class="day-upload">${button('Photographier les pages à la suite','camera')}<section data-day-camera class="document-camera"></section><details class="section-gap"><summary>Appareil photo du téléphone — secours</summary><label class="btn full" for="batch-camera">Photographier une page</label><input class="sr-only" id="batch-camera" type="file" accept="image/*" capture="environment" data-day-files></details><label class="btn full section-gap" for="batch-gallery">Ajouter des photos de la galerie</label><input class="sr-only" id="batch-gallery" type="file" accept="image/*" multiple data-day-files><p class="hint">100 photos maximum par session, 25 Mo par photo et 150 Mo au total. Vous pouvez fermer puis reprendre cette session.</p></section><p id="batch-progress" role="status" aria-live="polite">${esc(progressText)}</p><div class="section-gap">${button('Vérifier les doublons','duplicates')}</div><div id="batch-duplicates"></div><div id="batch-pages"></div><div class="actions section-gap">${button('Terminer les photos et analyser','analyse')}${button('Mettre l’analyse en pause','pause-analysis','hidden')}${button('Effacer cette session','discard')}${button('Continuer dans Ma journée','background')}</div><div id="batch-summary"></div>`,true);
  onModalClose(stopCapture);draw();
}
function draw(){
  const el=document.querySelector('#batch-pages');if(!el||!session)return;
  const failed=session.pages.filter(p=>(p.text||p.error)&&needsOrderRetry(p)),readable=session.pages.filter(p=>needsOrderRetry(p,{force:true})),retry=document.querySelector('#batch-retry');
  if(retry)retry.innerHTML=session.pages.length?'<section class="info-note section-gap"><strong>'+session.pages.length+' photo(s) déjà conservée(s)</strong><p>'+readable.length+' photo(s) à analyser de nouveau, y compris celles déjà reconnues. Les pages validées ou écartées restent conservées sans modification. Aucun besoin de reprendre les photos.</p>'+button('Relancer l’analyse des photos','reanalyse',readable.length?'':'disabled data-idle-disabled="1"')+(failed.length?'<p>'+failed.length+' page(s) non reconnue(s) ou incomplète(s).</p>'+button('Relire les pages non reconnues','retry'):'')+'</section>':'';
  el.innerHTML=`<h3 class="modal-subheading">${session.pages.length} photo(s) conservée(s)</h3>${session.pages.map((p,i)=>`<article class="day-page ${p.excluded?'excluded':''}"><div><strong>Page photographiée ${i+1}</strong><small>${esc(p.excluded?'Écartée':p.error?'Lecture à reprendre':p.sections?.length?p.sections.map(s=>s.number?'Commande '+s.number+(s.identityConflict?' — numéros à comparer':s.unreadRows?.length?' — '+s.unreadRows.length+' ligne(s) à compléter':!s.lines?.length?' — lignes à relire':s.lines.some(l=>l.quantity===null)?' — quantités à relire':''):'Numéro de commande/enregistrement non lu').join(' · '):'Prête à analyser')}</small></div><div class="actions">${p.text||p.error?button('Vérifier','edit',`data-id="${esc(p.id)}"`):''}${button(p.excluded?'Réintégrer':'Écarter',p.excluded?'include':'exclude',`data-id="${esc(p.id)}"`)}${needsOrderRetry(p,{force:true})&&(p.text||p.error)?button('Relire cette page','retry-page',`data-id="${esc(p.id)}"`):''}${button('Voir la photo','preview',`data-id="${esc(p.id)}"`)}${button('Recadrer','crop',`data-id="${esc(p.id)}"`)}</div></article>`).join('')}`;
  if(duplicatesOpen)drawDuplicates();if(session.pages.some(p=>p.text||p.error))drawSummary();syncBusy();
}
function drawDuplicates(){
  const host=document.querySelector('#batch-duplicates');if(!host)return;
  const result=findDayDuplicates(session.pages),number=id=>session.pages.findIndex(p=>p.id===id)+1;
  host.innerHTML=`<section class="info-note section-gap" data-help-context="day-duplicates"><h3>Contrôle des doublons</h3><p>${result.checked} photo(s) non écartée(s) contrôlée(s) · ${result.pairs.filter(p=>!p.distinct).length} rapprochement(s) signalé(s).</p><p class="hint">Les doublons certains restent ignorés dans le calcul. Comparez les autres avant de les écarter ou de confirmer deux pages différentes. Aucun fichier n’est supprimé.</p>${result.unread?'<p class="error-message">'+result.unread+' photo(s) ont une lecture incomplète : leur comparaison reste limitée. Relancez leur analyse.</p>':''}${!result.pairs.length?'<p>Aucun doublon repéré avec les informations actuellement lues. Une page non reconnue peut encore masquer un doublon.</p>':''}${result.pairs.map(pair=>`<article class="day-duplicate-pair"><strong>Photos ${number(pair.firstId)} et ${number(pair.secondId)}</strong><p>${esc(pair.reason)}.</p><p>${pair.automatic?'Doublon ignoré dans le calcul.':pair.distinct?'Deux pages différentes confirmées.':'Doublon possible : comparez les photos avant validation.'}</p><div class="actions">${button('Voir photo '+number(pair.firstId),'preview',`data-id="${esc(pair.firstId)}"`)}${button('Voir photo '+number(pair.secondId),'preview',`data-id="${esc(pair.secondId)}"`)}${button('Écarter photo '+number(pair.firstId),'exclude',`data-id="${esc(pair.firstId)}"`)}${button('Écarter photo '+number(pair.secondId),'exclude',`data-id="${esc(pair.secondId)}"`)}${!pair.automatic&&!pair.distinct?button('Ce sont deux pages différentes','distinct',`data-id="${esc(pair.secondId)}" data-other="${esc(pair.firstId)}"`):''}</div></article>`).join('')}</section>`;
}
async function previewPage(id){
  guard();const p=session.pages.find(p=>p.id===id);if(!p)throw Error('Page introuvable.');
  const file=await Store.readFile(p.photoId);guard();if(!file)throw Error('Photo indisponible sur cet appareil.');
  onModalClose(showPhotoViewer(file.blob,{title:'Page photographiée '+(session.pages.indexOf(p)+1)}));
}
function confirmDistinct(id,other){
  guard();const pair=findDayDuplicates(session.pages).pairs.find(p=>p.secondId===id&&p.firstId===other&&!p.automatic&&!p.distinct);if(!pair)throw Error('Le contrôle a changé. Vérifiez à nouveau les photos.');
  modal('Deux pages différentes ?',`<span hidden data-help-context="day-duplicates"></span><p>${esc(pair.reason)}. Comparez les deux feuilles avant de conserver les deux dans le calcul.</p><div class="actions">${button('Voir la première photo','preview',`data-id="${esc(other)}"`)}${button('Voir la seconde photo','preview',`data-id="${esc(id)}"`)}</div><form data-day-form="distinct" data-id="${esc(id)}" data-other="${esc(other)}">${check('confirmed','J’ai comparé les photos : ce sont bien deux pages différentes à compter.',false,'required')}<div data-form-error class="error-message" hidden></div><div class="form-actions">${button('Retour aux photos','resume')}<button type="submit" class="btn primary">Conserver les deux pages</button></div></form>`,true);
}
async function saveDistinct(form,data){
  guard();if(!data.get('confirmed'))throw Error('Comparez les photos avant de confirmer.');
  const page=session.pages.find(p=>p.id===form.dataset.id),other=session.pages.find(p=>p.id===form.dataset.other),pair=findDayDuplicates(session.pages).pairs.find(p=>p.secondId===page?.id&&p.firstId===other?.id&&!p.automatic);
  if(!pair)throw Error('Ces photos ne sont plus à comparer.');
  page.distinctPages=[...(page.distinctPages||[]).filter(p=>p.id!==other.id),distinctPageProof(page,other)];await persist();duplicatesOpen=true;showSession();
}
function drawSummary(){
  const el=document.querySelector('#batch-summary');if(!el)return;const p=plan(),catalogue=proposedCatalogue(p);
  planStamp=signature(p);
  const selected=p.orders.filter(g=>choice(g)!=='skip'),count=selected.length;
  let total=0,unknown=0;for(const g of selected){try{const r=dayRecord(g,session.date,choice(g));total+=r.total;unknown+=r.unknownLines;}catch{}}
  el.innerHTML=`<section class="card section-gap"><h3>Bilan proposé</h3><p><strong>${count} commande(s) à enregistrer · ${fmt(total)} picking(s)${unknown?' minimum estimé':''}</strong></p><p class="hint">${p.duplicatePages} page(s) en double ignorée(s). ${p.orders.filter(g=>choice(g)==='skip').length} commande(s) écartée(s) ou déjà enregistrée(s).</p>${p.problems.map(e=>`<p class="error-message">${esc(e.message)} ${e.id?button('Vérifier la page','edit',`data-id="${esc(e.id)}"`):''}</p>`).join('')}${renderOrderGroups(p.orders,g=>`<article class="day-order ${dayAttention(g,choice(g)).length?'has-anomaly':''}"><strong>Commande ${esc(g.number)}</strong><p>${g.sources.length} page(s) · ${g.lines.length} ligne(s) · ${fmt(g.estimate.total)} prise(s)${g.estimate.unknown?' minimum, conditionnement manquant':''}</p>${g.reviewPages.length?`<p class="overdue-label">${g.reviewPages.length} page(s) à vérifier</p>${g.reviewPages.map(id=>button('Vérifier','edit',`data-id="${esc(id)}"`)).join('')}`:''}${g.incomplete&&!(choice(g)==='append'&&g.appendIncomplete===false)?'<p class="error-message">Il manque une ou plusieurs pages annoncées sur cette commande. Ajoutez-les ou écartez cette commande.</p>':''}${g.mode==='other-day'?'<p class="info-note">Ce numéro existe sur une autre journée. Il reste écarté pour éviter un double comptage.</p>':''}<label>Traitement<select data-day-choice="${esc(g.number)}"><option value="skip" ${choice(g)==='skip'?'selected':''}>Ne pas compter cette commande</option>${g.mode==='new'?`<option value="new" ${choice(g)==='new'?'selected':''}>Enregistrer cette commande</option>`:''}${g.mode==='exists'?`<option value="replace" ${choice(g)==='replace'?'selected':''}>Remplacer la lecture déjà enregistrée ce jour</option>${g.appendLines?`<option value="append" ${choice(g)==='append'?'selected':''}>Ajouter seulement les nouvelles pages</option>`:''}`:''}</select></label></article>`)}${unknown?'<p class="info-note">Certaines lignes n’ont pas de règle de picking. Leur total reste une estimation minimale. Complétez les règles de famille ou de produit pour fiabiliser le calcul.</p>':''}${catalogueSummary(catalogue)}<form id="day-batch-save" data-day-form="save"><p class="hint">Le bilan est calculé à partir des feuilles. Confirmez uniquement les commandes réellement terminées. Les anciennes journées conservent leurs règles.</p>${check('confirmed','Je confirme les commandes terminées, les quantités relues et les estimations signalées.',false,'required')}<div data-form-error class="error-message" hidden></div><button type="submit" class="btn primary full section-gap" data-idle-disabled="${!count?'1':'0'}" ${!count?'disabled':''}>Enregistrer toutes les commandes retenues</button></form></section>`;
}
function renderOrderGroups(groups,render){
 const attention=groups.filter(g=>dayAttention(g,choice(g)).length),clear=groups.filter(g=>!dayAttention(g,choice(g)).length);
 return `<section class="day-focus card section-gap"><h3>À vérifier en priorité</h3><p>${attention.length} commande(s) signalée(s), ${new Set(attention.flatMap(g=>g.reviewPages)).size} page(s) à relire.</p><p class="hint">Les pages manquantes, règles absentes et commandes déjà enregistrées sont détaillées ci-dessous.</p></section>${attention.map(render).join('')}${clear.length?`<details class="day-clear-orders"><summary>${clear.length} commande(s) sans anomalie de lecture signalée — voir le détail</summary>${clear.map(render).join('')}</details>`:''}`;
}
async function addFiles(files){
  for(const file of files){
    guard();if(!file.type.startsWith('image/'))throw Error('Choisissez des photos de feuilles.');
    if(file.size>25e6||session.pages.length>=100||session.pages.reduce((s,p)=>s+(p.size||0),0)+file.size>150e6)throw Error('Limite atteinte : 100 photos, 25 Mo par photo, 150 Mo par session. Analysez et enregistrez les photos déjà conservées.');
    setProgress('Conservation de la photo…');
    const bytes=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');guard();
    if(session.pages.some(p=>p.hash===hash)){toast('Cette photo est déjà dans la session. Elle n’a pas été ajoutée deux fois.');continue;}
    const photoId=await Store.storeFile(new Blob([bytes],{type:file.type}),file.name||'feuille.jpg','day-photo');guard();
    await Store.save('documents',{id:photoId,name:file.name||'feuille.jpg',kind:'day-photo',dayDate:session.date,createdAt:new Date().toISOString(),sourceHash:hash},'Photo de journée conservée',{undoable:false});
    session.pages.push({id:uid(),photoId,hash,size:file.size,text:'',sections:null,reviewed:false,excluded:false});await persist();draw();
  }
  setProgress('Photos conservées. Ajoutez la suivante ou lancez l’analyse.');
}
async function analyse(onlyId,{force=false}={}){
  stopCapture();if(!session.pages.some(p=>!p.excluded))throw Error('Ajoutez au moins une photo.');
  const controller=new AbortController();analysisController=controller;syncBusy();
  let read=0,failed=0,paused=false;
  try{
  for(let i=0;i<session.pages.length;i++){
    if(controller.signal.aborted){paused=true;break;}
    const page=session.pages[i];if(onlyId&&page.id!==onlyId||!needsOrderRetry(page,{force}))continue;
    guard();
    try{
      const f=await Store.readFile(page.photoId);if(!f)throw Error('Photo indisponible sur cet appareil. Ajoutez-la de nouveau.');
      setProgress(`Photo ${i+1}/${session.pages.length} — lecture en cours…`);const text=await recognizePhoto(f.blob,message=>{if(!controller.signal.aborted)setProgress(`Photo ${i+1}/${session.pages.length} — ${message}`);},{table:true,order:true,signal:controller.signal});guard();controller.signal.throwIfAborted();
      if(!page.text||assessOrderText(text).score>=assessOrderText(page.text).score){page.text=text;page.sections=parseDayPage(text);page.reviewed=false;}page.error=null;page.parseVersion=ORDER_READER_VERSION;
    }catch(e){if(controller.signal.aborted){paused=true;break;}guard();page.error=e.message||'Lecture impossible.';failed++;}
    read++;
    await persist();draw();
  }
  setProgress(paused?'Analyse mise en pause. Les photos et les lectures terminées sont conservées ; vous pouvez reprendre plus tard.':read?'Analyse terminée : '+read+' photo(s) relue(s), '+failed+' échec(s). Vérifiez les anomalies signalées, puis validez la journée.':'Aucune photo à relire. Les pages déjà validées ou écartées sont conservées.');draw();
  }finally{if(analysisController===controller)analysisController=null;syncBusy();}
}
async function editPage(id){
  const p=session.pages.find(p=>p.id===id);if(!p)throw Error('Page introuvable.');
  const sections=p.sections?.length?p.sections:[{number:'',lines:[]}];
  const file=await Store.readFile(p.photoId),url=file?URL.createObjectURL(file.blob):null;
  modal('Vérifier la page',`<span hidden data-help-context="day-page"></span>${url?`<button type="button" class="day-photo-preview" data-day-action="preview" data-id="${esc(id)}" aria-label="Agrandir la photo en plein écran"><img class="day-photo" src="${url}" alt="Feuille à vérifier"><span>Touchez pour agrandir et zoomer</span></button>`:''}<p class="info-note">Les traits de marqueur servent de repères et ne changent pas le calcul. Comptez aussi les quantités barrées ou manquantes entourées si elles restent lisibles. Une ligne : référence ; quantité ; emplacement ; désignation ; code alpha (les trois derniers champs sont facultatifs). Gardez les zéros initiaux.</p><form data-day-form="page" data-id="${esc(id)}">${sections.map((s,i)=>`<fieldset data-day-section="${i}"><legend>Commande ${i+1}</legend>${s.identities?.length?'<p class="hint">Numéros lus : '+s.identities.map(a=>esc((a.kind==='registration'?'Enregistrement : ':'Commande : ')+a.value)).join(' · ')+'</p>':''}${s.unreadRows?.length?'<p class="error-message">'+s.unreadRows.length+' ligne(s) n’ont pas pu être reconnues complètement. Complétez-les dans la liste avant de valider.</p><pre class="day-raw">'+esc(s.unreadRows.join('\n'))+'</pre>':''}${s.identityConflict?'<p class="error-message">Les deux numéros lus ne correspondent pas. Vérifiez le numéro de la commande sur la feuille.</p>':''}${field('number'+i,'Numéro de commande ou d’enregistrement',s.number,{required:true,code:true})}${field('lines'+i,'Références et quantités préparées',s.lines.map(l=>[l.sku,l.quantity??l.rawQuantity??'',l.location||l.rawLocation||'',l.designation||'',l.alphaCode||''].join(';')).join('\n'),{textarea:true,rows:6,full:true})}</fieldset>`).join('')}${check('reviewed','J’ai vérifié les numéros, les références et les quantités de cette page.',p.reviewed,'required')}${check('allowDuplicate','Je confirme que cette photo représente une autre page malgré un texte identique.',p.allowDuplicate)}<details><summary>Texte brut lu sur la photo</summary><pre class="day-raw">${esc(p.text||p.error||'Lecture non effectuée')}</pre></details><div data-form-error class="error-message" hidden></div><div class="form-actions">${button('Retour aux photos','resume')}<button type="submit" class="btn primary">Valider cette page</button></div></form>`,true);
  if(url)onModalClose(()=>URL.revokeObjectURL(url));
}
async function savePage(form,d=new FormData(form)){
  const p=session.pages.find(p=>p.id===form.dataset.id);if(!p)throw Error('Page introuvable.');
  const next=[];
  for(const el of form.querySelectorAll('[data-day-section]')){
    const i=Number(el.dataset.daySection),number=refKey(d.get('number'+i)),text=String(d.get('lines'+i)||''),rows=text.split(/\r?\n/).filter(s=>s.trim()).map((s,j)=>{const cells=s.split(';').map(s=>s.trim()),quantity=sheetQuantity(cells[1]),location=sheetLocation(cells[2]);
      if(cells.length<2||cells.length>5||!cells[0]||quantity===null||quantity<1)throw Error('Ligne '+(j+1)+' : utilisez référence;quantité (entier positif), puis éventuellement ;emplacement;désignation;code alpha.');
      if(cells[2]&&!location)throw Error('Ligne '+(j+1)+' : vérifiez l’adresse avec son préfixe PAC, PAD ou RES.');
      return {sku:refKey(cells[0]),quantity,location,designation:cells[3]||'',alphaCode:cells[4]||'',quantitySource:'prepared',needsReview:false};});
    if(!number||!rows.length)throw Error('Renseignez le numéro de commande et au moins une ligne. Écartez une photo inutile depuis la session.');
    next.push({...p.sections?.[i],number,lines:rows,text:p.sections?.[i]?.text||p.text,quantitySource:'prepared',needsReview:false});
  }
  p.sections=next;p.reviewed=!!d.get('reviewed');p.allowDuplicate=!!d.get('allowDuplicate');p.error=null;await persist();showSession();
}
async function saveDay(form){
  guard();const duplicates=findDayDuplicates(session.pages);if(duplicates.pairs.some(p=>!p.automatic&&!p.distinct)){duplicatesOpen=true;drawDuplicates();document.querySelector('#batch-duplicates')?.scrollIntoView({block:'start'});throw Error('Vérifiez les doublons possibles avant d’enregistrer la journée.');}const p=plan();
  if(signature(p)!==planStamp){drawSummary();throw Error('Le catalogue ou une commande a changé. Relisez le bilan actualisé puis confirmez-le de nouveau.');}
  if(session.pages.some(p=>!p.excluded&&!p.sections))throw Error('Analysez toutes les photos avant de valider.');
  if(p.problems.length)throw Error(p.problems[0].message);
  const items=[];
  for(const g of p.orders){
    const mode=choice(g);if(mode==='skip'||g.mode==='skip')continue;
    if(g.reviewPages.length)throw Error('Vérifiez les pages signalées de la commande '+g.number+'.');
    if(g.incomplete&&!(mode==='append'&&g.appendIncomplete===false))throw Error('Pages manquantes pour '+g.number+'. Ajoutez-les ou écartez cette commande.');
    if(g.existing){if(Store.get('orders',g.existing.id)?._eventId!==g.existingRevision)throw Error('Une commande a changé. Relisez le bilan avant de valider.');}
    else if(Store.list('orders').some(o=>orderKey(o.number)===orderKey(g.number)))throw Error('La commande '+g.number+' vient d’être enregistrée. Relisez le bilan.');
    const record=dayRecord(g,session.date,mode);if(record)items.push({type:'orders',record});
  }
  if(!items.length)throw Error('Toutes ces commandes sont déjà enregistrées ou écartées.');
  if(!form.elements.confirmed.checked)throw Error('Confirmez le bilan avant l’enregistrement.');
  const commandCount=items.length,catalogue=proposedCatalogue(p);
  if(form.elements.updateCatalogue?.checked){
    if(!mayUpdateCatalogue())throw Error('La mise à jour du catalogue est réservée aux administrateurs.');
    if(catalogue.problems.length)throw Error(catalogue.problems[0]);items.push(...catalogue.items);
  }
  await Store.saveBatch(items,'Journée du '+session.date+' : '+commandCount+' commande(s)',{expectedScope:namespace});
  const savedDate=session.date;state.date=savedDate;session=null;await persist();closeModal();app.navigate('orders');toast('Journée enregistrée : '+commandCount+' commande(s). Le bilan est disponible.');window.dispatchEvent(new CustomEvent('pikeo-day-saved',{detail:{date:savedDate}}));
}
async function cropPage(id){
  const p=session.pages.find(p=>p.id===id),f=await Store.readFile(p.photoId);if(!f)throw Error('Photo indisponible.');
  const file=new File([f.blob],f.name,{type:f.blob.type}),out=await editDocumentPhoto(file);guard();
  if(out&&out!==file){const photoId=await Store.storeFile(out,out.name,'day-photo');await Store.save('documents',{id:photoId,name:out.name,kind:'day-photo',dayDate:session.date,createdAt:new Date().toISOString(),sourceHash:p.hash},'Photo redressée');p.photoId=photoId;p.text='';p.sections=null;p.reviewed=false;p.error=null;await persist();}
  showSession();
}
async function act(b){
  const name=b.dataset.dayAction,id=b.dataset.id;
  if(name==='restart')return prepareRestart(b.dataset.date);
  if(name==='change-date')return prepareDateChange(b.dataset.date);
  if(name==='resume')return openDay();
  if(name==='camera')return openCapture();
  if(name==='camera-stop'){stopCapture();return;}
  if(name==='snapshot'){if(!capture)throw Error('Ouvrez la caméra.');const file=await capture.capture();guard();return addFiles([file]);}
  if(name==='analyse'||name==='retry')return analyse();
  if(name==='reanalyse')return analyse(undefined,{force:true});
  if(name==='retry-page')return analyse(id,{force:true});
  if(name==='duplicates'){guard();duplicatesOpen=true;drawDuplicates();document.querySelector('#batch-duplicates')?.scrollIntoView({block:'start'});return;}
  if(name==='preview')return previewPage(id);
  if(name==='distinct')return confirmDistinct(id,b.dataset.other);
  if(name==='edit')return editPage(id);
  if(name==='crop')return cropPage(id);
  if(name==='discard'){
    if(session.pages.length){modal('Effacer les photos de cette session ?',`<p>Les commandes déjà enregistrées sont conservées. Cette session de photos sera abandonnée.</p><div class="form-actions">${button('Conserver ma session','resume')}${button('Effacer la session','confirm-discard')}</div>`);return;}
    return closeModal();
  }
  if(name==='confirm-discard'){session=null;await persist();closeModal();app.render();return;}
  if(name==='exclude'||name==='include'){const p=session.pages.find(p=>p.id===id);p.excluded=name==='exclude';await persist();draw();}
}
export function enhanceDay(root,route){
  ++revision;if(!['home','orders'].includes(route))return;
  for(const control of root.querySelectorAll('[data-day-action=restart],[data-day-action=change-date]'))control.disabled=busy;
}
export function installDay(callbacks){
  app=callbacks;
  document.addEventListener('click',e=>{const b=e.target.closest('[data-day-action]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(b.dataset.dayAction==='background'){closeModal();app.navigate('orders');return;}
    if(b.dataset.dayAction==='camera-stop'){stopCapture();return;}
    if(b.dataset.dayAction==='pause-analysis'){analysisController?.abort();return;}
    if(['today','switch-day'].includes(b.dataset.dayAction)){void changeDay(b.dataset.dayAction==='today'?localDate():b.dataset.date).catch(e=>toast(e.message,true));return;}
    if(busy&&b.dataset.dayAction!=='resume')return;
    // Opening a saved session must happen before the busy flag is set.
    if(b.dataset.dayAction==='resume'){void openDay().catch(e=>toast(e.message,true));return;}
    setBusy(true);activeOperation=act(b).catch(e=>toast(e.message,true)).finally(()=>{setBusy(false);});
  },true);
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.matches('[data-day-files]')){if(busy)return;const files=[...el.files];el.value='';setBusy(true);activeOperation=addFiles(files).catch(e=>toast(e.message,true)).finally(()=>{setBusy(false);draw();});}
    if(el.id==='batch-date'){const date=el.value;if(date)void changeDay(date).catch(e=>{el.value=session.date;toast(e.message,true);});else el.value=session.date;return;}
    if(busy)return;
    if(el.dataset.dayChoice){session.choices[el.dataset.dayChoice]=el.value;void persist();drawSummary();}
  });
  document.addEventListener('submit',e=>{const form=e.target.closest('[data-day-form]');if(!form)return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;const data=new FormData(form);setBusy(true);
    activeOperation=Promise.resolve().then(()=>form.dataset.dayForm==='page'?savePage(form,data):form.dataset.dayForm==='restart'?confirmRestart(form):form.dataset.dayForm==='date'?saveDate(form,data):form.dataset.dayForm==='distinct'?saveDistinct(form,data):saveDay(form)).catch(e=>{if(form.isConnected)formError(form,e);else toast(e.message,true);}).finally(()=>{setBusy(false);});
  },true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCapture();});
  document.addEventListener('keydown',e=>{const card=e.target.closest('.product-record[data-action]');if(card&&e.target===card&&['Enter',' '].includes(e.key)){e.preventDefault();card.click();}});
}
function signature(p){return JSON.stringify({orders:p.orders.map(g=>({number:g.number,revision:g.existingRevision,mode:g.mode,choice:choice(g),lines:g.lines.map(l=>[l.sku,l.quantity,l.pack,l.location,l.designation,l.alphaCode])})),catalogue:proposedCatalogue(p).changes.map(c=>[c.record.id,c.before?._eventId,c.record.name,c.record.location,c.record.locations,c.record.articleCode,c.record.alphaCode])});}
