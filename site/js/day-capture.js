import * as Store from './storage.js';
import {products} from './model.js';
import {matchProduct} from './catalogue-core.js';
import {parseDayPage,buildDayPlan,dayRecord} from './day-core.js';
import {recognizePhoto} from './features.js';
import {editDocumentPhoto} from './photo-tools.js';
import {state,esc,field,check,modal,closeModal,toast,formError,dateLabel,fmt,onModalClose} from './ui.js';
import {uid,localDate,refKey} from './core.js';

let app,session,busy=false,namespace,queue=Promise.resolve(),revision=0,planStamp;
const button=(label,action,attrs='')=>`<button type="button" class="btn ${action==='analyse'?'primary':''}" data-day-action="${action}" ${attrs}>${label}</button>`;
const persist=()=>{const value=structuredClone(session),space=namespace;queue=queue.catch(()=>{}).then(()=>{if(space!==Store.isDemo())throw Error('L’espace de travail a changé.');return Store.setMeta('day-capture',value);});return queue;};
const sameSpace=()=>namespace===Store.isDemo();
function setBusy(value){busy=value;syncBusy();}
function syncBusy(){for(const el of document.querySelectorAll('#dialog [data-day-action],#dialog [data-day-files],#dialog [data-day-form] [type=submit]'))el.disabled=busy||el.dataset.idleDisabled==='1';}
function guard(){if(!sameSpace())throw Error('L’espace de travail a changé. Rouvrez la session de photos.');}
const plan=()=>buildDayPlan(session.pages,Store.list('orders'),session.date,code=>matchProduct(code,products()));
const choice=g=>session.choices[g.number]||(g.mode==='new'?'new':'skip');

export async function openDay(){
  if(busy){toast('Le traitement continue. Les photos déjà ajoutées sont conservées.');return;}
  await queue.catch(()=>{});namespace=Store.isDemo();session=await Store.meta('day-capture')||{date:state.date||localDate(),pages:[],choices:{}};
  session.choices||={};showSession();
}
function showSession(){
  modal('Enregistrer ma journée',`<p class="dialog-intro">Photographiez toutes les feuilles à la suite. L’application regroupe leurs pages par numéro de commande.</p>${field('dayDate','Journée réalisée',session.date,{type:'date',id:'batch-date'})}<section class="day-upload"><label class="btn primary full" for="batch-camera">Photographier une page</label><input class="sr-only" id="batch-camera" type="file" accept="image/*" capture="environment" data-day-files><label class="btn full section-gap" for="batch-gallery">Ajouter des photos de la galerie</label><input class="sr-only" id="batch-gallery" type="file" accept="image/*" multiple data-day-files><p class="hint">100 photos maximum par session, 25 Mo par photo et 150 Mo au total. Vous pouvez fermer puis reprendre cette session.</p></section><p id="batch-progress" role="status" aria-live="polite"></p><div id="batch-pages"></div><div class="actions section-gap">${button('Terminer les photos et analyser','analyse')}${button('Effacer cette session','discard')}</div><div id="batch-summary"></div>`,true);
  draw();
}
function draw(){
  const el=document.querySelector('#batch-pages');if(!el||!session)return;
  el.innerHTML=`<h3 class="modal-subheading">${session.pages.length} photo(s) conservée(s)</h3>${session.pages.map((p,i)=>`<article class="day-page ${p.excluded?'excluded':''}"><div><strong>Page photographiée ${i+1}</strong><small>${esc(p.excluded?'Écartée':p.error?'Lecture à reprendre':p.sections?.length?p.sections.map(s=>s.number||'Numéro à vérifier').join(' · '):'Prête à analyser')}</small></div><div class="actions">${p.text||p.error?button('Vérifier','edit',`data-id="${esc(p.id)}"`):''}${button(p.excluded?'Réintégrer':'Écarter',p.excluded?'include':'exclude',`data-id="${esc(p.id)}"`)}${button('Voir / recadrer','crop',`data-id="${esc(p.id)}"`)}</div></article>`).join('')}`;
  if(session.pages.some(p=>p.text||p.error))drawSummary();syncBusy();
}
function drawSummary(){
  const el=document.querySelector('#batch-summary');if(!el)return;const p=plan();
  planStamp=signature(p);
  const selected=p.orders.filter(g=>choice(g)!=='skip'),count=selected.length;
  let total=0,unknown=0;for(const g of selected){try{const r=dayRecord(g,session.date,choice(g));total+=r.total;unknown+=r.unknownLines;}catch{}}
  el.innerHTML=`<section class="card section-gap"><h3>Bilan proposé</h3><p><strong>${count} commande(s) à enregistrer · ${fmt(total)} picking(s)${unknown?' minimum estimé':''}</strong></p><p class="hint">${p.duplicatePages} page(s) en double ignorée(s). ${p.orders.filter(g=>choice(g)==='skip').length} commande(s) écartée(s) ou déjà enregistrée(s).</p>${p.problems.map(e=>`<p class="error-message">${esc(e.message)} ${e.id?button('Vérifier la page','edit',`data-id="${esc(e.id)}"`):''}</p>`).join('')}${p.orders.map(g=>`<article class="day-order"><strong>Commande ${esc(g.number)}</strong><p>${g.sources.length} page(s) · ${g.lines.length} ligne(s) · ${fmt(g.estimate.total)} prise(s)${g.estimate.unknown?' minimum, conditionnement manquant':''}</p>${g.reviewPages.length?`<p class="overdue-label">${g.reviewPages.length} page(s) à vérifier</p>${g.reviewPages.map(id=>button('Vérifier','edit',`data-id="${esc(id)}"`)).join('')}`:''}${g.incomplete&&!(choice(g)==='append'&&g.appendIncomplete===false)?'<p class="error-message">Il manque une ou plusieurs pages annoncées sur cette commande. Ajoutez-les ou écartez cette commande.</p>':''}${g.mode==='other-day'?'<p class="info-note">Ce numéro existe sur une autre journée. Il reste écarté pour éviter un double comptage.</p>':''}<label>Traitement<select data-day-choice="${esc(g.number)}"><option value="skip" ${choice(g)==='skip'?'selected':''}>Ne pas compter cette commande</option>${g.mode==='new'?`<option value="new" ${choice(g)==='new'?'selected':''}>Enregistrer cette commande</option>`:''}${g.mode==='exists'?`<option value="replace" ${choice(g)==='replace'?'selected':''}>Remplacer la lecture déjà enregistrée ce jour</option>${g.appendLines?`<option value="append" ${choice(g)==='append'?'selected':''}>Ajouter seulement les nouvelles pages</option>`:''}`:''}</select></label></article>`).join('')}${unknown?'<p class="info-note">Certaines lignes n’ont pas de règle de picking. Leur total reste une estimation minimale. Complétez les règles de famille ou de produit pour fiabiliser le calcul.</p>':''}<form data-day-form="save"><p class="hint">Les quantités doivent correspondre au travail réellement préparé. Les anciennes journées conservent leurs règles de calcul.</p>${check('confirmed','Je confirme les commandes terminées, les quantités relues et les estimations signalées.',false,'required')}<div data-form-error class="error-message" hidden></div><button type="submit" class="btn primary full section-gap" data-idle-disabled="${!count?'1':'0'}" ${!count?'disabled':''}>Enregistrer toutes les commandes retenues</button></form></section>`;
}
async function addFiles(files){
  const status=document.querySelector('#batch-progress');
  for(const file of files){
    guard();if(!file.type.startsWith('image/'))throw Error('Choisissez des photos de feuilles.');
    if(file.size>25e6||session.pages.length>=100||session.pages.reduce((s,p)=>s+(p.size||0),0)+file.size>150e6)throw Error('Limite atteinte : 100 photos, 25 Mo par photo, 150 Mo par session. Analysez et enregistrez les photos déjà conservées.');
    if(status?.isConnected)status.textContent='Conservation de la photo…';
    const bytes=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');guard();
    if(session.pages.some(p=>p.hash===hash)){toast('Cette photo est déjà dans la session. Elle n’a pas été ajoutée deux fois.');continue;}
    const photoId=await Store.storeFile(new Blob([bytes],{type:file.type}),file.name||'feuille.jpg','day-photo');guard();
    await Store.save('documents',{id:photoId,name:file.name||'feuille.jpg',kind:'day-photo',createdAt:new Date().toISOString(),sourceHash:hash},'Photo de journée conservée',{undoable:false});
    session.pages.push({id:uid(),photoId,hash,size:file.size,text:'',sections:null,reviewed:false,excluded:false});await persist();draw();
  }
  if(status?.isConnected)status.textContent='Photos conservées. Ajoutez la suivante ou lancez l’analyse.';
}
async function analyse(){
  if(!session.pages.some(p=>!p.excluded))throw Error('Ajoutez au moins une photo.');
  const output=document.querySelector('#batch-progress');
  for(let i=0;i<session.pages.length;i++){
    const page=session.pages[i];if(page.excluded||page.sections&&!page.error)continue;
    guard();
    try{
      const f=await Store.readFile(page.photoId);if(!f)throw Error('Photo indisponible sur cet appareil. Ajoutez-la de nouveau.');
      page.text=await recognizePhoto(f.blob,message=>{if(output?.isConnected)output.textContent=`Photo ${i+1}/${session.pages.length} — ${message}`;});guard();
      page.sections=parseDayPage(page.text);page.error=null;page.reviewed=false;
    }catch(e){page.error=e.message||'Lecture impossible.';}
    await persist();draw();
  }
  if(output?.isConnected)output.textContent='Analyse terminée. Vérifiez les anomalies signalées, puis validez la journée.';draw();
}
async function editPage(id){
  const p=session.pages.find(p=>p.id===id);if(!p)throw Error('Page introuvable.');
  const sections=p.sections?.length?p.sections:[{number:'',lines:[]}];
  const file=await Store.readFile(p.photoId),url=file?URL.createObjectURL(file.blob):null;
  modal('Vérifier la page',`${url?`<img class="day-photo" src="${url}" alt="Feuille à vérifier">`:''}<p class="info-note">Vérifiez le numéro et les quantités réellement préparées. Les colonnes commandé et préparé peuvent différer. Une ligne : référence ; quantité préparée. Gardez les zéros initiaux.</p><form data-day-form="page" data-id="${esc(id)}">${sections.map((s,i)=>`<fieldset data-day-section="${i}"><legend>Commande ${i+1}</legend>${field('number'+i,'Numéro de commande',s.number,{required:true,code:true})}${field('lines'+i,'Références et quantités préparées',s.lines.map(l=>l.sku+';'+l.quantity).join('\n'),{textarea:true,rows:6,full:true})}</fieldset>`).join('')}${check('reviewed','J’ai vérifié les numéros, les références et les quantités de cette page.',p.reviewed,'required')}${check('allowDuplicate','Je confirme que cette photo représente une autre page malgré un texte identique.',p.allowDuplicate)}<details><summary>Texte brut lu sur la photo</summary><pre class="day-raw">${esc(p.text||p.error||'Lecture non effectuée')}</pre></details><div data-form-error class="error-message" hidden></div><div class="form-actions">${button('Retour aux photos','resume')}<button type="submit" class="btn primary">Valider cette page</button></div></form>`,true);
  if(url)onModalClose(()=>URL.revokeObjectURL(url));
}
async function savePage(form){
  const p=session.pages.find(p=>p.id===form.dataset.id),d=new FormData(form);if(!p)throw Error('Page introuvable.');
  const next=[];
  for(const el of form.querySelectorAll('[data-day-section]')){
    const i=Number(el.dataset.daySection),number=refKey(d.get('number'+i)),text=String(d.get('lines'+i)||''),rows=text.split(/\r?\n/).filter(s=>s.trim()).map((s,j)=>{const cells=s.split(';').map(s=>s.trim());if(cells.length!==2||!cells[0]||!/^\d+$/.test(cells[1])||Number(cells[1])<1)throw Error('Ligne '+(j+1)+' : utilisez référence;quantité préparée (entier positif).');return {sku:refKey(cells[0]),quantity:Number(cells[1]),quantitySource:'prepared',needsReview:false};});
    if(!number||!rows.length)throw Error('Renseignez le numéro de commande et au moins une ligne. Écartez une photo inutile depuis la session.');
    next.push({...p.sections?.[i],number,lines:rows,text:p.sections?.[i]?.text||p.text,quantitySource:'prepared',needsReview:false});
  }
  p.sections=next;p.reviewed=!!d.get('reviewed');p.allowDuplicate=!!d.get('allowDuplicate');p.error=null;await persist();showSession();
}
async function saveDay(form){
  guard();const p=plan();
  if(signature(p)!==planStamp){drawSummary();throw Error('Le catalogue ou une commande a changé. Relisez le bilan actualisé puis confirmez-le de nouveau.');}
  if(session.pages.some(p=>!p.excluded&&!p.sections))throw Error('Analysez toutes les photos avant de valider.');
  if(p.problems.length)throw Error(p.problems[0].message);
  const items=[];
  for(const g of p.orders){
    const mode=choice(g);if(mode==='skip'||g.mode==='skip')continue;
    if(g.reviewPages.length)throw Error('Vérifiez les pages signalées de la commande '+g.number+'.');
    if(g.incomplete&&!(mode==='append'&&g.appendIncomplete===false))throw Error('Pages manquantes pour '+g.number+'. Ajoutez-les ou écartez cette commande.');
    if(g.existing){if(Store.get('orders',g.existing.id)?._eventId!==g.existingRevision)throw Error('Une commande a changé. Relisez le bilan avant de valider.');}
    else if(Store.list('orders').some(o=>refKey(o.number)===g.number))throw Error('La commande '+g.number+' vient d’être enregistrée. Relisez le bilan.');
    const record=dayRecord(g,session.date,mode);if(record)items.push({type:'orders',record});
  }
  if(!items.length)throw Error('Toutes ces commandes sont déjà enregistrées ou écartées.');
  if(!form.elements.confirmed.checked)throw Error('Confirmez le bilan avant l’enregistrement.');
  await Store.saveBatch(items,'Journée du '+session.date+' : '+items.length+' commande(s)');
  state.date=session.date;session=null;await persist();closeModal();app.navigate('orders');toast('Journée enregistrée : '+items.length+' commande(s). Le bilan est disponible.');
}
async function cropPage(id){
  const p=session.pages.find(p=>p.id===id),f=await Store.readFile(p.photoId);if(!f)throw Error('Photo indisponible.');
  const file=new File([f.blob],f.name,{type:f.blob.type}),out=await editDocumentPhoto(file);guard();
  if(out&&out!==file){const photoId=await Store.storeFile(out,out.name,'day-photo');await Store.save('documents',{id:photoId,name:out.name,kind:'day-photo',createdAt:new Date().toISOString(),sourceHash:p.hash},'Photo redressée');p.photoId=photoId;p.text='';p.sections=null;p.reviewed=false;p.error=null;await persist();}
  showSession();
}
async function act(b){
  const name=b.dataset.dayAction,id=b.dataset.id;
  if(name==='resume')return openDay();
  if(name==='analyse')return analyse();
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
  if(!['home','orders'].includes(route))return;const rev=++revision;
  Store.meta('day-capture').then(d=>{if(!d?.pages?.length||!root.isConnected||rev!==revision)return;root.insertAdjacentHTML('afterbegin',`<section class="card draft-banner"><strong>${d.pages.length} photo(s) de journée en cours — ${esc(dateLabel(d.date))}</strong><div class="actions section-gap">${button('Reprendre mes photos','resume')}</div></section>`);});
}
export function installDay(callbacks){
  app=callbacks;
  document.addEventListener('click',e=>{const b=e.target.closest('[data-day-action]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;
    // Opening a saved session must happen before the busy flag is set.
    if(b.dataset.dayAction==='resume'){void openDay().catch(e=>toast(e.message,true));return;}
    setBusy(true);act(b).catch(e=>toast(e.message,true)).finally(()=>{setBusy(false);});
  },true);
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.matches('[data-day-files]')){if(busy)return;const files=[...el.files];el.value='';setBusy(true);addFiles(files).catch(e=>toast(e.message,true)).finally(()=>{setBusy(false);draw();});}
    if(el.id==='batch-date'){session.date=el.value||localDate();session.choices={};void persist();drawSummary();}
    if(el.dataset.dayChoice){session.choices[el.dataset.dayChoice]=el.value;void persist();drawSummary();}
  });
  document.addEventListener('submit',e=>{const form=e.target.closest('[data-day-form]');if(!form)return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;setBusy(true);const b=form.querySelector('[type=submit]');
    Promise.resolve().then(()=>form.dataset.dayForm==='page'?savePage(form):saveDay(form)).catch(e=>{if(form.isConnected)formError(form,e);else toast(e.message,true);}).finally(()=>{busy=false;if(b.isConnected)b.disabled=false;});
  },true);
  document.addEventListener('keydown',e=>{const card=e.target.closest('.product-record[data-action]');if(card&&e.target===card&&['Enter',' '].includes(e.key)){e.preventDefault();card.click();}});
}
function signature(p){return JSON.stringify(p.orders.map(g=>({number:g.number,revision:g.existingRevision,mode:g.mode,choice:choice(g),lines:g.lines.map(l=>[l.sku,l.quantity,l.pack])})));}
