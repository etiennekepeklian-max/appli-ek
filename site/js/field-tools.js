import * as Store from './storage.js';
import {products,findProducts} from './model.js';
import {productLocations} from './ops-core.js';
import {LOCATION_TYPES,splitLocation,locationValue,referenceMatches,googleConnectionInput} from './field-core.js';
import {state,esc,field,toast} from './ui.js';
import {persistDraft,hydratePhotos} from './ops.js';
import {pendingDuplicates,preferredLocation} from './workflow-core.js';

let pendingTimer;
export function locationFields(value=''){
  const parts=splitLocation(value);
  return `${field('locationType','Type d’emplacement',parts.type,{select:[{value:'',label:'À préciser'},...LOCATION_TYPES.map(value=>({value,label:value}))]})}${field('location','Adresse de l’emplacement',parts.address,{code:true,voice:true})}<p class="hint full" data-location-preview>${esc(value||'Le type sélectionné sera ajouté devant l’adresse.')}</p>`;
}
function setLocation(form,value,sku){
  const p=splitLocation(value);form.elements.locationType.value=p.type;form.elements.location.value=p.address;
  form.elements.location.dataset.autoSku=sku||'';refreshLocation(form);
}
function refreshLocation(form){const p=form.querySelector('[data-location-preview]');if(p)p.textContent=locationValue(form.elements.location.value,form.elements.locationType.value)||'Le type sélectionné sera ajouté devant l’adresse.';}
function renderReference(form){
  if(!form?.isConnected)return;const input=form.elements.sku,box=form.querySelector('#pending-reference-result');if(!input||!box)return;
  const result=referenceMatches(input.value,products(),findProducts(input.value)),address=form.elements.location;renderDuplicates(form);
  const selected=result.exact.find(p=>p.id===form.dataset.selectedProductId);
  if(selected){result.exact=[selected];result.status='found';}
  if(address.dataset.autoSku&&address.dataset.autoSku!==input.value.trim().toUpperCase()){setLocation(form,'','');}
  form.dataset.recognizedSku='';
  if(result.status==='empty'){box.innerHTML='';return;}
  if(result.status==='found'){
    const p=result.exact[0],locations=productLocations(p);form.dataset.recognizedSku=p.sku;
    box.innerHTML=`<div class="reference-confirm">${p.photoId?`<img class="reference-photo" data-product-photo="${esc(p.photoId)}" alt="${esc(p.name)}" hidden>`:''}<strong>✓ Référence reconnue</strong><p>${esc(p.name)}</p><small>Réf. ${esc(p.sku)}${p.barcode?' · EAN '+esc(p.barcode):''}</small>${locations.length>1?`<label class="section-gap">Emplacement connu<select data-reference-location><option value="">Choisir parmi ${locations.length} emplacements</option>${locations.map(l=>`<option value="${esc(l)}">${esc(l)}</option>`).join('')}</select></label>`:locations.length?`<p class="hint">Emplacement : ${esc(locations[0])}</p>`:'<p class="hint">Aucun emplacement connu pour cette référence.</p>'}</div>`;
    const current=locationValue(address.value,form.elements.locationType.value);
    const preferred=preferredLocation(p);
    if(preferred&&(!current||address.dataset.autoSku)){setLocation(form,preferred,input.value.trim().toUpperCase());void persistDraft();}
    void hydratePhotos();
    if(locations.length>1){const select=box.querySelector('[data-reference-location]');if(locations.includes(current||preferred))select.value=current||preferred;}
  }else{
    const list=result.status==='ambiguous'?result.exact:result.suggestions;
    box.innerHTML=`<p class="hint">${result.status==='ambiguous'?'Plusieurs produits correspondent : choisissez le bon.':list.length?'Continuez la saisie ou choisissez une référence.':'Référence absente du catalogue. Vous pouvez la signaler ; vérifiez les chiffres saisis.'}</p>${list.map(p=>`<button type="button" class="reference-suggestion" data-reference-id="${esc(p.id)}"><strong>${esc(p.sku)}</strong><span>${esc(p.name)}</span></button>`).join('')}`;
  }
}
function renderDuplicates(form){
  const box=form.querySelector('[data-pending-duplicates]');if(!box)return;
  const found=referenceMatches(form.elements.sku.value,products(),findProducts(form.elements.sku.value)),selected=found.exact.find(p=>p.id===form.dataset.selectedProductId),sku=selected?.sku||(found.status==='found'?found.exact[0].sku:form.elements.sku.value);
  const rows=pendingDuplicates(Store.list('pending'),{id:form.dataset.id,orderNumber:form.elements.orderNumber.value,sku}),key=JSON.stringify(rows.map(r=>[r.id,r.updatedAt]));
  if(box.dataset.matches===key)return;box.dataset.matches=key;box.hidden=!rows.length;
  box.innerHTML=rows.length?`<p><strong>Cette référence est déjà signalée sur cette commande.</strong></p>${rows.map(r=>`<p>${esc(r.location||'Casier non indiqué')} · ${r.status==='received'?'Réassort reçu':'En attente'}</p><button type="button" class="btn small section-gap" data-action="edit-pending" data-id="${esc(r.id)}">Ouvrir l’attente existante</button>`).join('')}<label class="check-label section-gap"><input type="checkbox" name="allowDuplicate">Créer une autre attente pour un autre casier, avec une précision</label>`:'';
}
export function refreshPendingReference(){const form=document.querySelector('[data-form=pending]');if(form)renderReference(form);}
export function confirmPendingReference(form){
  renderReference(form);const found=referenceMatches(form.elements.sku.value,products(),findProducts(form.elements.sku.value));
  const selected=found.exact.find(p=>p.id===form.dataset.selectedProductId);if(selected)return selected.sku;
  if(found.status==='ambiguous')throw Error('Choisissez la bonne référence parmi les produits proposés.');
  return found.status==='found'?found.exact[0].sku:form.elements.sku.value;
}
export function barcodeValue(form){
  const value=form.elements.value.value.trim();
  if(state.codePurpose!=='location')return value;
  const type=form.querySelector('[name=barcodeLocationType]')?.value;
  if(!type)throw Error('Choisissez PAC, PAD ou RES pour le code d’emplacement.');
  const full=locationValue(value,type);if(!full)throw Error('Saisissez l’adresse de l’emplacement.');return full;
}
export function enhanceFields(root,route){
  if(route==='codes'){
    const form=root.querySelector('[data-form=barcode]');
    if(form&&!form.querySelector('#barcode-purpose')){
      form.insertAdjacentHTML('afterbegin',`${field('barcodePurpose','Créer le code d’une…',state.codePurpose||'reference',{id:'barcode-purpose',select:[{value:'reference',label:'Référence produit'},{value:'location',label:'Adresse d’emplacement'}],full:true})}<div id="barcode-location-type" ${state.codePurpose==='location'?'':'hidden'}>${field('barcodeLocationType','Type d’emplacement',state.codeLocationType||splitLocation(state.codeValue).type||'',{select:[{value:'',label:'Choisir le type'},...LOCATION_TYPES.map(value=>({value,label:value}))]})}<p class="hint" id="barcode-location-preview"></p></div>`);
      previewBarcode(form);
    }
    const stars=root.querySelector('#code-stars');if(stars){const group=stars.closest('.field');if(group)group.hidden=state.codeFormat==='CODE39';}
  }
}
function previewBarcode(form){const p=form.querySelector('#barcode-location-preview');if(p)p.textContent=locationValue(form.elements.value.value,form.elements.barcodeLocationType.value)||'Le préfixe sera ajouté automatiquement.';}
export function applyTheme(){
  const setting=Store.settings().theme||(Store.scope()==='live'?localStorage.getItem('ek-theme'):null)||'system';
  const dark=setting==='dark'||setting==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';
  localStorage.setItem('ek-theme',setting);document.querySelector('meta[name=theme-color]')?.setAttribute('content',dark?'#111111':'#ffffff');
}
export function saveGoogleForm(){
  const form=document.querySelector('[data-form=google-settings]');if(!form)return null;
  return googleConnectionInput(form.elements.clientId.value,form.elements.spreadsheetId.value);
}
export function installFields(){
  document.addEventListener('input',e=>{const el=e.target,form=el.closest('form');
    if(form?.dataset.form==='pending'&&['sku','orderNumber'].includes(el.name)){if(el.name==='sku')delete form.dataset.selectedProductId;clearTimeout(pendingTimer);pendingTimer=setTimeout(()=>renderReference(form),100);}
    if(form?.elements.location&&['location','locationType'].includes(el.name)){if(el.name==='location')delete form.elements.location.dataset.autoSku;refreshLocation(form);}
    if(form?.dataset.form==='barcode'&&el.name==='value')previewBarcode(form);
  });
  document.addEventListener('change',e=>{const el=e.target,form=el.closest('form');
    if(el.id==='barcode-purpose'){state.codePurpose=el.value;form.querySelector('#barcode-location-type').hidden=el.value!=='location';previewBarcode(form);}
    if(el.name==='barcodeLocationType'){state.codeLocationType=el.value;previewBarcode(form);}
    if(el.name==='format'&&form?.dataset.form==='barcode'){state.codeFormat=el.value;const group=form.querySelector('#code-stars')?.closest('.field');if(group)group.hidden=el.value==='CODE39';}
    if(el.name==='locationType'&&form?.elements.location){delete form.elements.location.dataset.autoSku;refreshLocation(form);void persistDraft();}
    if(el.name==='allowDuplicate'&&el.checked){form.querySelector('.pending-detail').open=true;}
    if(el.matches('[data-reference-location]')){setLocation(form,el.value,form.elements.sku.value.trim().toUpperCase());void persistDraft();}
  });
  document.addEventListener('click',e=>{const b=e.target.closest('[data-reference-id]');if(!b)return;e.preventDefault();const form=b.closest('form'),p=products().find(p=>p.id===b.dataset.referenceId);if(!p)return;form.elements.sku.value=p.sku;form.dataset.selectedProductId=p.id;renderReference(form);void persistDraft();});
  new MutationObserver(()=>{const form=document.querySelector('[data-form=pending]');if(form&&!form.querySelector('#pending-reference-result')){const container=form.elements.sku.closest('.field');container.insertAdjacentHTML('afterend','<div id="pending-reference-result" class="full" role="status" aria-live="polite"></div>');renderReference(form);}}).observe(document.querySelector('#dialog-body'),{childList:true,subtree:true});
  window.addEventListener('ek-draft-restored',refreshPendingReference);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);applyTheme();
}
