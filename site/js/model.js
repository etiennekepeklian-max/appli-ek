import * as Store from './storage.js';
import {state} from './ui.js';
import {refKey} from './core.js';
let productCache=null;
const safeURL=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
Store.onChange(()=>{productCache=null;});
export async function loadCatalogue(){
  const [families,products]=await Promise.all([fetch('data/families.json').then(r=>{if(!r.ok)throw Error('Catalogue familles indisponible.');return r.json();}),fetch('data/catalogue.json').then(r=>{if(!r.ok)throw Error('Catalogue produits indisponible.');return r.json();})]);
  state.baseFamilies=families.families;state.baseProducts=products.products;Store.setBaseRecords('products',products.products);Store.setBaseRecords('families',families.families);state.catalogue={...products.meta,familyMeta:families.meta};productCache=null;
}
export function families(includeInactive=false){const m=new Map(state.baseFamilies.map(f=>[f.id,{...f,active:true}]));for(const f of Store.list('families',{includeDeleted:true}))m.set(f.id,f);return [...m.values()].filter(f=>!f.deleted&&(includeInactive||f.active!==false)).sort((a,b)=>a.name.localeCompare(b.name,'fr'));}
export function familyName(id){return families(true).find(f=>f.id===id)?.name||'Sans famille';}
export function familyOptions(){return [{value:'',label:'Choisir une famille'},...families().map(f=>({value:f.id,label:(f.parentId?'↳ ':'')+f.name}))];}
export function products(){if(productCache)return productCache;const m=new Map(state.baseProducts.map(p=>[p.id,p]));for(const p of Store.list('products',{includeDeleted:true}))m.set(p.id,p);const packs=new Map(Store.list('packagings').map(p=>[refKey(p.sku),p.unitsPerPick]));productCache=[...m.values()].filter(p=>!p.deleted).map(p=>({...p,sourceUrl:safeURL(p.sourceUrl),unitsPerPick:packs.get(refKey(p.sku))??p.unitsPerPick??null}));return productCache;}
export function findProducts(code){const v=refKey(code);return products().filter(p=>refKey(p.sku)===v||p.barcode&&refKey(p.barcode)===v);}
export function findProduct(code){return findProducts(code)[0];}
export function productName(sku){return findProduct(sku)?.name||sku;}
export function recordLabel(r){return r.orderNumber||r.number||r.sku||r.name||r.title||r.label||r.date||r.id;}
export const pendingStatus={waiting:{label:'En attente',kind:'amber'},partial:{label:'Reçu en partie',kind:'amber'},received:{label:'Réassort reçu',kind:'green'},done:{label:'Commande terminée',kind:'green'}};
export const issueStatus={open:'À traiter',progress:'En cours',resolved:'Résolu'};

