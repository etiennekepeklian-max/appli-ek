// Shared by the scanner and its read-only public-product relay.
export const codeKey=value=>typeof value==='string'?value.trim().normalize('NFKC').toLocaleUpperCase('fr-FR'):'';
export function validLookupCode(value){return typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9 ._/*+%-]{0,119}$/.test(value.trim());}
export function isGTIN(value){
  if(typeof value!=='string'||!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value))return false;
  const digits=[...value].map(Number);const check=digits.pop();
  return (10-digits.reverse().reduce((sum,n,i)=>sum+n*(i%2?1:3),0)%10)%10===check;
}
export const sameBarcode=(a,b)=>!!a&&!!b&&(codeKey(a)===codeKey(b)||isGTIN(a)&&isGTIN(b)&&a.padStart(14,'0')===b.padStart(14,'0'));
export function localLookupStatus(matches){
  if(!matches.length)return 'missing';
  return matches.length!==1||matches[0].namePending||!String(matches[0].name||'').trim()?'ambiguous':'known';
}
export function safeSourceURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')?u.href:'';}catch{return '';}}

export function safeProductImageURL(value){
 if(typeof value!=='string'||value.length>2048)return '';
 try{
  const u=new URL(value.startsWith('//')?'https:'+value:value);
  const host=u.hostname.toLowerCase().replace(/\.$/,'');
  if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!host.includes('.')||/^[0-9.]+$/.test(host)||/[\[\]:]/.test(host)||/(?:^|\.)(?:localhost|local|internal|lan|home|onion)$/.test(host))return '';
  u.hash='';
  if(host==='cdn.shopify.com'||['fr.checkout.draegerparis.com','www.draegerparis.com'].includes(host)&&u.pathname.startsWith('/cdn/shop/')){
   u.searchParams.set('width','480');u.searchParams.delete('height');u.searchParams.delete('crop');
  }
  return u.href;
 }catch{return '';}
}
const text=(v,max=240)=>typeof v==='string'?v.trim().replace(/[\u0000-\u001f]/g,' ').slice(0,max):'';
export function normalizeCandidate(raw,code){
  if(!raw||typeof raw!=='object')return null;
  const sourceKind=['draeger','upcitemdb'].includes(raw.sourceKind)?raw.sourceKind:'';
  const sourceUrl=safeSourceURL(raw.sourceUrl),name=text(raw.name),sku=text(raw.sku,120),barcode=text(raw.barcode,120);
  if(!name||!sourceKind||!sourceUrl)return null;
  const host=new URL(sourceUrl).hostname;
  if(sourceKind==='draeger'&&!['fr.checkout.draegerparis.com','www.draegerparis.com'].includes(host)||sourceKind==='upcitemdb'&&host!=='www.upcitemdb.com')return null;
  const exact=!!(sku&&codeKey(sku)===codeKey(code)||sameBarcode(barcode,code));
  return {name,sku,barcode,sourceKind,sourceUrl,imageUrl:safeProductImageURL(raw.imageUrl),brand:text(raw.brand,100),exact,retrievedAt:Number.isFinite(Date.parse(raw.retrievedAt))?raw.retrievedAt:''};
}
const productCodes=p=>[p.sku,p.barcode,p.articleCode,...(Array.isArray(p.referenceCodes)?p.referenceCodes:[])].map(codeKey).filter(Boolean);
export function candidateMatches(candidate,rows){return rows.filter(p=>productCodes(p).some(code=>code===codeKey(candidate.sku)||code===codeKey(candidate.barcode))||sameBarcode(p.barcode,candidate.barcode));}
export function productIdentityConflict(next,previous,rows){
  return rows.find(p=>p.id!==next.id&&(productCodes(p).includes(codeKey(next.sku))&&(!previous||codeKey(next.sku)!==codeKey(previous.sku))||next.barcode&&(productCodes(p).includes(codeKey(next.barcode))||sameBarcode(p.barcode,next.barcode))&&(!previous||!sameBarcode(next.barcode,previous.barcode))));
}
