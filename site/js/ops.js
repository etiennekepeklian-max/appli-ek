import * as Store from './storage.js';
import {publicProductPhoto} from './product-image.js';
import {state,esc,btn,field,check,modal,modalForm,closeModal,onModalClose,toast,download,pdfReport,dateLabel,fmt,formError} from './ui.js';
import {products,findProducts,productName} from './model.js';
import {refKey,localDate,uid,toCSV} from './core.js';
import {parseLocationImport,productLocations,pendingGroups,allocateReceipt,isOverdue,isWaiting,waitStarted,WAIT_LIMIT,weeklySummary,weekDates,matchesSearch} from './ops-core.js';
import {scanFeedback,unlockFeedback} from './feedback.js';

export const SHORTCUTS=[['enfs','Mes ENF','Références et quantités','layers'],['codes','Créer un code','Saisir ou dicter','barcode'],['scan','Scanner','Caméra ou photo','scan'],['new-order','Ma journée','Chiffres et graphiques','chart'],['new-pending','Un manquant','Suivre le réassort','clock'],['stock','Catalogue','Chercher un produit','box'],['locations','Emplacements','Retrouver un casier','pin'],['unknowns','Codes inconnus','Identifier plus tard','help'],['journal','Journal de bord','Bilan de la semaine','list'],['receipt','Réception groupée','Choisir les commandes débloquées','check']];
let app,importPreview,receiptRows=[],receiptPlan=[],busy=false,timer,alerting=false,currentDraftKey,hydration=0,photoRevision=0;
const object=form=>Object.fromEntries(new FormData(form));
const opsButton=(text,action,attrs='')=>`<button type="button" class="btn" data-ops-action="${action}" ${attrs}>${text}</button>`;
const unknownId=code=>'unknown-'+refKey(code);

export async function recordUnknown(code){
  if(String(code).length>500)throw Error('Code trop long : 500 caractères maximum.');
  const id=unknownId(code),old=Store.get('unknowns',id);
  await Store.save('unknowns',{...old,id,code:refKey(code),status:'open',count:(old?.count||0)+1,firstSeen:old?.firstSeen||new Date().toISOString(),lastSeen:new Date().toISOString()},'Code inconnu à identifier');
}
export async function resolveUnknownLocations(location){
 const rows=Store.list('unknowns').filter(r=>r.status!=='resolved'&&refKey(r.code)===refKey(location));
 if(rows.length)await Store.saveBatch(rows.map(r=>({type:'unknowns',record:{...r,status:'resolved',location}})),'Code identifié comme emplacement',{undoable:false});
}
export async function resolveUnknowns(product){
  const rows=Store.list('unknowns').filter(r=>{
    if(r.status==='resolved'||![refKey(product.sku),refKey(product.barcode)].includes(refKey(r.code)))return false;
    const found=findProducts(r.code);
    return found.length===1&&found[0].id===product.id&&!found[0].namePending&&String(found[0].name||'').trim();
  });
  if(rows.length)await Store.saveBatch(rows.map(r=>({type:'unknowns',record:{...r,status:'resolved',productId:product.id}})),'Code identifié',{undoable:false});
}

function options(){
  const s=Store.settings(),permission=globalThis.Notification?.permission||'indisponible';
  return `<section class="card ops-options"><h2>Options terrain</h2><form data-ops-form="options"><div class="stack section-gap">${check('scanSound','Son à la lecture d’un code',s.scanSound)}${check('scanVibration','Vibration à la lecture d’un code',s.scanVibration)}${check('waitNotifications','Alertes de réassort après 30 minutes',s.waitNotifications)}</div><p class="hint section-gap">Les sons et vibrations dépendent du navigateur et du mode silencieux. Les alertes sont contrôlées pendant l’utilisation et à la réouverture. Si le téléphone suspend ou ferme l’application, la notification peut être retardée. Les réassorts reçus et commandes clôturées ne déclenchent plus d’alerte.</p><p class="hint">Notifications système : ${esc(permission==='granted'?'autorisées':permission==='denied'?'bloquées dans le navigateur':permission==='default'?'à autoriser':permission)}.</p><div class="actions section-gap">${opsButton('Autoriser les notifications','allow-notifications')}${opsButton('Essayer le retour de lecture','test-feedback')}<button class="btn primary" type="submit">Enregistrer les options</button></div></form><h3 class="modal-subheading">Raccourcis de mon accueil</h3><form data-ops-form="shortcuts"><p class="hint">Choisissez de 1 à 4 actions et leur ordre. « Aucun » retire une case.</p><div class="form-grid mobile-one">${Array.from({length:4},(_,i)=>field('shortcut'+i,'Position '+(i+1),s.homeShortcuts?.[i]||'',{select:[{value:'',label:'Aucun'},...SHORTCUTS.map(([value,label])=>({value,label}))]})).join('')}</div><button class="btn primary section-gap" type="submit">Enregistrer mon accueil</button></form></section>`;
}
function unknownsView(){
  const rows=Store.list('unknowns').filter(r=>r.status!=='resolved'&&matchesSearch(r,['code','notes'],state.query)).sort((a,b)=>b.lastSeen.localeCompare(a.lastSeen));
  return `<div class="page-heading"><h1>Codes inconnus</h1><p>Les codes non reconnus restent ici, même hors connexion.</p></div><div class="search-box"><label for="view-search">Rechercher</label><input id="view-search" data-filter-search type="search" value="${esc(state.query)}"></div>${rows.length?rows.map(r=>`<article class="card section-gap"><h2 class="mono">${esc(r.code)}</h2><p>${r.count} lecture(s) · dernière : ${new Date(r.lastSeen).toLocaleString('fr-FR')}</p><div class="actions section-gap">${opsButton('Identifier cet emplacement','identify-unknown-location',`data-id="${esc(r.id)}"`)}${opsButton('Identifier ce produit','identify-unknown',`data-id="${esc(r.id)}"`)}${opsButton('Classer sans suite','dismiss-unknown',`data-id="${esc(r.id)}"`)}</div></article>`).join(''):'<div class="card section-gap"><p>Aucun code en attente d’identification.</p></div>'}`;
}
function journalView(){
  const dates=weekDates(state.date),r=Store.get('journal','week-'+dates[0])||{},summary=weeklySummary(state.date,Store.list('orders'),Store.list('days'),Store.list('issues'),Store.list('pending'),Store.settings().goal);
  return `<div class="page-heading"><h1>Journal de bord</h1><p>Du ${dateLabel(dates[0])} au ${dateLabel(dates[6])}.</p></div><div class="field"><label for="journal-date">Une date de la semaine</label><input type="date" id="journal-date" value="${esc(state.date)}"></div><section class="card section-gap"><h2>Bilan enregistré</h2><p>${summary.commands==null?'Commandes non renseignées':fmt(summary.commands)+' commande(s)'+(summary.commandsPartial?' (partiel)':'')} · ${fmt(summary.total)} pickings · ${summary.days} jour(s) renseigné(s).</p><p class="hint">${summary.estimated?'Une partie des pickings reste estimée.':'Les jours non renseignés ne sont pas comptés comme des journées à zéro.'}</p><p>${summary.issues.length} incident(s) enregistré(s) cette semaine. ${summary.pending.length} attente(s) actuellement ouvertes.</p></section><section class="card section-gap"><form data-ops-form="journal" data-week="${dates[0]}"><div class="form-grid mobile-one">${field('activities','Activités et missions',r.activities||'',{textarea:true,full:true})}${field('difficulties','Difficultés rencontrées',r.difficulties||'',{textarea:true,full:true})}${field('learning','Apprentissages et progrès',r.learning||'',{textarea:true,full:true})}${field('improvements','Pistes d’amélioration',r.improvements||'',{textarea:true,full:true})}</div><div class="actions section-gap"><button class="btn primary" type="submit">Enregistrer le journal</button>${opsButton('Relire et exporter en PDF','weekly-pdf')}</div><div data-form-error class="error-message" hidden></div></form></section>`;
}
export function renderOpsView(){return state.route==='unknowns'?unknownsView():journalView();}

function groupsView(){
  const groups=pendingGroups(Store.list('pending')).filter(g=>!state.query||matchesSearch(g,['sku','sku','name'],state.query)||g.rows.some(p=>matchesSearch(p,['orderNumber','location','notes'],state.query))||matchesSearch({name:productName(g.sku)},['sku','barcode','name'],state.query));
  return `<section class="ops-groups"><p class="hint">Références attendues et commandes concernées. Cochez les commandes réellement débloquées à la réception.</p>${groups.length?groups.map(g=>`<article class="card section-gap ${g.overdue?'overdue-card':''}"><h2>${esc(g.sku)}</h2><p>${esc(productName(g.sku))}</p><p class="group-total">${new Set(g.rows.map(r=>r.orderNumber)).size} commande(s) concernée(s)</p>${g.overdue?'<p class="overdue-label">Au moins une attente dépasse 30 min</p>':''}<ul class="group-details">${g.rows.map(r=>`<li><strong>${esc(r.orderNumber)}</strong> · ${esc(r.location||'Sans casier')} · ${r.quantity==null?'Quantité non renseignée':fmt(r.quantity)+' unité(s)'} ${opsButton('Ouvrir','edit-wait',`data-id="${esc(r.id)}"`)} ${btn('Message pour réassort','message-jc','message','small',`data-id="${esc(r.id)}"`)} ${btn('Supprimer','delete-pending','trash','small danger',`data-id="${esc(r.id)}" aria-label="Supprimer le manquant ${esc(r.sku)} de la commande ${esc(r.orderNumber)}"`)}</li>`).join('')}</ul>${opsButton('Recevoir ce réassort','receipt',`data-sku="${esc(g.sku)}"`)}</article>`).join(''):'<div class="card section-gap">Aucun réassort restant à recevoir.</div>'}</section>`;
}
export function enhanceOps(root,route){
  if(route==='settings')root.insertAdjacentHTML('beforeend',options());

  if(['stock','locations'].includes(route))root.querySelector('.filters')?.insertAdjacentHTML('beforeend',opsButton('Importer les emplacements','import-locations'));
  if(route==='locations'){root.querySelector('.filters')?.insertAdjacentHTML('afterend','<p class="info-note"><strong>Import des emplacements : CSV UTF-8.</strong> Colonnes : <code>reference;emplacement</code>. Une ligne par casier ; répétez la référence pour plusieurs emplacements. Dans Excel, utilisez le format Texte pour conserver les zéros. Modèle et aperçu disponibles dans « Importer les emplacements ».</p>');
    const links=products().filter(p=>productLocations(p).length&&matchesSearch(p,['sku','barcode','name','location','locations'],state.query));
    root.insertAdjacentHTML('beforeend',`<section class="card section-gap"><h2>Emplacements par référence</h2><p class="hint">${links.length} référence(s). Utilisez la recherche pour filtrer.</p>${links.slice(0,50).map(p=>`<p class="location-link"><strong>${esc(p.sku)}</strong><span>${esc(productLocations(p).join(' · '))}</span></p>`).join('')}${links.length>50?'<p class="hint">50 premières fiches affichées. Affinez la recherche.</p>':''}</section>`);
  }
  if(route==='pending'){
    root.querySelector('.filters')?.insertAdjacentHTML('afterend',`<div class="actions section-gap">${opsButton('Par commande','wait-list')}${opsButton('Regrouper par référence','wait-groups')}${opsButton('Réception groupée','receipt')}</div>`);
    if(state.groupWaits&&state.filter==='all'){root.querySelector('.responsive-cards')?.remove();root.querySelector(':scope > .empty')?.remove();root.insertAdjacentHTML('beforeend',groupsView());}
    for(const card of root.querySelectorAll('.pending-card')){
      const id=card.querySelector('[data-action="edit-pending"]')?.dataset.id,p=Store.get('pending',id);if(!p||!isWaiting(p))continue;
      const age=Math.max(0,Math.floor((Date.now()-waitStarted(p))/60000));
      card.insertAdjacentHTML('afterbegin',`<p class="${isOverdue(p)?'overdue-label':'hint'}">${Number.isFinite(age)?`En attente depuis ${age} min`:'Date du signalement inconnue'}${isOverdue(p)?' · délai de 30 min dépassé':''}</p>`);card.classList.toggle('overdue-card',isOverdue(p));
    }
  }
  if(route==='stock')for(const card of root.querySelectorAll('.product-record')){
    const p=products().find(p=>p.id===card.querySelector('[data-action="edit-product"]')?.dataset.id);if(!p)continue;
    if(p.photoId)card.insertAdjacentHTML('afterbegin',`<img class="product-photo" data-product-photo="${esc(p.photoId)}" alt="${esc(p.name)}" hidden>`);else if(p.lookupImageUrl)card.insertAdjacentHTML('afterbegin',publicProductPhoto(p.lookupImageUrl,p.name));
    if(productLocations(p).length)card.insertAdjacentHTML('beforeend',`<p class="hint section-gap">Emplacements : ${esc(productLocations(p).join(' · '))}</p>`);
  }
  if(route==='history')root.insertAdjacentHTML('beforeend',`<div class="actions section-gap">${opsButton('Annuler la dernière action','undo')}</div>`);
  if(route==='home')void showDraftBanner(root);
  void hydratePhotos();
}
const photoUrls=new Map();
export async function hydratePhotos(){
  const revision=++hydration;
  for(const [el,url] of photoUrls)if(!el.isConnected){URL.revokeObjectURL(url);photoUrls.delete(el);}
  for(const el of document.querySelectorAll('[data-product-photo]:not([src])')){
    const f=await Store.readFile(el.dataset.productPhoto);if(revision!==hydration||!el.isConnected)continue;
    if(f){const url=URL.createObjectURL(f.blob);photoUrls.set(el,url);el.src=url;el.hidden=false;}
    else {el.hidden=true;if(!el.nextElementSibling?.classList.contains('photo-unavailable'))el.insertAdjacentHTML('afterend','<p class="hint photo-unavailable">Photo indisponible sur cet appareil : restaurez la sauvegarde contenant les photos.</p>');}
  }
}

function importDialog(){
  importPreview=null;
  modal('Importer les emplacements',`<p class="dialog-intro">Dans Excel, créez les colonnes <strong>reference</strong> et <strong>emplacement</strong>, puis enregistrez au format <strong>CSV UTF-8</strong> (séparateur point-virgule). Les virgules et tabulations sont aussi acceptées.</p><pre class="csv-example">reference;emplacement\n001234;PAC001-A\n001234;RES004-B\nTRJDUPOR;PAD003-C</pre><p class="hint">Commencez chaque adresse par PAC, PAD ou RES (ex. PAC001-A). Une ligne par association. Répétez une référence pour plusieurs casiers. Formatez les références et casiers en <strong>Texte</strong> dans Excel pour conserver les zéros initiaux. Maximum : 5 000 lignes et 3 Mo. Les fichiers .xlsx ne sont pas acceptés.</p><div class="actions">${opsButton('Télécharger le modèle CSV','location-template')}</div><form data-ops-form="locations"><div class="field section-gap"><label for="location-file">Choisir le fichier CSV</label><input id="location-file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" data-ops-file="locations"></div>${field('csv','Ou coller le contenu du CSV','',{textarea:true,rows:6,full:true})}<div class="field section-gap">${check('replace','Remplacer tous les emplacements des références présentes dans ce fichier',false)}</div><p class="hint">Par défaut, les casiers sont ajoutés aux emplacements existants. Aucun produit, conditionnement ou casier des autres références n’est supprimé. Une référence inconnue sera créée avec un nom à compléter.</p><div data-form-error class="error-message" hidden></div><button class="btn primary section-gap" type="submit">Vérifier avant d’importer</button></form><div id="location-preview"></div>`,true);
}
async function previewImport(form){
  const d=object(form),parsed=parseLocationImport(d.csv),known=products();
  importPreview={...parsed,replace:!!d.replace,text:d.csv};
  const unknown=parsed.links.filter(l=>!known.some(p=>refKey(p.sku)===l.sku));
  const withoutType=parsed.links.filter(l=>! /^(PAC|PAD|RES)/.test(l.location)).length;
  const repeated=parsed.links.filter(l=>/^(PAC|PAD|RES)(PAC|PAD|RES)/.test(l.location)).length;
  document.querySelector('#location-preview').innerHTML=`<section class="card section-gap"><h3>Aperçu</h3><p>${parsed.referenceCount} référence(s), ${parsed.links.length} association(s), ${parsed.duplicates} doublon(s) ignoré(s).</p>${withoutType?`<p class="info-note">${withoutType} adresse(s) sans préfixe PAC/PAD/RES : elles seront conservées telles quelles. Complétez le CSV si nécessaire.</p>`:''}${repeated?`<p class="info-note">${repeated} adresse(s) semblent avoir deux préfixes. Vérifiez le fichier avant de confirmer.</p>`:''}<p>${new Set(unknown.map(l=>l.sku)).size} référence(s) à créer.</p><p>${d.replace?'Les emplacements des références du fichier seront remplacés.':'Les emplacements existants seront conservés et complétés.'}</p>${parsed.links.slice(0,12).map(l=>`<p class="location-link"><strong>${esc(l.sku)}</strong><span>${esc(l.location)}</span></p>`).join('')}${parsed.links.length>12?'<p class="hint">Les 12 premières associations sont affichées.</p>':''}${opsButton('Confirmer cet import','confirm-locations')}</section>`;
}
async function commitImport(){
  if(!importPreview)throw Error('Vérifiez le fichier avant de confirmer.');
  const form=document.querySelector('[data-ops-form="locations"]'),d=object(form);
  if(d.csv!==importPreview.text||!!d.replace!==importPreview.replace)throw Error('Le contenu a changé. Touchez à nouveau Vérifier avant d’importer.');
  const grouped=new Map();for(const l of importPreview.links){if(!grouped.has(l.sku))grouped.set(l.sku,[]);grouped.get(l.sku).push(l.location);}
  const items=[],known=products();
  for(const [sku,locations] of grouped){
    const matches=known.filter(p=>refKey(p.sku)===sku);
    for(const p of matches.length?matches:[{id:'import-'+sku,sku,name:'Référence '+sku,namePending:true}]){
      const merged=[...new Set([...(importPreview.replace?[]:productLocations(p)),...locations])];
      items.push({type:'products',record:{...p,locations:merged,location:merged[0]||'',preferredLocation:merged.includes(p.preferredLocation)?p.preferredLocation:''}});
    }
  }
  const existing=new Set(Store.list('locations').map(l=>refKey(l.name)));
  for(const location of new Set(importPreview.links.map(l=>l.location)))if(!existing.has(location))items.push({type:'locations',record:{id:'loc-'+location,name:location,zone:'Picking',notes:'Créé lors de l’import des emplacements'}});
  await Store.saveBatch(items,'Import des emplacements par référence');const count=importPreview.links.length;importPreview=null;closeModal();toast(`${count} association(s) importée(s). L’import peut être annulé en une action.`);
}
function receiptDialog(sku=''){
 const groups=pendingGroups(Store.list('pending'));if(!groups.length)throw Error('Aucun réassort en attente.');
 const selected=sku||groups[0].sku;receiptRows=groups.find(g=>g.sku===selected)?.rows||[];
 modal('Réception groupée',`<span hidden data-help-context="receipt"></span><p class="dialog-intro">Choisissez les commandes que ce réassort permet réellement de reprendre. La fin de préparation de la commande reste une étape distincte.</p><div class="field">${field('sku','Référence reçue',selected,{id:'receipt-reference',select:groups.map(g=>({value:g.sku,label:g.sku+' — '+g.rows.length+' attente(s)'}))})}</div><div id="receipt-choices">${receiptRows.map(r=>`<div class="card section-gap">${check('receipt-'+r.id,'Commande '+esc(r.orderNumber)+' · '+esc(r.location||'Sans casier')+' · '+(r.quantity==null?'Quantité non renseignée':fmt(r.quantity)+' unité(s)'),false,'data-receipt-id="'+esc(r.id)+'"')}${r.priority==='urgent'?'<p class="overdue-label">Prioritaire</p>':''}</div>`).join('')}</div><p class="hint section-gap">Aucune commande n’est sélectionnée automatiquement.</p><div class="form-actions">${opsButton('Confirmer les commandes débloquées','confirm-receipt')}</div>`);
}
export const openReceipt=sku=>receiptDialog(sku);
async function commitReceipt(){
 const selected=[...document.querySelectorAll('[data-receipt-id]:checked')];if(!selected.length)throw Error('Cochez au moins une commande réellement débloquée.');
 const items=selected.map(el=>{const old=receiptRows.find(r=>r.id===el.dataset.receiptId),row=Store.get('pending',el.dataset.receiptId);if(!old||!row||row._eventId!==old._eventId||!isWaiting(row))throw Error('Une attente a changé. Rouvrez la réception.');return {type:'pending',record:{...row,status:'received',received:row.quantity??row.received,simpleReceipt:true}};});
 await Store.saveBatch(items,'Réassort reçu : '+items.length+' attente(s)');closeModal();toast('Réassort marqué reçu pour '+items.length+' attente(s).');
}

async function weeklyPDF(){
  const form=document.querySelector('[data-ops-form="journal"]');if(form)await saveJournal(form);
  const dates=weekDates(state.date),notes=Store.get('journal','week-'+dates[0])||{},s=weeklySummary(state.date,Store.list('orders'),Store.list('days'),Store.list('issues'),Store.list('pending'),Store.settings().goal);
  const lines=[{heading:true,text:`Semaine du ${dateLabel(dates[0])} au ${dateLabel(dates[6])}`},`Collaborateur : ${Store.settings().name}`,`• ${s.commands==null?'Commandes non renseignées':fmt(s.commands)+' commande(s) terminée(s)'+(s.commandsPartial?' (total partiel)':'')} ; ${fmt(s.total)} pickings retenus.`,`• ${s.days} journée(s) renseignée(s). Les journées absentes ne valent pas zéro.`,s.estimated?'• Certaines valeurs restent estimatives.':'• Totaux issus des chiffres saisis et anciens bilans conservés.',{heading:true,text:'Activité par jour'},...s.stats.filter(r=>r.hasData).map(r=>`• ${dateLabel(r.date)} : ${fmt(r.total)} pickings, ${r.commands==null?'commandes non renseignées':r.commands+' commande(s)'} (${r.status==='manual'?'chiffres saisis':r.status==='corrected'?'corrigé':r.status==='estimated'?'estimé':'calculé'}).`),...['activities','difficulties','learning','improvements'].flatMap((key,i)=>[{heading:true,text:['Activités et missions','Difficultés rencontrées','Apprentissages et progrès','Pistes d’amélioration'][i]},...(notes[key]||'Non renseigné.').split(/\n+/).filter(Boolean).map(t=>'• '+t)]),{heading:true,text:'Incidents de la semaine'},...s.issues.slice(0,20).map(r=>`• ${r.kind} · ${r.sku||r.location||'Sans référence'} : ${r.notes||r.status}`),...(s.issues.length?[]:['• Aucun incident enregistré sur cette semaine.']),...(s.issues.length>20?[`• ${s.issues.length-20} autre(s) incident(s) consultable(s) dans l’application.`]:[]),{heading:true,text:'Attentes encore ouvertes au moment de l’export'},`• ${s.pending.length} ligne(s), dont ${s.pending.filter(r=>isOverdue(r)).length} dépassant 30 minutes.`];
  pdfReport('Journal de bord hebdomadaire',lines,`journal-ek-${dates[0]}.pdf`);
}
async function saveJournal(form){const d=object(form);await Store.save('journal',{id:'week-'+form.dataset.week,week:form.dataset.week,...d},'Journal hebdomadaire enregistré');}

async function notifyOverdue(){
  if(alerting)return;alerting=true;
  try{
    clearTimeout(timer);const rows=Store.list('pending'),waiting=rows.filter(isWaiting),now=Date.now(),notified=await Store.meta('wait-alerts')||{},late=waiting.filter(r=>isOverdue(r,now)&&!notified[r.id+':'+waitStarted(r)]);
    if(Store.settings().waitNotifications&&late.length){
      const message=`${late.length} attente(s) de réassort dépassent 30 minutes.`;
      toast(message,true);
      if(!Store.isDemo()&&globalThis.Notification?.permission==='granted'){
        try{const registration=await navigator.serviceWorker?.getRegistration();
          if(registration?.active)await registration.showNotification('EK · Réassort en attente',{body:message,tag:'ek-wait-30',icon:'assets/icon-192.png',silent:!Store.settings().scanSound,data:{url:new URL('./#pending',document.baseURI).href},...(Store.settings().scanVibration?{vibrate:[100,60,100]}:{})});
          else if(!/Android|iPhone|iPad/i.test(navigator.userAgent))new Notification('EK · Réassort en attente',{body:message,tag:'ek-wait-30'});
        }catch{}
      }
      for(const r of late)notified[r.id+':'+waitStarted(r)]=true;
      const valid=new Set(waiting.map(r=>r.id+':'+waitStarted(r)));await Store.setMeta('wait-alerts',Object.fromEntries(Object.entries(notified).filter(([key])=>valid.has(key))));
      if(state.route==='pending')app.render();
    }
    const future=waiting.map(r=>waitStarted(r)+WAIT_LIMIT-now).filter(n=>n>0);timer=setTimeout(()=>void notifyOverdue(),Math.max(500,Math.min(15000,...future)));
  }catch{}finally{alerting=false;}
}

function draftKey(form){return !form?.dataset.draftComplete&&form?.dataset.form&&['order','pending','product','issue','movement','count','replenishment'].includes(form.dataset.form)?'draft-'+form.dataset.form+'-'+(form.dataset.id||'new'):null;}
function draftValue(form){
  const data={};for(const el of form.querySelectorAll('[name]'))if(el.type!=='file'&&el.name!=='checked'&&el.name!=='completed')data[el.name]=el.type==='checkbox'?el.checked:el.value;
  return {form:form.dataset.form,id:form.dataset.id||'',data,lines:form.dataset.form==='order'?app.readOrderLines():null,rawText:form.querySelector('#order-raw-text')?.value||'',photoIds:[...(state.draftPhotoIds||[])],productPhotoId:state.draftProductPhotoId||null,updatedAt:new Date().toISOString()};
}
let draftQueue=Promise.resolve(),draftNamespace;
const draftFingerprint=value=>JSON.stringify({...value,updatedAt:undefined});
export function persistDraft(){
  const form=document.querySelector('#dialog [data-form]'),key=draftKey(form);if(!key)return draftQueue;
  currentDraftKey=key;const value=draftValue(form);if(form.dataset.draftBaseline===draftFingerprint(value))return draftQueue;draftQueue=draftQueue.catch(()=>{}).then(()=>Store.setMeta(key,value));return draftQueue;
}
export async function clearDraft(form){
  const key=draftKey(form);if(!key)return;form.dataset.draftComplete='1';await draftQueue.catch(()=>{});await Store.setMeta(key,null);currentDraftKey=null;state.draftPhotoIds=[];if(state.route==='home')app.render();
}
async function showDraftBanner(root){
  const drafts=await Store.drafts();if(!root.isConnected||state.route!=='home'||!drafts.length)return;
  root.insertAdjacentHTML('afterbegin',`<section class="card draft-banner"><h2>${drafts.length} brouillon(s) disponible(s)</h2>${drafts.slice(0,5).map(d=>`<div class="actions section-gap"><span>${esc({order:'Commande',pending:'Manquant',product:'Produit',issue:'Incident',movement:'Transfert',count:'Comptage',replenishment:'Seuils'}[d.value.form])} · ${new Date(d.value.updatedAt).toLocaleString('fr-FR')}</span>${opsButton('Reprendre','resume-draft',`data-key="${esc(d.key)}"`)}${opsButton('Effacer','delete-draft',`data-key="${esc(d.key)}"`)}</div>`).join('')}</section>`);
}
export async function restoreDraft(key){
  const d=await Store.meta(key);if(!d)throw Error('Ce brouillon n’est plus disponible.');
  app.restoreForm(d);const form=document.querySelector('#dialog [data-form]');
  if(!form)throw Error('Impossible de rouvrir ce formulaire.');form.dataset.restored='1';
  for(const [name,value] of Object.entries(d.data))for(const el of form.elements)if(el.name===name){if(el.type==='checkbox')el.checked=!!value;else if(el.type!=='file')el.value=d.form==='pending'&&name==='status'&&value==='partial'?'waiting':value;}
  if(d.form==='product'&&d.productPhotoId){state.draftProductPhotoId=d.productPhotoId;form.querySelector('#product-photo')?.insertAdjacentHTML('afterend',`<img class="product-photo" data-product-photo="${esc(d.productPhotoId)}" alt="Photo du brouillon" hidden>`);void hydratePhotos();}
  if(d.form==='order'){state.orderLines=d.lines||[];state.draftPhotoIds=d.photoIds||[];app.renderOrderLines();const raw=form.querySelector('#order-raw-text');if(raw)raw.value=d.rawText||'';app.updateOrderEstimate();}
  currentDraftKey=key;window.dispatchEvent(new CustomEvent('ek-draft-restored'));toast('Brouillon restauré. Vérifiez-le avant de l’enregistrer.');
}

async function action(button){
  const name=button.dataset.opsAction,id=button.dataset.id;
  if(name==='import-locations')importDialog();
  else if(name==='location-template')download(new Blob(['\uFEFFreference;emplacement\r\n001234;PAC001-A\r\n001234;RES004-B\r\nTRJDUPOR;PAD003-C\r\n'],{type:'text/csv;charset=utf-8'}),'modele-emplacements.csv');
  else if(name==='confirm-locations')await commitImport();
  else if(name==='receipt')receiptDialog(button.dataset.sku);
  else if(name==='confirm-receipt')await commitReceipt();
  else if(name==='wait-groups'){state.groupWaits=true;state.filter='all';app.render();}
  else if(name==='wait-list'){state.groupWaits=false;app.render();}
  else if(name==='edit-wait')app.pendingForm(Store.get('pending',id));
  else if(name==='allow-notifications'){
    if(!globalThis.Notification)throw Error('Notifications non prises en charge. Le repère rouge dans l’application reste disponible.');
    const status=await Notification.requestPermission();toast(status==='granted'?'Notifications autorisées.':'Notifications non autorisées. Vous pouvez les régler dans le navigateur.');app.render();await notifyOverdue();
  }
  else if(name==='test-feedback'){unlockFeedback();scanFeedback('success');toast('Test du son et de la vibration selon vos options enregistrées.');}
  else if(name==='identify-unknown-location'){const r=Store.get('unknowns',id);app.locationForm({name:r.code});}
  else if(name==='identify-unknown'){const r=Store.get('unknowns',id);app.productForm({sku:r.code,barcode:r.code});}
  else if(name==='dismiss-unknown'){const r=Store.get('unknowns',id);await Store.save('unknowns',{...r,status:'resolved'},'Code inconnu classé');}
  else if(name==='hide-undo'){await Store.dismissUndo(button.dataset.undoId);await refreshUndo();}
  else if(name==='quick-undo'){const info=await Store.undoInfo();if(!info||Store.undoId(info)!==button.dataset.undoId)throw Error('La dernière action a changé. Vérifiez son intitulé.');if(info.items.length===1){await Store.undoLast(Store.undoId(info));await refreshUndo();toast('Action annulée.');}else await action({dataset:{opsAction:'undo'}});}
  else if(name==='undo'){
    const info=await Store.undoInfo();if(!info)throw Error('Aucune action à annuler.');undoTarget=Store.undoId(info);
    modal('Annuler la dernière action',`<span hidden data-help-context="history"></span><p class="dialog-intro">${esc(info.action)}</p><p>${info.items.length?info.items.length+' fiche(s) reviendront à leur état précédent. L’historique sera conservé.':'La session de photos retrouvera son état précédent, si elle n’a pas été modifiée depuis.'}</p><div class="actions section-gap">${opsButton('Confirmer l’annulation','confirm-undo')}${btn('Conserver cette action','close-dialog')}</div>`);
  }
  else if(name==='confirm-undo'){const latest=await Store.undoInfo();if(!latest||Store.undoId(latest)!==undoTarget)throw Error('La dernière action a changé. Rouvrez son annulation.');await Store.undoLast(undoTarget);await refreshUndo();closeModal();toast('Action annulée. La trace reste dans l’historique.');}
  else if(name==='resume-draft')await restoreDraft(button.dataset.key);
  else if(name==='delete-draft'){await Store.setMeta(button.dataset.key,null);app.render();}
  else if(name==='weekly-pdf')await weeklyPDF();
}
async function submit(form){
  const d=object(form),name=form.dataset.opsForm;
  if(name==='locations')await previewImport(form);
  else if(name==='receipt')throw Error('Rouvrez la réception groupée.');
  else if(name==='options'){await Store.save('preferences',{...Store.settings(),id:'main',scanSound:!!d.scanSound,scanVibration:!!d.scanVibration,waitNotifications:!!d.waitNotifications},'Options terrain modifiées');toast('Options enregistrées.');await notifyOverdue();}
  else if(name==='shortcuts'){const chosen=Array.from({length:4},(_,i)=>d['shortcut'+i]).filter(Boolean);if(!chosen.length||new Set(chosen).size!==chosen.length)throw Error('Choisissez de 1 à 4 raccourcis différents.');if(chosen.some(x=>!SHORTCUTS.some(([id])=>id===x)))throw Error('Raccourci invalide.');await Store.save('preferences',{...Store.settings(),id:'main',homeShortcuts:chosen},'Accueil personnalisé');toast('Accueil enregistré.');}
  else if(name==='journal'){await saveJournal(form);toast('Journal de bord enregistré.');}
}
export async function saveDraftPhoto(file){const id=await Store.storeFile(file,file.name,'photo');await Store.save('documents',{id,name:file.name,kind:'photo',createdAt:new Date().toISOString()},'Photo de brouillon conservée');state.draftPhotoIds||=[];state.draftPhotoIds.push(id);await persistDraft();return id;}
export function installOps(callbacks){
  app=callbacks;
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-ops-action]');if(!b||b.disabled)return;event.preventDefault();event.stopImmediatePropagation();if(busy)return;busy=true;b.disabled=true;Promise.resolve().then(()=>action(b)).catch(e=>toast(e.message,true)).finally(()=>{busy=false;if(b.isConnected)b.disabled=false;});
  },true);
  document.addEventListener('submit',event=>{
    const form=event.target.closest('[data-ops-form]');if(!form)return;event.preventDefault();event.stopImmediatePropagation();if(busy)return;busy=true;const b=form.querySelector('[type="submit"]');if(b)b.disabled=true;submit(form).catch(e=>formError(form,e)).finally(()=>{busy=false;if(b?.isConnected)b.disabled=false;});
  },true);
  document.addEventListener('change',event=>{
    const el=event.target;if(el.id==='receipt-reference'){receiptDialog(el.value);return;}if(el.id==='journal-date'){state.date=el.value||localDate();app.render();}
    if(el.dataset.opsFile==='locations'&&el.files?.[0]){const file=el.files[0];if(file.size>3e6||!/\.(csv|tsv)$/i.test(file.name)){toast('Choisissez un fichier CSV UTF-8 de moins de 3 Mo.',true);return;}const form=el.closest('form');file.text().then(text=>{if(form.isConnected)form.elements.csv.value=text;importPreview=null;}).catch(()=>toast('Fichier illisible.',true));}
    if(el.name==='productPhoto'&&el.files?.[0]){
      const form=el.closest('form'),file=el.files[0],revision=++photoRevision;state.draftProductPhotoId=null;
      import('./photo-tools.js').then(async({compressProductPhoto})=>{const photo=await compressProductPhoto(file);if(!form?.isConnected||revision!==photoRevision)return;const id=await Store.storeFile(photo,photo.name,'product-photo');await Store.save('documents',{id,name:photo.name,kind:'product-photo',createdAt:new Date().toISOString()},'Photo produit conservée');if(!form.isConnected||revision!==photoRevision)return;state.draftProductPhotoId=id;state.draftProductPhotoFile=file;await persistDraft();form.querySelector('.chosen-product-photo')?.remove();el.insertAdjacentHTML('afterend',`<img class="product-photo chosen-product-photo" data-product-photo="${esc(id)}" alt="Photo choisie" hidden>`);void hydratePhotos();}).catch(e=>toast(e.message,true));
    }
    void persistDraft().catch(()=>toast('Le brouillon n’a pas pu être sauvegardé.',true));
  });
  document.addEventListener('input',()=>{void persistDraft().catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{void persistDraft();if(!document.hidden)void notifyOverdue();});
  window.addEventListener('pagehide',()=>void persistDraft());
  window.addEventListener('ek-product-images',()=>void hydratePhotos());
  Store.onChange(()=>{void notifyOverdue();void refreshUndo();});
  new MutationObserver(()=>{
    const form=document.querySelector('#dialog [data-form]'),key=draftKey(form);if(!form||form.dataset.draftReady||!key)return;
    form.dataset.draftReady='1';form.dataset.draftBaseline=draftFingerprint(draftValue(form));onModalClose(()=>{void persistDraft();});
    Store.meta(key).then(d=>{if(d&&form.isConnected&&!form.dataset.restored)form.insertAdjacentHTML('afterbegin',`<div class="info-note">Un brouillon existe pour ce formulaire. ${opsButton('Restaurer le brouillon','resume-draft',`data-key="${esc(key)}"`)}</div>`);});
  }).observe(document.querySelector('#dialog-body'),{childList:true,subtree:true});
  void notifyOverdue();void refreshUndo();
}


let undoRevision=0,undoTarget;
export async function refreshUndo(){
 const rev=++undoRevision,scope=Store.scope(),info=await Store.undoInfo();if(rev!==undoRevision||scope!==Store.scope())return;
 let bar=document.querySelector('#undo-bar');if(!bar){bar=document.createElement('aside');bar.id='undo-bar';bar.setAttribute('aria-label','Annulation de la dernière modification');document.body.append(bar);}
 bar.hidden=!info||info.dismissed===true;document.body.classList.toggle('has-undo',!bar.hidden);if(bar.hidden)return;
 bar.innerHTML=`<span><small>Dernière modification</small><strong>${esc(info.action)}</strong></span>${opsButton('Annuler','quick-undo','data-undo-id="'+esc(Store.undoId(info))+'"')}<button type="button" class="icon-button" data-ops-action="hide-undo" data-undo-id="${esc(Store.undoId(info))}" aria-label="Masquer le raccourci d’annulation">×</button>`;
}
