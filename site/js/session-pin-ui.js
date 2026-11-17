// A separate dialog keeps credentials outside application drafts and exports.
export function askPin({name,enroll,error='',owner=false,recover,initialPin=''}){
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');dialog.className='personal-pin-dialog';
  const title=document.createElement('h2');title.textContent=enroll?'Choisissez votre code personnel':'Ouvrir ma session';dialog.append(title);
  const who=document.createElement('p');who.textContent=name;dialog.append(who);
  const form=document.createElement('form');form.autocomplete='off';
  const input=(label,name)=>{const l=document.createElement('label');l.className='field section-gap';const span=document.createElement('span');span.textContent=label;const i=document.createElement('input');Object.assign(i,{name,type:'password',inputMode:'numeric',pattern:'[0-9]{4}',minLength:4,maxLength:4,required:true,autocomplete:'off'});l.append(span,i);form.append(l);return i;};
  const pin=input(enroll?'Mon code à quatre chiffres':'Mon code personnel','personalPin');
  if(enroll&&/^[0-9]{4}$/.test(initialPin))pin.value=initialPin;
  const confirmation=enroll?input('Confirmer mon code','personalPinConfirmation'):null;
  const message=document.createElement('p');message.setAttribute('role','alert');message.className='error-message';message.textContent=error;form.append(message);
  const help=document.createElement('details');const summary=document.createElement('summary');summary.textContent='? Aide et code oublié';const text=document.createElement('p');text.textContent='Première connexion : choisissez quatre chiffres puis saisissez-les une deuxième fois. Gardez ce code pour vos prochaines connexions. En cas d’oubli, contactez Étienne : lui seul peut autoriser une réinitialisation. Les connexions et modifications métier sont journalisées pour Étienne, sans enregistrer votre code ni vos mémos privés. La connexion nécessite Internet ; les données restent sur cet appareil.';help.append(summary,text);form.append(help);
  const actions=document.createElement('div');actions.className='actions section-gap';const submit=document.createElement('button');submit.type='submit';submit.className='btn primary';submit.textContent=enroll?'Enregistrer mon code et entrer':'Entrer';const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Annuler';actions.append(submit,cancel);form.append(actions);dialog.append(form);
  const cleanup=()=>{pin.value='';if(confirmation)confirmation.value='';dialog.close();dialog.remove();};
  cancel.onclick=()=>{cleanup();reject(Error('Ouverture de session annulée.'));};dialog.addEventListener('cancel',e=>{e.preventDefault();cancel.click();});
  if(owner&&recover){const file=document.createElement('input');file.type='file';file.accept='.json';const label=document.createElement('label');label.className='field section-gap';label.textContent='Étienne : récupérer avec mon fichier privé';label.append(file);help.append(label);file.onchange=async()=>{try{const f=file.files?.[0];if(!f)return;if(f.size>16384)throw Error('Fichier privé invalide.');await recover(JSON.parse(await f.text()));cleanup();resolve({recovered:true});}catch(e){message.textContent=e.message;file.value='';}};}
  form.onsubmit=e=>{e.preventDefault();if(!form.reportValidity())return;if(confirmation&&pin.value!==confirmation.value){message.textContent='Les deux codes doivent être identiques.';confirmation.focus();return;}const value={pin:pin.value,confirmation:confirmation?.value};cleanup();resolve(value);};
  document.body.append(dialog);dialog.showModal();(enroll&&pin.value&&confirmation?confirmation:pin).focus();
 });
}
