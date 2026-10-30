import {refKey} from './core.js';
const codeOK=s=>/^[A-Z0-9][A-Z0-9._/-]{0,59}$/i.test(s);
export const ENF_ROLES={meuble:'Meuble',mere:'Réf mère',fille:'Réf fille'};
const lineKey=row=>refKey(row.sku)+'|'+(row.role||'');
export function searchEnfs(records,query=''){
 const key=refKey(query),matches=records.filter(r=>!r.deleted&&refKey([r.code,r.name,...(r.lines||[]).map(l=>l.sku)].join(' ')).includes(key));
 return matches.sort((a,b)=>Number(refKey(b.code)===key)-Number(refKey(a.code)===key)||String(a.code).localeCompare(String(b.code),'fr',{numeric:true}));
}
export function parseEnfText(text,catalogue=[]){
 const raw=String(text||'').replace(/\u00a0/g,' '),found=raw.match(/(?:code\s+enf|r[ée]f[ée]rence\s+enf|\benf\b)(?:\s*[:#]\s*|\s+)(?:n[°o]\s*)?([A-Z0-9][A-Z0-9._/-]{1,59})/i);
 let code=found&&/\d/.test(found[1])?found[1]:'';
 if(!code)code=raw.match(/\b(ENF[-._/]?\d[A-Z0-9._/-]*)\b/i)?.[1]||'';
 const lines=[],unread=[];
 for(const original of raw.split(/\r?\n/)){
  const line=original.trim();if(!line||/^(?:code\s+enf|enf\b|r[ée]f[ée]rence\s+enf|composition|contenu|total|date|page|r[ée]f[ée]rence\b|quantit[ée]\b|article\b)/i.test(line))continue;
  const m=line.match(/^([A-Z0-9][A-Z0-9._/-]{1,59})\s*(?:[;|\t]\s*|\s+)(.+)$/i);if(!m||!/\d/.test(m[1])||/^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(m[1])||refKey(m[1])===refKey(code))continue;
  let sku=m[1],tail=m[2].trim(),quantity='';
  const cells=line.split(/[;|\t]/).map(s=>s.trim()).filter(Boolean);
  if(cells.length>1&&/^\d+(?:[,.]\d+)?$/.test(cells[1]))quantity=cells[1];
  else quantity=tail.match(/(?:^|\s)(\d+(?:[,.]\d+)?)\s*(?:pcs?|pi[èe]ces?|unit[ée]s?|u)?\s*$/i)?.[1]||'';
  const product=catalogue.find(p=>refKey(p.sku)===refKey(sku)||p.barcode&&refKey(p.barcode)===refKey(sku));if(product)sku=product.sku;
  const issues=[];if(!product)issues.push('Référence à vérifier');if(!quantity)issues.push('Quantité non reconnue');if((tail.match(/\d+(?:[,.]\d+)?/g)||[]).length>1)issues.push('Plusieurs nombres : relire la quantité');
  lines.push({sku,quantity,raw:line.slice(0,180),issues});
 }
 const seen=new Set();for(const row of lines){const key=refKey(row.sku);if(seen.has(key))row.issues.push('Référence répétée : ne pas compter deux fois');seen.add(key);}
 return {code,lines,unread,warnings:lines.length?[]:['Aucune ligne reconnue. Vérifiez la photo ou complétez le tableau.']};
}
export function validateEnf(data){
 const code=String(data?.code||'').trim();if(!codeOK(code))throw Error('Renseignez le code ENF avec ses lettres, chiffres et zéros.');
 if(!Array.isArray(data.lines)||!data.lines.length||data.lines.length>300)throw Error('Renseignez entre 1 et 300 références.');
 const seen=new Set(),lines=[];
 for(const row of data.lines){const sku=String(row.sku||'').trim(),quantity=Number(String(row.quantity??'').replace(',','.')),role=row.role||'';if(!codeOK(sku))throw Error('Une référence est vide ou invalide.');if(role&&!Object.hasOwn(ENF_ROLES,role))throw Error('Choisissez Meuble, Réf mère ou Réf fille pour le type de référence.');if(!Number.isInteger(quantity)||quantity<1||quantity>1000000)throw Error('Chaque quantité doit être un entier positif, sans valeur devinée.');const key=lineKey({sku,role});if(seen.has(key))throw Error('Une référence est répétée dans le même type. Vérifiez puis regroupez les lignes concernées.');seen.add(key);lines.push({sku,quantity,...(role?{role}:{})});}
 return {code,name:String(data.name||'').trim().slice(0,140),notes:String(data.notes||'').trim().slice(0,2000),lines};
}
export function combineEnfLines(rows){
 const map=new Map();for(const row of rows){const quantity=Number(String(row.quantity??'').replace(',','.'));if(!Number.isInteger(quantity)||quantity<1)throw Error('Corrigez les quantités avant de regrouper.');if(!refKey(row.sku))throw Error('Corrigez les références avant de regrouper.');const key=lineKey(row),old=map.get(key);if(old)old.quantity+=quantity;else map.set(key,{...row,quantity});}return [...map.values()];
}
