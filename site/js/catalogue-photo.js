import * as Store from './storage.js';
import * as Identity from './identity-context.js';
import {products} from './model.js';
import {uid,refKey} from './core.js';
import {recognizePhoto} from './features.js';
import {productLocations} from './ops-core.js';
import {parseCataloguePhotoText,reviewPhotoRows} from './catalogue-photo-core.js';
import {modal,closeModal,toast,esc} from './ui.js';
let app,reading=false;
const button=(label,action)=>'<button type="button" class="btn" data-photo-catalogue-action="'+action+'">'+label+'</button>';
function host(){return document.querySelector('[data-photo-catalogue]');}
function status(text){const el=host()?.querySelector('[data-photo-catalogue-status]');if(el)el.textContent=text;}
export function open(){
 Identity.assertConfigure();
 modal('Importer des références et emplacements par photo',
 '<div data-photo-catalogue data-help-context="catalogue-photo"><p class="dialog-intro">Photographiez une ou plusieurs pages. La lecture reste sur cet appareil. Vérifiez chaque référence, dénomination et casier avant toute écriture.</p>'+
 '<label class="field"><span>Photographier ou sélectionner des pages</span><input type="file" accept="image/*" capture="environment" multiple data-photo-catalogue-files></label>'+
 '<p class="hint" data-photo-catalogue-status role="status">Aucune photo analysée. Formats conseillés : référence ; nom ; PAC/PAD/RES.</p>'+
 '<label class="field section-gap"><span>Texte reconnu ou à corriger (une ligne par produit)</span><textarea data-photo-catalogue-text rows="6" placeholder="001234;Carte anniversaire;PAC001-A&#10;009876;Carnet;RES002-B"></textarea></label>'+
 '<div class="actions section-gap">'+button('Vérifier les lignes','preview')+'</div><div data-photo-catalogue-preview></div></div>',true);
 document.querySelector('#dialog').dataset.helpContext='catalogue-photo';
}
async function readFiles(files){
 if(reading)return;reading=true;
 const selected=[...files];
 if(selected.length>10){reading=false;throw Error('Sélectionnez au maximum 10 pages à la fois.');}
 const root=host();if(!root){reading=false;return;}
 const input=root.querySelector('[data-photo-catalogue-files]');input.disabled=true;
 try{
  for(let i=0;i<selected.length;i++){
   const f=selected[i];if(!f.type.startsWith('image/')||f.type==='image/svg+xml'||f.size>25e6)throw Error('Chaque photo doit être une image de moins de 25 Mo.');
   status('Analyse locale de la page '+(i+1)+' sur '+selected.length+'…');
   try{
    const result=await recognizePhoto(f,text=>status(text));
    if(!root.isConnected)return;
    const field=root.querySelector('[data-photo-catalogue-text]');
    field.value+=(field.value?'\n':'')+result;
   }catch(e){status('Lecture interrompue pour la page '+(i+1)+'. Reprenez la photo ou saisissez les données.');toast('Lecture photo incomplète. Le texte peut être saisi à la main.',true);}
  }
  if(root.isConnected){status('Lecture terminée. Vérifiez et corrigez les lignes proposées.');preview();}
 }finally{reading=false;if(input.isConnected)input.disabled=false;}
}
function preview(){
 const root=host();if(!root)throw Error('Fenêtre fermée.');
 const rows=parseCataloguePhotoText(root.querySelector('[data-photo-catalogue-text]').value,products());
 const view=root.querySelector('[data-photo-catalogue-preview]');
 if(!rows.length){view.innerHTML='<p class="error-message">Aucune ligne reconnue. Utilisez le format référence ; nom ; emplacement ou reprenez la photo.</p>';return;}
 view.innerHTML='<h3 class="section-gap">'+rows.length+' ligne(s) à examiner</h3><p class="hint">Une référence existante est ignorée par défaut. Tout changement doit être choisi explicitement. Les anomalies doivent être corrigées avant validation.</p>'+
 '<form data-photo-catalogue-review>'+rows.map((r,i)=>'<fieldset class="card section-gap" data-photo-catalogue-row><legend>Ligne '+(i+1)+' · texte n°'+r.sourceLine+'</legend>'+
 '<label class="field"><span>Référence</span><input name="sku" value="'+esc(r.sku)+'" required></label>'+
 '<label class="field"><span>Nom</span><input name="name" value="'+esc(r.name)+'"></label>'+
 '<label class="field"><span>Emplacement PAC/PAD/RES</span><input name="location" value="'+esc(r.location)+'"></label>'+
 '<label class="field"><span>Traitement</span><select name="action">'+(r.existingId?'<option value="skip">Ignorer la fiche existante</option><option value="update">Mettre à jour après relecture</option>':'<option value="create">Créer la référence</option><option value="skip">Ignorer cette ligne</option>')+'</select></label>'+
 '<label class="field"><input type="checkbox" name="confirmName"> Confirmer un nom différent de la fiche existante</label>'+
 '<p class="hint" role="status">'+esc(r.warnings.length?r.warnings.join(' ; '):'Aucune anomalie détectée. À confirmer par relecture.')+'</p></fieldset>').join('')+
 '<label class="field"><input name="reviewed" type="checkbox" required> J’ai vérifié les lignes, corrigé les anomalies et choisi les mises à jour.</label>'+
 '<p data-photo-catalogue-error class="error-message" role="alert" hidden></p><div class="form-actions"><button type="submit" class="btn primary">Importer les lignes vérifiées</button></div></form>';
}
async function commit(form){
 if(reading)throw Error('Attendez la fin de lecture des photos.');
 Identity.assertConfigure();
 if(!form.elements.reviewed.checked)throw Error('Cochez la confirmation après relecture.');
 const rows=[...form.querySelectorAll('[data-photo-catalogue-row]')].map(el=>({
  sku:el.querySelector('[name=sku]').value,name:el.querySelector('[name=name]').value,
  location:el.querySelector('[name=location]').value,action:el.querySelector('[name=action]').value,
  confirmName:el.querySelector('[name=confirmName]').checked
 }));
 const existing=products(),list=reviewPhotoRows(rows,existing);
 const groups=new Map();
 for(const row of list){
  if(!groups.has(row.sku))groups.set(row.sku,[]);
  groups.get(row.sku).push(row);
 }
 const jobs=[];
 for(const [sku,rs] of groups){
  const p=existing.find(p=>refKey(p.sku)===sku);
  if(!p&&rs.some(r=>r.action!=='create'))throw Error('Référence nouvelle incohérente : '+sku);
  const uniqueNames=[...new Set(rs.map(r=>r.name))];
  if(uniqueNames.length!==1)throw Error('Noms contradictoires pour '+sku+' : relisez les pages.');
  const locs=[...new Set([...(p?productLocations(p):[]),...rs.map(r=>r.location)])];
  const record={...p,id:p?.id||uid(),sku,name:uniqueNames[0],locations:locs,location:p?.location||locs[0],namePending:false};
  jobs.push({type:'products',record});
 }
 const existingLocations=new Set(Store.list('locations').map(l=>refKey(l.name)));
 for(const r of list)if(!existingLocations.has(r.location)){existingLocations.add(r.location);jobs.push({type:'locations',record:{id:'loc-'+r.location,name:r.location,zone:r.location.startsWith('RES')?'Réserve':'Picking',notes:'Ajout confirmé depuis une feuille photographiée'}});}
 if(!jobs.length)throw Error('Toutes les lignes sont ignorées. Choisissez au moins une ligne à importer.');
 await Store.saveBatch(jobs,'Catalogue et emplacements vérifiés depuis photo');
 closeModal();app.render();toast(groups.size+' référence(s) importée(s), avec contrôle des anomalies.');
}
export function install(callbacks){
 app=callbacks;
 document.addEventListener('click',event=>{const el=event.target.closest('[data-photo-catalogue-action]');if(!el)return;event.preventDefault();if(el.dataset.photoCatalogueAction==='preview')try{preview();}catch(e){toast(e.message,true);}});
 document.addEventListener('change',event=>{const el=event.target.closest('[data-photo-catalogue-files]');if(el?.files?.length){const files=[...el.files];el.value='';void readFiles(files).catch(e=>toast(e.message,true));}});
 document.addEventListener('submit',event=>{const form=event.target.closest('[data-photo-catalogue-review]');if(!form)return;event.preventDefault();event.stopImmediatePropagation();const button=form.querySelector('[type=submit]');button.disabled=true;void commit(form).catch(e=>{const root=form.querySelector('[data-photo-catalogue-error]');if(root){root.hidden=false;root.textContent=e.message;}toast(e.message,true);}).finally(()=>{if(button.isConnected)button.disabled=false;});},true);
}
