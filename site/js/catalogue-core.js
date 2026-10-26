import {refKey} from './core.js';

const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
// Only absent classifications are inferred. User choices and warehouse data win.
export function inferFamily(product){
  if(product.familyId&&product.familyId!=='a-classer')return product.familyId;
  const text=key(product.sourceProductType+' '+product.name);
  const rules=[
    [/porte[ -]?cartes/,'sacs-porte-cartes'],[/porte[ -]?monnaie/,'sacs-porte-monnaie'],[/boucles? d.?oreilles?/,'bijoux-boucles-doreilles'],
    [/\bbagues?\b/,'bijoux-bagues'],[/\bbracelets?\b/,'bijoux-bracelets'],[/\bcolliers?\b/,'bijoux-colliers'],
    [/\bcartes?\b/,'cartes'],[/\bcarnets?\b|blocs?[ -]?notes?/,'papeterie-carnets-et-blocs-notes'],
    [/\bcalendriers?\b/,'papeterie-calendriers'],[/\bstylos?\b/,'papeterie-stylos'],
    [/\bstickers?\b|autocollants?/,'papeterie-stickers'],[/sacs? cadeaux?|boites? cadeaux?|sacs? bouteilles?|papier de soie|rubans?/,'cadeaux-emballages-cadeaux'],
    [/\bgourdes?\b/,'accessoires-gourdes'],[/\bmugs?\b|\btasses?\b/,'cadeaux-mugs'],
    [/porte[ -]?cles?/,'accessoires-porte-cles'],[/\btrousses?\b|\bpochettes?\b/,'sacs-trousses-et-pochettes'],
    [/foulards?|etoles?|pareos?/,'accessoires-foulards-et-etoles'],[/\bparapluies?\b/,'accessoires-parapluies'],
    [/\bbonnets?\b|\bchapeaux?\b|\bcasquettes?\b/,'accessoires-chapeaux-et-bonnets'],
    [/decoration.*noel|boules? de noel/,'cadeaux-decorations-de-noel']
  ];
  return rules.find(([pattern])=>pattern.test(text))?.[1]||product.familyId||'a-classer';
}
export function familyChain(id,families){
  const result=[],seen=new Set();let current=id;
  while(current&&!seen.has(current)){seen.add(current);const f=families.find(f=>f.id===current);if(!f)break;result.push(f);current=f.parentId;}
  return result;
}
export const inFamily=(product,id,families)=>familyChain(product.familyId,families).some(f=>f.id===id);
export function pickingRule(product,families){
  const own=Number(product?.unitsPerPick);
  if(Number.isInteger(own)&&own>0)return {units:own,source:'product',label:'Exception produit',familyId:null};
  for(const f of familyChain(product?.familyId,families)){
    const n=Number(f.unitsPerPick);if(Number.isInteger(n)&&n>0)return {units:n,source:'family',label:'Famille : '+f.name,familyId:f.id};
  }
  return {units:null,source:'unknown',label:'Règle à renseigner',familyId:null};
}
export function codesForProduct(p){
  return [...new Set([p.sku,p.barcode,p.articleCode,...(Array.isArray(p.referenceCodes)?p.referenceCodes:[])].filter(Boolean).map(refKey))];
}
export function matchProduct(code,products){const value=refKey(code);const rows=products.filter(p=>codesForProduct(p).includes(value));return rows.length===1?rows[0]:null;}
