// All loading surfaces reuse Pikéo opening #1 with the ORIGINAL mascot.
// Feedback is visual only: it never blocks navigation, forms or operations.
import * as Personal from './workbench-store.js';
const jobs=new Set();let mounted=false,booting=true,loadingTimer;
let privateBlob,privateURL;
const root=()=>document.getElementById('mascot-status');
const clearDialog=()=>document.querySelectorAll('.pk-dialog-loading').forEach(el=>el.remove());
export function applyPersonal(){
 const blob=Personal.get('personal-mascot')?.photo;
 if(blob===privateBlob)return;
 if(privateURL)URL.revokeObjectURL(privateURL);privateURL=null;privateBlob=blob;
 if(blob instanceof Blob){privateURL=URL.createObjectURL(blob);document.documentElement.style.setProperty('--mascot-sheet',`url("${privateURL}")`);}
 else document.documentElement.style.removeProperty('--mascot-sheet');
}
export async function validateSprite(file){
 if(!file||!['image/png','image/webp'].includes(file.type)||file.size>3e6)throw Error('Choisissez la planche de mascotte fournie, en PNG ou WebP, de moins de 3 Mo.');
 const image=await createImageBitmap(file);
 try{if(image.width<384||image.width>4096||image.height<256||image.height>2732||image.width%4||image.height%2||image.width/image.height!==1.5)throw Error('Ce fichier n’est pas une planche de mascotte compatible. Utilisez le fichier d’animation fourni.');}finally{image.close();}
 return file;
}
export function ready(){
 if(mounted)return;mounted=true;booting=false;
 if(!jobs.size&&root())root().hidden=true;
}
export function stop(){
 booting=false;clearTimeout(loadingTimer);loadingTimer=null;jobs.clear();
 clearDialog();if(root())root().hidden=true;
}
function dialogLoading(dialog,label){
 let layer=dialog.querySelector('.pk-dialog-loading');
 if(!layer){
  layer=document.createElement('div');layer.className='pk-dialog-loading';layer.setAttribute('role','status');layer.setAttribute('aria-live','polite');
  layer.innerHTML='<div class="pk-intro-stage"><div class="pk-intro-text"><div class="pk-intro-title">PIKÉO</div><div class="pk-intro-rule"></div><p class="pk-intro-slogan">Scannez. Préparez. Avancez.</p></div><span class="mascot-sprite" aria-hidden="true"></span><p class="pk-load-label" data-dialog-mascot-label></p></div>';
  dialog.append(layer);
 }
 layer.querySelector('[data-dialog-mascot-label]').textContent=label;
}
function paint(){
 if(!jobs.size)return;
 const label=[...jobs].at(-1).label,el=root(),dialog=document.querySelector('#dialog[open]');
 if(dialog){
  if(el)el.hidden=true;
  dialogLoading(dialog,label);
 }else{
  clearDialog();
  if(!el)return;
  el.classList.remove('mascot-ready');el.classList.add('mascot-loading');
  el.querySelector('[data-mascot-label]').textContent=label;
  el.hidden=false;
 }
}
export function begin(label='Chargement en cours…'){
 const token={label};jobs.add(token);
 if(!loadingTimer)loadingTimer=setTimeout(()=>{loadingTimer=null;paint();},180);
 let done=false;
 return ()=>{
  if(done)return;done=true;jobs.delete(token);
  if(!jobs.size){
   clearTimeout(loadingTimer);loadingTimer=null;clearDialog();
   if(!booting&&root())root().hidden=true;
  }else if(!loadingTimer)paint();
 };
}
export async function during(operation,label){const end=begin(label);try{return await operation();}finally{end();}}
