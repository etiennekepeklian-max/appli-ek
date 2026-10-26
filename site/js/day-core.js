import {refKey,orderKey,estimateLines,parseOrderText,dailyStats,localDate} from './core.js';

const plain=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const command=/\b(?:(?:n[°ºo]?|numero)\s*(?:de\s*)?)?(commande|order|enregistrement)\s*(?:(?:n[°ºo]?|numero)\s*)?[\s:#.\-]*([A-Z0-9][A-Z0-9/_.-]{2,39})(?:\s*\/\s*(\d{3}))?\b/i;
function printedIdentity(raw){
  const text=plain(raw),m=text.match(command);if(!m)return null;
  if(/^(?:client|numero|reference|date|commande|enregistrement)$/.test(m[2]))return null;
  // A customer's reference and the preparation-note number are separate fields.
  const kind=m[1]==='enregistrement'?'registration':'order',value=refKey(m[2]+(m[3]?'/'+m[3]:''));
  let number=value;const split=value.match(/^(\d{6,})\/(\d{3})$/);
  if(split)number=split[1];else if(kind==='registration'&&/^\d{12}$/.test(value))number=value.slice(0,9);
  return {kind,value,number};
}
const cells=s=>s.trim().split(/[;\t|]|\s{2,}/).map(s=>s.trim()).filter(Boolean);
export const pageTextKey=text=>plain(text).replace(/[^a-z0-9]/g,'');

export function sheetQuantity(value){
  let s=String(value??'').trim();if(!s||/^[+-]\s*\d/.test(s))return null;
  s=s.replace(/[\u2460-\u2473]/g,ch=>String(ch.charCodeAt(0)-0x245f));
  const numbers=s.match(/\d+/g);if(numbers?.length!==1)return null;
  const rest=plain(s).replace(/\d+/g,'').replace(/\b(?:manquant(?:e|es|s)?|barre(?:e|es|s)?|entoure(?:e|es|s)?|u|unites?|pcs?|pieces?)\b/g,'').replace(/[\s()[\]{}~_*✗×x✓✔/\\—–-]/g,'');
  const n=Number(numbers[0]);return !rest&&Number.isSafeInteger(n)&&n>=0&&n<=9999999?n:null;
}
export function sheetLocation(value){
  const s=refKey(value).replace(/\s+/g,'');
  return /^(?:PAC|PAD|RES)[A-Z0-9][A-Z0-9._/-]{0,116}$/.test(s)?s:'';
}
const tableCells=s=>s.trim().split(/[;\t|]|\s{2,}/).map(s=>s.trim());
function warehouseLayout(row){
  const head=tableCells(row).map(plain),ref=head.findIndex(s=>/^(?:reference(?: produit)?|ref\.?|sku|article|code article)$/.test(s));
  const quantities=head.map((s,i)=>({s,i})).filter(({s})=>/^(?:quantite|qte|quantity|qty)\b/.test(s));
  if(ref<0||!quantities.length)return null;
  const prepared=quantities.find(({s})=>/prepar|livr|servi|realise/.test(s)),q=prepared||quantities.find(({s})=>/^(?:quantite|qte|quantity|qty)(?:\s*\(u\))?$/.test(s))||quantities[0];
  return {ref,q:q.i,ordered:quantities.find(({s})=>/command/.test(s))?.i,source:prepared?'prepared':/command/.test(q.s)?'ordered':'generic',ambiguous:quantities.length>1&&!prepared,location:head.findIndex(s=>/^(?:adresse(?: picking)?|emplacement|casier|location)$/.test(s)),designation:head.findIndex(s=>/^(?:designation(?: article)?|libelle|description|nom)$/.test(s)),alpha:head.findIndex(s=>/^(?:code alpha|alpha)$/.test(s))};
}
function warehouseRow(row,layout){
  const cs=tableCells(row),sku=cs[layout.ref];
  if(!sku||!/^[A-Z0-9][A-Z0-9._/-]{2,119}$/i.test(sku))return null;
  const rawQuantity=cs[layout.q]??'',marked=/manquant|barre|entour/i.test(plain(row));
  let quantity=sheetQuantity(rawQuantity),quantitySource=layout.source;
  if(quantity===0&&marked&&layout.ordered!==undefined&&layout.ordered!==layout.q){
    const ordered=sheetQuantity(cs[layout.ordered]);if(ordered>0){quantity=ordered;quantitySource='missing-ordered';}
  }
  if(quantity===0)return {skip:true};
  const rawLocation=layout.location>=0?cs[layout.location]||'':'',location=sheetLocation(rawLocation);
  return {sku:refKey(sku),quantity,rawQuantity,quantitySource,location,rawLocation,designation:layout.designation>=0?(cs[layout.designation]||'').slice(0,250):'',alphaCode:layout.alpha>=0?(cs[layout.alpha]||'').slice(0,120):'',needsReview:!!(layout.ambiguous||quantitySource==='ordered'||quantitySource==='missing-ordered'||quantity===null||marked||rawQuantity.trim()!==String(quantity)||rawLocation&&!location)};
}

export function parseDayPage(text){
  const lines=String(text||'').split(/\r?\n/),sections=[];let current=null;
  for(let i=0;i<lines.length;i++){
    const raw=lines[i];let identity=printedIdentity(raw);
    if(!identity&&/^(?:(?:n[°ºo]?|numero)\s*)?(?:commande|order|enregistrement)\s*[:#]?\s*$/i.test(plain(raw.trim()))&&lines[i+1]){identity=printedIdentity(raw+' '+lines[i+1].trim());if(identity)i++;}
    if(identity){
      if(current&&orderKey(current.number)===orderKey(identity.number)){
        current.identities||=[];current.identities.push(identity);if(identity.kind==='order')current.number=identity.number;continue;
      }
      if(current?.number&&current.identities?.some(a=>a.kind!==identity.kind)&&!current.text.some(row=>warehouseLayout(row)||/^(?:PAC|PAD|RES)\s*[A-Z0-9]/i.test(row.trim()))){
        current.identityConflict=true;current.identities.push(identity);if(identity.kind==='order')current.number=identity.number;continue;
      }
      current={number:identity.number,identities:[identity],text:[],lines:[],quantitySource:'unknown'};sections.push(current);continue;
    }
    if(!current){current={number:'',text:[],lines:[],quantitySource:'unknown'};sections.push(current);}
    current.text.push(raw);
  }
  for(const section of sections){
    const raw=section.text.join('\n'),page=raw.match(/\bpage\s*[:._-]?\s*(\d+)(?:\s*(?:\/|sur|of)\s*(\d+))?/i);
    section.pageNumber=page?Number(page[1]):null;section.pageCount=page?.[2]?Number(page[2]):null;
    let layout=null,ambiguous=false,headerSeen=false,warehouse=null;
    for(const row of section.text){
      const detected=warehouseLayout(row);
      if(detected){warehouse=detected;headerSeen=true;ambiguous=detected.ambiguous;section.quantitySource=detected.source;continue;}
      if(warehouse){const item=warehouseRow(row,warehouse);if(item){if(!item.skip)section.lines.push(item);continue;}}
      // Clear address/quantity/article rows remain recoverable when the header is damaged.
      const physical=row.trim().match(/^((?:PAC|PAD|RES)\s*[A-Z0-9][A-Z0-9._/-]*)\s+[|]?\s*(\d+|[①-⑳]|\(\d+\)|~\d+~)\s*[|]?\s+([A-Z0-9][A-Z0-9._/-]{4,119})(?:\s+(.+))?$/i);
      if(physical){const quantity=sheetQuantity(physical[2]);if(quantity>0)section.lines.push({sku:refKey(physical[3]),quantity,rawQuantity:physical[2],location:sheetLocation(physical[1]),designation:physical[4]||'',needsReview:true,quantitySource:'generic'});continue;}
      const cs=cells(row),hs=cs.map(plain),ref=hs.findIndex(s=>/^(reference(?: produit)?|ref\.?|sku|article|code article)$/.test(s));
      // OCR often collapses a printed table's columns to single spaces.
      if(ref<0&&/^(reference|ref\.?|sku|article|code article)\s+/i.test(plain(row.trim()))){
        const qs=[...plain(row).matchAll(/\b(?:quantite|qte|quantity|qty)(?:\s+(?:preparee?|commandee?|livree?|servie?|realisee?))?/g)].map(m=>m[0]);
        if(qs.length){const prepared=qs.findIndex(s=>/prepar|livr|servi|realise/.test(s)),q=prepared>=0?prepared:0;layout={words:true,q,total:qs.length,source:prepared>=0?'prepared':/command/.test(qs[q])?'ordered':'generic'};headerSeen=true;ambiguous=qs.length>1&&prepared<0||/prix|total|poids|montant|colis|reste/.test(plain(row));section.quantitySource=layout.source;continue;}
      }
      if(ref>=0){
        const quantities=hs.map((s,i)=>({s,i})).filter(({s})=>/^(qte|quantite|quantity|qty)\b/.test(s));
        const prepared=quantities.find(({s})=>/prepar|servi|livr|realise/.test(s)),generic=quantities.find(({s})=>/^(qte|quantite|quantity|qty)(?:\s*\(u\))?$/.test(s));
        const q=prepared||generic||quantities[0];
        if(q){layout={ref,q:q.i,source:prepared?'prepared':generic?'generic':'ordered'};headerSeen=true;ambiguous=quantities.length>1&&!prepared;section.quantitySource=layout.source;}
        continue;
      }
      if(layout?.words){
        const ws=row.trim().split(/\s+/),sku=ws[0],numbers=ws.slice(1).filter(s=>/^\d+$/.test(s));
        if(/^[A-Z0-9][A-Z0-9._/-]{2,119}$/i.test(sku)&&numbers.length>=layout.total){
          const quantity=Number(numbers.slice(-layout.total)[layout.q]);if(quantity>0)section.lines.push({sku:refKey(sku),quantity,needsReview:ambiguous||layout.source==='ordered',quantitySource:layout.source});continue;
        }
      }
      if(layout&&cs.length>Math.max(layout.ref,layout.q)&&/^[A-Z0-9][A-Z0-9._/-]{2,119}$/i.test(cs[layout.ref])&&/^\d+$/.test(cs[layout.q])){
        if(Number(cs[layout.q])>0)section.lines.push({sku:refKey(cs[layout.ref]),quantity:Number(cs[layout.q]),needsReview:ambiguous||layout.source==='ordered',quantitySource:layout.source});
        continue;
      }
      if(/^(?:page|total|date|client|adresse|designation|reference|commande)\b/i.test(plain(row.trim())))continue;
      const parsed=parseOrderText(row).lines;
      for(const l of parsed)if(Number(l.quantity)>0)section.lines.push({...l,sku:refKey(l.sku),quantity:Number(l.quantity),needsReview:!headerSeen||ambiguous||layout?.source==='ordered'});
      if(!parsed.length){const simple=row.trim().match(/^([A-Z0-9][A-Z0-9._/-]{2,119})\s+(\d+)$/i);if(simple&&Number(simple[2])>0)section.lines.push({sku:refKey(simple[1]),quantity:Number(simple[2]),needsReview:true});}
    }
    section.needsReview=!!(section.identityConflict||!headerSeen||ambiguous||section.quantitySource==='ordered'||!section.lines.length||/(?:\d[OILSBZ]|[OILSBZ]\d)/i.test(section.number));
    section.text=raw;
  }
  // Preamble (addresses, date) is kept in the photo but isn't an orphan command.
  return sections.filter(s=>s.number||s.lines.length||sections.length===1);
}

export function buildDayPlan(pages,existing,date,resolveProduct){
  const groups=new Map(),problems=[],seenHashes=new Set(),seenSlots=new Map();let duplicatePages=0;
  for(const page of pages.filter(p=>!p.excluded)){
    if(page.hash&&seenHashes.has(page.hash)){duplicatePages++;continue;}if(page.hash)seenHashes.add(page.hash);
    if(page.error){problems.push({id:page.id,message:page.error});continue;}
    const sections=page.sections||parseDayPage(page.text);
    if(!sections.length){problems.push({id:page.id,message:'Aucune commande reconnue sur cette page.'});continue;}
    for(let i=0;i<sections.length;i++){
      const s=sections[i];let number=refKey(s.number);
      // An exact previously saved image keeps the reviewed number, including OCR corrections.
      const associated=existing.find(o=>(o.daySources||[]).some(old=>old.hash&&old.hash===page.hash&&(old.sectionIndex??0)===i));
      if(associated&&!page.reviewed)number=refKey(associated.number);
      if(!number){problems.push({id:page.id,message:'Numéro de commande à compléter.'});continue;}
      if(!s.lines.length){problems.push({id:page.id,message:'Aucune ligne exploitable pour '+number+'.'});continue;}
      const key=orderKey(number),source={hash:page.hash||'',textKey:pageTextKey(key+' '+(s.text||page.text)),photoId:page.photoId,pageNumber:s.pageNumber||null,pageCount:s.pageCount||null,sectionIndex:i,identities:s.identities||[]};
      const slot=key+':'+(s.pageNumber||'text-'+source.textKey);
      if(seenSlots.has(slot)){
        const previous=seenSlots.get(slot);
        if(s.pageNumber&&previous.textKey===source.textKey){duplicatePages++;continue;}
        if(!page.allowDuplicate){problems.push({id:page.id,message:s.pageNumber?'Deux lectures différentes de la page '+s.pageNumber+' de '+number+'. Écartez la mauvaise photo.':'Deux pages identiques pour '+number+'. Écartez le doublon ou confirmez deux pages distinctes.'});continue;}
      }
      seenSlots.set(slot,source);
      if(!groups.has(key))groups.set(key,{number,lines:[],sources:[],reviewPages:new Set()});
      const g=groups.get(key);
      if(s.needsReview&&!page.reviewed)g.reviewPages.add(page.id);
      for(const line of s.lines){
        if(!refKey(line.sku)||!Number.isInteger(Number(line.quantity))||Number(line.quantity)<1){problems.push({id:page.id,message:'Référence ou quantité invalide dans '+number+'.'});continue;}
        const p=resolveProduct(refKey(line.sku),line),pack=p?.effectiveUnitsPerPick??p?.unitsPerPick??null;
        g.lines.push({...line,sku:refKey(line.sku),quantity:Number(line.quantity),pack,pickingOverride:null,ruleSource:p?.pickingRule?.label||'Règle à renseigner',sourceHash:source.hash});
        if((line.needsReview||!p)&&!page.reviewed)g.reviewPages.add(page.id);
      }
      g.sources.push(source);
    }
  }
  const orders=[];
  for(const g of groups.values()){
    const matches=existing.filter(o=>!o.deleted&&orderKey(o.number)===orderKey(g.number));
    if(matches.length===1)g.number=matches[0].number;
    g.existing=matches[0]||null;g.existingRevision=g.existing?._eventId;g.mode='new';
    if(matches.length>1)problems.push({message:'Plusieurs fiches existent pour '+g.number+'. Corrigez-les avant cet import.'});
    if(g.existing){
      const sameDate=g.existing.date===date;
      const fresh=g.sources.filter(s=>!(g.existing.daySources||[]).some(old=>old.hash&&old.hash===s.hash||old.textKey&&old.textKey===s.textKey));
      g.mode=!fresh.length?'skip':sameDate?'exists':'other-day';
      if(sameDate&&fresh.length&&g.existing.daySources?.length&&!fresh.some(s=>s.pageNumber&&g.existing.daySources.some(old=>old.pageNumber===s.pageNumber))){
        const freshHashes=new Set(fresh.map(s=>s.hash));g.appendLines=g.lines.filter(l=>freshHashes.has(l.sourceHash));g.appendSources=fresh;
      }
    }
    const counts=g.sources.map(s=>s.pageCount).filter(Boolean),numbers=new Set(g.sources.map(s=>s.pageNumber).filter(Boolean)),expected=Math.max(0,...counts,...numbers);
    if(expected&&Array.from({length:expected},(_,i)=>i+1).some(n=>!numbers.has(n)))g.incomplete=true;
    if(g.incomplete&&g.existing?.daySources?.length){const known=new Set([...numbers,...g.existing.daySources.map(s=>s.pageNumber)]);g.appendIncomplete=Array.from({length:expected},(_,i)=>i+1).some(n=>!known.has(n));}
    g.reviewPages=[...g.reviewPages];g.estimate=estimateLines(g.lines);orders.push(g);
  }
  return {orders,problems,duplicatePages};
}

export function dayRecord(group,date,mode='new'){
  if(group.mode==='skip'||mode==='skip')return null;
  if(group.mode==='other-day')throw Error('Cette commande est déjà enregistrée sur une autre journée.');
  if(group.mode==='exists'&&!['replace','append'].includes(mode))throw Error('Choisissez comment traiter la commande déjà enregistrée.');
  if(mode==='append'&&!group.appendLines)throw Error('Ajout impossible : les anciennes pages ne sont pas identifiées.');
  const lines=mode==='append'?[...group.existing.lines,...group.appendLines]:group.lines;
  const sources=mode==='append'?[...group.existing.daySources,...group.appendSources]:group.sources;
  const e=estimateLines(lines);
  return {...group.existing,id:group.existing?.id,number:group.number,date,lines:e.lines,total:e.total,rangeMax:e.maximum,unknownLines:e.unknown,calculationStatus:e.status,status:'completed',reviewed:true,daySources:sources,photoIds:[...new Set(sources.map(s=>s.photoId).filter(Boolean))],notes:group.existing?.notes||''};
}

export function restartDayPlan(date,orders,days,draft){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||localDate(new Date(date+'T12:00:00'))!==date)throw Error('Choisissez une journée valide.');
  const selectedOrders=orders.filter(r=>!r.deleted&&r.date===date),corrections=days.filter(r=>!r.deleted&&r.date===date);
  const items=[...selectedOrders.map(record=>({type:'orders',record:{...record,deleted:true}})),...corrections.map(record=>({type:'days',record:{...record,deleted:true}}))];
  const stats=dailyStats(date,selectedOrders,corrections);
  return {date,items,commands:stats.commands,total:stats.total,corrections:corrections.length,photos:draft?.date===date?draft.pages?.length||0:0,otherDraft:!!(draft?.pages?.length&&draft.date!==date),
    nextSession:{date,pages:[],choices:{}},signature:JSON.stringify({date,records:items.map(x=>[x.type,x.record.id,x.record._eventId||null]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),draft:draft||null})};
}
