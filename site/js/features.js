import {lookupScannedProduct,cancelProductLookup,renderProductLookup} from './product-lookup.js';
export {cancelProductLookup,renderProductLookup};
import * as Mascot from './mascot.js';
import {layoutText} from './ocr-layout-core.js';
import * as Store from './storage.js';
import {state,esc,icon,modal,closeModal,onModalClose,toast,btn,download,fmt} from './ui.js';
import {voiceCode,validBarcode,spokenInteger} from './core.js';
import {findProducts,familyName} from './model.js';
import {CameraSession,cameraErrorMessage} from './camera.js';
import {scanFeedback,unlockFeedback} from './feedback.js';
import {recordUnknown,resolveUnknowns,hydratePhotos} from './ops.js';
import {productLocations} from './ops-core.js';
import {OCR_ASSETS} from './offline-core.js';
import {boundedOCR,abortableOCR,ocrAbortError} from './ocr-task.js';

const scripts=new Map();
export function loadScript(path){
  if(scripts.has(path))return scripts.get(path);
  const p=new Promise((resolve,reject)=>{
    const s=document.createElement('script'),finish=error=>{clearTimeout(timer);s.onload=s.onerror=null;if(error){scripts.delete(path);s.remove();reject(error);}else resolve();};
    const unavailable=()=>finish(Error('Ce module est indisponible. Préparez-le hors ligne dans Réglages ou vérifiez votre connexion.'));
    const timer=setTimeout(unavailable,25000);s.src=path;s.onload=()=>finish();s.onerror=unavailable;document.head.append(s);
  });
  scripts.set(path,p);return p;
}
let recognition;
export function dictate(button){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){toast('La dictée n’est pas disponible dans ce navigateur. Utilisez le micro du clavier de votre téléphone ou saisissez le texte.',true);return;}
  const input=document.getElementById(button.dataset.target);if(!input)return;
  if(recognition){recognition.stop();recognition=null;return;}
  window.dispatchEvent(new Event('pikeo-stop-pending-voice'));recognition=new Recognition();recognition.lang='fr-FR';recognition.continuous=false;recognition.interimResults=false;
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
export async function generateBarcode(value,format=Store.settings().barcodeFormat||'CODE39',stars=false,log=true){
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
  const pdf=new jspdf.jsPDF({orientation:'landscape',format:'a5'});pdf.setFontSize(14);pdf.text('Pikéo · '+g.format,15,20);const img=pdf.getImageProperties(png);const w=175,h=w*img.height/img.width;pdf.addImage(png,'PNG',17,35,w,Math.min(85,h));pdf.setFontSize(9);pdf.text('Texte lu : '+g.payload,17,133);download(pdf.output('blob'),`code-${name}.pdf`);
}
export async function compareCodes(){
  const input=document.querySelector('#code-input')?.value?.trim()||state.codeValue||'001234';
  const g1=barcodeSVG(input,'CODE128',false),g2=barcodeSVG(input,'CODE128',true);
  const s=Store.settings();let custom='';
  if(s.fontId){const f=await Store.readFile(s.fontId);if(f){const url=URL.createObjectURL(f.blob);const face=new FontFace('EKCustomTest',`url(${url})`);try{await face.load();document.fonts.add(face);custom=`<h3 class="modal-subheading">Essai avec la police importée</h3><p class="hint">Affichage brut avec la police « ${esc(s.fontName)} ». Son encodage doit être confirmé ; cet essai ne remplace pas le Code 128 standard.</p><div style="font-family:EKCustomTest;font-size:64px;overflow-wrap:anywhere;margin:20px 0;background:white;color:black">${esc(input)}<br>${esc('*'+input+'*')}</div>`;}finally{URL.revokeObjectURL(url);}}}
  modal('Comparer la lecture sur Honeywell',`<p class="dialog-intro">Testez les codes sur votre terminal. Vérifiez aussi le texte reçu, notamment les zéros du début et les étoiles. Ces boutons enregistrent uniquement votre propre constat de lecture.</p><div class="responsive-cards"><section class="batch-label"><h3>A · Code 128 standard</h3>${g1.outerHTML}<p class="hint">Texte attendu : <span class="mono">${esc(input)}</span></p>${btn('Lecture A correcte','test-barcode-result','check','small',`data-stars="0"`)}</section><section class="batch-label"><h3>B · Code 128 avec étoiles</h3>${g2.outerHTML}<p class="hint">Texte attendu : <span class="mono">${esc('*'+input+'*')}</span></p>${btn('Lecture B correcte','test-barcode-result','check','small',`data-stars="1"`)}</section></div>${custom}<div class="info-note">Ajouter des étoiles à un Code 128 ajoute les caractères « * » aux données. Si le terminal réclame un format différent, choisissez le Code 39 dans le générateur ou vérifiez la convention avec Adrien.</div><div class="form-actions">${btn('Fermer','close-dialog')}</div>`,true);
}
export function batchDialog(){modal('Planche de codes-barres',`<form data-form="batch-codes"><div class="field"><label for="batch-values">Une référence par ligne</label><textarea id="batch-values" name="values" rows="7" placeholder="REA1\nREA2\nTRJDUPOR" required></textarea><p class="hint">100 codes au maximum par planche. Les doublons sont conservés si vous avez besoin de plusieurs exemplaires.</p></div><div class="field section-gap"><label for="batch-format">Format des codes</label><select name="format" id="batch-format"><option value="CODE39">Code 39 — compatible C39HrP24DhTt</option><option value="CODE128">Code 128</option></select></div><label class="check-label section-gap"><input name="stars" type="checkbox">Ajouter les étoiles aux données (Code 128 uniquement)</label><div class="form-actions"><button class="btn primary" type="submit">Créer la planche</button></div></form><div id="batch-output"></div>`,true);}
let batchItems=[];
export function createBatch(text,stars,format='CODE39'){const values=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!values.length||values.length>100)throw Error('Indiquez entre 1 et 100 références, une par ligne.');batchItems=values.map(value=>({value,stars:stars&&format==='CODE128',format,svg:barcodeSVG(value,format,stars).outerHTML}));document.querySelector('#batch-output').innerHTML=`<div class="actions section-gap">${btn('Télécharger le PDF','batch-pdf','download','primary')}${btn('Imprimer','print','print')}</div><div class="section-gap">${batchItems.map(i=>`<div class="batch-label">${i.svg}</div>`).join('')}</div>`;}
export async function batchPDF(){if(!batchItems.length)return;const pdf=new jspdf.jsPDF();let y=15;for(const item of batchItems){if(y+48>282){pdf.addPage();y=15;}const png=await svgPNG(item.svg);const props=pdf.getImageProperties(png);const width=Math.min(178,props.width/props.height*40);pdf.addImage(png,'PNG',(210-width)/2,y,width,40);y+=50;}download(pdf.output('blob'),'codes-barres-ek.pdf');}
let scannerControls,scanTimer,scanRun=0,cameraSession;
const cameraPreference='ek-preferred-camera';
function getCameraSession(){
  return cameraSession||=new CameraSession({
    mediaDevices:navigator.mediaDevices,
    recall:()=>{try{return localStorage.getItem(cameraPreference)||'';}catch{return '';}},
    remember:id=>{try{localStorage.setItem(cameraPreference,id);}catch{}}
  });
}
function stopDecoder(){
  clearTimeout(scanTimer);
  const controls=scannerControls;scannerControls=null;
  try{controls?.stop();}catch{}
}
export function stopCamera(){
  scanRun++;stopDecoder();cameraSession?.stop();
  const container=document.querySelector('#camera-container');
  container?.removeAttribute('aria-busy');
  if(container?.querySelector('#scan-video')){
    const video=container.querySelector('#scan-video');video.pause();video.srcObject=null;
    container.innerHTML=btn('Rouvrir la caméra','start-camera','camera','primary full')+'<p class="hint section-gap">Caméra arrêtée. Votre dernier objectif sera réutilisé.</p>';
  }
}
export async function startCamera(){
  unlockFeedback();
  stopCamera();
  if(!navigator.mediaDevices?.getUserMedia)throw Error('La caméra nécessite une adresse HTTPS ou localhost. Vous pouvez utiliser une photo ou saisir le code.');
  const container=document.querySelector('#camera-container');if(!container)return;
  container.innerHTML='<div class="camera-picker"><label for="scan-camera">Caméra utilisée</label><select id="scan-camera" aria-describedby="camera-hint" disabled><option>Autorisez la caméra pour voir les objectifs…</option></select><p class="hint" id="camera-hint">Les caméras disponibles apparaissent après votre autorisation.</p></div><div class="camera-frame"><video id="scan-video" class="camera-video" autoplay muted playsinline></video></div><div class="camera-actions section-gap">'+btn('Changer de caméra','next-camera','sync')+btn('Arrêter','stop-camera','close')+'</div><p id="camera-status" class="hint section-gap" role="status" aria-live="polite">Ouverture de la caméra…</p>';
  container.querySelector('[data-action="next-camera"]').disabled=true;
  await openCamera();
}
export async function changeCamera(deviceId){
  if(deviceId&&deviceId===cameraSession?.deviceId&&cameraSession?.stream)return;
  await openCamera(deviceId);
}
export async function nextCamera(){
  if(!cameraSession||cameraSession.cameras.length<2)return;
  const cameras=cameraSession.cameras,index=cameras.findIndex(c=>c.deviceId===cameraSession.deviceId);
  await changeCamera(cameras[(index+1)%cameras.length].deviceId);
}
function installCameraControls(container){
  if(!container.insertAdjacentHTML)return;
  container.querySelector('.camera-track-options')?.remove();
  const caps=cameraSession.capabilities(),settings=cameraSession.stream?.getVideoTracks()[0]?.getSettings?.()||{},zoom=caps.zoom;
  container.insertAdjacentHTML('beforeend',`<section class="camera-track-options section-gap"><h3>Lampe et zoom</h3>${caps.torch?'<button class="btn full section-gap" type="button" data-action="camera-torch" aria-pressed="false">Allumer la lampe</button>':'<p class="hint">Lampe non disponible pour cet objectif dans ce navigateur.</p>'}${zoom&&zoom.max>zoom.min?`<div class="field section-gap"><label for="camera-zoom">Zoom <output id="camera-zoom-value">${Number(settings.zoom||zoom.min).toFixed(1)}×</output></label><input id="camera-zoom" type="range" min="${zoom.min}" max="${zoom.max}" step="${zoom.step||.1}" value="${settings.zoom||zoom.min}"></div>`:'<p class="hint">Zoom matériel non disponible pour cet objectif.</p>'}</section>`);
}
export async function toggleTorch(){
  const b=document.querySelector('[data-action="camera-torch"]');if(!b)return;
  b.disabled=true;try{const value=await cameraSession.control('torch',b.getAttribute('aria-pressed')!=='true');if(!b.isConnected)return;b.setAttribute('aria-pressed',String(value));b.textContent=value?'Éteindre la lampe':'Allumer la lampe';}finally{if(b.isConnected)b.disabled=false;}
}
export async function setZoom(value){const zoom=await cameraSession.control('zoom',Number(value)),output=document.querySelector('#camera-zoom-value');if(output)output.textContent=Number(zoom).toFixed(1)+'×';}
async function openCamera(deviceId){
  const container=document.querySelector('#camera-container'),video=container?.querySelector('#scan-video');
  if(!video)return;
  const run=++scanRun;stopDecoder();
  const current=()=>{
    if(run!==scanRun)return false;
    if(!video.isConnected||document.hidden){stopCamera();return false;}
    return true;
  };
  const select=container.querySelector('#scan-camera'),next=container.querySelector('[data-action="next-camera"]'),status=container.querySelector('#camera-status');
  select.disabled=true;next.disabled=true;container.setAttribute('aria-busy','true');
  status.textContent='Ouverture de la caméra…';video.pause();video.srcObject=null;
  try{
    const opened=await getCameraSession().open(deviceId);
    if(!opened||!current())return;
    select.innerHTML=opened.cameras.length?opened.cameras.map(c=>'<option value="'+esc(c.deviceId)+'">'+esc(c.label)+'</option>').join(''):'<option value="">Caméra actuelle</option>';
    select.value=opened.deviceId;select.disabled=opened.cameras.length<2;next.disabled=opened.cameras.length<2;
    container.querySelector('#camera-hint').textContent=opened.cameras.length>1?'Choisissez un objectif dans la liste ou touchez « Changer de caméra ». Le dernier choix reste sur cet appareil.':'Le navigateur ne propose qu’une caméra. Les autres objectifs peuvent être masqués par le téléphone ou le navigateur.';
    video.srcObject=opened.stream;await video.play();if(!current())return;
    container.removeAttribute('aria-busy');status.textContent='Caméra prête. Alignez le code et maintenez le téléphone immobile.';
    installCameraControls(container);
    if(opened.fallback)toast('La caméra choisie est indisponible. Une autre caméra a été ouverte.');
    const accept=raw=>{if(!current())return;stopCamera();lookupProduct(raw).catch(error=>toast(error.message,true));};
    let detector;
    if('BarcodeDetector' in window){
      try{
        const supported=await BarcodeDetector.getSupportedFormats();
        const formats=['code_128','code_39','code_93','ean_13','ean_8','upc_a','upc_e','itf','qr_code','data_matrix','pdf417','aztec','codabar'].filter(format=>supported.includes(format));
        if(formats.length)detector=new BarcodeDetector({formats});
      }catch{}
    }
    if(!current())return;
    if(detector){
      const tick=async()=>{
        if(!current())return;
        try{const results=await detector.detect(video);if(current()&&results.length){accept(results[0].rawValue);return;}}catch{}
        if(current())scanTimer=setTimeout(tick,220);
      };
      void tick();return;
    }
    await loadScript('vendor/zxing-browser.min.js');if(!current())return;
    const reader=new ZXingBrowser.BrowserMultiFormatReader();
    const controls=await reader.decodeFromStream(opened.stream,video,(result,error,controls)=>{
      if(result&&current()){controls.stop();accept(result.getText());}
    });
    if(!current()){controls.stop();return;}
    scannerControls=controls;
  }catch(error){
    if(run!==scanRun)return;
    scanFeedback('error');
    stopCamera();throw Error(cameraErrorMessage(error));
  }
}
export async function scanPhoto(file){unlockFeedback();stopCamera();await loadScript('vendor/zxing-browser.min.js');const url=URL.createObjectURL(file);try{const reader=new ZXingBrowser.BrowserMultiFormatReader();const result=await reader.decodeFromImageUrl(url);await lookupProduct(result.getText());}catch{throw Error('Aucun code lisible sur cette photo. Cadrez le code entier, net et sans reflet, puis réessayez.');}finally{URL.revokeObjectURL(url);}}
export async function lookupProduct(raw){stopCamera();return lookupScannedProduct(raw);}
let ocrWorker,ocrGeneration=0,ocrQueue=Promise.resolve(),ocrProgress=()=>{};
function terminateOCR(worker){try{Promise.resolve(worker?.terminate()).catch(()=>{});}catch{}}
function resetOCR(){const worker=ocrWorker;ocrWorker=null;ocrGeneration++;ocrProgress=()=>{};terminateOCR(worker);}
export function recognizePhoto(file,onProgress=()=>{},options={}){
  const task=ocrQueue.catch(()=>{}).then(()=>Mascot.during(async()=>{
    ocrProgress=onProgress;
    try{return await boundedOCR(signal=>readPhoto(file,onProgress,{...options,signal}),{signal:options.signal,timeoutMs:options.timeoutMs,onInterrupt:resetOCR});}
    catch(error){if(error.name!=='AbortError'&&error.name!=='OCRTimeoutError')resetOCR();throw error;}
    finally{ocrProgress=()=>{};}
  },'Lecture de votre document…'));ocrQueue=task.catch(()=>{});return task;
}
async function readPhoto(file,onProgress,options){
  const signal=options.signal;
  await abortableOCR(loadScript('vendor/ocr/tesseract.min.js'),signal);const absolute=path=>new URL(path,document.baseURI).href;
  if(!ocrWorker){
    onProgress('Préparation du moteur de lecture…');const generation=ocrGeneration;
    const pending=Tesseract.createWorker(['fra','eng'],1,{workerPath:absolute('vendor/ocr/worker.min.js'),corePath:absolute('vendor/ocr/core'),langPath:absolute('vendor/ocr/lang'),workerBlobURL:false,gzip:true,logger:m=>{if(generation!==ocrGeneration)return;if(m.status==='recognizing text')ocrProgress('Lecture du document : '+Math.round((m.progress||0)*100)+' %');else if(m.status==='loading language traineddata')ocrProgress('Préparation des langues de reconnaissance…');}}).then(worker=>{
      if(signal.aborted||generation!==ocrGeneration){terminateOCR(worker);throw signal.reason||ocrAbortError();}return worker;
    });
    ocrWorker=await abortableOCR(pending,signal);
  }
  const worker=ocrWorker,recognize=(image,settings,output)=>abortableOCR(worker.recognize(image,settings,output),signal);
  if(options.order){const {readOrderPhoto}=await import('./order-ocr.js');return readOrderPhoto(file,recognize,onProgress,{signal});}
  let source=file;try{const bitmap=await createImageBitmap(file);try{const factor=Math.min(1,(options.table?3400:2600)/Math.max(bitmap.width,bitmap.height));if(factor<1){const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*factor);canvas.height=Math.round(bitmap.height*factor);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);source=canvas;}}finally{bitmap.close();}}catch{}
  const {data}=await recognize(source,{},options.table?{text:true,tsv:true}:{text:true});
  onProgress('Texte lu. Vérifiez les références et les quantités.');return options.table?layoutText(data.tsv,data.text):data.text;
}
export async function cacheOCR(){
  if(!('caches' in window))throw Error('Le cache hors ligne n’est pas disponible dans ce navigateur.');
  const cache=await caches.open('ek-large-assets-v1');let count=0;for(const path of OCR_ASSETS){const url=new URL(path,document.baseURI).href;const present=await cache.match(url);if(!present){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Un fichier OCR est indisponible : '+path);await cache.put(url,r);}count++;toast(`Préparation hors ligne : ${count} / ${OCR_ASSETS.length}`);}toast('La lecture des photos est prête hors ligne.');
}
export async function viewPhoto(id){const f=await Store.readFile(id);if(f){const url=URL.createObjectURL(f.blob);modal('Document enregistré',`<img class="photo-preview" src="${url}" alt="${esc(f.name)}"><p class="hint">${esc(f.name)}</p>`);onModalClose(()=>URL.revokeObjectURL(url));}else{const d=Store.get('documents',id);if(d?.driveUrl)modal('Document sauvegardé sur Drive',`<p class="dialog-intro">Cette photo est disponible dans votre sauvegarde Google.</p><a class="btn primary" href="https://drive.google.com/file/d/${encodeURIComponent(d.driveId)}/view" target="_blank" rel="noopener noreferrer">Ouvrir le document dans Drive</a>`);else throw Error('Ce document n’est pas disponible sur cet appareil.');}}

