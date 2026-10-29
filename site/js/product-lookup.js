import * as Store from './storage.js';
import {publicProductPhoto} from './product-image.js';
import {state,esc,btn,icon,toast} from './ui.js';
import {findProducts,products,familyName} from './model.js';
import {recordUnknown,resolveUnknowns,hydratePhotos} from './ops.js';
import {productLocations} from './ops-core.js';
import {scanFeedback} from './feedback.js';
import {guard} from './access-ui.js';
import {localLookupStatus,candidateMatches,normalizeCandidate,validLookupCode,codeKey} from './product-lookup-core.js';
import {searchProductWeb} from './product-lookup-client.js';
let active,sequence=0;
export function cancelProductLookup(){active?.controller.abort();active=null;state.scanResult=null;}
const sourceName=p=>p.sourceKind==='upcitemdb'?'UPCitemdb — base externe':'Draeger Paris — site officiel';
function localHTML(result){
 const {code,matches,status}=result;
 return `<p class="hint">Code lu : <strong class="mono">${esc(code)}</strong></p>${status==='ambiguous'?'<div class="info-note amber">Correspondance incertaine. Vérifiez la désignation et la variante ; aucune fiche n’est choisie automatiquement.</div>':''}${matches.slice(0,20).map(p=>`<section class="section-gap">${p.photoId?`<img class="product-photo" data-product-photo="${esc(p.photoId)}" alt="${esc(p.name)}" hidden>`:publicProductPhoto(p.lookupImageUrl,p.name)}<div class="eyebrow">${p.sourceUrl?'Catalogue et sources publiques':'Votre référence'}</div><h2 style="font-size:21px;line-height:1.4">${esc(p.name||'Dénomination à confirmer')}</h2><div class="pill-list section-gap"><span class="pill mono">Réf. ${esc(p.sku)}</span><span class="pill">${esc(familyName(p.familyId))}</span></div><p class="hint section-gap">EAN : ${esc(p.barcode||'Non renseigné')}<br>Unités par picking : ${p.effectiveUnitsPerPick||'À renseigner'}${p.effectiveUnitsPerPick?' · '+esc(p.pickingRule.label):''}<br>Emplacements : ${esc(productLocations(p).join(' · ')||'À renseigner')}</p><div class="actions section-gap">${state.scanTarget?btn('Utiliser pour le manquant','use-scanned-reference','check','primary',`data-id="${esc(p.id)}"`):btn('Noter un manquant','pending-from-product','clock','small',`data-id="${esc(p.id)}"`)}${btn('Créer le code','code-from-product','barcode','small primary',`data-code="${esc(p.sku||code)}"`)}${btn('Compléter la fiche','edit-product','edit','small',`data-id="${esc(p.id)}"`)}</div>${p.sourceUrl?`<p class="hint section-gap"><a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">Voir la source ↗</a></p>`:''}</section>`).join('')}`;
}
function webHTML(result){
 if(result.status==='known')return '';
 const {code,candidates=[],warnings=[],webState}=result;
 const searchURL='https://www.google.com/search?q='+encodeURIComponent('"'+code+'" produit');
 const controls=`<div class="actions section-gap"><a class="btn" href="${searchURL}" target="_blank" rel="noopener noreferrer">${icon('search')}Rechercher sur Internet</a>${btn('Ajouter manuellement','new-product-from-scan','plus','',`data-code="${esc(code)}"`)}</div>`;
 if(webState==='loading')return '<section class="section-gap" data-web-lookup aria-live="polite"><h3>Recherche Internet en cours…</h3><p class="hint">Draeger et, pour les EAN, une base externe. Aucun ajout automatique.</p><span class="loader"></span></section>';
 const message=webState==='offline'?'Hors connexion : le code reste à identifier. Relancez la recherche lorsque le réseau revient.':webState==='error'?result.error:!candidates.length?'Aucune correspondance vérifiable trouvée. Le code reste à identifier.':'';
 return `<section class="section-gap" data-web-lookup aria-live="polite"><h3>Résultats Internet à vérifier</h3>${message?`<p class="info-note">${esc(message)}</p>`:''}${warnings.map(w=>`<p class="hint">${esc(w)}</p>`).join('')}${candidates.map((p,index)=>{
   const existing=candidateMatches(p,products());
   const actions=existing.length?existing.slice(0,8).map(row=>btn('Relire la fiche '+row.sku,'review-web-product','edit','small',`data-lookup-key="${esc(result.key)}" data-candidate="${index}" data-id="${esc(row.id)}"`)).join(''):btn('Vérifier avant ajout','review-web-product','plus','primary',`data-lookup-key="${esc(result.key)}" data-candidate="${index}"`);
   return `<article class="card section-gap">${publicProductPhoto(p.imageUrl,p.name)}<div class="eyebrow">${esc(sourceName(p))}</div><h4>${esc(p.name)}</h4><p class="hint">Référence : ${esc(p.sku||'À renseigner, non fournie par la source')}<br>Code-barres : ${esc(p.barcode||'Non fourni par la source')}</p><p class="info-note ${p.exact?'':'amber'}">${p.exact?'Le code correspond dans cette source. Vérifiez aussi le produit et sa variante.':'Piste seulement : le code lu n’est pas confirmé pour cette variante.'}</p><p class="hint">${existing.length?'Déjà présent dans le catalogue : relisez la fiche pour éviter un doublon.':'Aucune fiche correspondante dans le catalogue actuel.'}</p><p><a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">Consulter la source ↗</a></p><div class="actions section-gap">${actions}</div></article>`;
 }).join('')}<p class="hint section-gap">Enregistrer dans la fiche vaut validation. Les résultats Internet restent temporaires jusque-là. Les emplacements et règles de picking ne sont jamais déduits d’une source Web.</p>${btn('Relancer la recherche','retry-product-lookup','sync','small',`data-code="${esc(code)}"`)}${controls}</section>`;
}
function render(result){
 if(state.scanResult!==result||Store.scope()!==result.scope||state.route!=='scan')return false;
 const el=document.querySelector('#scan-result');if(!el||!el.isConnected)return false;
 el.innerHTML=localHTML(result)+webHTML(result);guard(el);void hydratePhotos();return true;
}
export function renderProductLookup(){return state.scanResult?render(state.scanResult):false;}
export async function lookupScannedProduct(raw,{retry=false}={}){
 const code=String(raw??'').trim();if(!code)throw Error('Saisissez un code.');
 const previous=state.scanResult,matches=findProducts(code),status=localLookupStatus(matches);
 if(!retry&&previous&&previous.scope===Store.scope()&&codeKey(previous.code)===codeKey(code)&&Date.now()-previous.startedAt<30000&&JSON.stringify(matches)===JSON.stringify(previous.matches)&&render(previous))return active?.task;
 cancelProductLookup();
 const result={key:String(++sequence),code,matches,status,scope:Store.scope(),startedAt:Date.now(),webState:navigator.onLine===false?'offline':'loading',candidates:[],warnings:[]};
 state.scanResult=result;scanFeedback(status==='known'?'success':'unknown');
 if(status==='known')await resolveUnknowns(matches[0]);else await recordUnknown(code);
 if(!render(result)||status==='known'||result.webState==='offline')return;
 if(!validLookupCode(code)){result.webState='error';result.error='Ce format ne peut pas être recherché automatiquement. Consultez le lien Internet ou identifiez le code manuellement.';render(result);return;}
 const controller=new AbortController();active={controller,result};
 const task=(async()=>{
  try{const web=await searchProductWeb(code,{signal:controller.signal});if(controller.signal.aborted)return;Object.assign(result,web,{webState:'complete'});}
  catch(error){if(controller.signal.aborted)return;result.webState='error';result.error=error.name==='TimeoutError'?'La recherche a pris trop de temps. Vous pouvez la relancer.':error.message||'La recherche Internet est indisponible.';}
  finally{if(active?.result===result)active=null;render(result);}
 })();active.task=task;return task;
}
export function webProductProposal(index,existingId,key){
 const result=state.scanResult;if(!result||String(key)!==result.key||result.scope!==Store.scope()||state.route!=='scan')throw Error('Relancez la lecture de ce code.');
 const candidate=normalizeCandidate(result.candidates?.[index],result.code);if(!candidate)throw Error('Résultat Internet indisponible. Relancez la recherche.');
 const existing=candidateMatches(candidate,products());
 if(existingId){const row=existing.find(p=>p.id===existingId);if(!row)throw Error('La fiche a changé. Relancez la recherche avant de la compléter.');return {product:{...row,name:row.namePending?candidate.name:row.name||candidate.name,barcode:row.barcode||candidate.barcode},candidate};}
 if(existing.length){render(result);toast('Une fiche existe déjà. Choisissez Relire la fiche.');return null;}
 return {product:{sku:candidate.sku,barcode:candidate.barcode,name:candidate.name},candidate};
}

globalThis.addEventListener?.('online',()=>{const result=state.scanResult;if(state.route==='scan'&&result?.webState==='offline')void lookupScannedProduct(result.code,{retry:true}).catch(()=>{});});
