import {refKey,number,localDate,dailyStats} from './core.js';

export const WAIT_LIMIT=30*60*1000;
export const searchKey=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function oneEdit(a,b){
  if(Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}
  return edits+(i<a.length||j<b.length?1:0)<=1;
}
export function matchesSearch(record,fields,query){
  if(!query?.trim())return true;
  const values=fields.map(f=>String(record[f]??'')),joined=values.map(searchKey).join(' ');
  const tokens=query.trim().split(/\s+/).map(searchKey).filter(Boolean);
  return tokens.every(token=>joined.includes(token)||(token.length>=5&&values.slice(2).flatMap(v=>v.split(/[^\p{L}\p{N}]+/u)).some(word=>oneEdit(searchKey(word),token))));
}

// RFC-style quoted cells; quoted separators/newlines and an Excel UTF-8 BOM are supported.
export function parseDelimited(text){
  if(typeof text!=='string'||text.includes('\u0000')||text.includes('\uFFFD'))throw Error('Fichier illisible. Exportez-le en CSV UTF-8 depuis Excel.');
  text=text.replace(/^\uFEFF/,'');
  const first=text.split(/\r?\n/)[0],separator=first.includes(';')?';':first.includes('\t')?'\t':',';
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else cell+=c;continue;}
    if(c==='"'){if(cell.trim()||closed)throw Error('Guillemets CSV mal placés.');quoted=true;continue;}
    if(c===separator||c==='\n'||c==='\r'){
      row.push(cell.trim());cell='';closed=false;
      if(c!==separator){if(row.some(Boolean))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}
    }else{if(closed&&c.trim())throw Error('Séparateur manquant après les guillemets.');cell+=c;}
  }
  if(quoted)throw Error('Guillemets CSV non refermés.');
  row.push(cell.trim());if(row.some(Boolean))rows.push(row);
  return rows;
}
export function parseLocationImport(text){
  const rows=parseDelimited(text);if(rows.length<2)throw Error('Ajoutez les en-têtes reference;emplacement puis au moins une ligne.');
  const head=rows.shift().map(searchKey),ri=head.findIndex(x=>['reference','sku','referenceproduit'].includes(x)),li=head.findIndex(x=>['emplacement','casier','location'].includes(x));
  if(ri<0||li<0)throw Error('Les colonnes reference et emplacement sont obligatoires.');
  if(rows.length>5000)throw Error('Limite : 5 000 lignes par import.');
  const links=new Map();let duplicates=0;
  rows.forEach((r,index)=>{
    if(r.length!==head.length)throw Error(`Ligne ${index+2} : le nombre de colonnes ne correspond pas aux en-têtes.`);
    const sku=refKey(r[ri]),location=refKey(r[li]);
    if(!sku||!location||sku.length>120||location.length>120)throw Error(`Ligne ${index+2} : référence et emplacement obligatoires, 120 caractères maximum.`);
    const key=JSON.stringify([sku,location]);if(links.has(key))duplicates++;else links.set(key,{sku,location});
  });
  return {links:[...links.values()],duplicates,referenceCount:new Set([...links.values()].map(l=>l.sku)).size};
}
export function productLocations(p){return [...new Set([...(Array.isArray(p?.locations)?p.locations:[]),p?.location].filter(Boolean).map(refKey))];}
export function waitStarted(p){return Date.parse(p.waitingSince||p.createdAt||p.updatedAt);}
export function isWaiting(p){return !p.deleted&&['waiting','partial'].includes(p.status);}
export function isOverdue(p,now=Date.now()){return isWaiting(p)&&Number.isFinite(waitStarted(p))&&now-waitStarted(p)>=WAIT_LIMIT;}
export function pendingGroups(rows,now=Date.now()){
  const groups=new Map();
  for(const p of rows.filter(isWaiting)){
    const key=refKey(p.sku);if(!groups.has(key))groups.set(key,{sku:key,remaining:0,rows:[],overdue:false});
    const g=groups.get(key);g.remaining+=Math.max(0,Number(p.quantity)-Number(p.received||0));g.rows.push(p);g.overdue||=isOverdue(p,now);
  }
  return [...groups.values()].sort((a,b)=>Number(b.overdue)-Number(a.overdue)||a.sku.localeCompare(b.sku,'fr'));
}
export function allocateReceipt(rows,quantity){
  let remaining=number(quantity,{min:1,integer:true});
  const sorted=rows.filter(isWaiting).sort((a,b)=>Number(b.priority==='urgent')-Number(a.priority==='urgent')||(waitStarted(a)||0)-(waitStarted(b)||0)||a.id.localeCompare(b.id));
  const total=sorted.reduce((s,r)=>s+Math.max(0,r.quantity-(r.received||0)),0);
  if(remaining>total)throw Error(`Il reste seulement ${total} unité(s) à répartir. Le surplus ne peut pas être affecté à ces commandes.`);
  return sorted.map(r=>{const allocated=Math.min(remaining,r.quantity-(r.received||0));remaining-=allocated;return {id:r.id,allocated,beforeReceived:Number(r.received||0),received:Number(r.received||0)+allocated,quantity:r.quantity,orderNumber:r.orderNumber,location:r.location,revision:r._eventId};}).filter(r=>r.allocated>0);
}
export function weekDates(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Choisissez une date.');
  const d=new Date(value+'T12:00:00');if(!Number.isFinite(+d)||localDate(d)!==value)throw Error('Date invalide.');
  d.setDate(d.getDate()-(d.getDay()+6)%7);
  return Array.from({length:7},(_,i)=>{const day=new Date(d);day.setDate(d.getDate()+i);return localDate(day);});
}
export function weeklySummary(date,orders,days,issues,pending,goal){
  const dates=weekDates(date),stats=dates.map(day=>dailyStats(day,orders,days,goal));
  return {dates,stats,total:stats.reduce((n,s)=>n+s.total,0),commands:stats.reduce((n,s)=>n+s.commands,0),days:stats.filter(s=>s.hasData).length,estimated:stats.some(s=>s.hasData&&s.status==='estimated'),issues:issues.filter(r=>dates.includes((r.createdAt||r.updatedAt||'').slice(0,10))),pending:pending.filter(isWaiting)};
}

export function validQuad(points){
  if(points.length!==4||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return false;
  const crosses=points.map((p,i)=>{const q=points[(i+1)%4],r=points[(i+2)%4];return(q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x);});
  return crosses.every(x=>x>1)&&Math.abs(points.reduce((s,p,i)=>s+p.x*points[(i+1)%4].y-p.y*points[(i+1)%4].x,0))>100;
}
// Unit square -> quadrilateral, used for real perspective correction.
export function quadTransform(p){
  if(!validQuad(p))throw Error('Les quatre coins doivent entourer la feuille sans se croiser.');
  const [a,b,c,d]=p,dx1=b.x-c.x,dx2=d.x-c.x,dx3=a.x-b.x+c.x-d.x,dy1=b.y-c.y,dy2=d.y-c.y,dy3=a.y-b.y+c.y-d.y;
  const denominator=dx1*dy2-dx2*dy1;
  let g=0,h=0;
  if(Math.abs(dx3)+Math.abs(dy3)>1e-8){if(Math.abs(denominator)<1e-8)throw Error('Cadrage trop aplati.');g=(dx3*dy2-dx2*dy3)/denominator;h=(dx1*dy3-dx3*dy1)/denominator;}
  const A=b.x-a.x+g*b.x,B=d.x-a.x+h*d.x,D=b.y-a.y+g*b.y,E=d.y-a.y+h*d.y;
  return(u,v)=>{const w=g*u+h*v+1;return{x:(A*u+B*v+a.x)/w,y:(D*u+E*v+a.y)/w};};
}

