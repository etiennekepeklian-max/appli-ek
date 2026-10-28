import * as Store from './storage.js';
import * as Identity from './identity-context.js';
import {products} from './model.js';
import {refKey,uid} from './core.js';
import {parseEnfText,validateEnf,combineEnfLines} from './enf-core.js';
import {recognizePhoto} from './features.js';
import {state,esc,nav,pageHeading,field,check,modal,closeModal,onModalClose,toast,formError} from './ui.js';
export const ROUTES={enfs:'ENF'};
let app,draft,draftScope,busy=false,queue=Promise.resolve();
const canEdit=()=>Store.isDemo()||Identity.canConfigure();
const button=(label,action,id='',kind='')=>'<button type="button" class="btn '+kind+'" data-enf-action="'+action+'" data-id="'+esc(id)+'">'+label+'</button>';
const hint=s=>'<p class="hint section-gap">'+s+'</p>';
function assertEdit(){if(!Store.isDemo())Identity.assertConfigure();}
function same(){return draftScope===Store.scope();}
function status(s){const p=document.querySelector('[data-enf-status]');if(p)p.textContent=s;}
function persist(){const scope=draftScope,value=structuredClone(draft);queue=queue.catch(()=>{}).then(()=>{if(scope===Store.scope())return Store.setMeta('enf-draft',value);});return queue;}
function capture(form){if(!same()||!form)return;const d=new FormData(form);draft.code=String(d.get('code')||'');draft.name=String(d.get('name')||'');draft.notes=String(d.get('notes')||'');draft.reviewed=!!d.get('reviewed');draft.lines=[...form.querySelectorAll('[data-enf-row]')].map(row=>{const old=draft.lines.find(l=>l.key===row.dataset.enfRow)||{};return {...old,key:row.dataset.enfRow,sku:row.querySelector('[data-enf-sku]').value,quantity:row.querySelector('[data-enf-qty]').value};});}
function invalidate(form){draft.reviewed=false;const input=form?.querySelector('[name=reviewed]');if(input)input.checked=false;}
function drawLines(form){
 const slot=form.querySelector('[data-enf-lines]');slot.innerHTML=draft.lines.map((r,i)=>{const p=products().find(p=>refKey(p.sku)===refKey(r.sku));return '<div class="enf-edit-line" data-enf-row="'+esc(r.key)+'"><label class="field"><span>Référence '+(i+1)+'</span><input data-enf-sku value="'+esc(r.sku)+'" aria-label="Référence '+(i+1)+'" maxlength="60"><small>'+esc(p?.name||r.sku&&'Référence à vérifier'||'')+'</small></label><label class="field"><span>Quantité</span><input data-enf-qty type="number" min="1" max="1000000" step="1" value="'+esc(r.quantity)+'" aria-label="Quantité '+(i+1)+'"></label><button class="icon-button" type="button" data-enf-action="remove-line" data-id="'+esc(r.key)+'" aria-label="Retirer la ligne '+(i+1)+'">×</button>'+(r.raw?'<p class="hint enf-line-source">Lu : '+esc(r.raw)+(r.issues?.length?' · '+esc(r.issues.join(' ; ')):'')+'</p>':'')+'</div>';}).join('')||hint('La photo remplira ce tableau. Vous pouvez aussi ajouter une ligne.');
 const photos=form.querySelector('[data-enf-pages]');photos.textContent=draft.pages.length+' photo(s) conservée(s).';
}
export function render(){
 const query=refKey(state.query),rows=Store.list('enfs').filter(r=>refKey([r.code,r.name,...(r.lines||[]).map(l=>l.sku)].join(' ')).includes(query)).sort((a,b)=>String(a.code).localeCompare(String(b.code),'fr',{numeric:true}));
 return pageHeading('ENF','Le contenu par référence et quantité.',canEdit()?button('Photographier une feuille ENF','new','','primary'):'')+'<div class="actions section-gap">'+nav('Catalogue produits','stock','box')+'</div><div data-enf-draft></div><label class="field section-gap"><span>Rechercher un ENF ou une référence</span><input type="search" id="enf-search" data-filter-search value="'+esc(state.query)+'" placeholder="Code ENF, nom ou référence"></label><div class="record-list section-gap">'+rows.map(r=>'<article class="card"><h2>'+esc(r.code)+'</h2>'+hint(esc(r.name||'')+(r.name?' · ':'')+(r.lines?.length||0)+' référence(s)')+button('Voir le contenu','view',r.id)+'</article>').join('')+'</div>'+(!rows.length?'<section class="card section-gap"><p>Aucun ENF trouvé.</p>'+hint(canEdit()?'Photographiez sa feuille, vérifiez les références et quantités, puis enregistrez.':'Les compositions publiées par un administrateur apparaîtront ici.')+'</section>':'');
}
export async function mount(root){const scope=Store.scope(),d=await Store.meta('enf-draft'),slot=root.querySelector('[data-enf-draft]');if(slot?.isConnected&&scope===Store.scope()&&d&&canEdit())slot.innerHTML='<div class="card section-gap"><p>Un brouillon ENF est conservé sur cet appareil.</p>'+button('Reprendre mon ENF','resume')+'</div>';}
export function shortcut(){return '<div class="actions section-gap">'+nav('ENF — références et quantités','enfs','layers')+'</div>';}
async function openEditor(id='',force=false){
 assertEdit();if(busy)throw Error('La lecture ENF continue. Le brouillon sera conservé.');
 await queue;const old=await Store.meta('enf-draft');if(!force&&old&&(id!==old.id||!id)){modal('Brouillon ENF conservé',hint('Reprenez ce brouillon ou démarrez une autre fiche.')+'<div class="actions section-gap">'+button('Reprendre le brouillon','resume')+button('Démarrer une autre fiche','fresh',id)+'</div>');document.querySelector('#dialog').dataset.helpContext='enfs';return;}
 const record=id?Store.get('enfs',id):null;draftScope=Store.scope();draft={id:id||'',code:record?.code||'',name:record?.name||'',notes:record?.notes||'',lines:(record?.lines||[]).map(l=>({...l,key:uid()})),pages:(record?.documentIds||[]).map(id=>({id,done:true})),reviewed:false,text:''};showEditor();await persist();
}
function showEditor(){
 modal(draft.id?'Modifier l’ENF':'Renseigner un ENF','<form data-enf-form data-help-context="enfs"><label class="field"><span>Photographier la feuille</span><input type="file" accept="image/*" capture="environment" multiple data-enf-photos></label><p data-enf-status class="hint section-gap" role="status">Les références et quantités seront proposées pour relecture.</p><p data-enf-pages class="hint"></p><div class="form-grid mobile-one section-gap">'+field('code','Code ENF',draft.code,{required:true,code:true,attrs:'maxlength="60"'})+field('name','Nom, facultatif',draft.name,{full:true,attrs:'maxlength="140"'})+'</div><div data-enf-lines class="section-gap"></div><div class="actions section-gap">'+button('Ajouter une référence','add-line')+button('Regrouper les références répétées','combine')+button('Relire les photos conservées','retry')+'</div><details class="section-gap"><summary>Texte reconnu et précisions</summary><label class="field section-gap"><span>Texte reconnu, modifiable</span><textarea rows="6" data-enf-text>'+esc(draft.text||'')+'</textarea></label>'+button('Recréer le tableau depuis ce texte','parse')+field('notes','Précisions',draft.notes,{textarea:true,full:true})+'</details><div class="section-gap">'+check('reviewed','J’ai vérifié le code ENF, les références et les quantités.',draft.reviewed)+'</div><p data-form-error class="error-message" role="alert" hidden></p><div class="form-actions"><button type="button" class="btn" data-action="close-dialog">Fermer et garder le brouillon</button><button type="submit" class="btn primary">Enregistrer l’ENF</button></div></form>',true);
 document.querySelector('#dialog').dataset.helpContext='enfs';const form=document.querySelector('[data-enf-form]');drawLines(form);onModalClose(()=>{if(same()){if(!busy)capture(form);void persist();}});
}
function detail(id){
 const row=Store.get('enfs',id);if(!row||row.deleted)throw Error('Cet ENF n’est plus disponible.');
 modal('ENF '+row.code,hint(esc(row.name||''))+'<div class="table-wrap"><table class="data-table"><thead><tr><th>Référence</th><th>Quantité</th></tr></thead><tbody>'+(row.lines||[]).map(l=>{const p=products().find(p=>refKey(p.sku)===refKey(l.sku));return '<tr><td><strong class="mono">'+esc(l.sku)+'</strong>'+(p?'<span class="hint">'+esc(p.name)+'</span>':'')+'</td><td>'+esc(l.quantity)+'</td></tr>';}).join('')+'</tbody></table></div>'+hint(esc(row.notes||''))+'<div class="actions section-gap">'+(row.documentIds||[]).map((file,i)=>button('Photo source '+(i+1),'photo',file)).join('')+(canEdit()?button('Modifier','edit',id)+button('Retirer cette fiche','remove',id):'')+'</div>',true);document.querySelector('#dialog').dataset.helpContext='enfs';
}
async function photo(id){const f=await Store.readFile(id);if(!f)throw Error('Photo absente sur cet appareil. Importez son archive ou restaurez les documents depuis votre sauvegarde.');const url=URL.createObjectURL(f.blob);modal('Feuille source ENF','<img src="'+url+'" alt="Feuille source de la composition ENF" style="max-width:100%;height:auto">',true);document.querySelector('#dialog').dataset.helpContext='enfs';onModalClose(()=>URL.revokeObjectURL(url));}
async function addPhotos(files,retry=false){
 assertEdit();if(busy)return;busy=true;const scope=Store.scope(),form=document.querySelector('[data-enf-form]');capture(form);invalidate(form);for(const el of form.elements)el.disabled=true;
 try{
  const pending=retry?draft.pages.filter(p=>!p.done):files;
  for(let i=0;i<pending.length;i++){
   if(scope!==Store.scope())return;let item=pending[i],file,page;
   if(retry){page=item;file=(await Store.readFile(page.id))?.blob;if(!file)continue;}
   else{file=item;if(!file.type.startsWith('image/')||file.type==='image/svg+xml'||file.size>25e6)throw Error('Choisissez une photo de moins de 25 Mo.');const bytes=await file.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(scope!==Store.scope())return;if(draft.pages.some(p=>p.hash===hash)){status('Cette photo est déjà dans le brouillon ; elle n’est pas comptée deux fois.');continue;}const id=await Store.storeFile(file,file.name||'feuille-enf.jpg','enf-photo');if(scope!==Store.scope())return;await Store.save('documents',{id,name:file.name||'feuille-enf.jpg',kind:'enf-photo',createdAt:new Date().toISOString()},'Feuille ENF conservée');page={id,hash,done:false};draft.pages.push(page);await persist();}
   status('Lecture de la photo '+(i+1)+' sur '+pending.length+'…');
   try{const text=await recognizePhoto(file,message=>{if(scope===Store.scope())status(message);});if(scope!==Store.scope())return;const read=parseEnfText(text,products());draft.text=(draft.text?draft.text+'\n\n':'')+text;draft.text=draft.text.slice(-100000);if(!draft.code&&read.code)draft.code=read.code;draft.lines=draft.lines.filter(l=>l.sku||l.quantity).concat(read.lines.map(l=>({...l,key:uid()})));page.done=true;if(form.isConnected&&!form.elements.code.value)form.elements.code.value=draft.code;status(read.warnings.join(' ')||'Lecture terminée. Vérifiez les références et quantités avant d’enregistrer.');}
   catch(e){page.error='Lecture à reprendre';status('Lecture impossible pour cette photo. Elle est conservée : réessayez ou complétez le tableau.');}
   await persist();if(form.isConnected)drawLines(form);
  }
 }finally{busy=false;if(scope===Store.scope()&&form.isConnected){for(const el of form.elements)el.disabled=false;drawLines(form);}}
}
async function action(node){
 const a=node.dataset.enfAction,id=node.dataset.id,form=document.querySelector('[data-enf-form]');
 if(a==='new')return openEditor();if(a==='fresh')return openEditor(id,true);if(a==='edit')return openEditor(id);if(a==='view')return detail(id);if(a==='photo')return photo(id);
 if(a==='resume'){assertEdit();if(busy)throw Error('La lecture continue.');await queue;draft=await Store.meta('enf-draft');if(!draft)throw Error('Brouillon introuvable.');draftScope=Store.scope();showEditor();return;}
 if(a==='remove'){modal('Retirer l’ENF',hint('La fiche sera retirée. Son historique reste conservé et l’action peut être annulée.')+button('Confirmer le retrait','remove-confirm',id,'primary'));document.querySelector('#dialog').dataset.helpContext='enfs';return;}
 if(a==='remove-confirm'){assertEdit();await Store.save('enfs',{id,deleted:true},'ENF retiré');closeModal();app.render();return;}
 if(!form||busy)return;capture(form);assertEdit();invalidate(form);
 if(a==='add-line')draft.lines.push({key:uid(),sku:'',quantity:''});
 if(a==='remove-line')draft.lines=draft.lines.filter(l=>l.key!==id);
 if(a==='combine')draft.lines=combineEnfLines(draft.lines);
 if(a==='parse'){const text=form.querySelector('[data-enf-text]').value,read=parseEnfText(text,products());draft.text=text;draft.lines=read.lines.map(l=>({...l,key:uid()}));if(!draft.code&&read.code){draft.code=read.code;form.elements.code.value=read.code;}status('Tableau recréé : relisez toutes les lignes.');}
 if(a==='retry')return addPhotos([],true);
 drawLines(form);await persist();
}
export function install(callbacks){
 app=callbacks;document.addEventListener('click',e=>{const b=e.target.closest('[data-enf-action]');if(!b||b.disabled)return;e.preventDefault();void action(b).catch(err=>toast(err.message,true));});
 document.addEventListener('input',e=>{const form=e.target.closest('[data-enf-form]');if(!form||busy)return;capture(form);if(e.target.matches('[data-enf-sku]')){const product=products().find(p=>refKey(p.sku)===refKey(e.target.value));e.target.closest('[data-enf-row]').querySelector('small').textContent=product?.name||'Référence à vérifier';}if(e.target.name!=='reviewed')invalidate(form);void persist().catch(err=>toast(err.message,true));});
 document.addEventListener('change',e=>{if(!e.target.matches('[data-enf-photos]'))return;const files=[...e.target.files];e.target.value='';if(files.length)void addPhotos(files).catch(err=>toast(err.message,true));});
 document.addEventListener('submit',e=>{const form=e.target.closest('[data-enf-form]');if(!form)return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;void(async()=>{assertEdit();capture(form);if(!draft.reviewed)throw Error('Vérifiez le tableau puis cochez la relecture.');const clean=validateEnf(draft),existing=Store.list('enfs').find(r=>r.id!==draft.id&&refKey(r.code)===refKey(clean.code));if(existing)throw Error('Ce code ENF existe déjà. Ouvrez sa fiche pour le modifier.');const record={...clean,id:draft.id||uid(),documentIds:draft.pages.map(p=>p.id),verifiedAt:new Date().toISOString()};busy=true;await Store.save('enfs',record,'Composition ENF enregistrée');await queue;await Store.setMeta('enf-draft',null);draftScope='';draft=null;closeModal();app.render();detail(record.id);toast('ENF enregistré. Vous pouvez consulter sa composition.');})().catch(err=>formError(form,err)).finally(()=>busy=false);});
}

export async function flush(){const form=document.querySelector('[data-enf-form]');if(draft&&same()){if(form&&!busy)capture(form);await persist();}await queue;}
