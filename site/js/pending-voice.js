import * as Store from './storage.js';
import {parsePendingVoice} from './pending-voice-core.js';
import {onModalClose} from './ui.js';
import {stopDictation} from './features.js';
import {persistDraft} from './ops.js';

let active;
export function stopPendingVoice(){
 const current=active;active=null;if(!current)return;clearTimeout(current.timer);try{current.recognition.abort();}catch{}
 current.button.classList.remove('listening');current.button.setAttribute('aria-pressed','false');current.button.textContent='Dicter commande et référence';
}
export const controls=()=>`<section class="full pending-voice"><button type="button" class="btn primary full" data-pending-voice="listen" aria-pressed="false">Dicter commande et référence</button><p class="hint section-gap">Dites « commande … référence … », chiffre par chiffre. Relisez avant d’enregistrer.</p><p class="hint">Dictée du navigateur : Internet possible, aucun audio conservé par Pikéo.</p><p data-pending-voice-status role="status" aria-live="polite"></p><details class="section-gap"><summary>Texte dicté ou saisie de secours</summary><label class="field"><span>Commande et référence dictées</span><textarea data-pending-voice-text rows="3" placeholder="Commande 0000123 référence 001234"></textarea></label><button type="button" class="btn full section-gap" data-pending-voice="apply">Remplir les champs depuis ce texte</button></details></section>`;
function apply(form,text,before){
 if(!form.isConnected)return;const result=parsePendingVoice(text),warnings=[...result.warnings];
 for(const name of ['orderNumber','sku'])if(result[name]){
  const field=form.elements[name];if(before&&field.value!==before[name]){warnings.push('Le champ '+(name==='sku'?'référence':'commande')+' modifié pendant la dictée a été conservé.');continue;}
  field.value=result[name];field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
 }
 form.querySelector('[data-pending-voice-status]').textContent=(result.orderNumber||result.sku?'Champs proposés. Relisez la commande, la référence et l’emplacement. ':'Aucun champ rempli. ')+warnings.join(' ');
 void persistDraft();
}
function listen(button){
 if(active){stopPendingVoice();return;}
 const form=button.closest('[data-form=pending]'),status=form.querySelector('[data-pending-voice-status]'),Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){status.textContent='Dictée indisponible ici. Utilisez le micro du clavier dans Texte dicté ou saisie de secours, puis Remplir les champs.';form.querySelector('details').open=true;form.querySelector('[data-pending-voice-text]').focus();return;}
 stopDictation();const recognition=new Recognition(),before={orderNumber:form.elements.orderNumber.value,sku:form.elements.sku.value},space=Store.scope();
 const current={recognition,button};active=current;recognition.lang='fr-FR';recognition.continuous=false;recognition.interimResults=false;
 const valid=()=>active===current&&form.isConnected&&Store.scope()===space;
 recognition.onresult=e=>{if(!valid())return;const text=Array.from(e.results).filter(r=>r.isFinal!==false).map(r=>r[0]?.transcript||'').join(' ');if(!text)return;form.querySelector('[data-pending-voice-text]').value=text;apply(form,text,before);};
 recognition.onerror=e=>{if(!valid())return;status.textContent=e.error==='not-allowed'?'Autorisez le microphone dans les réglages du navigateur, ou utilisez le clavier.':'La dictée n’a pas abouti. Réessayez ou utilisez le texte de secours.';};
 recognition.onend=()=>{if(!valid())return;if(status.textContent==='Écoute en cours… Dites commande puis référence.')status.textContent='Aucune parole reçue. Vous pouvez réessayer.';stopPendingVoice();};
 button.classList.add('listening');button.setAttribute('aria-pressed','true');button.textContent='Arrêter la dictée du manquant';status.textContent='Écoute en cours… Dites commande puis référence.';
 current.timer=setTimeout(()=>{if(valid()){status.textContent='Dictée arrêtée. Les champs déjà proposés sont conservés.';stopPendingVoice();}},30000);
 try{recognition.start();}catch{stopPendingVoice();status.textContent='Impossible de démarrer le microphone. Réessayez ou utilisez le clavier.';}
}
export function mount(){onModalClose(stopPendingVoice);}
export function install(){
 document.addEventListener('click',e=>{const button=e.target.closest('[data-pending-voice]');if(!button)return;e.preventDefault();if(button.dataset.pendingVoice==='listen')listen(button);else{stopPendingVoice();const form=button.closest('[data-form=pending]');apply(form,form.querySelector('[data-pending-voice-text]').value);}});
 window.addEventListener('pikeo-stop-pending-voice',stopPendingVoice);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPendingVoice();});
}
