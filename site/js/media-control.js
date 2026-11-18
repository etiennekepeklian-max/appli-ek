import * as API from './session-api.js';
import {toast} from './ui.js';
let installed=false,busy=false;
const supported=()=>!!API.current()&&globalThis.PikeoNative?.isNative===true&&typeof globalThis.PikeoNative.toggleMedia==='function';
export function sync(){
 const nav=document.getElementById('mobile-nav');if(!nav)return;
 const existing=nav.querySelector('[data-media-toggle]');nav.classList.toggle('media-enabled',supported());
 if(!supported()){existing?.remove();return;}if(existing){existing.disabled=busy;return;}
 const button=document.createElement('button');button.type='button';button.dataset.mediaToggle='';button.disabled=busy;button.setAttribute('aria-label','Lecture / Pause du lecteur multimédia actif');button.title='Lecture / Pause';
 button.innerHTML='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 4l10 8L3 20V4Z"/><path d="M17 4v16M22 4v16"/></svg><span>Musique</span>';nav.append(button);
}
export function install(){
 if(installed)return;installed=true;window.addEventListener('pikeo-session',sync);
 document.addEventListener('click',event=>{const button=event.target.closest('[data-media-toggle]');if(!button||busy||!supported())return;event.preventDefault();busy=true;button.disabled=true;
  void Promise.resolve().then(()=>globalThis.PikeoNative.toggleMedia()).catch(error=>toast(error.message||'Commande indisponible. Ouvrez votre lecteur musical.',true)).finally(()=>{busy=false;sync();});
 });sync();
}
