export const VERSION = '1.16.2';
export const SCHEMA = 1;
export const TYPES = ['families','products','enfs','packagings','locations','pending','orders','days','issues','movements','counts','replenishments','documents','codes','preferences','unknowns','journal'];
export const LEGACY_SHEETS = {families:'Familles',products:'References',enfs:'ENF',packagings:'Conditionnements',locations:'Emplacements',pending:'Commandes_attente',orders:'Commandes',days:'Pickings',issues:'Ecarts_stock',movements:'Mouvements',counts:'Inventaires',replenishments:'Reassorts',documents:'Documents',codes:'Historique',preferences:'Parametres',unknowns:'Codes_inconnus',journal:'Journal_hebdomadaire'};
export const SHEETS = {families:'produit',products:'produit',enfs:'produit',packagings:'produit',locations:'produit',pending:'manquant',replenishments:'manquant',issues:'manquant',orders:'objectif picking',days:'objectif picking',movements:'historique',counts:'historique',documents:'historique',codes:'historique',preferences:'historique',unknowns:'historique',journal:'historique'};
export const SHEET_TABS = [...new Set(Object.values(SHEETS))];
export const HEADERS = ['event_id','record_id','updated_at','actor','action','label','order_number','reference','location','quantity','payload_json','device_id'];
export const uid = () => globalThis.crypto?.randomUUID?.() || `ek-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const localDate = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const normalize = s => String(s??'').trim().normalize('NFKC');
export const refKey = s => normalize(s).toLocaleUpperCase('fr-FR');
// Printed order numbers may have padding and a separated registration suffix.
// Product references keep using refKey: their leading zeros remain significant.
export const orderKey = value => {
  const printed=refKey(value).replace(/\s+/g,''),m=printed.match(/^(\d{6,})\/\d{3}$/);
  const number=m?m[1]:printed;
  return /^\d+$/.test(number)?number.replace(/^0+(?=\d)/,''):number;
};
export const escapeHTML = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function number(value,{min=0,max=1e9,integer=false,optional=false}={}) {
  if(optional && (value==='' || value==null)) return null;
  if(value==='' || value==null) throw Error('Renseignez un nombre.');
  const n=Number(String(value).replace(',','.'));
  if(!Number.isFinite(n) || n<min || n>max || (integer&&!Number.isInteger(n))) throw Error(`Saisissez ${integer?'un nombre entier':'un nombre'} entre ${min} et ${max}.`);
  return n;
}
export function voiceCode(text) {
  const dictionary = {'zéro':'0','zero':'0','un':'1','une':'1','deux':'2','trois':'3','quatre':'4','cinq':'5','six':'6','sept':'7','huit':'8','neuf':'9','bé':'B','béé':'B','cé':'C','dé':'D','effe':'F','gé':'G','ache':'H','ji':'J','ka':'K','elle':'L','emme':'M','enne':'N','pé':'P','ku':'Q','erre':'R','esse':'S','té':'T','vé':'V','doublevé':'W','ix':'X','igrec':'Y','zède':'Z','étoile':'*','etoile':'*','tiret':'-'};
  const input=normalize(text).toLowerCase().replace(/double v[ée]/g,'doublevé');
  const tokens=input.split(/[\s,;]+/).filter(Boolean);
  const ambiguous=tokens.some(t=>!dictionary[t]&&!/^[a-z0-9*_-]+$/i.test(t) || ['cent','cents','mille','vingt','trente','quarante','cinquante','soixante','dix','onze','douze','treize','quatorze','quinze','seize'].includes(t));
  if(ambiguous) return {value:normalize(text),needsReview:true};
  return {value:tokens.map(t=>dictionary[t]??t.toUpperCase()).join(''),needsReview:true};
}
export function spokenInteger(text){
  const raw=normalize(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(/^\d[\d\s]*$/.test(raw))return Number(raw.replace(/\s/g,''));
  const words=raw.replace(/-/g,' ').replace(/quatre vingts?/g,'quatrevingt').replace(/\bet\b/g,' ').trim().split(/\s+/);
  const values={zero:0,un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,six:6,sept:7,huit:8,neuf:9,dix:10,onze:11,douze:12,treize:13,quatorze:14,quinze:15,seize:16,vingt:20,vingts:20,trente:30,quarante:40,cinquante:50,soixante:60,septante:70,huitante:80,quatrevingt:80,nonante:90};
  if(words.length>1&&words.every(w=>values[w]!=null&&values[w]<10))return Number(words.map(w=>values[w]).join(''));
  let total=0,current=0;for(const w of words){if(w==='cent'||w==='cents')current=Math.max(1,current)*100;else if(w==='mille'){total+=Math.max(1,current)*1000;current=0;}else if(w==='million'||w==='millions'){total=(total+Math.max(1,current))*1e6;current=0;}else if(values[w]!=null)current+=values[w];else throw Error('Dictez le nombre chiffre par chiffre, ou utilisez le clavier.');}return number(total+current,{integer:true});
}
export function estimateLines(lines) {
  let known=0,unknown=0,minimum=0,maximum=0;
  const details=lines.map(line=>{
    const quantity=number(line.quantity,{min:1,integer:true});
    const pack=number(line.pack,{min:1,integer:true,optional:true});
    const override=number(line.pickingOverride,{min:0,integer:true,optional:true});
    if(override!==null){known+=override; minimum+=override; maximum+=override; return {...line,quantity,pack,pickings:override,confirmed:true};}
    if(pack!==null){const n=Math.ceil(quantity/pack);known+=n; minimum+=n;maximum+=n;return {...line,quantity,pack,pickings:n,confirmed:true};}
    unknown++;minimum++;maximum+=quantity;return {...line,quantity,pack:null,pickings:null,confirmed:false};
  });
  return {lines:details,known,unknown,minimum,maximum,total:minimum,status:unknown?'estimated':'verified'};
}
export function dailyStats(date,orders,days,goal=1800){
  const completed=orders.filter(o=>!o.deleted&&o.date===date&&o.status==='completed');
  const correction=days.filter(d=>!d.deleted&&d.date===date).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const calculated=completed.reduce((a,o)=>a+Number(o.total||0),0);
  const total=correction?.manualTotal!=null?Number(correction.manualTotal):calculated;
  return {date,total,calculated,commands:new Set(completed.map(o=>orderKey(o.number)||o.id)).size,goal,remaining:Math.max(0,goal-total),percent:goal>0?total/goal*100:0,status:correction?.manualTotal!=null?'corrected':completed.some(o=>o.calculationStatus!=='verified')?'estimated':'verified',hasData:completed.length>0||correction?.manualTotal!=null,correction};
}
export function latestRecords(events){
  const records=new Map(),seen=new Set();
  const sorted=[...events].sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id));
  for(const ev of sorted){if(seen.has(ev.id))continue;seen.add(ev.id);if(!TYPES.includes(ev.type)||!ev.record?.id)continue;records.set(`${ev.type}:${ev.record.id}`,{...ev.record,updatedAt:ev.updatedAt,_eventId:ev.id});}
  return records;
}
export function makeEvent(type,record,action,actor,deviceId,lastClock=0){
  if(!TYPES.includes(type)||!record.id)throw Error('Fiche invalide.');
  const time=Math.max(Date.now(),lastClock+1);
  return {id:uid(),type,record:structuredClone(record),action,actor,deviceId,updatedAt:new Date(time).toISOString(),schema:SCHEMA,synced:false};
}
export function rowForEvent(ev){
  const r=ev.record;
  return [ev.id,r.id,ev.updatedAt,ev.actor||'',ev.action||'',r.name||r.title||r.label||r.number||r.sku||'',r.orderNumber||r.number||'',r.sku||r.reference||'',r.location||r.from||'',r.quantity??r.total??'',JSON.stringify({type:ev.type,record:r,schema:ev.schema,...(ev.baseEventId?{baseEventId:ev.baseEventId}:{}),...(ev.resolves?.length?{resolves:ev.resolves}:{})}),ev.deviceId||''];
}
export function eventFromRow(row,type){
  if(!row[0]||!row[10])return null;
  try {const data=JSON.parse(row[10]);if(!TYPES.includes(data.type)||(type&&data.type!==type)||!data.record?.id||typeof row[2]!=='string'||!Number.isFinite(Date.parse(row[2])))return null;
    return {id:String(row[0]),type:data.type,record:data.record,updatedAt:row[2],actor:row[3]||'',action:row[4]||'',deviceId:row[11]||'',schema:data.schema||1,synced:true,...(data.baseEventId?{baseEventId:String(data.baseEventId)}:{}),...(Array.isArray(data.resolves)?{resolves:data.resolves.filter(s=>typeof s==='string')}:{}),};
  }catch{return null;}
}
export function parseOrderText(text){
  const match=text.match(/(?:commande|order|bon\s*(?:n[o°]|de\s*préparation)?)\s*[:#n°-]*\s*([A-Z0-9][A-Z0-9/-]{3,})/i);
  const lines=[];
  for(const raw of text.split(/\r?\n/)){
    const t=raw.trim();if(!t||/^(?:total|commande|date|client|page|référence\s|reference\s)/i.test(t))continue;
    const chunks=t.split(/[;\t|]/).map(x=>x.trim());
    if(chunks.length>=2&&/^[A-Z0-9][A-Z0-9._/-]{2,39}$/i.test(chunks[0])&&/^\d+(?:[,.]\d+)?$/.test(chunks[1])){
      lines.push({sku:chunks[0],quantity:chunks[1],pack:/^\d+$/.test(chunks[2]||'')?chunks[2]:'',needsReview:true});continue;
    }
    const m=t.match(/^([A-Z0-9][A-Z0-9._/-]{2,39})\s+.+?\s+(\d{1,7})(?:\s+(?:pcs|pièces?|u|unité[s]?))?\s*$/i);
    if(m&&!/^\d{2}[/-]\d{2}/.test(m[1]))lines.push({sku:m[1],quantity:m[2],pack:'',needsReview:true});
  }
  return {orderNumber:match?.[1]||'',lines};
}
export function csvCell(value){const s=String(value??'');const safe=/^[=+@-]/.test(s)?`'${s}`:s;return '"'+safe.replace(/"/g,'""')+'"';}
export function toCSV(headers,rows){return '\uFEFF'+[headers,...rows].map(r=>r.map(csvCell).join(';')).join('\r\n');}
export function validateFamilyParent(id,parentId,families){
  let p=parentId;const seen=new Set([id]);while(p){if(seen.has(p))throw Error('Une famille ne peut pas être son propre parent.');seen.add(p);p=families.find(f=>f.id===p)?.parentId;}
}
export function validBarcode(value,format='CODE128'){
  if(!value||value.length>120)throw Error('Saisissez une référence de 1 à 120 caractères.');
  if(!/^[\x20-\x7E]+$/.test(value))throw Error('Le code accepte ici les lettres sans accent, les chiffres et les signes courants.');
  if(format==='CODE39'&&!/^[0-9A-Z .$/+%-]+$/.test(value))throw Error('Le Code 39 accepte les majuscules, chiffres et les signes espace . $ / + % - . Les étoiles sont gérées par le format.');
  return true;
}



