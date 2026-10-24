import {refKey} from './core.js';
import {productLocations,matchesSearch} from './ops-core.js';

export function pendingDuplicates(rows,{id,orderNumber,sku}){
  const order=refKey(orderNumber),reference=refKey(sku);
  if(!order||!reference)return [];
  return rows.filter(r=>!r.deleted&&r.id!==id&&r.status!=='done'&&refKey(r.orderNumber)===order&&refKey(r.sku)===reference);
}
export function validatePendingDuplicate(duplicates,location,allow,notes){
  if(!duplicates.length)return;
  if(!allow)throw Error('Cette référence est déjà signalée sur cette commande. Ouvrez l’attente existante ci-dessous.');
  if(!refKey(location)||duplicates.some(r=>refKey(r.location)===refKey(location)))throw Error('Une autre attente doit concerner un casier différent et renseigné.');
  if(!String(notes||'').trim())throw Error('Précisez pourquoi une autre attente est nécessaire dans « Ajouter un détail ».');
}
export function preferredLocation(product){
  const locations=productLocations(product);
  return locations.includes(product?.preferredLocation)?product.preferredLocation:locations.length===1?locations[0]:'';
}
export function missingProductInfo(product){
  const missing=[];
  if(product.namePending||!product.name||product.name==='Référence '+product.sku)missing.push('identity');
  if(!productLocations(product).length)missing.push('location');
  if(!product.effectiveUnitsPerPick)missing.push('rule');
  if(!product.familyId||product.familyId==='a-classer')missing.push('family');
  return missing;
}
export const completionLabels={identity:'Nom à identifier',location:'Emplacement absent',rule:'Règle de picking absente',family:'Famille à préciser'};
export function completionRows(products,filter='all',query=''){
  return products.map(product=>({product,missing:missingProductInfo(product)})).filter(({product,missing})=>missing.length&&(filter==='all'||missing.includes(filter))&&matchesSearch(product,['sku','barcode','name','aliases','location','locations'],query));
}
export function backupPresentation({demo=false,online=true,configured=false,connected=false,busy=false,error='',pending=0,documents=0,lastSync=null}){
  const count=pending+documents;
  if(demo)return {kind:'demo',title:'Démonstration : données séparées',action:null};
  if(busy)return {kind:'busy',title:'Sauvegarde en cours…',action:null};
  if(error)return {kind:'error',title:'La sauvegarde n’a pas abouti',action:online?(configured?'retry':'configure'):null};
  if(!online)return {kind:'offline',title:'Hors connexion — saisies conservées ici',action:null};
  if(!configured)return {kind:'local',title:'Sauvegarde Google à configurer',action:'configure'};
  if(!connected)return {kind:'disconnected',title:'Connexion Google à reprendre',action:'connect'};
  if(count)return {kind:'pending',title:'Des éléments restent à sauvegarder',action:'sync'};
  return {kind:lastSync?'synced':'ready',title:lastSync?'Sauvegarde à jour':'Première sauvegarde à effectuer',action:'sync'};
}
export function dayAttention(group,mode){
  const reasons=[];
  if(group.reviewPages.length)reasons.push('Page(s) à relire');
  if(group.incomplete&&!(mode==='append'&&group.appendIncomplete===false))reasons.push('Pages manquantes');
  if(group.estimate.unknown)reasons.push('Règle(s) de picking absente(s)');
  if(group.mode==='exists')reasons.push('Commande déjà enregistrée');
  if(group.mode==='other-day')reasons.push('Commande d’une autre journée');
  return reasons;
}
