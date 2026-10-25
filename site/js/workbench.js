import * as Sync from './sync.js';
import * as Store from './storage.js';
import * as Local from './workbench-store.js';
import * as Recovery from './recovery.js';
import * as AudioStore from './voice-store.js';
import * as Secrets from './secure-session.js';
import {sealJSON,openJSON,toBase64,fromBase64} from './secure-core.js';
import {VERSION,uid,localDate,dailyStats,toCSV,refKey} from './core.js';
import {KINDS,CAUSES,IMPROVEMENT_STATES,personalPreferences,resumeQueue,orderChanges,reminderMessage,handoffText,concurrentChanges,dayFeedback,endOfDayActions} from './workbench-core.js';
import {state,esc,fmt,icon,nav,pageHeading,field,check,modal,closeModal,toast,formError,download,jsonDownload,timestampLabel,onModalClose} from './ui.js';
import {products} from './model.js';

export const ROUTES={post:'Mon poste',resume:'Préparations à reprendre',instructions:'Consignes et rappels',handoff:'Passation',personal:'Mes préférences',progress:'Mes progrès',improvements:'Mes améliorations',storage:'Espace et sauvegardes',diagnostic:'Diagnostic hors ligne',training:'Prise en main',conflicts:'Modifications à comparer',exports:'Partager un bilan'};
let app,search='',revision=0,diagResult=[],lastCelebration='',timer,busy=new WeakSet(),drafts={};
const wbButton=(label,action,id='',kind='')=>'<button type="button" class="btn '+kind+'" data-wb-action="'+action+'" data-id="'+esc(id)+'">'+label+'</button>';
const small=(label,action,id='')=>wbButton(label,action,id,'small');
const link=(label,route,glyph='')=>nav(label,route,glyph);
const fullForm=(name,body,label='Enregistrer',attrs='')=>'<form data-wb-form="'+name+'" '+attrs+'><div class="form-grid mobile-one">'+body+'</div><p data-form-error class="error-message" role="alert" hidden></p><div class="form-actions"><button class="btn primary" type="submit">'+label+'</button></div></form>';
const back=()=>'<div class="actions wb-back">'+link('Mon poste','post','arrowleft')+'</div>';
const hint=text=>'<p class="hint">'+text+'</p>';
function hasQuery(row){return !search||[row.title,row.notes,row.sku,row.orderNumber].join(' ').toLocaleLowerCase('fr-FR').includes(search.toLocaleLowerCase('fr-FR'));}
function rowActions(r){return '<div class="actions section-gap">'+small('Modifier','edit',r.id)+small('Retirer','remove',r.id)+'</div>';}
function listCards(kind,extra=()=>'',empty='Aucune fiche pour le moment.'){
 const rows=Local.list(kind).filter(hasQuery);
 return rows.length?rows.map(r=>'<article class="card wb-record section-gap"><h2>'+esc(r.title)+'</h2>'+hint(esc(r.date)+(r.author?' · '+esc(r.author):''))+(r.notes?'<p class="small wb-pre">'+esc(r.notes)+'</p>':'')+extra(r)+rowActions(r)+'</article>').join(''):'<p class="info-note">'+empty+'</p>';
}
function recordHeading(title,kind,description=''){return pageHeading(title,description,wbButton('Ajouter','new',kind,'primary'))+back();}
function hub(){
 const options=[['resume','Reprendre une préparation','Ligne, bac, casier et commandes débloquées','clock'],['instructions','Consignes et lexique','Fiches datées, rappels et définitions','list'],['handoff','Préparer une passation','Choisir les commandes et relire le partage','arrow'],['progress','Mes progrès','Bilan, entraide et objectif personnel','chart'],['improvements','Mes améliorations','Une idée, un essai et son résultat','edit'],['training','Prise en main','Essayer les gestes en démonstration','help'],['exports','Partager un bilan','Choisir la période et les informations','download'],['conflicts','Modifications à comparer','Choisir les bonnes valeurs sans perdre l’historique','history'],['storage','Espace et sauvegardes','Points locaux et sauvegardes chiffrées','shield'],['diagnostic','Tester le hors ligne','Contrôler les ressources et le stockage','sync'],['personal','Mes préférences','Lecture, utilisation à une main et rappels','settings']];
 const equipment=Local.list('equipment');
 return pageHeading('Mon poste','Les repères utiles, à votre rythme.')+'<section class="card"><div class="card-header"><h2>Mon matériel au départ</h2>'+small('Définir le matériel','new','equipment')+'</div>'+hint('Choisissez les contrôles réellement utiles à votre poste. La liste est à définir avec vous.')+(equipment.length?equipment.map(r=>'<div class="wb-equipment-row"><label class="check-label wb-equipment"><input type="checkbox" data-wb-equipment="'+esc(r.id)+'" '+(r.checkedDate===localDate()?'checked':'')+'><span>'+esc(r.title)+(r.notes?'<small>'+esc(r.notes)+'</small>':'')+'</span></label>'+small('Modifier','edit',r.id)+'</div>').join(''):hint('Aucun matériel imposé. Ajoutez vos premiers contrôles.'))+'</section><div class="tool-list section-gap">'+options.map(([route,title,description,glyph])=>'<button type="button" class="tool-row" data-nav="'+route+'"><span class="tool-icon">'+icon(glyph)+'</span><span><strong>'+title+'</strong><small>'+description+'</small></span>'+icon('arrowright')+'</button>').join('')+'</div>';
}
function resumeView(){
 const queue=resumeQueue(Store.list('pending')),resumes=Local.list('resume').filter(r=>!r.closed);
 return recordHeading('Reprendre une préparation','resume','Un repère manuel : aucun suivi de position en temps réel.')+'<section class="card"><h2>Débloquées par un réassort</h2>'+(queue.length?queue.map(g=>'<article class="wb-subcard"><h3>Commande '+esc(g.orderNumber)+'</h3><p class="small">'+(g.ready?'Toutes les références signalées sont reçues.':g.waiting.length+' référence(s) attendent encore leur réassort.')+'</p>'+wbButton('Créer mon repère de reprise','resume-order',g.orderNumber)+' '+link('Voir les manquants','pending','clock')+'</article>').join(''):hint('Les commandes avec un réassort reçu apparaîtront ici.'))+'</section>'+resumes.map(r=>'<article class="card wb-record section-gap"><h2>'+esc(r.orderNumber||r.title)+'</h2><dl class="record-facts"><div><dt>Ligne</dt><dd>'+esc(r.line||'Non précisée')+'</dd></div><div><dt>Bac / chariot / palette</dt><dd>'+esc(r.bin||'Non précisé')+'</dd></div><div><dt>Point de dépose</dt><dd>'+esc(r.location||'Non précisé')+'</dd></div></dl><p>'+esc(r.next||r.title)+'</p>'+hint(esc(r.notes||''))+(r.photo?'<img class="wb-photo" data-wb-photo="'+esc(r.id)+'" alt="Repère de dépose">':'')+'<div class="actions section-gap">'+small('J’ai repris cette préparation','finish-resume',r.id)+small('Modifier','edit',r.id)+'</div></article>').join('')+(!resumes.length?hint('Avant une interruption, notez seulement ce qui vous permettra de reprendre. La commande n’est pas clôturée par ce repère.'):'');
}
function instructionsView(){
 const type=['instruction','card','term'].includes(state.filter)?state.filter:'instruction';
 return pageHeading('Consignes et lexique','Une source et une date pour retrouver le bon repère.',wbButton('Ajouter','new',type,'primary'))+back()+'<div class="tabs">'+[['instruction','Consignes'],['card','Rappels courts'],['term','Lexique']].map(([v,t])=>'<button class="tab '+(type===v?'active':'')+'" data-wb-action="filter" data-id="'+v+'">'+t+'</button>').join('')+'</div><label class="field"><span>Rechercher</span><input id="wb-search" type="search" data-wb-search value="'+esc(search)+'" placeholder="Référence, titre ou mot…"></label>'+listCards(type,r=>hint((r.confirmed?'Repère confirmé par son auteur':'À confirmer')+(r.sku?' · Référence '+esc(r.sku):'')+(r.source?' · Source : '+esc(r.source):'')+(r.reviewDate?' · Revue : '+esc(r.reviewDate)+(r.reviewDate<localDate()?' — à revoir':''):'')));
}
function handoffView(){
 const rows=Store.list('pending').filter(r=>r.status!=='done');
 return pageHeading('Préparer une passation','Seules les informations sélectionnées seront partagées.')+back()+fullForm('handoff','<div class="field full">'+(rows.length?rows.map(r=>check('selected',esc(r.orderNumber)+' · '+esc(r.sku)+' · '+esc(r.location||'Sans casier'),false,'value="'+esc(r.id)+'"')).join(''):hint('Aucun manquant à transmettre.'))+'</div><div class="field full">'+check('includeNotes','Inclure les précisions des fiches sélectionnées',false)+'</div>','Prévisualiser la passation');
}
function improvementsView(){
 return recordHeading('Mes améliorations','improvement','Conserver une idée et suivre ce que son essai apporte.')+listCards('improvement',r=>'<p><strong>'+esc(IMPROVEMENT_STATES.find(s=>s[0]===r.status)?.[1]||r.status)+'</strong></p>'+hint(r.owner?'Suivi avec '+esc(r.owner):'Responsable à préciser')+(r.result?'<p>Résultat : '+esc(r.result)+'</p>':''));
}
function progressView(){
 const date=state.date||localDate(),stats=dailyStats(date,Store.list('orders'),Store.list('days'),Store.settings().goal),feedback=dayFeedback(stats),goals=Local.list('goal'),active=goals.find(g=>g.active),dates=[...new Set([...Store.list('orders'),...Store.list('days')].map(r=>r.date).filter(Boolean))].sort().reverse().slice(0,30);
 const actions=endOfDayActions(Store.list('pending'),products().filter(p=>!p.location||!p.effectiveUnitsPerPick).length);
 return pageHeading('Mes progrès','Votre progression personnelle, sans classement imposé.')+back()+'<section class="card"><h2>'+esc(feedback.title)+'</h2><p class="section-gap"><strong>'+fmt(stats.commands)+'</strong> commande(s) · '+(stats.hasData?fmt(stats.total):'—')+' picking(s)</p>'+hint(stats.status==='estimated'?'Une estimation reste à confirmer.':'Le calcul reste distinct de la mesure officielle de l’entrepôt.')+'<div class="actions section-gap">'+link('Voir mon bilan','orders','chart')+wbButton('Revoir le retour de journée','feedback',date)+'</div></section><section class="card section-gap"><div class="card-header"><h2>Un petit objectif choisi</h2>'+small(active?'Modifier':'Choisir','new-goal',active?.id||'')+'</div>'+(active?'<h3>'+esc(active.title)+'</h3><p>'+fmt(active.progress)+' / '+fmt(active.target)+'</p><div class="actions section-gap">'+small('Ajouter un progrès','goal-plus',active.id)+small('Mettre en pause','goal-pause',active.id)+'</div>':hint('Un seul objectif à la fois, facultatif. Aucune série perdue à cause d’une pause.'))+'</section><section class="card section-gap"><h2>Reconnaitre l’entraide</h2>'+hint('Ce bilan reste personnel. Aucun message n’est envoyé automatiquement.')+wbButton('Noter une aide','new','gratitude')+Local.list('gratitude').slice(0,5).map(r=>'<p class="wb-subcard"><strong>'+esc(r.title)+'</strong><br>'+esc(r.person||'')+' · '+esc(r.date)+'</p>').join('')+'</section><section class="card section-gap"><h2>Mon ressenti, pour moi</h2>'+hint('Facultatif, conservé sur cet appareil, exclu des partages et de Google. Aucune interprétation médicale.')+wbButton('Noter mon ressenti','new','fatigue')+Local.list('fatigue').slice(0,5).map(r=>'<p class="small section-gap">'+esc(r.date)+' · '+r.level+' / 5 · '+esc(r.notes||'')+'</p>').join('')+'</section><section class="card section-gap"><h2>Préparer le prochain poste</h2>'+hint('Choisissez jusqu’à trois actions issues des problèmes observés. Vous pouvez les modifier ou les ignorer ; aucune consigne n’est inventée.')+(actions.length?actions.map((a,i)=>'<div class="wb-subcard"><strong>'+esc(a.title)+'</strong>'+hint(esc(a.notes))+small('Garder cette action','keep-day-action',String(i))+'</div>').join(''):hint('Aucune action suggérée actuellement.'))+listCards('day-action',()=>'', 'Les actions retenues apparaîtront ici.')+'</section><section class="card section-gap"><h2>Comparer deux journées</h2>'+hint('Choisissez vous-même deux situations comparables ; le volume ne décrit pas toute la difficulté.')+fullForm('compare-days',field('before','Première journée',dates[1]||dates[0]||localDate(),{type:'date',required:true})+field('after','Deuxième journée',dates[0]||localDate(),{type:'date',required:true})+'<div class="field full">'+check('comparable','Je considère ces deux journées comparables',false,'required')+'</div>','Comparer')+'</section><section class="card section-gap"><h2>Valider mes pas dans WeWard</h2>'+hint('La validation et les éventuelles récompenses restent dans WeWard. Pikéo ne valide pas les pas à votre place.')+'<a class="btn" href="https://www.wewardapp.com/" target="_blank" rel="noopener noreferrer">Ouvrir le site WeWard</a></section>';
}
function personalView(){
 const p=Local.preferences();
 return pageHeading('Mes préférences','Ces choix restent personnels à cet appareil.')+back()+fullForm('preferences',field('hand','Utilisation à une main',p.hand,{select:[{value:'both',label:'Disposition habituelle'},{value:'left',label:'Main gauche'},{value:'right',label:'Main droite'}],full:true})+field('textSize','Taille de lecture',p.textSize,{select:[{value:'normal',label:'Habituelle'},{value:'large',label:'Agrandie'}]})+field('celebration','Réussite de fin de journée',p.celebration,{select:[{value:'off',label:'Sans animation'},{value:'discreet',label:'Message discret'},{value:'festive',label:'Feu d’artifice bref'}]})+'<div class="field full">'+check('scanVisual','Confirmation visuelle des scans',p.scanVisual)+'</div>'+field('recoveryTimes','Mes rappels de récupération',p.recoveryTimes.join(', '),{full:true,placeholder:'Ex. 10:30, 14:00',hint:'Facultatifs, huit horaires maximum. Ils apparaissent lorsque l’application est ouverte ; aucune précision écran verrouillé n’est promise.'}))+'<section class="card section-gap"><h2>Mes raccourcis et mon apparence</h2>'+hint('Le thème, les sons, les vibrations et les raccourcis restent disponibles dans Réglages.')+link('Ouvrir mes réglages','settings','settings')+'</section>';
}
function trainingView(){
 return pageHeading('Prise en main','Essayer les gestes avec des exemples séparés.')+back()+'<section class="card"><h2>Trois gestes pour commencer</h2><ol class="wb-lessons"><li>Retrouver une référence et vérifier son nom.</li><li>Noter un manquant puis préparer le message pour JC.</li><li>Photographier les feuilles et vérifier le bilan proposé.</li></ol>'+hint('Les exercices utilisent la démonstration. Ils ne valident aucune habilitation ni procédure de votre employeur.')+'<button class="btn primary full" data-action="enter-demo">Ouvrir les exemples</button></section><section class="card section-gap"><h2>Retrouver un geste</h2>'+link('Consignes et rappels','instructions','list')+' '+link('Aide de l’application','help','help')+'</section>';
}
function conflictView(){
 const conflicts=concurrentChanges(Store.allEvents());
 return pageHeading('Modifications à comparer','Les branches de modification détectées restent dans l’historique.')+back()+hint('Les anciennes versions sans repère de départ restent consultables dans l’historique ; elles ne sont pas présentées comme des conflits certains.')+(conflicts.length?conflicts.map(g=>'<section class="card section-gap"><h2>'+esc(g.type)+' · '+esc(g.id)+'</h2><p>'+g.events.length+' modifications issues du même état.</p>'+wbButton('Comparer et choisir','conflict',g.events[0].id)+'</section>').join(''):'<section class="card section-gap"><p>Aucun conflit détecté.</p></section>')+link('Tout l’historique','history','history');
}
function exportView(){
 return pageHeading('Partager un bilan','Choisissez les informations utiles avant de transmettre.')+back()+fullForm('export',field('type','Contenu','orders',{select:[{value:'orders',label:'Commandes terminées'},{value:'pending',label:'Manquants et réassorts'}],full:true})+field('start','Du',localDate(),{type:'date',required:true})+field('end','Au',localDate(),{type:'date',required:true})+'<div class="field full">'+check('notes','Inclure les précisions saisies',false)+'</div>'+hint('Les notes peuvent contenir des informations privées ou client. Les mémos, messages, ressentis et paramètres de connexion sont exclus.'),'Vérifier l’export');
}
function storageView(){
 return pageHeading('Espace et sauvegardes','Vos points de restauration restent sur cet appareil.')+back()+'<section class="card"><h2>Espace utilisé</h2><div data-wb-storage role="status">Calcul en cours…</div><div class="actions section-gap">'+link('Gérer mes mémos','voice','mic')+' '+link('Diagnostic hors ligne','diagnostic','sync')+'</div>'+hint('Aucun document ni mémo n’est supprimé automatiquement.')+'</section><section class="card section-gap"><h2>Points de restauration locaux</h2>'+hint('Une copie est créée avant cette nouvelle version et avant une restauration. Elle reste dans le même navigateur ; gardez aussi une copie téléchargée pour changer d’appareil.')+wbButton('Créer un point maintenant','checkpoint','','primary')+'<div data-wb-snapshots class="section-gap"></div></section><section class="card section-gap"><h2>Clé personnelle et sauvegarde chiffrée</h2>'+hint('La clé de récupération est créée sur votre appareil. Conservez son fichier séparément de la sauvegarde. Elle n’est ni publiée ni envoyée à Google. Un PIN de quatre chiffres ne la remplace pas.')+'<p data-wb-key-status>'+ (Secrets.unlocked()?'Clé chargée pour cette session.':'Clé non chargée.')+'</p><div class="actions section-gap">'+wbButton('Créer une clé personnelle','create-key')+wbButton('Charger ma clé','load-key')+wbButton('Verrouiller','lock-key')+wbButton('Exporter une copie chiffrée','encrypted-export','','primary')+'</div><label class="field section-gap"><span>Restaurer une sauvegarde chiffrée</span><input type="file" accept=".json,.pikeo" data-wb-file="encrypted-import"></label>'+'<div class="actions section-gap">'+wbButton('Préparer une base Google chiffrée','prepare-google-migration')+wbButton('Récupérer mes documents Google','restore-cloud-files')+'</div>'+hint('Google doit être connecté. Les anciennes copies en clair sont conservées ; leur historique Google reste à gérer dans votre compte.')+hint('Les mémos vocaux conservent leur propre sauvegarde et restauration dans Mémos vocaux.')+'</section><section class="card section-gap"><h2>Revenir au code précédent</h2><a class="btn" href="'+Recovery.codeArchive('1.8.0')+'">Télécharger le code v1.8.0</a>'+hint('Le retour du code et la restauration des données sont deux opérations distinctes. Conservez vos saisies récentes avant de choisir un point ancien.')+'</section>';
}
function diagnosticView(){
 return pageHeading('Diagnostic hors ligne','Vérifier les outils avant une coupure de réseau.')+back()+'<section class="card"><p>Réseau : '+(navigator.onLine?'disponible selon le téléphone':'hors connexion')+'</p>'+wbButton('Lancer la vérification','diagnostic','','primary')+'<div class="section-gap" role="status">'+diagResult.map(r=>'<p><strong>'+esc(r.label)+' :</strong> '+esc(r.value)+'</p>').join('')+'</div>'+hint('Le contrôle vérifie les ressources disponibles maintenant. Il ne protège pas contre un effacement des données du navigateur.')+'</section><div class="actions section-gap"><button class="btn" data-action="cache-ocr">Préparer l’OCR hors ligne</button>'+link('Sauvegardes','storage','shield')+'</div>';
}
export function render(route){const views={post:hub,resume:resumeView,instructions:instructionsView,handoff:handoffView,personal:personalView,progress:progressView,improvements:improvementsView,storage:storageView,diagnostic:diagnosticView,training:trainingView,conflicts:conflictView,exports:exportView};return (views[route]||hub)();}

function recordForm(kind,row={}){
 const names={equipment:'Contrôle du matériel',resume:'Repère de reprise',instruction:'Consigne datée',card:'Fiche de rappel',term:'Mot du lexique',gratitude:'Reconnaissance de l’entraide',goal:'Petit objectif personnel',improvement:'Idée d’amélioration',fatigue:'Mon ressenti privé','day-action':'Action du prochain poste'};
 if(!KINDS.includes(kind))throw Error('Fiche inconnue.');if(!row.id&&drafts[kind])row={...row,...drafts[kind]};
 let body=field('title',kind==='equipment'?'Équipement ou contrôle utile':kind==='term'?'Mot ou sigle':'Titre',row.title||'',{required:true,full:true,attrs:'maxlength="160"'});
 if(kind==='resume')body+=field('orderNumber','Commande',row.orderNumber||'',{code:true})+field('line','Ligne à reprendre',row.line||'')+field('bin','Bac, chariot ou palette',row.bin||'')+field('location','Point de dépose',row.location||'',{code:true})+field('next','Prochain geste',row.next||'',{full:true,placeholder:'Ex. reprendre à la référence indiquée'})+'<label class="field full"><span>Photo du repère, si autorisée</span><input type="file" name="photo" accept="image/*" capture="environment"></label>';
 if(['instruction','card','term'].includes(kind))body+=field('sku','Référence concernée, si nécessaire',row.sku||'',{code:true,full:true})+field('author','Auteur / personne ayant confirmé',row.author||Store.settings().name,{full:true})+field('source','Source de la consigne',row.source||'',{full:true})+field('reviewDate','Date de prochaine revue',row.reviewDate||'',{type:'date'})+'<div class="field full">'+check('confirmed','Repère confirmé, dans ce contexte précis',!!row.confirmed)+'</div>';
 if(kind==='gratitude')body+=field('person','Collègue, facultatif',row.person||'')+field('direction','Aide',row.direction||'received',{select:[{value:'received',label:'J’ai reçu une aide'},{value:'given',label:'J’ai apporté une aide'}]});
 if(kind==='goal')body+=field('target','Nombre de petits progrès visés',row.target||1,{type:'number',required:true})+field('progress','Progrès déjà réalisés',row.progress||0,{type:'number',required:true})+'<div class="field full">'+check('active','Cet objectif est actif',row.active!==false)+'</div>';
 if(kind==='improvement')body+=field('status','État',row.status||'proposed',{select:IMPROVEMENT_STATES.map(([value,label])=>({value,label}))})+field('owner','À revoir avec, facultatif',row.owner||'')+field('result','Résultat de l’essai',row.result||'',{textarea:true,full:true});
 if(kind==='fatigue')body+=field('level','Ressenti du jour',row.level||3,{select:[{value:1,label:'1 — très fatigué'},{value:2,label:'2 — fatigué'},{value:3,label:'3 — moyen'},{value:4,label:'4 — plutôt en forme'},{value:5,label:'5 — en forme'}],full:true});
 body+=field('date','Date',row.date||localDate(),{type:'date',required:true})+field('notes',kind==='term'?'Définition et contexte':'Précisions facultatives',row.notes||'',{textarea:true,full:true,attrs:'maxlength="4000"'});
 modal(names[kind],hint(kind==='fatigue'?'Ce ressenti reste privé sur cet appareil. Il n’est ni partagé ni envoyé à Google.':kind==='equipment'?'Définissez votre matériel réel. Aucun équipement n’est imposé.':'Ces repères personnels ne remplacent pas les procédures officielles du site.')+fullForm('record',body,'Enregistrer','data-kind="'+kind+'" data-id="'+esc(row.id||'')+'"'));
 document.querySelector('#dialog').dataset.helpContext='wb-'+kind;const form=document.querySelector('[data-wb-form="record"]');onModalClose(()=>{if(form.dataset.saved)return;const d=Object.fromEntries(new FormData(form));delete d.photo;if(Object.values(d).some(v=>String(v).trim())){drafts[kind]=d;void Local.setMeta('form-'+kind,d).catch(()=>{});}});
}
function previewText(title,text){
 modal(title,'<label class="field"><span>Informations prêtes à copier</span><textarea readonly rows="10" data-wb-preview>'+esc(text)+'</textarea></label><div class="form-actions">'+wbButton('Copier','copy-preview','','primary')+'</div>');
 document.querySelector('#dialog').dataset.helpContext='handoff';
}
function compareOrder(id){
 const events=Store.getEvents('orders',id).filter(e=>!e.record.deleted);
 if(events.length<2){modal('Comparer une commande',hint('Cette commande ne possède qu’une version enregistrée. Aucune différence ne peut être calculée.'));return;}
 const versions=events.map((e,i)=>({value:e.id,label:timestampLabel(e.updatedAt)+' · '+(i===0?'actuelle':e.actor||'version précédente')}));
 modal('Comparer les versions de la commande',fullForm('compare-order',field('before','Version précédente',events[1].id,{select:versions,full:true})+field('after','Version à comparer',events[0].id,{select:versions,full:true}),'Afficher les différences','data-id="'+esc(id)+'"'));
 document.querySelector('#dialog').dataset.helpContext='wb-compare';
}
function showOrderChanges(a,b){
 const rows=orderChanges(a.record,b.record);
 modal('Ce qui a changé — commande '+b.record.number,hint('Quantités enregistrées dans les deux versions choisies. Aucun remplacement n’est effectué.')+(rows.length?'<div class="wb-differences">'+rows.map(r=>'<article class="wb-subcard"><strong>'+esc(r.sku)+'</strong><p>Avant : '+r.before+' · Après : '+r.after+'</p><p>'+esc(r.kind==='added'?'Référence ajoutée':r.kind==='removed'?'Référence retirée':'Quantité modifiée')+'</p></article>').join('')+'</div>':hint('Aucune différence de référence ou de quantité. Les autres champs restent consultables dans l’historique.')));
 document.querySelector('#dialog').dataset.helpContext='wb-compare';
}
async function showConflict(eventId){
 const group=concurrentChanges(Store.allEvents()).find(g=>g.events.some(e=>e.id===eventId));if(!group)throw Error('Ce conflit a déjà été traité.');
 const current=Store.get(group.type,group.id);if(!current)throw Error('Fiche introuvable.');
 const fields=[...new Set(group.events.flatMap(e=>Object.keys(e.record)))].filter(k=>!['id','updatedAt','_eventId'].includes(k)&&new Set(group.events.map(e=>JSON.stringify(e.record[k]))).size>1);
 modal('Choisir la bonne version',hint('Chaque version sera conservée dans l’historique. Le choix crée une nouvelle révision.')+group.events.map((e,i)=>'<section class="wb-subcard"><h3>Version '+(i+1)+' · '+esc(e.actor||'auteur non renseigné')+'</h3>'+hint(timestampLabel(e.updatedAt))+'<dl>'+fields.map(k=>'<dt>'+esc(k)+'</dt><dd class="wb-pre">'+esc(typeof e.record[k]==='object'?JSON.stringify(e.record[k]):e.record[k]??'')+'</dd>').join('')+'</dl>'+wbButton('Retenir cette version','resolve-conflict',e.id)+'</section>').join(''));
 const dialog=document.querySelector('#dialog');dialog.dataset.helpContext='conflicts';dialog.dataset.wbRevision=current._eventId;dialog.dataset.wbConflicts=JSON.stringify(group.events.map(e=>e.id));
}
async function storageInfo(root){
 const rev=++revision,estimate=await navigator.storage?.estimate?.().catch(()=>null),files=await Store.files(),memos=await AudioStore.listMemos(),summary=await Local.storageSummary(),points=await Recovery.available();
 if(!root.isConnected||rev!==revision)return;
 const mb=n=>(n/1048576).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Mo';
 const slot=root.querySelector('[data-wb-storage]');if(slot)slot.innerHTML='<p>Documents et photos métier : '+mb(files.reduce((n,f)=>n+f.blob.size,0))+'</p><p>Mémos vocaux : '+mb(memos.reduce((n,m)=>n+m.blob.size,0))+'</p><p>Photos de repère : '+mb(summary.photos)+'</p>'+hint(estimate?'Total du site estimé par le navigateur : '+mb(estimate.usage||0)+' / quota indicatif '+mb(estimate.quota||0)+'.':'Le navigateur ne fournit pas de quota précis.')+hint('Les totaux peuvent inclure le cache et les points de restauration. Aucune suppression automatique.');
 const box=root.querySelector('[data-wb-snapshots]');if(box)box.innerHTML=points.length?points.map(p=>'<article class="wb-subcard"><strong>'+esc(p.reason)+'</strong>'+hint(timestampLabel(p.createdAt)+' · '+p.eventCount+' révision(s), '+p.fileCount+' fichier(s)')+small('Préparer une restauration','restore-point',p.id)+'</article>').join(''):hint('Aucun point local disponible.');
}
async function diagnostic(){
 diagResult=[];
 try{const id='diagnostic-'+Date.now();await Local.setMeta(id,'ok');const ok=await Local.meta(id);diagResult.push({label:'Stockage local',value:ok==='ok'?'lecture et écriture réussies':'à vérifier'});await Local.setMeta(id,null);}catch{diagResult.push({label:'Stockage local',value:'indisponible — exportez vos données si possible'});}
 diagResult.push({label:'Service worker',value:navigator.serviceWorker?.controller?'actif':'non actif dans cet onglet'});
 for(const [label,path] of [['Application','index.html'],['OCR','vendor/ocr/tesseract.min.js'],['Modèle français','vendor/ocr/lang/fra.traineddata.gz']]){
  let cached=false;try{cached=!!await caches.match(new URL(path,location.href));}catch{}
  diagResult.push({label,value:cached?'ressource en cache':'cache absent ou inaccessible — préparer le hors ligne'});
 }
 const points=await Recovery.available();diagResult.push({label:'Dernier point local',value:points[0]?timestampLabel(points[0].createdAt):'aucun'});
 const sheet=await Store.meta('lastSync');diagResult.push({label:'Dernière synchronisation Google réussie',value:sheet?timestampLabel(sheet):'aucune sur cet appareil'});
 app.render();
}
async function exportEncrypted(){
 if(!Secrets.unlocked())throw Error('Chargez votre clé personnelle avant de créer la copie chiffrée.');
 const data=await Store.exportData(),raw=await Store.snapshotData();
 const body={app:'PikeoBackupPackage',schema:1,version:VERSION,data,metadata:raw.metadata.filter(r=>r.key.startsWith('draft-')||r.key==='day-capture'),personal:await portablePersonal(),schedule:localStorage.getItem('ek-work-schedule-'+(Store.isDemo()?'demo':'live'))};
 const sealed=await sealJSON(body,Secrets.key(),'backup');jsonDownload(sealed,'pikeo-'+VERSION+'-'+localDate()+'.pikeo');
}
function selectKeyFile(){
 const input=document.createElement('input');input.type='file';input.accept='.json,.pikeokey';input.addEventListener('change',async()=>{try{const f=input.files?.[0];if(!f)return;if(f.size>16384)throw Error('Choisissez le petit fichier de clé personnelle.');await Secrets.unlock(JSON.parse(await f.text()));toast('Clé chargée pour cette session.');app.render();}catch(e){toast(e.message,true);}});input.click();
}
async function readEncrypted(file){
 if(!file)return;if(!Secrets.unlocked())throw Error('Chargez d’abord votre clé personnelle.');
 if(file.size>200e6)throw Error('Cette copie dépasse 200 Mo.');const sealed=JSON.parse(await file.text()),body=await openJSON(sealed,Secrets.key(),'backup');
 if(body.app!=='PikeoBackupPackage'||body.schema!==1||body.data?.app!=='EK Logistique')throw Error('Cette copie ne contient pas une sauvegarde Pikéo compatible.');
 await Store.prepareImport(body.data);body.personal=await unpackPersonal(body.personal);Local.validateLocal(body.personal);state.wbImport=body;
 modal('Fusionner la sauvegarde chiffrée',hint('La clé a permis de vérifier le fichier. Les révisions et fichiers absents seront ajoutés ; vos saisies récentes sont conservées.')+'<p>'+body.data.events.length+' révision(s) · '+body.data.files.length+' fichier(s)</p><div class="form-actions">'+wbButton('Confirmer la fusion','confirm-import','','primary')+'</div>');
 document.querySelector('#dialog').dataset.helpContext='storage';
}
async function perform(button){
 const action=button.dataset.wbAction,id=button.dataset.id;
 if(action==='new')return recordForm(id);
 if(action==='edit'){const r=Local.get(id);if(r)return recordForm(r.kind,r);}
 if(action==='remove'){const r=Local.get(id);if(!r)throw Error('Fiche introuvable.');modal('Retirer ce repère ?',hint(esc(r.title))+'<div class="form-actions">'+wbButton('Confirmer le retrait','confirm-remove',id,'danger')+'</div>');return;}
 if(action==='confirm-remove'){await Local.remove(id);closeModal();app.render();return;}
 if(action==='sku-instructions'){search=id;state.filter='instruction';app.navigate('instructions');return;}
 if(action==='dismiss-reminder'){button.closest('.wb-recovery')?.remove();return;}
 if(action==='filter'){state.filter=id;app.render();return;}
 if(action==='resume-order')return recordForm('resume',{orderNumber:id,title:'Reprendre la commande '+id});
 if(action==='finish-resume'){const r=Local.get(id);await Local.save('resume',{...r,closed:true});app.render();toast('Repère terminé. Le statut de la commande reste distinct.');return;}
 if(action==='new-goal')return recordForm('goal',Local.get(id)||{});
 if(action==='goal-plus'){const r=Local.get(id);await Local.save('goal',{...r,progress:r.progress+1});app.render();return;}
 if(action==='goal-pause'){const r=Local.get(id);await Local.save('goal',{...r,active:false});app.render();return;}
 if(action==='keep-day-action'){const rows=endOfDayActions(Store.list('pending'),products().filter(p=>!p.location||!p.effectiveUnitsPerPick).length),r=rows[Number(id)];if(!r)throw Error('La suggestion a changé.');return recordForm('day-action',r);}
 if(action==='copy-preview'){const input=document.querySelector('[data-wb-preview]');try{await navigator.clipboard.writeText(input.value);toast('Texte copié.');}catch{input.focus();input.select();toast('Utilisez Copier dans le menu du téléphone.');}return;}
 if(action==='remind-jc'){const row=Store.get('pending',id);return previewText('Relance pour JC',reminderMessage(row,Store.list('pending')));}
 if(action==='compare-order')return compareOrder(id);
 if(action==='conflict')return showConflict(id);
 if(action==='resolve-conflict'){
  const dialog=document.querySelector('#dialog'),event=Store.allEvents().find(e=>e.id===id);if(!event)throw Error('Version introuvable.');
  if(Store.get(event.type,event.record.id)?._eventId!==dialog.dataset.wbRevision)throw Error('La fiche a changé. Rouvrez la comparaison.');
  const resolves=JSON.parse(dialog.dataset.wbConflicts||'[]');await Store.saveBatch([{type:event.type,record:event.record}],'Conflit relu et résolu',{resolves});closeModal();app.render();toast('Version retenue. Toutes les révisions sont conservées.');return;
 }
 if(action==='diagnostic')return diagnostic();
 if(action==='checkpoint'){await Recovery.makeSnapshot();app.render();toast('Point de restauration local créé.');return;}
 if(action==='restore-point'){const point=await Recovery.read(id);if(!point)throw Error('Copie introuvable.');modal('Revenir à ce point local ?',hint(point.reason+' · '+timestampLabel(point.createdAt))+'<p class="small">Un nouveau point sera créé avant de restaurer. Les fiches métier et repères retrouveront l’état choisi dans de nouvelles révisions. Les anciennes révisions seront conservées. Les mémos se restaurent séparément depuis leur section.</p><div class="form-actions">'+wbButton('Restaurer ce point','confirm-restore',id,'primary')+'</div>');document.querySelector('#dialog').dataset.helpContext='storage';return;}
 if(action==='confirm-restore'){await Recovery.restoreSnapshot(id);closeModal();app.render();toast('Point local restauré. Relisez vos fiches avant de synchroniser.');return;}
 if(action==='create-key'){
  if(Secrets.unlocked()){modal('Créer une autre clé ?',hint('La clé chargée ne sera plus utilisée pour cette session. Conservez-la pour ouvrir vos anciennes sauvegardes.')+'<div class="form-actions">'+wbButton('Créer une nouvelle clé','confirm-key','','primary')+'</div>');return;}
  return perform({dataset:{wbAction:'confirm-key'}});
 }
 if(action==='confirm-key'){const file=await Secrets.create();jsonDownload(file,'Pikeo-cle-personnelle-'+localDate()+'.pikeokey');return;}
 if(action==='load-key')return selectKeyFile();
 if(action==='lock-key'){Secrets.lock();app.render();toast('Clé retirée de cette session.');return;}
 if(action==='encrypted-export')return exportEncrypted();
 if(action==='confirm-import'){
  const body=state.wbImport;if(!body)throw Error('Rouvrez votre copie chiffrée.');
  await Recovery.makeSnapshot('Avant fusion d’une copie chiffrée');await Store.importData(body.data);await Store.restoreFilesAndDrafts({files:[],metadata:body.metadata||[]});await Local.restoreLocal(body.personal);if(body.schedule)localStorage.setItem('ek-work-schedule-'+(Store.isDemo()?'demo':'live'),body.schedule);applyPreferences();state.wbImport=null;closeModal();app.render();toast('Copie fusionnée. Vos révisions récentes restent conservées.');return;
 }
 if(action==='restore-cloud-files'){const count=await Sync.restoreCloudFiles();app.render();toast(count+' document(s) récupéré(s) sur cet appareil.');return;}
 if(action==='prepare-google-migration'){
  const info=await Sync.prepareEncryptedMigration();await Recovery.makeSnapshot('Avant la nouvelle base Google chiffrée');
  await Local.setMeta('google-before-encryption',Sync.connection().spreadsheetId);
  modal('Préparer une base Google chiffrée',hint('La lecture et la copie locale sont terminées. '+info.events+' révision(s) distante(s) ont été vérifiées. Les documents accessibles ont été récupérés.')+hint('La nouvelle base recevra les données chiffrées avec votre clé chargée. L’ancienne feuille et les anciens fichiers restent conservés : leurs anciennes données ne deviennent pas chiffrées rétroactivement.')+'<div class="actions section-gap">'+wbButton('Télécharger d’abord une copie chiffrée','encrypted-export')+wbButton('Créer et remplir la nouvelle base','confirm-google-migration','','primary')+'</div>');document.querySelector('#dialog').dataset.helpContext='storage';return;
 }
 if(action==='confirm-google-migration'){
  await Sync.createDatabase();await Store.markUnsynced();await Sync.sync();closeModal();app.render();toast('Nouvelle base chiffrée enregistrée. Conservez votre clé et votre ancienne copie.');return;
 }
 if(action==='download-export'){const data=state.wbExport;if(!data)throw Error('Rouvrez la préparation de l’export.');download(new Blob([data.csv],{type:'text/csv;charset=utf-8'}),'pikeo-bilan-'+data.start+'-'+data.end+'.csv');return;}
 if(action==='feedback')return celebrate(id,true);
}
async function submit(form){
 const d=Object.fromEntries(new FormData(form)),name=form.dataset.wbForm;
 if(name==='record'){
  const kind=form.dataset.kind,old=Local.get(form.dataset.id)||{};let photo=old.photo;
  const f=form.elements.photo?.files?.[0];if(f){const {compressProductPhoto}=await import('./photo-tools.js');photo=await compressProductPhoto(f);}
  await Local.save(kind,{...old,...d,id:form.dataset.id||undefined,photo,confirmed:!!d.confirmed,active:!!d.active});form.dataset.saved='1';delete drafts[kind];await Local.setMeta('form-'+kind,null);closeModal();app.render();toast('Repère enregistré sur cet appareil.');return;
 }
 if(name==='preferences'){const p=personalPreferences({...Local.preferences(),...d,scanVisual:!!d.scanVisual,recoveryTimes:String(d.recoveryTimes||'').split(/[,;\s]+/).filter(Boolean)});if(String(d.recoveryTimes||'').split(/[,;\s]+/).filter(Boolean).some(t=>!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('Utilisez des heures au format 10:30, séparées par des virgules.');Local.savePreferences(p);applyPreferences();toast('Préférences personnelles enregistrées.');return;}
 if(name==='handoff'){const ids=new FormData(form).getAll('selected'),rows=Store.list('pending').filter(r=>ids.includes(r.id));return previewText('Passation à relire',handoffText(rows,{includeNotes:!!d.includeNotes}));}
 if(name==='compare-order'){const events=Store.getEvents('orders',form.dataset.id),a=events.find(e=>e.id===d.before),b=events.find(e=>e.id===d.after);if(!a||!b||a.id===b.id)throw Error('Choisissez deux versions différentes.');return showOrderChanges(a,b);}
 if(name==='compare-days'){
  if(!d.comparable)throw Error('Confirmez que les deux situations sont comparables.');if(d.before===d.after)throw Error('Choisissez deux journées différentes.');
  const stats=date=>dailyStats(date,Store.list('orders'),Store.list('days'),Store.settings().goal),a=stats(d.before),b=stats(d.after);
  if(!a.hasData||!b.hasData)throw Error('Les deux journées doivent être enregistrées.');if(a.status==='estimated'||b.status==='estimated')throw Error('Confirmez les règles ou totaux estimés avant de comparer.');
  modal('Votre progression',hint('Comparaison choisie par vous ; aucune conclusion sur la difficulté des commandes.')+'<p>'+esc(d.before)+' : '+fmt(a.total)+' picking(s), '+a.commands+' commande(s).</p><p>'+esc(d.after)+' : '+fmt(b.total)+' picking(s), '+b.commands+' commande(s).</p><p>Écart de volume : '+fmt(b.total-a.total)+' picking(s).</p>'+hint('La qualité, l’entraide et les blocages résolus comptent aussi. Aucun objectif n’est relevé automatiquement.'));document.querySelector('#dialog').dataset.helpContext='progress';return;
 }
 if(name==='export'){
  if(!d.start||!d.end||d.start>d.end)throw Error('Choisissez une période valide.');
  const types=d.type==='pending'?'pending':'orders',rows=Store.list(types).filter(r=>{const date=r.date||String(r.createdAt||r.updatedAt).slice(0,10);return date>=d.start&&date<=d.end;});
  const headers=types==='orders'?['Commande','Date','Pickings','Qualité du calcul']:['Commande','Référence','Casier','État'];
  const values=rows.map(r=>types==='orders'?[r.number,r.date,r.total,r.calculationStatus]:[r.orderNumber,r.sku,r.location,r.status]);
  if(d.notes){headers.push('Précisions');rows.forEach((r,i)=>values[i].push(r.notes||''));}
  state.wbExport={csv:toCSV(headers,values),start:d.start,end:d.end};modal('Export à vérifier','<p>'+rows.length+' fiche(s), du '+esc(d.start)+' au '+esc(d.end)+'.</p>'+hint(d.notes?'Les précisions sont incluses : relisez-les avant de partager.':'Précisions, notes privées, mémos et connexions exclus.')+'<textarea readonly rows="8">'+esc(state.wbExport.csv.slice(0,12000))+'</textarea><div class="form-actions">'+wbButton('Télécharger ce CSV','download-export','','primary')+'</div>');document.querySelector('#dialog').dataset.helpContext='exports';return;
 }
}

async function portablePersonal(){
 const data=Local.localData();
 for(const r of data.records)if(r.photo instanceof Blob){r.photoData=toBase64(new Uint8Array(await r.photo.arrayBuffer()));r.photoType=r.photo.type;delete r.photo;}
 return data;
}
async function unpackPersonal(data){
 if(!Array.isArray(data?.records))throw Error('Repères personnels absents.');
 for(const r of data.records)if(r.photoData){const bytes=fromBase64(r.photoData);if(bytes.length>10e6||!/^image\/(?:jpeg|png|webp)$/.test(r.photoType))throw Error('Photo de repère invalide.');r.photo=new Blob([bytes],{type:r.photoType});delete r.photoData;delete r.photoType;}
 return data;
}
export async function open(demo=false){
 await Local.open(demo);drafts={};
 for(const kind of KINDS){const d=await Local.meta('form-'+kind);if(d)drafts[kind]=d;}
 applyPreferences();
 try{await Recovery.ensureVersionSnapshot();}catch(e){toast('Le point automatique n’a pas pu être créé : '+e.message,true);}
}
export function applyPreferences(){
 const p=Local.preferences();document.documentElement.dataset.hand=p.hand;document.documentElement.dataset.textSize=p.textSize;
}
const photoURLs=new Map();
export function productLinks(sku){return '<div class="actions section-gap">'+wbButton('Consignes de cette référence','sku-instructions',sku)+'</div>';}
export function enhance(root,route){
 applyPreferences();
 for(const [el,url] of photoURLs)if(!el.isConnected){URL.revokeObjectURL(url);photoURLs.delete(el);}
 for(const el of root.querySelectorAll('[data-wb-photo]')){const blob=Local.get(el.dataset.wbPhoto)?.photo;if(blob instanceof Blob){const url=URL.createObjectURL(blob);photoURLs.set(el,url);el.src=url;}else el.hidden=true;}
 if(route==='storage')void storageInfo(root).catch(e=>toast(e.message,true));
 if(route==='settings'){const google=root.querySelector('#google-settings');if(google)google.insertAdjacentHTML('afterbegin','<p class="info-note">Les nouveaux envois sont chiffrés. Chargez votre clé personnelle avant de synchroniser. Une ancienne base peut encore contenir des données en clair.</p><div class="actions section-gap">'+link('Charger ma clé / préparer la base chiffrée','storage','shield')+'</div>');}if(route==='settings')root.insertAdjacentHTML('beforeend','<section class="card section-gap"><h2>Mon environnement personnel</h2><div class="actions">'+link('Mes préférences','personal','settings')+link('Espace et sauvegardes','storage','shield')+link('Diagnostic hors ligne','diagnostic','sync')+'</div></section>');
 if(route==='home')root.insertAdjacentHTML('beforeend','<section class="card section-gap wb-home"><h2>Mes repères de travail</h2><div class="actions">'+link('Mon poste','post','box')+link('Reprendre une préparation','resume','clock')+link('Mes progrès','progress','chart')+'</div></section>');
 if(route==='pending'){
  root.querySelector('.filters')?.insertAdjacentHTML('afterend','<div class="actions section-gap">'+link('Préparations à reprendre','resume','clock')+link('Préparer une passation','handoff','arrow')+'</div>');
  for(const card of root.querySelectorAll('.pending-card')){
   const id=card.querySelector('[data-action="edit-pending"]')?.dataset.id,r=Store.get('pending',id);
   if(!r)continue;
   if(r.cause||r.nextAction)card.insertAdjacentHTML('beforeend',hint((r.cause?esc(CAUSES.find(c=>c[0]===r.cause)?.[1]||r.cause):'')+(r.nextAction?' · Suite : '+esc(r.nextAction):'')));
   if(['waiting','partial'].includes(r.status))card.insertAdjacentHTML('beforeend','<div class="actions section-gap">'+small('Préparer une relance JC','remind-jc',r.id)+'</div>');
  }
 }
 if(route==='orders')for(const button of root.querySelectorAll('[data-action="edit-order"]')){const id=button.dataset.id;if(Store.getEvents('orders',id).length>1)button.parentElement.insertAdjacentHTML('beforeend',small('Comparer les versions','compare-order',id));}
}
async function celebrate(date,manual=false){
 const stats=dailyStats(date||localDate(),Store.list('orders'),Store.list('days'),Store.settings().goal),feedback=dayFeedback(stats),p=Local.preferences();
 if(!manual){if(!feedback.celebrate||p.celebration==='off')return;if(!await Local.claim('celebration-'+date,{at:new Date().toISOString()}))return;}
 toast(feedback.title);
 if(!feedback.celebrate||p.celebration!=='festive'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 document.querySelector('.wb-celebration')?.remove();
 const el=document.createElement('div');el.className='wb-celebration';el.setAttribute('aria-hidden','true');el.innerHTML=Array.from({length:16},(_,i)=>'<i style="--n:'+i+'"></i>').join('');document.body.append(el);setTimeout(()=>el.remove(),1200);
}
async function recoveryReminder(){
 if(document.hidden)return;const now=new Date(),time=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),p=Local.preferences();
 if(!p.recoveryTimes.includes(time)||!await Local.claim('recovery-'+localDate()+'-'+time,{at:Date.now()}))return;
 document.querySelector('.wb-recovery')?.remove();
 const el=document.createElement('aside');el.className='wb-recovery';el.setAttribute('role','status');el.innerHTML='<strong>Un petit temps de récupération ?</strong><p>Si votre activité le permet, relâchez les épaules et prenez votre pause prévue.</p>'+wbButton('C’est noté','dismiss-reminder');document.body.append(el);
}
export function install(callbacks){
 app=callbacks;
 window.addEventListener('pikeo-key',()=>{if(['storage','settings'].includes(state.route))app.render();});
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-wb-action]');if(!button||button.disabled||busy.has(button))return;event.preventDefault();busy.add(button);button.disabled=true;
  Promise.resolve().then(()=>perform(button)).catch(e=>toast(e.message,true)).finally(()=>{busy.delete(button);button.disabled=false;});
 });
 document.addEventListener('submit',event=>{
  const form=event.target.closest('[data-wb-form]');if(!form)return;event.preventDefault();if(busy.has(form))return;busy.add(form);
  const buttons=[...form.querySelectorAll('[type="submit"]')];buttons.forEach(b=>b.disabled=true);
  submit(form).catch(e=>{if(form.isConnected)formError(form,e.message);else toast(e.message,true);}).finally(()=>{busy.delete(form);buttons.forEach(b=>b.disabled=false);});
 });
 document.addEventListener('change',event=>{
  const input=event.target;
  if(input.matches('[data-wb-equipment]')){const r=Local.get(input.dataset.wbEquipment);void Local.save('equipment',{...r,checkedDate:input.checked?localDate():''}).catch(e=>toast(e.message,true));}
  if(input.dataset.wbFile==='encrypted-import')void readEncrypted(input.files?.[0]).catch(e=>toast(e.message,true)).finally(()=>{input.value='';});
 });
 let searchTimer;
 document.addEventListener('input',event=>{if(!event.target.matches('[data-wb-search]'))return;search=event.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>app.render(),150);});
 window.addEventListener('pikeo-day-saved',event=>{void celebrate(event.detail.date).catch(e=>toast(e.message,true));});
 window.addEventListener('pikeo-scan-feedback',event=>{
  if(!Local.preferences().scanVisual)return;document.querySelector('.wb-scan-status')?.remove();
  const el=document.createElement('div'),kind=event.detail.kind;el.className='wb-scan-status '+(kind==='success'?'success':kind==='unknown'?'unknown':'failure');el.setAttribute('role','status');el.textContent=kind==='success'?'✓ Référence reconnue':kind==='unknown'?'? Code à identifier':'! Lecture à vérifier';document.body.append(el);setTimeout(()=>el.remove(),1800);
 });
 clearInterval(timer);timer=setInterval(()=>{void recoveryReminder().catch(()=>{});},20000);
}
