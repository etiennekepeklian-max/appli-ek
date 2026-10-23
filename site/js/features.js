import * as Store from './storage.js';
import {state,esc,icon,modal,closeModal,onModalClose,toast,btn,download,fmt} from './ui.js';
import {voiceCode,validBarcode,spokenInteger} from './core.js';
import {findProducts,familyName} from './model.js';

const scripts=new Map();
export function loadScript(path){if(scripts.has(path))return scripts.get(path);const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=path;s.onload=resolve;s.onerror=()=>{scripts.delete(path);reject(Error('Ce module est indisponible. Préparez-le hors ligne dans Réglages ou vérifiez votre connexion.'));};document.head.append(s);});scripts.set(path,p);return p;}
let recognition;
export function dictate(button){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){toast('La dictée n’est pas disponible dans ce navigateur. Utilisez le micro du clavier de votre téléphone ou saisissez le texte.',true);return;}
  const input=document.getElementById(button.dataset.target);if(!input)return;
  if(recognition){recognition.stop();recognition=null;return;}
  recognition=new Recognition();recognition.lang='fr-FR';recognition.continuous=false;recognition.interimResults=false;
  button.classList.add('listening');button.setAttribute('aria-label','Arrêter la dictée');
  recognition.onresult=e=>{try{const text=e.results[0][0].transcript;input.value=input.type==='number'?spokenInteger(text):button.dataset.code==='1'?voiceCode(text).value:text;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();toast('Dictée insérée. Vérifiez le texte avant de confirmer.');}catch(error){toast(error.message,true);}};
  recognition.onerror=e=>{toast(e.error==='not-allowed'?'Autorisez le microphone dans les réglages du navigateur.':'La dictée n’a pas abouti. Vous pouvez réessayer ou saisir le texte.',true);};
  recognition.onend=()=>{recognition=null;button.classList.remove('listening');button.setAttribute('aria-label','Dicter');};recognition.start();
}
export function stopDictation(){recognition?.stop();recognition=null;}
export function barcodeSVG(value,format='CODE128',stars=false){
  const payload=stars&&format==='CODE128'?`*${value}*`:value;
  validBarcode(payload,format);if(!window.JsBarcode)throw Error('Le générateur de codes-barres n’est pas chargé.');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  JsBarcode(svg,payload,{format,width:2,height:92,displayValue:true,font:'monospace',fontSize:17,textMargin:8,margin:22,lineColor:'#000000',background:'#ffffff'});
  svg.setAttribute('role','img');svg.setAttribute('aria-label',`${format} : ${payload}`);return svg;
}
export async function generateBarcode(value,format='CODE128',stars=false,log=true){
  const svg=barcodeSVG(value,format,stars);const payload=stars&&format==='CODE128'?`*${value}*`:value;
  state.codeValue=value;state.codeFormat=format;state.codeStars=stars&&format==='CODE128';
  state.generated={value,format,stars:state.codeStars,payload,svg:svg.outerHTML};
  if(log){const existing=Store.list('codes').find(c=>c.value===value&&c.format===format&&!!c.stars===state.codeStars);const row=await Store.save('codes',{...existing,value,format,stars:state.codeStars,favourite:existing?.favourite||false},'Code-barres généré');state.generated.id=row.id;}
  showBarcode();return state.generated;
}
export function showBarcode(){if(!state.generated)return;const stage=document.querySelector('#barcode-stage');if(stage){stage.innerHTML=state.generated.svg+`<p class="code-result-label">Texte lu : <strong class="mono">${esc(state.generated.payload)}</strong></p>`;document.querySelector('#code-actions').hidden=false;}}
export async function svgPNG(svg){
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const canvas=document.createElement('canvas');canvas.width=img.naturalWidth*2;canvas.height=img.naturalHeight*2;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png');}finally{URL.revokeObjectURL(url);}
}
const safeName=s=>s.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60)||'code';
export async function exportCode(format){const g=state.generated;if(!g)throw Error('Générez un code avant de l’exporter.');const name=safeName(g.value);
  if(format==='svg'){download(new Blob([g.svg],{type:'image/svg+xml'}),`code-${name}.svg`);return;}
  const png=await svgPNG(g.svg);
  if(format==='png'){const blob=await (await fetch(png)).blob();download(blob,`code-${name}.png`);return;}
  const pdf=new jspdf.jsPDF({orientation:'landscape',format:'a5'});pdf.setFontSize(14);pdf.text('EK Logistique · '+g.format,15,20);const img=pdf.getImageProperties(png);const w=175,h=w*img.height/img.width;pdf.addImage(png,'PNG',17,35,w,Math.min(85,h));pdf.setFontSize(9);pdf.text('Texte lu : '+g.payload,17,133);download(pdf.output('blob'),`code-${name}.pdf`);
}
export async function compareCodes(){
  const input=document.querySelector('#code-input')?.value?.trim()||state.codeValue||'001234';
  const g1=barcodeSVG(input,'CODE128',false),g2=barcodeSVG(input,'CODE128',true);
  const s=Store.settings();let custom='';
  if(s.fontId){const f=await Store.readFile(s.fontId);if(f){const url=URL.createObjectURL(f.blob);const face=new FontFace('EKCustomTest',`url(${url})`);try{await face.load();document.fonts.add(face);custom=`<h3 class="modal-subheading">Essai avec la police importée</h3><p class="hint">Affichage brut avec la police « ${esc(s.fontName)} ». Son encodage doit être confirmé ; cet essai ne remplace pas le Code 128 standard.</p><div style="font-family:EKCustomTest;font-size:64px;overflow-wrap:anywhere;margin:20px 0;background:white;color:black">${esc(input)}<br>${esc('*'+input+'*')}</div>`;}finally{URL.revokeObjectURL(url);}}}
  modal('Comparer la lecture sur Honeywell',`<p class="dialog-intro">Testez les codes sur votre terminal. Vérifiez aussi le texte reçu, notamment les zéros du début et les étoiles. Ces boutons enregistrent uniquement votre propre constat de lecture.</p><div class="responsive-cards"><section class="batch-label"><h3>A · Code 128 standard</h3>${g1.outerHTML}<p class="hint">Texte attendu : <span class="mono">${esc(input)}</span></p>${btn('Lecture A correcte','test-barcode-result','check','small',`data-stars="0"`)}</section><section class="batch-label"><h3>B · Code 128 avec étoiles</h3>${g2.outerHTML}<p class="hint">Texte attendu : <span class="mono">${esc('*'+input+'*')}</span></p>${btn('Lecture B correcte','test-barcode-result','check','small',`data-stars="1"`)}</section></div>${custom}<div class="info-note">Ajouter des étoiles à un Code 128 ajoute les caractères « * » aux données. Si le terminal réclame un format différent, choisissez le Code 39 dans le générateur ou vérifiez la convention avec Adrien.</div><div class="form-actions">${btn('Fermer','close-dialog')}</div>`,true);
}
export function batchDialog(){modal('Planche de codes-barres',`<form data-form="batch-codes"><div class="field"><label for="batch-values">Une référence par ligne</label><textarea id="batch-values" name="values" rows="7" placeholder="REA1\nREA2\nTRJDUPOR" required></textarea><p class="hint">100 codes au maximum par planche. Les doublons sont conservés si vous avez besoin de plusieurs exemplaires.</p></div><label class="check-label section-gap"><input name="stars" type="checkbox">Ajouter les étoiles aux données du Code 128</label><div class="form-actions"><button class="btn primary" type="submit">Créer la planche</button></div></form><div id="batch-output"></div>`,true);}
let batchItems=[];
export function createBatch(text,stars){const values=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!values.length||values.length>100)throw Error('Indiquez entre 1 et 100 références, une par ligne.');batchItems=values.map(value=>({value,stars,svg:barcodeSVG(value,'CODE128',stars).outerHTML}));document.querySelector('#batch-output').innerHTML=`<div class="actions section-gap">${btn('Télécharger le PDF','batch-pdf','download','primary')}${btn('Imprimer','print','print')}</div><div class="section-gap">${batchItems.map(i=>`<div class="batch-label">${i.svg}</div>`).join('')}</div>`;}
export async function batchPDF(){if(!batchItems.length)return;const pdf=new jspdf.jsPDF();let y=15;for(const item of batchItems){if(y+48>282){pdf.addPage();y=15;}const png=await svgPNG(item.svg);const props=pdf.getImageProperties(png);const width=Math.min(178,props.width/props.height*40);pdf.addImage(png,'PNG',(210-width)/2,y,width,40);y+=50;}download(pdf.output('blob'),'codes-barres-ek.pdf');}
let scannerControls,scanStream,scanTimer,scanActive=false;
export function stopCamera(){scanActive=false;scannerControls?.stop();scannerControls=null;scanStream?.getTracks().forEach(t=>t.stop());scanStream=null;clearTimeout(scanTimer);}
export async function startCamera(){
  stopCamera();if(!navigator.mediaDevices?.getUserMedia)throw Error('La caméra nécessite une adresse HTTPS ou localhost. Vous pouvez utiliser une photo ou saisir le code.');
  const container=document.querySelector('#camera-container');container.innerHTML=`<div class="camera-frame"><video id="scan-video" class="camera-video" autoplay muted playsinline></video></div><div class="actions section-gap">${btn('Arrêter la caméra','stop-camera','close')}</div><p class="hint section-gap">Alignez le code et maintenez le téléphone immobile.</p>`;
  const video=document.querySelector('#scan-video');scanActive=true;
  try{
    if('BarcodeDetector' in window){const supported=await BarcodeDetector.getSupportedFormats();const formats=['code_128','code_39','code_93','ean_13','ean_8','upc_a','upc_e','itf','qr_code','data_matrix','pdf417','aztec','codabar'].filter(x=>supported.includes(x));if(!formats.length)throw Error('native-unavailable');const detector=new BarcodeDetector({formats});scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1600}},audio:false});video.srcObject=scanStream;await video.play();const tick=async()=>{if(!scanActive)return;try{const results=await detector.detect(video);if(results.length){stopCamera();await lookupProduct(results[0].rawValue);return;}}catch{}scanTimer=setTimeout(tick,220);};tick();return;}
    throw Error('native-unavailable');
  }catch(error){
    if(error.name==='NotAllowedError'||error.name==='NotFoundError'){stopCamera();throw Error(error.name==='NotAllowedError'?'Autorisez la caméra dans les réglages du navigateur.':'Aucune caméra n’a été trouvée sur cet appareil.');}
    scanStream?.getTracks().forEach(t=>t.stop());scanStream=null;
    await loadScript('vendor/zxing-browser.min.js');const reader=new ZXingBrowser.BrowserMultiFormatReader();
    try{scannerControls=await reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}},audio:false},video,(result,error,controls)=>{if(result&&scanActive){controls.stop();stopCamera();lookupProduct(result.getText()).catch(e=>toast(e.message,true));}});}catch(e){stopCamera();throw Error('Impossible d’ouvrir la caméra. Vous pouvez choisir une photo ou saisir le code.');}
  }
}
export async function scanPhoto(file){await loadScript('vendor/zxing-browser.min.js');const url=URL.createObjectURL(file);try{const reader=new ZXingBrowser.BrowserMultiFormatReader();const result=await reader.decodeFromImageUrl(url);await lookupProduct(result.getText());}catch{throw Error('Aucun code lisible sur cette photo. Cadrez le code entier, net et sans reflet, puis réessayez.');}finally{URL.revokeObjectURL(url);}}
export async function lookupProduct(raw){const code=String(raw).trim();if(!code)throw Error('Saisissez un code.');state.scanResult={code};const el=document.querySelector('#scan-result');if(!el)return;
  let matches=findProducts(code);const unique=new Map(matches.map(p=>[`${p.sku}:${p.barcode}:${p.name}`,p]));matches=[...unique.values()];
  const searchURL='https://www.google.com/search?q='+encodeURIComponent('"'+code+'" produit');
  if(matches.length){el.innerHTML=`<p class="hint">Code lu : <strong class="mono">${esc(code)}</strong></p>${matches.length>1?`<div class="info-note amber">Plusieurs correspondances existent pour ce code. Vérifiez la désignation du produit.</div>`:''}${matches.slice(0,20).map(p=>`<section class="section-gap"><div class="eyebrow">${p.sourceUrl?'Catalogue public Draeger Paris':'Votre référence'}</div><h2 style="font-size:21px;line-height:1.4">${esc(p.name)}</h2><div class="pill-list section-gap"><span class="pill mono">Réf. ${esc(p.sku)}</span><span class="pill">${esc(familyName(p.familyId))}</span></div><p class="hint section-gap">EAN : ${esc(p.barcode||'Non renseigné')}<br>Unités par picking : ${p.unitsPerPick||'À renseigner'}</p><div class="actions section-gap">${btn('Créer le code','code-from-product','barcode','small primary',`data-code="${esc(p.sku||code)}"`)}${btn('Compléter la fiche','edit-product','edit','small',`data-id="${esc(p.id)}"`)}</div>${p.sourceUrl?`<p class="hint section-gap"><a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">Voir la fiche officielle ↗</a></p>`:''}</section>`).join('')}`;return;}
  el.innerHTML=`<p class="hint">Code lu : <strong class="mono">${esc(code)}</strong></p><h3 class="section-gap">Recherche en cours…</h3><span class="loader section-gap"></span>`;
  let found=[];
  if(navigator.onLine){try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6500);try{const url='https://fr.checkout.draegerparis.com/search/suggest.json?'+new URLSearchParams({q:code,'resources[type]':'product','resources[limit]':'5','resources[options][fields]':'title,variants.sku,variants.barcode'});const r=await fetch(url,{signal:controller.signal});if(r.ok){const data=await r.json();found=data.resources?.results?.products||[];}}finally{clearTimeout(timer);}}catch{}}
  if(state.scanResult?.code!==code||!el.isConnected)return;
  el.innerHTML=`<p class="hint">Code lu : <strong class="mono">${esc(code)}</strong></p>${found.length?`<h3 class="section-gap">Pistes trouvées sur le site officiel</h3><p class="hint">Vérifiez la référence avant de retenir une dénomination.</p>${found.map(p=>`<p class="section-gap"><a href="${esc(new URL(p.url,'https://fr.checkout.draegerparis.com').href)}" target="_blank" rel="noopener noreferrer">${esc(p.title)} ↗</a></p>`).join('')}`:'<h3 class="section-gap">Aucune correspondance certaine</h3><p class="small muted section-gap">Ce code peut être une référence interne ou un produit absent du catalogue public. Vous pouvez rechercher sa dénomination sur Internet ou créer sa fiche.</p>'}<div class="actions section-gap"><a class="btn" href="${searchURL}" target="_blank" rel="noopener noreferrer">${icon('search')}Rechercher sur Internet</a>${btn('Ajouter ce produit','new-product-from-scan','plus','primary',`data-code="${esc(code)}"`)}</div>`;
}
let ocrWorker;
export async function recognizePhoto(file,onProgress=()=>{}){
  await loadScript('vendor/ocr/tesseract.min.js');const absolute=path=>new URL(path,document.baseURI).href;
  if(!ocrWorker){onProgress('Préparation du moteur de lecture…');ocrWorker=await Tesseract.createWorker(['fra','eng'],1,{workerPath:absolute('vendor/ocr/worker.min.js'),corePath:absolute('vendor/ocr/core'),langPath:absolute('vendor/ocr/lang'),workerBlobURL:false,gzip:true,logger:m=>{if(m.status==='recognizing text')onProgress(`Lecture du document : ${Math.round((m.progress||0)*100)} %`);else if(m.status==='loading language traineddata')onProgress('Préparation des langues de reconnaissance…');}});}
  let source=file;try{const bitmap=await createImageBitmap(file);const factor=Math.min(1,2600/Math.max(bitmap.width,bitmap.height));if(factor<1){const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*factor);canvas.height=Math.round(bitmap.height*factor);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);source=canvas;}bitmap.close();}catch{}
  const {data}=await ocrWorker.recognize(source);onProgress('Texte lu. Vérifiez les références et les quantités.');return data.text;
}
export async function cacheOCR(){
  const response=await fetch('vendor/manifest.json');const manifest=await response.json();const paths=[];
  function walk(o){if(typeof o==='string'&&/ocr\//.test(o)&&!o.startsWith('http'))paths.push(o.startsWith('vendor/')?o:'vendor/'+o);else if(o&&typeof o==='object')for(const v of Object.values(o))walk(v);}
  walk(manifest);
  // Fixed list is independent from vendor manifest shape and caches all fallbacks.
  const filelist=await fetch('data/offline-assets.json').then(r=>r.json());const unique=[...new Set([...paths,...filelist.filter(p=>p.includes('vendor/ocr/'))])];
  if(!('caches' in window))throw Error('Le cache hors ligne n’est pas disponible dans ce navigateur.');
  const cache=await caches.open('ek-large-assets-v1');let count=0;for(const path of unique){const url=new URL(path,document.baseURI).href;const present=await cache.match(url);if(!present){const r=await fetch(url);if(!r.ok)throw Error('Un fichier OCR est indisponible : '+path);await cache.put(url,r);}count++;toast(`Préparation hors ligne : ${count} / ${unique.length}`);}toast('La lecture des photos est prête hors ligne.');
}
export async function viewPhoto(id){const f=await Store.readFile(id);if(f){const url=URL.createObjectURL(f.blob);modal('Document enregistré',`<img class="photo-preview" src="${url}" alt="${esc(f.name)}"><p class="hint">${esc(f.name)}</p>`);onModalClose(()=>URL.revokeObjectURL(url));}else{const d=Store.get('documents',id);if(d?.driveUrl)modal('Document sauvegardé sur Drive',`<p class="dialog-intro">Cette photo est disponible dans votre sauvegarde Google.</p><a class="btn primary" href="https://drive.google.com/file/d/${encodeURIComponent(d.driveId)}/view" target="_blank" rel="noopener noreferrer">Ouvrir le document dans Drive</a>`);else throw Error('Ce document n’est pas disponible sur cet appareil.');}}
