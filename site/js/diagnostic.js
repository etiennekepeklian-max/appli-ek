import * as Store from './storage.js';
import * as Local from './workbench-store.js';
import * as Sync from './sync.js';
import {VERSION,uid} from './core.js';
import {OCR_ASSETS} from './offline-core.js';
import {state,esc,pageHeading,nav,timestampLabel} from './ui.js';

const key='application-diagnostic-v1',reports=new Map();
let active,loading;
const statuses={pass:'Réussi',fail:'Échec',warn:'À vérifier',manual:'Essai manuel'};
const launch=(label,action)=>'<button type="button" class="btn primary" data-wb-action="'+action+'" '+(active?.scope===Store.scope()?'disabled':'')+'>'+label+'</button>';
const summary=report=>{
 const count=status=>report.rows.filter(r=>r.status===status).length;
 return count('pass')+' réussi(s) · '+count('fail')+' échec(s) · '+count('warn')+' point(s) à vérifier · '+count('manual')+' essai(s) manuel(s)';
};
function results(){
 const report=reports.get(Store.scope());
 if(!report)return '<p class="hint">Aucun contrôle enregistré pour cette session. Lancez une vérification.</p>';
 return '<p><strong>'+esc(active?.scope===Store.scope()?'Contrôle en cours…':summary(report))+'</strong></p><p class="hint">Pikéo '+esc(report.version)+' · '+esc(timestampLabel(report.at))+(report.kind==='photo'?' · Test photo uniquement.':'')+(report.version!==VERSION?' · Ancienne version : relancez le contrôle.':'')+(report.complete?'':' · Contrôle incomplet, à relancer.')+'</p><div class="diagnostic-results">'+report.rows.map(r=>'<article class="wb-subcard" data-diagnostic-id="'+esc(r.id)+'" data-diagnostic-status="'+esc(r.status)+'"><h3>'+esc(r.label)+'</h3><p><strong>'+esc(statuses[r.status]||'À vérifier')+'</strong> · '+esc(r.detail)+'</p>'+(r.route?nav('Ouvrir '+r.linkLabel,r.route,'arrow'):'')+'</article>').join('')+'</div>';
}
export function view(){
 return pageHeading('Vérifier l’application','Un bilan sur cet appareil, sans modifier vos fiches.')+'<div class="actions wb-back">'+nav('Tous mes outils','more','arrowleft')+'</div><section class="card"><h2>Diagnostic de Pikéo</h2><p class="hint">Calculs, feuilles multipages, catalogue, CSV, ENF, historique, sauvegardes, codes-barres, PDF et stockage. Des exemples fictifs sont utilisés ; aucun message n’est envoyé.</p><div class="actions section-gap">'+launch('Lancer la vérification','diagnostic')+'</div><p class="hint section-gap">Pour vérifier aussi le moteur OCR, lancez le test photo après ce contrôle. Au premier essai, il peut télécharger les fichiers de lecture.</p><div class="actions section-gap">'+launch('Tester la lecture photo','diagnostic-ocr')+'</div><div class="section-gap" data-diagnostic-results role="status" aria-live="polite" aria-busy="'+(active?.scope===Store.scope())+'">'+results()+'</div></section><section class="card section-gap"><h2>Ce qui demande un essai réel</h2><p>Le contrôle automatique ne certifie pas tous les usages. La netteté de vos feuilles, le terminal de lecture, le microphone, les vibrations, les autorisations Google et la réception d’un message se vérifient en situation.</p><p class="hint">Le dernier bilan reste sur cet appareil, par session. Il ne contient ni photo, ni référence de travail, ni message, ni identifiant Google et n’est pas envoyé à un service.</p><div class="actions section-gap">'+nav('Sauvegardes','storage','shield')+'<button type="button" class="btn" data-action="cache-ocr">Préparer l’OCR hors ligne</button></div></section>';
}
function paint(){
 if(state.route!=='diagnostic')return;
 const slot=document.querySelector('[data-diagnostic-results]');if(!slot)return;
 slot.innerHTML=results();slot.setAttribute('aria-busy',String(active?.scope===Store.scope()));
 for(const button of document.querySelectorAll('[data-wb-action="diagnostic"],[data-wb-action="diagnostic-ocr"]'))button.disabled=active?.scope===Store.scope();
}
export function mount(){
 const owner=Store.scope();paint();if(reports.has(owner)||loading===owner)return;
 loading=owner;void Local.meta(key).then(report=>{if(Store.scope()!==owner||reports.has(owner))return;if(report?.schema===1&&typeof report.version==='string'&&Number.isFinite(Date.parse(report.at))&&Array.isArray(report.rows)&&report.rows.length<=100&&report.rows.every(r=>r&&typeof r.id==='string'&&typeof r.label==='string'&&typeof r.detail==='string'&&statuses[r.status]))reports.set(owner,report);paint();}).catch(()=>{}).finally(()=>{if(loading===owner)loading=null;});
}
function workerInfo(){
 const worker=navigator.serviceWorker?.controller;if(!worker)return Promise.resolve(null);
 return new Promise(resolve=>{const channel=new MessageChannel();let done=false;const finish=data=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();resolve(data);};const timer=setTimeout(()=>finish(null),1500);channel.port1.onmessage=e=>finish(e.data);try{worker.postMessage({type:'PIKEO_DIAGNOSTIC'},[channel.port2]);}catch{finish(null);}});
}
async function localProbe(){
 // Separate disposable database. No production event, draft, photo or setting is written.
 const name='pikeo-diagnostic-'+uid();let db,expired=false;
 try{
  db=await new Promise((resolve,reject)=>{const q=indexedDB.open(name,1),timer=setTimeout(()=>{expired=true;reject(Error('Stockage trop lent'));},5000);q.onupgradeneeded=()=>q.result.createObjectStore('probe');q.onsuccess=()=>{clearTimeout(timer);if(expired){q.result.close();indexedDB.deleteDatabase(name);}else resolve(q.result);};q.onerror=()=>{clearTimeout(timer);reject(q.error);};});
  await new Promise((resolve,reject)=>{const tx=db.transaction('probe','readwrite'),s=tx.objectStore('probe');s.put('001234','test');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});
  const value=await new Promise((resolve,reject)=>{const q=db.transaction('probe').objectStore('probe').get('test');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  if(value!=='001234')throw Error('Lecture différente');
  // Also check that the active business database can be read, without writing to it.
  await Store.meta('lastSync');return {detail:'Lecture et écriture réussies dans une base de test séparée ; base métier lisible.'};
 }finally{
  db?.close();await new Promise((resolve,reject)=>{const q=indexedDB.deleteDatabase(name),timer=setTimeout(()=>reject(Error('Nettoyage du test à vérifier')),5000);q.onsuccess=()=>{clearTimeout(timer);resolve();};q.onerror=q.onblocked=()=>{clearTimeout(timer);reject(q.error||Error('Base de test occupée'));};});
 }
}
async function cachedResources(){
 const info=await workerInfo();
 if(!info?.shellCache)return {status:'warn',detail:'Le cache de cette version n’est pas identifiable. Rechargez après Vérifier la version.',route:'diagnostic',linkLabel:'le diagnostic'};
 const shell=await caches.open(info.shellCache),large=await caches.open(info.largeCache),url=p=>new URL(p,document.baseURI).href;
 const manifest=await shell.match(url('data/offline-assets.json'));if(!manifest)return {status:'warn',detail:'Liste du cache absente. Actualisez Pikéo avec Internet.'};
 const files=await manifest.json(),shellKeys=new Set((await shell.keys()).map(r=>r.url)),largeKeys=new Set((await large.keys()).map(r=>r.url));
 const missing=files.filter(p=>!p.startsWith('vendor/ocr/')&&!shellKeys.has(url(p))),ocr=OCR_ASSETS.filter(p=>!largeKeys.has(url(p))&&!shellKeys.has(url(p)));
 if(missing.length)return {status:'fail',detail:missing.length+' ressource(s) de l’application absente(s). Vérifiez la version avec Internet.'};
 return {status:ocr.length?'warn':'pass',detail:'Application en cache ('+(files.length-OCR_ASSETS.length)+' fichiers). '+(ocr.length?ocr.length+' ressource(s) OCR à préparer via Préparer l’OCR hors ligne.':'Les huit ressources OCR sont aussi disponibles hors ligne.')};
}
async function barcodeAndPDF(){
 const {barcodeSVG,svgPNG,loadScript}=await import('./features.js');
 await loadScript('vendor/zxing-browser.min.js');
 for(const format of ['CODE39','CODE128']){
  const svg=barcodeSVG('001234',format),png=await svgPNG(svg.outerHTML),reader=new ZXingBrowser.BrowserMultiFormatReader();
  if((await reader.decodeFromImageUrl(png)).getText()!=='001234')throw Error('Code différent');
 }
 const pdf=new window.jspdf.jsPDF();pdf.text('Pikeo test',10,10);if(pdf.output('blob').size<100)throw Error('PDF vide');
 return {detail:'Code 39 et Code 128 générés puis décodés avec leurs zéros ; PDF créé en mémoire.'};
}
async function photoCheck(){
 const canvas=document.createElement('canvas');canvas.width=1300;canvas.height=300;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';ctx.font='bold 60px Arial';ctx.fillText('REFERENCE 001234 QUANTITE 12',40,100);ctx.fillText('PAC001-A',40,210);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Image de test indisponible');
 const {recognizePhoto}=await import('./features.js'),text=await recognizePhoto(blob,()=>{},{table:true});
 if(!text.includes('001234')||!text.includes('12'))throw Error('Lecture différente');
 return {detail:'Une image fictive a été créée et lue localement. La qualité de vos propres photos reste à vérifier.'};
}
export async function run(ocr=false){
 const owner=Store.scope();if(active?.scope===owner)return;
 const token={scope:owner},current=()=>Store.scope()===owner&&active===token;
 active=token;const previous=reports.get(owner),keep=ocr&&previous?.version===VERSION&&previous.complete&&previous.kind==='full',report={schema:1,version:VERSION,kind:ocr&&!keep?'photo':'full',at:new Date().toISOString(),complete:false,rows:keep?[...previous.rows.filter(r=>r.id!=='ocr-live')]:[]};reports.set(owner,report);paint();
 try{
  const {businessChecks,runChecks}=await import('./diagnostic-core.js');
  const checks=ocr?[{id:'ocr-live',label:'Lecture OCR réelle d’une image de test',run:photoCheck,failure:'Lecture photo non réussie. Vérifiez le réseau, préparez l’OCR hors ligne puis réessayez.'}]:[
   {id:'storage',label:'Stockage local',run:localProbe,failure:'Stockage indisponible ou test interrompu. Vérifiez l’espace libre et conservez une copie de vos données.'},
   {id:'version',label:'Version ouverte et cache actif',run:async()=>{const info=await workerInfo();return {status:info?.version===VERSION?'pass':'warn',detail:info?.version===VERSION?'Interface et cache correspondent à Pikéo '+VERSION+'.':'Cache absent ou version différente. Utilisez Vérifier la version avec Internet.'};}},
   ...businessChecks(),
   {id:'documents',label:'Codes-barres, lecture et moteur PDF',run:barcodeAndPDF,failure:'Un générateur ou lecteur n’a pas répondu correctement. Actualisez Pikéo puis réessayez.'},
   {id:'cache',label:'Disponibilité hors ligne',run:cachedResources,failure:'Cache inaccessible. Actualisez avec Internet ; les données métier ne sont pas modifiées.'},
   {id:'recovery',label:'Dernier point local et synchronisation réussie',run:async()=>{const recovery=await import('./recovery.js'),points=await recovery.available(),last=await Store.meta('lastSync');return {status:points.length?'pass':'warn',detail:'Point local : '+(points[0]?timestampLabel(points[0].createdAt):'aucun')+'. Dernier succès Google : '+(last?timestampLabel(last):'aucun sur cet appareil')+'.',route:'storage',linkLabel:'les sauvegardes'};}},
   {id:'backup',label:'Import d’une sauvegarde JSON',run:async()=>{await Store.prepareImport({app:'EK Logistique',schema:1,events:[makeTestEvent()],files:[]});return {detail:'Format de sauvegarde validé sans import dans vos données.'};}},
   {id:'google',label:'Sauvegarde Google',run:()=>Sync.checkConnection(),failure:'Accès Google non confirmé. Vérifiez la connexion dans Sauvegardes ; aucun envoi n’a été déclenché.'},
   {id:'hardware',label:'Caméra, micro et terminal de l’entrepôt',run:()=>({status:'manual',detail:'Photographiez une feuille, écoutez un mémo et lisez un code sur le terminal pour vérifier le matériel.',route:'scan',linkLabel:'le scanner'})},
   {id:'alerts',label:'Notifications et vibration',run:()=>({status:'manual',detail:'Utilisez le bouton de test dans Horaires et alertes. Le navigateur peut suspendre les rappels.',route:'schedule',linkLabel:'les horaires'})},
   {id:'delivery',label:'Réception des messages entre collègues',run:()=>({status:'manual',detail:'Vérifiez un échange réel avec un collègue connecté. Ce diagnostic n’envoie aucun message.',route:'chat',linkLabel:'les messages'})}
  ];
  const result=await runChecks(checks,{current,onResult:async row=>{report.rows.push(row);paint();}});
  if(!result.cancelled&&current()){report.complete=true;await Local.setMeta(key,report);}
 }catch{
  if(current()){report.rows.push({id:'interrupted',label:'Diagnostic interrompu',status:'fail',detail:'Le contrôle n’a pas pu se terminer ou son bilan n’a pas pu être conservé. Relancez-le.'});}
 }finally{if(active===token)active=null;paint();}
}
function makeTestEvent(){return {id:'diagnostic-example',type:'orders',record:{id:'diagnostic-order',number:'EXEMPLE',date:'2026-01-05',total:3},updatedAt:'2026-01-05T12:00:00.000Z'};}
