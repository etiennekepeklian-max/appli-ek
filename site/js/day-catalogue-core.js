import {refKey} from './core.js';
import {inferFamily,codesForProduct} from './catalogue-core.js';
import {sheetLocation} from './day-core.js';
import {productLocations} from './ops-core.js';

export function productIndex(products){
  const byId=new Map(),byCode=new Map();
  function add(product){
    const previous=byId.get(product.id);
    if(previous)for(const code of codesForProduct(previous)){const ids=byCode.get(code);ids?.delete(product.id);if(!ids?.size)byCode.delete(code);}
    byId.set(product.id,product);
    if(!product.deleted)for(const code of codesForProduct(product)){if(!byCode.has(code))byCode.set(code,new Set());byCode.get(code).add(product.id);}
  }
  products.forEach(add);return {byId,byCode,add};
}
export function lineProduct(line,products){
  const index=Array.isArray(products)?productIndex(products):products,ids=index.byCode.get(refKey(line.sku));
  return ids?.size===1?index.byId.get([...ids][0]):null;
}
export function catalogueProposal(groups,products,{reservedIds=[]}={}){
  const index=productIndex(products),reserved=new Set([...index.byId.keys(),...reservedIds]),changes=new Map(),problems=[];
  for(const group of groups)for(const line of group.lines){
    const sku=refKey(line.sku),ids=index.byCode.get(sku);
    if(!/^[A-Z0-9][A-Z0-9._/-]{2,119}$/i.test(sku)){problems.push('Référence à vérifier : '+sku);continue;}
    if(ids?.size>1){problems.push('Plusieurs produits portent la référence '+sku+'. Corrigez les fiches avant la mise à jour.');continue;}
    let before=lineProduct(line,index),p=before,created=false;
    const designation=String(line.designation||'').trim().slice(0,250),alpha=String(line.alphaCode||'').trim().slice(0,120);
    if(!p){
      let id='sheet-'+sku,n=1;while(reserved.has(id))id='sheet-'+sku+'-'+(++n);reserved.add(id);
      p={id,sku,name:designation||'Référence '+sku,namePending:!designation,unitsPerPick:null,location:'',locations:[],source:'order-photo'};p.familyId=inferFamily(p);created=true;
    }
    const {effectiveUnitsPerPick,pickingRule,classificationSuggested,...record}=p;
    const old=JSON.stringify(record),addresses=productLocations(p),location=sheetLocation(line.location);
    if(location&&!addresses.includes(location)){addresses.push(location);record.locations=addresses;if(!record.location)record.location=addresses[0];}
    if(designation&&(record.namePending||!record.name)){record.name=designation;record.namePending=false;record.familyId=inferFamily(record);}
    if(!record.articleCode)record.articleCode=sku;
    // Alpha is descriptive: short shared codes must never merge two references.
    if(alpha&&!record.alphaCode)record.alphaCode=alpha;
    if(created||JSON.stringify(record)!==old){
      if(!changes.has(record.id))changes.set(record.id,{before:created?null:before,record});
      else changes.get(record.id).record=record;
      index.add(record);
    }
  }
  const rows=[...changes.values()];
  return {changes:rows,items:rows.map(({record})=>({type:'products',record})),problems:[...new Set(problems)],created:rows.filter(x=>!x.before).length,updated:rows.filter(x=>x.before).length};
}
