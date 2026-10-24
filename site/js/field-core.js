import {refKey} from './core.js';

export const LOCATION_TYPES=['PAC','PAD','RES'];
export function splitLocation(value){
  const full=refKey(value),type=LOCATION_TYPES.find(t=>full.startsWith(t));
  return {type:type||'',address:type?full.slice(type.length):full};
}
export function locationValue(address,type=''){
  const parts=splitLocation(address),body=parts.address;
  if(type&&!LOCATION_TYPES.includes(type))throw Error('Choisissez PAC, PAD ou RES.');
  if(!body)return '';
  return (type||parts.type)+body;
}
export function referenceMatches(value,products){
  const q=refKey(value);if(!q)return {status:'empty',exact:[],suggestions:[]};
  const exact=products.filter(p=>refKey(p.sku)===q||p.barcode&&refKey(p.barcode)===q);
  const unique=[...new Map(exact.map(p=>[JSON.stringify([p.sku,p.name]),p])).values()];
  return {status:unique.length===1?'found':unique.length>1?'ambiguous':'unknown',exact:unique,suggestions:unique.length?[]:products.filter(p=>refKey(p.sku).startsWith(q)||p.barcode&&refKey(p.barcode).startsWith(q)).slice(0,5)};
}
export function googleConnectionInput(clientId,sheet){
  const client=String(clientId||'').trim(),raw=String(sheet||'').trim();
  if(client&&!/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(client))throw Error('L’identifiant Google doit se terminer par .apps.googleusercontent.com.');
  let spreadsheetId=raw;
  if(raw.includes('://')){let u;try{u=new URL(raw);}catch{throw Error('Adresse Google Sheets invalide.');}if(u.hostname!=='docs.google.com')throw Error('Utilisez l’adresse de votre feuille Google Sheets.');spreadsheetId=u.pathname.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)?.[1]||'';}
  if(spreadsheetId&&!/^[A-Za-z0-9_-]{20,}$/.test(spreadsheetId))throw Error('Identifiant de feuille invalide. Copiez son adresse depuis Google Sheets.');
  return {clientId:client,spreadsheetId};
}
