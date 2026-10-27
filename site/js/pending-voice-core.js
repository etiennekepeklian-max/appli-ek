import {voiceCode,spokenInteger} from './core.js';

const clean=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function code(text){
 const raw=text.trim().replace(/^(?:numero|n[°o])\s*/,'').replace(/\bmerci(?: beaucoup)?[.!?]*$/,'').replace(/[.,!?]+$/,'').replace(/double\s+ve?\b/g,'doubleve').trim();if(!raw)return '';
 if(/^\d[\d\s.,-]*$/.test(raw))return raw.replace(/[\s.,-]/g,'');
 if(/\b(?:cent|cents|mille|million|millions|vingt|trente|quarante|cinquante|soixante|dix|onze|douze|treize|quatorze|quinze|seize)\b/.test(raw)){
  try{const prefix=raw.match(/^(?:(?:zero|0)\s+)+/)?.[0]||'';return '0'.repeat(prefix.trim()?prefix.trim().split(/\s+/).length:0)+String(spokenInteger(raw.slice(prefix.length)));}catch{return '';}
 }
 const tokens=raw.split(/[\s,;]+/),words=new Set('zero un une deux trois quatre cinq six sept huit neuf be bee ce de effe ge ache ji ka elle emme enne pe ku erre esse te ve doubleve ix igrec y zede tiret'.split(' '));
 if(tokens.some((t,i)=>!words.has(t)&&!/^\d+$/.test(t)&&!(/^[a-z0-9._/-]+$/i.test(t)&&/\d/.test(t))&&!/^[a-z]$/.test(t)&&!(i===0&&/^[a-z]{2,4}$/.test(t)&&!['pour','avec','dans','puis','code','cela','moi','est','une'].includes(t))))return '';
 const letters={be:'B',bee:'B',ce:'C',de:'D',ge:'G',pe:'P',te:'T',ve:'V',doubleve:'W',zede:'Z'};
 const result=voiceCode(tokens.map(t=>letters[t]||t).join(' '));return /^[A-Z0-9][A-Z0-9._/-]{1,119}$/.test(result.value)&&/\d/.test(result.value)?result.value:'';
}
export function parsePendingVoice(text){
 const raw=clean(text).replace(/\breference\s+(?:produit|article|manquante)\b/g,'reference').replace(/\bnumero\s+(?:de\s+)?commande\b/g,'commande');
 const labels=[...raw.matchAll(/\b(commande|enregistrement|reference|ref|article|emplacement|casier|quantite|priorite)\b\s*[:=#-]?/g)],values={orderNumber:[],sku:[]};
 for(let i=0;i<labels.length;i++){
  const label=labels[i];if(/emplacement|casier|quantite|priorite/.test(label[1]))continue;const field=/commande|enregistrement/.test(label[1])?'orderNumber':'sku',value=code(raw.slice(label.index+label[0].length,labels[i+1]?.index??raw.length));
  if(value)values[field].push(value);
 }
 const result={orderNumber:'',sku:'',warnings:[]};
 for(const field of ['orderNumber','sku']){const unique=[...new Set(values[field])];if(unique.length===1)result[field]=unique[0];else result.warnings.push(unique.length?'Plusieurs '+(field==='sku'?'références':'numéros de commande')+' ont été entendus.':'Le '+(field==='sku'?'numéro de référence':'numéro de commande')+' n’a pas été identifié.');}
 return result;
}
