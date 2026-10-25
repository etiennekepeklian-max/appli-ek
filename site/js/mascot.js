// Visual feedback only: never hold a render, camera, form or operation for an animation.
import * as Personal from './workbench-store.js';
const jobs=new Set();let mounted=false,booting=true,readyTimer,loadingTimer;
let privateBlob,privateURL;
const root=()=>document.getElementById('mascot-status');
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
 const el=root();if(!el)return;
 el.classList.add('mascot-ready');el.querySelector('[data-mascot-label]').textContent='Votre espace est prêt';
 // The short greeting may finish beside the already usable interface.
 readyTimer=setTimeout(()=>{if(!jobs.size)el.hidden=true;},800);
}
export function stop(){booting=false;clearTimeout(readyTimer);clearTimeout(loadingTimer);jobs.clear();if(root())root().hidden=true;}
export function begin(label='Chargement en cours…'){
 const token={label};jobs.add(token);
 if(!loadingTimer)loadingTimer=setTimeout(()=>{
  loadingTimer=null;if(!jobs.size||!root())return;
  clearTimeout(readyTimer);const el=root();el.classList.remove('mascot-ready');el.classList.add('mascot-loading');
  el.querySelector('[data-mascot-label]').textContent=[...jobs].at(-1).label;el.hidden=false;
  const header=document.querySelector('#dialog[open] .dialog-top');
  if(header&&!header.querySelector('.mascot-inline')){const sprite=document.createElement('span');sprite.className='mascot-sprite mascot-walk mascot-inline';sprite.setAttribute('aria-hidden','true');header.querySelector('h2').after(sprite);}
 },150);
 let done=false;
 return ()=>{if(done)return;done=true;jobs.delete(token);if(!jobs.size){clearTimeout(loadingTimer);loadingTimer=null;document.querySelectorAll('.mascot-inline').forEach(el=>el.remove());if(!booting&&root())root().hidden=true;}};
}
export async function during(operation,label){const end=begin(label);try{return await operation();}finally{end();}}
