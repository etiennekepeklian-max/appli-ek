import * as Store from './storage.js';
import {enfVoiceQuery} from './enf-core.js';
import {state,esc,icon} from './ui.js';
import {stopDictation} from './features.js';
import {show as showHelp} from './help.js';

let active,message='',messageScope;
const label=mode=>mode==='reference'?'Dicter la référence':'Dicter le nom';
function status(text,scope=Store.scope()){
 if(scope!==Store.scope())return;
 message=text;messageScope=scope;
 const slot=document.querySelector('[data-enf-voice-status]');if(slot)slot.textContent=text;
}
export function controls(){
 if(messageScope!==Store.scope()){message='';messageScope=Store.scope();}
 return '<section class="enf-voice section-gap" aria-label="Recherche vocale des ENF"><div class="enf-voice-heading"><strong>Recherche vocale</strong><button type="button" class="icon-button" data-enf-voice="help" aria-label="Aide pour la recherche vocale des ENF">?</button></div><div class="enf-voice-actions">'+['reference','name'].map(mode=>'<button type="button" class="btn" data-enf-voice="'+mode+'" aria-controls="enf-search" aria-pressed="false">'+icon('mic')+label(mode)+'</button>').join('')+'</div><p class="hint section-gap">Référence : dites chaque chiffre, y compris les zéros, puis les lettres. Nom : dites le nom du concept. La dictée peut nécessiter Internet ; Pikéo ne conserve aucun audio.</p><p class="hint" data-enf-voice-status role="status" aria-live="polite">'+esc(message)+'</p></section>';
}
export function stopSearchVoice(text='Dictée arrêtée. La recherche actuelle est conservée.'){
 const current=active;active=null;if(!current)return;
 clearTimeout(current.timer);current.observer.disconnect();
 current.button.classList.remove('listening');current.button.setAttribute('aria-pressed','false');current.button.innerHTML=icon('mic')+label(current.mode);
 if(text)status(text,current.scope);
 try{current.recognition.abort();}catch{}
}
function listen(button){
 if(active?.button===button){stopSearchVoice();return;}
 stopDictation();
 window.dispatchEvent(new Event('pikeo-stop-pending-voice'));
 const input=document.querySelector('#enf-search'),Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!input||state.route!=='enfs')return;
 if(!Recognition){status('Dictée indisponible dans ce navigateur. Utilisez le micro du clavier de votre téléphone ou saisissez la recherche.');input.focus();return;}
 const mode=button.dataset.enfVoice,current={button,input,mode,scope:Store.scope(),before:input.value,observer:new MutationObserver(()=>{if(active===current&&!input.isConnected)stopSearchVoice(input.value!==current.before?'La recherche modifiée pendant la dictée a été conservée.':'La page a changé. Relancez la dictée si nécessaire.');})};
 try{current.recognition=new Recognition();}catch{status('Impossible de démarrer le microphone. Réessayez ou utilisez le clavier.');return;}
 const recognition=current.recognition;active=current;
 const valid=()=>active===current&&current.scope===Store.scope()&&input.isConnected&&button.isConnected&&state.route==='enfs';
 recognition.lang='fr-FR';recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
 recognition.onresult=event=>{
  if(!valid())return;
  const text=Array.from(event.results).filter(result=>result.isFinal!==false).map(result=>result[0]?.transcript||'').join(' ').trim();if(!text)return;
  if(input.value!==current.before){stopSearchVoice('La recherche modifiée pendant la dictée a été conservée.');return;}
  try{
   const query=enfVoiceQuery(text,mode);stopSearchVoice('');input.value=query;
   status('Recherche par '+(mode==='reference'?'référence':'nom')+' lancée. Vérifiez le texte reconnu.');
   input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.focus({preventScroll:true});
  }catch(error){stopSearchVoice(error.message);}
 };
 recognition.onerror=event=>{if(!valid())return;stopSearchVoice(event.error==='not-allowed'||event.error==='service-not-allowed'?'Microphone non autorisé. Autorisez-le dans les réglages du navigateur, ou utilisez le clavier.':'La dictée n’a pas abouti. Réessayez ou utilisez le clavier ; une connexion Internet peut être nécessaire.');};
 recognition.onend=()=>{if(active===current)stopSearchVoice('Aucune parole reçue. Réessayez ou utilisez le clavier.');};
 button.classList.add('listening');button.setAttribute('aria-pressed','true');button.innerHTML=icon('mic')+'Arrêter la dictée';
 status('Écoute en cours… '+(mode==='reference'?'Dictez la référence chiffre par chiffre.':'Dites le nom du concept.'));
 current.observer.observe(document.querySelector('#main'),{childList:true,subtree:true});
 current.timer=setTimeout(()=>{if(active===current)stopSearchVoice('Dictée arrêtée après 30 secondes. Réessayez ou utilisez le clavier.');},30000);
 try{recognition.start();}catch{stopSearchVoice('Impossible de démarrer le microphone. Réessayez ou utilisez le clavier.');}
}
export function install(){
 document.addEventListener('click',event=>{const button=event.target.closest('[data-enf-voice]');if(!button||button.disabled)return;event.preventDefault();if(button.dataset.enfVoice==='help'){stopSearchVoice();showHelp('help-enf-voice');}else listen(button);});
 window.addEventListener('pikeo-stop-enf-voice',()=>stopSearchVoice());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSearchVoice();});
 window.addEventListener('pagehide',()=>stopSearchVoice());
}
