import {refKey,estimateLines,parseOrderText} from './core.js';

const plain=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const command=/^(?:.*?\b)?(?:n[°o]?\s*(?:de\s*)?(?:commande|order)|(?:commande|order|bon de preparation)\s*(?:n[°o]?|numero)?)[\s:#.\-]*([A-Z0-9][A-Z0-9/_.-]{2,39})\b/i;
const cells=s=>s.trim().split(/[;\t|]|\s{2,}/).map(s=>s.trim()).filter(Boolean);
export const pageTextKey=text=>plain(text).replace(/[^a-z0-9]/g,'');
export function parseDayPage(text){
  const lines=String(text||'').split(/\r?\n/),sections=[];let current=null;
  for(const raw of lines){
    const m=plain(raw).match(command); // matching is accent-insensitive; codes are normalized below
    if(m){const number=refKey(m[1]);if(!['NUMERO','REFERENCE','DATE','CLIENT','COMMANDE'].includes(number)){
      if(current?.number!==number){current={number,text:[],lines:[],quantitySource:'unknown'};sections.push(current);}continue;
    }}
    if(!current){current={number:'',text:[],lines:[],quantitySource:'unknown'};sections.push(current);}
    current.text.push(raw);
  }
  for(const section of sections){
    const raw=section.text.join('\n'),page=raw.match(/\bpage\s*[:.]?\s*(\d+)\s*(?:\/|sur|of)\s*(\d+)/i);
    section.pageNumber=page?Number(page[1]):null;section.pageCount=page?Number(page[2]):null;
    let layout=null,ambiguous=false,headerSeen=false;
    for(const row of section.text){
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
    section.needsReview=!headerSeen||ambiguous||section.quantitySource==='ordered'||!section.lines.length||/(?:\d[OILSBZ]|[OILSBZ]\d)/i.test(section.number);
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
      if(associated)number=refKey(associated.number);
      if(!number){problems.push({id:page.id,message:'Numéro de commande à compléter.'});continue;}
      if(!s.lines.length){problems.push({id:page.id,message:'Aucune ligne exploitable pour '+number+'.'});continue;}
      const source={hash:page.hash||'',textKey:pageTextKey(number+' '+(s.text||page.text)),photoId:page.photoId,pageNumber:s.pageNumber||null,pageCount:s.pageCount||null,sectionIndex:i};
      const slot=number+':'+(s.pageNumber||'text-'+source.textKey);
      if(seenSlots.has(slot)){
        const previous=seenSlots.get(slot);
        if(s.pageNumber&&previous.textKey===source.textKey){duplicatePages++;continue;}
        if(!page.allowDuplicate){problems.push({id:page.id,message:s.pageNumber?'Deux lectures différentes de la page '+s.pageNumber+' de '+number+'. Écartez la mauvaise photo.':'Deux pages identiques pour '+number+'. Écartez le doublon ou confirmez deux pages distinctes.'});continue;}
      }
      seenSlots.set(slot,source);
      if(!groups.has(number))groups.set(number,{number,lines:[],sources:[],reviewPages:new Set()});
      const g=groups.get(number);
      if(s.needsReview&&!page.reviewed)g.reviewPages.add(page.id);
      for(const line of s.lines){
        if(!refKey(line.sku)||!Number.isInteger(Number(line.quantity))||Number(line.quantity)<1){problems.push({id:page.id,message:'Référence ou quantité invalide dans '+number+'.'});continue;}
        const p=resolveProduct(refKey(line.sku)),pack=p?.effectiveUnitsPerPick??p?.unitsPerPick??null;
        g.lines.push({...line,sku:refKey(line.sku),quantity:Number(line.quantity),pack,pickingOverride:null,ruleSource:p?.pickingRule?.label||'Règle à renseigner',sourceHash:source.hash});
        if((line.needsReview||!p)&&!page.reviewed)g.reviewPages.add(page.id);
      }
      g.sources.push(source);
    }
  }
  const orders=[];
  for(const g of groups.values()){
    const matches=existing.filter(o=>!o.deleted&&refKey(o.number)===g.number);
    g.existing=matches[0]||null;g.existingRevision=g.existing?._eventId;g.mode='new';
    if(matches.length>1)problems.push({message:'Plusieurs fiches existent pour '+g.number+'. Corrigez-les avant cet import.'});
    if(g.existing){
      const sameDate=g.existing.date===date;
      const fresh=g.sources.filter(s=>!(g.existing.daySources||[]).some(old=>old.hash&&old.hash===s.hash||old.textKey&&old.textKey===s.textKey));
      g.mode=!fresh.length?'skip':sameDate?'exists':'other-day';
      if(sameDate&&fresh.length&&g.existing.daySources?.length){
        const freshHashes=new Set(fresh.map(s=>s.hash));g.appendLines=g.lines.filter(l=>freshHashes.has(l.sourceHash));g.appendSources=fresh;
      }
    }
    const counts=g.sources.map(s=>s.pageCount).filter(Boolean),expected=Math.max(0,...counts),numbers=new Set(g.sources.map(s=>s.pageNumber).filter(Boolean));
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
