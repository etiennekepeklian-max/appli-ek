import * as Store from './storage.js';
import * as Personal from './workbench-store.js';
import {dayPhotoIndex,photoCleanupPlan} from './photo-cleanup-core.js';
import {state,esc,pageHeading,nav,modal,closeModal,check,toast,dateLabel,formError,onModalClose} from './ui.js';

export const ROUTES={'photo-cleanup':'Photos par journée'};
let app,scope='',data,snapshots=[],selected=new Set(),copies=true,busy=false,loading=false,preview;
const size=bytes=>bytes<1024?bytes+' octets':(bytes/(bytes<1048576?1024:1048576)).toLocaleString('fr-FR',{maximumFractionDigits:1})+(bytes<1048576?' Ko':' Mo');
async function read(){
 const space=Store.scope(),data=await Store.snapshotData();await Personal.open(Store.isDemo());const snapshots=[];
 for(const row of await Personal.listSnapshots()){if(Store.scope()!==space)throw Error('La session a changé.');snapshots.push(await Personal.readSnapshot(row.id));}
 if(Store.scope()!==space)throw Error('La session a changé.');return {space,data,snapshots};
}
export function invalidate(){data=null;snapshots=[];preview=null;}
export function render(){
 if(scope!==Store.scope()){scope=Store.scope();data=null;snapshots=[];selected.clear();preview=null;}
 const photos=data?dayPhotoIndex(data,snapshots):[],dates=[...new Set(photos.flatMap(r=>r.dates))].sort().reverse(),plan=selected.size&&data?photoCleanupPlan(data,snapshots,[...selected],{copies}):null;
 return pageHeading('Photos par journée','Libérer de l’espace sur ce téléphone en conservant les bilans et les références.')+'<div class="actions">'+nav('Ma journée','orders','camera')+nav('Espace et sauvegardes','storage','shield')+'<button type="button" class="btn" data-photo-cleanup="refresh">Actualiser la liste</button></div><section class="card section-gap"><h2>Choisir les dates</h2><p class="hint">Les dates correspondent aux journées des commandes lorsqu’elles sont connues ; sinon à la prise de photo. Les photos d’une session encore en cours et celles utilisées ailleurs restent protégées.</p>'+(!data?'<p role="status">Lecture des photos et de leurs copies locales…</p>':dates.length?dates.map(date=>{
  const rows=photos.filter(r=>r.dates.includes(date)),locked=rows.filter(r=>r.protected),bytes=rows.reduce((n,r)=>n+(r.local?r.file.blob.size:0)+(copies?r.copyBytes:0),0);
  return '<label class="archive-file-row"><input type="checkbox" data-photo-date="'+date+'" '+(selected.has(date)?'checked':'')+' '+(busy?'disabled':'')+'><span><strong>'+esc(dateLabel(date,{day:'numeric',month:'long',year:'numeric'}))+'</strong><small>'+rows.length+' photo(s) · '+size(bytes)+(locked.length?' · '+locked.length+' protégée(s)':'')+'</small></span></label>';
 }).join(''):'<p>Aucune photo de commande à supprimer sur cet appareil.</p>')+'<div class="section-gap">'+check('photoCopies','Retirer aussi ces photos des points de restauration locaux.',copies,'data-photo-copies')+'</div><p class="hint">Les mémos vocaux, photos de produits et copies Google sont conservés. Après suppression, les images retirées des points locaux ne pourront plus être récupérées depuis ces points. Une sauvegarde exportée ou Google peut encore les contenir.</p><p class="section-gap" role="status">'+(plan?plan.count+' photo(s) · '+plan.copyCount+' copie(s) de version · '+size(plan.bytes)+' de fichiers sélectionnés'+(plan.blocked.length?' · '+plan.blocked.length+' photo(s) protégée(s) ou partagée(s) avec une date non sélectionnée.':''):'Sélectionnez une ou plusieurs dates.')+'</p><button type="button" class="btn danger full section-gap" data-photo-cleanup="prepare" '+(busy||!plan?.count?'disabled':'')+'>Supprimer les photos sélectionnées</button><p class="hint section-gap">Une confirmation sera demandée. Le volume indiqué compte les fichiers et leurs copies ; l’espace réellement rendu dépend du stockage du navigateur.</p></section>';
}
export async function mount(){
 if(data||loading)return;loading=true;
 try{const fresh=await read();if(state.route!=='photo-cleanup'||fresh.space!==scope)return;data=fresh.data;snapshots=fresh.snapshots;app.render();}finally{loading=false;}
}
async function prepare(){
 const fresh=await read();if(fresh.space!==scope)throw Error('La session a changé.');const plan=photoCleanupPlan(fresh.data,fresh.snapshots,[...selected],{copies});if(!plan.count)throw Error('Aucune photo disponible pour cette sélection.');
 data=fresh.data;snapshots=fresh.snapshots;preview={...plan,scope,copies};
 modal('Supprimer définitivement ces photos ?',`<span hidden data-help-context="photo-cleanup"></span><p><strong>${plan.count} photo(s)${copies?' et '+plan.copyCount+' copie(s) dans les points de restauration':''} · ${size(plan.bytes)}</strong></p><p>Dates : ${plan.dates.map(d=>esc(dateLabel(d,{day:'numeric',month:'long',year:'numeric'}))).join(' · ')}.</p><p>Les commandes, quantités, calculs de picking et leur historique restent conservés. Les photos des brouillons en cours sont protégées. Les copies Google et les fichiers exportés ne sont pas supprimés.</p><p class="error-message">Cette suppression des images ne peut pas être annulée dans Pikéo.${copies?' Ces photos seront également retirées des points de restauration locaux.':' Les points de restauration locaux garderont leurs copies.'}</p><form data-photo-cleanup-form>${check('confirmed','Je confirme la suppression des photos pour les dates indiquées.',false,'required')}<div data-form-error class="error-message" hidden></div><div class="form-actions"><button type="button" class="btn" data-action="close-dialog">Conserver mes photos</button><button class="btn danger" type="submit">Confirmer la suppression des photos</button></div></form>`,true);onModalClose(()=>{preview=null;});
}
async function remove(form){
 const target=preview;if(!target||target.scope!==Store.scope()||!form.elements.confirmed.checked)throw Error('Confirmez la suppression pour les dates indiquées.');
 const fresh=await read(),plan=photoCleanupPlan(fresh.data,fresh.snapshots,target.dates,{copies:target.copies});if(fresh.space!==target.scope||plan.signature!==target.signature)throw Error('Les photos ou leur utilisation ont changé. Fermez et vérifiez la sélection de nouveau.');
 const removed=await Store.removeDayPhotos(plan.manifest,plan.dates,target.scope);let copyCount=0;
 if(target.copies)try{copyCount=await Personal.removePhotoCopies(plan.manifest.map(r=>r.id),target.scope);}catch(error){data=null;snapshots=[];if(form.isConnected)closeModal();app.render();throw Error(removed+' photo(s) retirée(s), mais les copies de version n’ont pas toutes pu être nettoyées. Rouvrez les dates pour réessayer.');}
 preview=null;data=null;snapshots=[];selected.clear();if(form.isConnected)closeModal();app.render();toast(removed+' photo(s) et '+copyCount+' copie(s) locale(s) supprimée(s). Bilans conservés.');
}
export function install(callbacks){app=callbacks;
 document.addEventListener('click',e=>{const b=e.target.closest('[data-photo-cleanup]');if(!b||busy)return;e.preventDefault();if(b.dataset.photoCleanup==='refresh'){data=null;app.render();return;}busy=true;void prepare().catch(err=>toast(err.message,true)).finally(()=>{busy=false;});});
 document.addEventListener('change',e=>{if(busy)return;if(e.target.matches('[data-photo-date]')){e.target.checked?selected.add(e.target.dataset.photoDate):selected.delete(e.target.dataset.photoDate);app.render();}if(e.target.matches('[data-photo-copies]')){copies=e.target.checked;app.render();}});
 document.addEventListener('submit',e=>{const form=e.target.closest('[data-photo-cleanup-form]');if(!form)return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;busy=true;form.querySelector('[type=submit]').disabled=true;void remove(form).catch(err=>form.isConnected?formError(form,err):toast(err.message,true)).finally(()=>{busy=false;if(form.isConnected)form.querySelector('[type=submit]').disabled=false;});},true);
}
