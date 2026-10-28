import * as API from './session-api.js';
import {esc,toast} from './ui.js';

let currentId=null,known=null,peers=[],loading=false,busy=false,app;
const action=(label,name,style='')=>'<button type="button" class="btn '+style+'" data-pin-action="'+name+'">'+label+'</button>';
export const unlocked=()=>!!known?.unlocked&&!known?.locked&&!known?.requiresReset;

export function panel(){
 const u=API.current();
 if(u?.role!=='admin')return '';
 const title='<section class="card section-gap" data-pin-panel><h2>Code administrateur</h2><p class="hint">Un code à 4 chiffres protège les opérations sensibles, en plus de la signature de cet appareil. Il n’est jamais enregistré dans ce navigateur ni envoyé à Google Sheets.</p>';
 if(!known)return title+'<p>Vérification du code auprès du serveur…</p></section>';
 let main='';
 if(known.locked)main='<p role="alert">Accès temporairement verrouillé après plusieurs tentatives. Réessayez plus tard.</p>'+action('Actualiser','refresh');
 else if(!known.configured||known.requiresReset)main='<form data-pin-form="enroll"><label class="field"><span>'+(known.requiresReset?'Choisir un nouveau code':'Créer mon code administrateur')+'</span><input name="pin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required autocomplete="new-password"></label><label class="field"><span>Confirmer le code</span><input name="confirm" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required autocomplete="new-password"></label><button type="submit" class="btn primary">Enregistrer le code</button></form>';
 else if(!unlocked())main='<form data-pin-form="unlock"><label class="field"><span>Code à 4 chiffres</span><input name="pin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required autocomplete="off"></label><button type="submit" class="btn primary">Déverrouiller pour 10 minutes</button></form>';
 else main='<p>Accès administrateur déverrouillé pendant 10 minutes au maximum.</p><div class="actions">'+action('Verrouiller immédiatement','lock')+action('Changer mon code','change')+'</div>';
 if(u.owner&&known.configured)main+='<details class="section-gap"><summary>Récupérer mon code avec mon fichier propriétaire</summary><p class="hint">À utiliser si vous avez oublié le code. Votre fichier propriétaire privé est nécessaire.</p><form data-pin-form="recover"><input type="file" name="file" accept=".json,application/json" required><button type="submit" class="btn">Vérifier le fichier et réinitialiser mon code</button></form></details>';
 if(unlocked())main+='<details class="section-gap"><summary>Réinitialiser le code d’un autre administrateur</summary><form data-pin-form="reset"><label class="field"><span>Appareil concerné</span><select name="target" required><option value="">Choisir un appareil</option>'+peers.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.id.slice(0,8))+'</option>').join('')+'</select></label><p class="hint">La réinitialisation ne retire pas les données métier et oblige le collègue à choisir son nouveau code.</p><button type="submit" class="btn">Demander la réinitialisation</button></form>'+action('Actualiser les administrateurs','peers')+'</details>';
 return title+main+'<p class="error-message" data-pin-error role="alert" hidden></p></section>';
}

export async function refresh(force=false){
 const u=API.current();
 if(!u||u.role!=='admin'){currentId=null;known=null;peers=[];return;}
 if(!force&&currentId===u.id&&known)return;
 if(loading)return;
 loading=true;const id=u.id;
 try{
  const next=await API.request('admin-pin-status');
  if(API.current()?.id!==id)return;
  currentId=id;known=next;
  peers=next.unlocked?(await API.request('admin-pin-peers')).peers:[];
  app?.render?.();
 }catch(e){if(API.current()?.id===id){known=null;toast('Sécurité administrateur : '+e.message,true);}}
 finally{loading=false;}
}

async function perform(form,action){
 if(busy)return;busy=true;
 try{
  const data=new FormData(form),pin=String(data.get('pin')||'');
  if(action==='enroll'){
   if(pin!==data.get('confirm'))throw Error('La confirmation du code ne correspond pas.');
   await API.request('admin-pin-enroll',{pin});
  }else if(action==='unlock')await API.request('admin-pin-unlock',{pin});
  else if(action==='reset'){
   const target=String(data.get('target')||'');
   const person=peers.find(p=>p.id===target);
   if(!person)throw Error('Choisissez un administrateur.');
   if(!confirm('Réinitialiser le code de '+person.name+' ? Il devra choisir un nouveau code sur son appareil.'))return;
   await API.request('admin-pin-reset',{target});
   toast('Demande de réinitialisation enregistrée.');
  }else if(action==='recover'){
   const file=form.querySelector('[name=file]')?.files?.[0];
   if(!file||file.size>16384)throw Error('Choisissez le fichier propriétaire privé.');
   const json=JSON.parse(await file.text());
   if(json.app!=='PikeoAdminAccess'||json.version!==1||json.endpoint!==API.ENDPOINT||!/^[a-f0-9]{64}$/.test(json.secret||''))
    throw Error('Fichier propriétaire invalide.');
   await API.request('admin-pin-recover',{ownerSecret:json.secret});
  }
  if(action!=='reset')toast('Sécurité administrateur actualisée.');
  await refresh(true);
 }catch(e){
  const el=document.querySelector('[data-pin-error]');
  if(el){el.textContent=e.message;el.hidden=false;}else toast(e.message,true);
 }finally{busy=false;}
}

export function install(callbacks){
 app=callbacks;
 document.addEventListener('submit',event=>{
  const form=event.target.closest('[data-pin-form]');if(!form)return;
  event.preventDefault();void perform(form,form.dataset.pinForm);
 });
 document.addEventListener('click',event=>{
  const b=event.target.closest('[data-pin-action]');if(!b)return;
  event.preventDefault();
  if(b.dataset.pinAction==='refresh'||b.dataset.pinAction==='peers'){void refresh(true);return;}
  if(b.dataset.pinAction==='change'){known={...known,requiresReset:true};app?.render?.();return;}
  if(b.dataset.pinAction==='lock'){
   void API.request('admin-pin-lock').then(()=>refresh(true)).catch(e=>toast(e.message,true));
  }
 });
}
