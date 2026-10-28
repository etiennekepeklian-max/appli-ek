// Local-only contact numbers for warehouse re-stocking. Do not place personal
// telephone numbers in the public repository or in synced business preferences.
import {esc,modal,closeModal,toast} from './ui.js';

const KEY='pikeo-reassort-contacts-local-v1';

export function normalizePhone(value){
 const s=String(value??'').replace(/[\s.()-]/g,'');
 if(!s)return '';
 const fr=s.startsWith('+33')?'0'+s.slice(3):s.startsWith('0033')?'0'+s.slice(4):s;
 if(!/^0[1-9]\d{8}$/.test(fr))throw Error('Saisissez un numéro français à 10 chiffres (ex. 06 XX XX XX XX).');
 return fr;
}
export function phones(){
 try{
  const v=JSON.parse(localStorage.getItem(KEY)||'{}');
  return {jc:normalizePhone(v.jc),serge:normalizePhone(v.serge)};
 }catch{return {jc:'',serge:''};}
}
export function savePhones(raw){
 const next={jc:normalizePhone(raw.jc),serge:normalizePhone(raw.serge)};
 try{localStorage.setItem(KEY,JSON.stringify(next));}catch{throw Error('Le navigateur ne permet pas de conserver les numéros sur ce téléphone.');}
 return next;
}
export function toDialNumber(fr){return fr?'+33'+fr.slice(1):'';}
const control=(who,phone,message)=>{
 const label=who==='jc'?'JC':'Serge';
 if(!phone)return '<span class="hint">Numéro de '+label+' non renseigné.</span>';
 const dial=toDialNumber(phone);
 return '<a class="btn small" href="tel:'+esc(dial)+'" aria-label="Appeler '+label+'">Appeler '+label+'</a>'
  +'<a class="btn small" href="sms:'+esc(dial)+'?body='+encodeURIComponent(message)+'" aria-label="Préparer un SMS pour '+label+'">SMS '+label+'</a>';
};
export function actions(message){
 const p=phones();
 return '<section class="section-gap"><p class="hint">Choisissez un destinataire. L’appel ou le SMS s’ouvre sur votre téléphone : rien n’est envoyé automatiquement.</p>'
 +'<div class="actions">'+control('jc',p.jc,message)+control('serge',p.serge,message)+'</div>'
 +'<button type="button" class="btn small section-gap" data-reassort-contact-edit>Configurer les numéros de JC et Serge</button></section>';
}
export function settingsPanel(){
 const p=phones();
 return '<section class="card section-gap"><h2>Contacts pour réassort</h2>'
 +'<p class="hint">Conservés seulement dans ce navigateur, sans envoi à Google ni publication dans GitHub.</p>'
 +'<p>JC : '+(p.jc?'numéro enregistré':'à renseigner')+' · Serge : '+(p.serge?'numéro enregistré':'à renseigner')+'</p>'
 +'<button type="button" class="btn" data-reassort-contact-edit>Modifier les numéros</button></section>';
}
export function edit(){
 const p=phones();
 const input=(who,label,number)=>'<label class="field"><span>'+label+'</span><input name="'+who+'" type="tel" autocomplete="tel-national" inputmode="tel" placeholder="06 XX XX XX XX" value="'+esc(number)+'"></label>';
 modal('Contacts de réassort','<p class="dialog-intro">Numéros privés sur cet appareil. Un appel ou un SMS demandera toujours une action de votre part.</p>'
 +'<form data-reassort-contacts-form>'+input('jc','Téléphone de JC',p.jc)+input('serge','Téléphone de Serge',p.serge)
 +'<div class="error-message" data-reassort-error role="alert" hidden></div><div class="form-actions"><button type="button" class="btn" data-action="close-dialog">Annuler</button><button type="submit" class="btn primary">Enregistrer les numéros</button></div></form>');
}
export function consumeLink(){
 const match=location.hash.match(/^#contact-serge=([^&]+)$/);
 if(!match)return false;
 const phone=decodeURIComponent(match[1]);
 savePhones({...phones(),serge:phone});
 history.replaceState(null,'','#pending');
 return true;
}
let installed=false;
export function install(){
 if(installed)return;installed=true;
 document.addEventListener('click',e=>{
  if(!e.target.closest('[data-reassort-contact-edit]'))return;
  e.preventDefault();edit();
 });
 document.addEventListener('submit',e=>{
  const f=e.target.closest('[data-reassort-contacts-form]');
  if(!f)return;
  e.preventDefault();
  const data=Object.fromEntries(new FormData(f));
  try{savePhones(data);closeModal();toast('Contacts de réassort enregistrés sur cet appareil.');}
  catch(error){const div=f.querySelector('[data-reassort-error]');div.hidden=false;div.textContent=error.message;}
 });
}
