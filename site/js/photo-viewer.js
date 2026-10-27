import {esc} from './ui.js';

// A separate top-layer dialog keeps the review form and its unsaved input intact.
export function showPhotoViewer(blob,{title='Photo de la feuille'}={}){
 const dialog=document.createElement('dialog'),url=URL.createObjectURL(blob),previous=document.activeElement;
 dialog.className='photo-viewer';dialog.dataset.helpContext='day-photo';dialog.setAttribute('aria-label',title);
 dialog.innerHTML=`<header class="dialog-top photo-viewer-top"><h2>${esc(title)}</h2><button type="button" class="btn" data-action="quickhelp" aria-label="Aide pour agrandir la photo">?</button><button type="button" class="btn" data-viewer="close" aria-label="Fermer la photo">×</button></header><div class="photo-viewer-tools"><button type="button" class="btn" data-viewer="out" aria-label="Réduire le zoom">−</button><output aria-live="polite">100 %</output><button type="button" class="btn" data-viewer="in" aria-label="Agrandir le zoom">+</button><button type="button" class="btn" data-viewer="fit">Ajuster</button><button type="button" class="btn" data-viewer="rotate">Tourner</button></div><div class="photo-viewer-scroll" tabindex="0" aria-label="Photo agrandie, déplacez-vous pour lire la feuille"><div class="photo-viewer-stage"><img alt="Feuille photographiée" draggable="false"></div></div><p class="photo-viewer-hint">Pincez avec deux doigts ou utilisez + / −. Faites glisser pour lire.</p>`;
 document.body.append(dialog);
 const viewport=dialog.querySelector('.photo-viewer-scroll'),stage=dialog.querySelector('.photo-viewer-stage'),image=dialog.querySelector('img'),output=dialog.querySelector('output'),pointers=new Map();
 let zoom=1,angle=0,fit=1,done=false,gesture;
 const bounds=()=>({w:angle%180?image.naturalHeight:image.naturalWidth,h:angle%180?image.naturalWidth:image.naturalHeight});
 function draw(){
  if(!image.naturalWidth)return;
  const {w,h}=bounds();fit=Math.min(viewport.clientWidth/w,viewport.clientHeight/h);const scale=fit*zoom;
  stage.style.width=w*scale+'px';stage.style.height=h*scale+'px';image.style.width=image.naturalWidth*scale+'px';image.style.height=image.naturalHeight*scale+'px';image.style.transform=`translate(-50%,-50%) rotate(${angle}deg)`;
  output.value=Math.round(zoom*100)+' %';dialog.querySelector('[data-viewer=out]').disabled=zoom<=1;dialog.querySelector('[data-viewer=in]').disabled=zoom>=8;
 }
 function setZoom(value){
  const x=(viewport.scrollLeft+viewport.clientWidth/2)/Math.max(1,stage.offsetWidth),y=(viewport.scrollTop+viewport.clientHeight/2)/Math.max(1,stage.offsetHeight);
  zoom=Math.max(1,Math.min(8,value));draw();viewport.scrollLeft=x*stage.offsetWidth-viewport.clientWidth/2;viewport.scrollTop=y*stage.offsetHeight-viewport.clientHeight/2;
 }
 const observer=new ResizeObserver(()=>draw());observer.observe(viewport);
 function close(){if(done)return;done=true;observer.disconnect();URL.revokeObjectURL(url);dialog.close();dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});}
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('close',close);
 dialog.addEventListener('click',e=>{
  const action=e.target.closest('[data-viewer]')?.dataset.viewer;if(!action)return;e.preventDefault();
  if(action==='close')return close();
  if(action==='in'||action==='out')setZoom(zoom*(action==='in'?1.5:1/1.5));
  if(action==='fit'){zoom=1;draw();viewport.scrollTo(0,0);}
  if(action==='rotate'){angle=(angle+90)%360;zoom=1;draw();viewport.scrollTo(0,0);}
 });
 const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
 function resetGesture(){gesture=pointers.size>=2?{distance:distance(),zoom}:pointers.size?{point:[...pointers.values()][0],left:viewport.scrollLeft,top:viewport.scrollTop}:null;}
 viewport.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);resetGesture();e.preventDefault();});
 viewport.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2&&gesture.distance)setZoom(gesture.zoom*distance()/gesture.distance);
  else if(gesture.point){viewport.scrollLeft=gesture.left+gesture.point.x-e.clientX;viewport.scrollTop=gesture.top+gesture.point.y-e.clientY;}
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,e=>{pointers.delete(e.pointerId);resetGesture();});
 viewport.addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();setZoom(zoom*(e.deltaY<0?1.15:1/1.15));}},{passive:false});
 dialog.addEventListener('keydown',e=>{if(['+','=','-','0'].includes(e.key)){e.preventDefault();setZoom(e.key==='0'?1:zoom*(e.key==='-'?1/1.5:1.5));}});
 image.addEventListener('load',draw);image.addEventListener('error',()=>{dialog.querySelector('.photo-viewer-hint').textContent='Cette photo ne peut pas être affichée. Fermez puis ajoutez une copie lisible.';});
 dialog.showModal();image.src=url;dialog.querySelector('[data-viewer=close]').focus();
 return close;
}
