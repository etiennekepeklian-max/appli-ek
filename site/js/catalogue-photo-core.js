import {refKey} from './core.js';
const code=/^[A-Z0-9][A-Z0-9._/-]{1,59}$/i;
const address=/^(?:PAC|PAD|RES)[A-Z0-9._/-]{1,70}$/i;
export function validPhotoLocation(value){return address.test(refKey(value));}
export function auditPhotoRows(lines,existing=[]){
 const seen=new Set();
 return lines.map((line,index)=>{
  const sku=refKey(line.sku),location=refKey(line.location),name=String(line.name||'').trim().slice(0,140),warnings=[];
  if(!code.test(sku))warnings.push('Référence manquante ou suspecte');
  if(!name)warnings.push('Dénomination manquante');
  if(!validPhotoLocation(location))warnings.push('Adresse invalide : PAC, PAD ou RES attendu');
  const key=sku+':'+location;
  if(seen.has(key))warnings.push('Association répétée sur les pages');
  seen.add(key);
  const previous=existing.find(p=>refKey(p.sku)===sku);
  if(previous&&previous.name&&name&&refKey(previous.name)!==refKey(name))warnings.push('Nom différent de la fiche existante : confirmer la correction');
  return {...line,index,sku,name,location,existingId:previous?.id||'',warnings};
 });
}
export function parseCataloguePhotoText(raw,existing=[]){
 const rows=[];
 for(const [index,original] of String(raw||'').split(/\r?\n/).entries()){
  const line=original.trim().replace(/\u00a0/g,' ');
  if(!line||/^(?:r[ée]f[ée]rence|sku|produit|nom|adresse|emplacement|casier|page|date|liste|total)\b/i.test(line))continue;
  let cells=line.split(/[;\t|]/).map(s=>s.trim()).filter(Boolean);
  let sku='',name='',location='';
  if(cells.length>=3){[sku,name,location]=[cells[0],cells.slice(1,-1).join(' '),cells.at(-1)];}
  else {
   const found=line.match(/^([A-Z0-9][A-Z0-9._/-]{1,59})\s+(.+?)\s+((?:PAC|PAD|RES)[A-Z0-9._/-]{1,70})$/i);
   if(found)[,sku,name,location]=found;
   else if(cells.length===2){[sku,location]=cells;name='';}
   else{const codeAtStart=line.match(/^([A-Z0-9][A-Z0-9._/-]{1,59})\b\s*(.*)$/);if(!codeAtStart)continue;sku=codeAtStart[1];name=codeAtStart[2];}
  }
  rows.push({sku,name,location,sourceLine:index+1});
  if(rows.length>=500)break;
 }
 return auditPhotoRows(rows,existing);
}
export function reviewPhotoRows(rows,existing=[]){
 const valid=auditPhotoRows(rows,existing);
 if(!valid.length)throw Error('Aucune ligne à importer. Vérifiez le texte ou reprenez la photo.');
 const actionable=valid.filter(r=>r.action!=='skip');
 for(const row of actionable){
  if(row.warnings.some(w=>w.includes('Référence manquante')||w.includes('Dénomination manquante')||w.includes('Adresse invalide')||w.includes('Association répétée')))throw Error('Corrigez les lignes signalées avant validation (ligne '+(row.index+1)+').');
  if(!['create','update'].includes(row.action))throw Error('Choisissez Créer, Mettre à jour ou Ignorer pour chaque ligne.');
  if(row.existingId&&row.action==='create')throw Error('La référence '+row.sku+' existe : choisissez Mettre à jour ou Ignorer.');
  if(!row.existingId&&row.action==='update')throw Error('La référence '+row.sku+' est nouvelle : choisissez Créer.');
  const existingProduct=existing.find(p=>refKey(p.sku)===row.sku);
  if(existingProduct&&refKey(existingProduct.name)!==refKey(row.name)&&!row.confirmName)throw Error('Confirmez la correction du nom pour '+row.sku+'.');
 }
 return actionable;
}
