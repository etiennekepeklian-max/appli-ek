import {validLookupCode,isGTIN,normalizeCandidate,safeProductImageURL} from '../../site/js/product-lookup-core.js';
const imageFor=(...values)=>values.flat().slice(0,12).map(v=>typeof v==='string'?v:v?.src||v?.url||'').map(safeProductImageURL).find(Boolean)||'';
const OFFICIAL='https://fr.checkout.draegerparis.com';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
export function createProductLookup({fetcher=fetch,now=Date.now}={}){
  const cache=new Map(),rates=new Map();let upcBlockedUntil=0;
  async function readJSON(url){
    const response=await fetcher(url,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(3000)});
    if(!response.ok){const error=Error('Source indisponible');error.status=response.status;if(response.status===429){const reset=Number(response.headers.get('x-ratelimit-reset'))*1000;error.retryAt=Number.isFinite(reset)&&reset>now()?reset:now()+60000;}throw error;}
    if(Number(response.headers.get('content-length'))>512000)throw Error('Réponse trop volumineuse');
    const reader=response.body?.getReader();let bytes=0,text='';const decoder=new TextDecoder();
    if(reader)while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>512000){await reader.cancel();throw Error('Réponse trop volumineuse');}text+=decoder.decode(part.value,{stream:true});}
    return JSON.parse(text+decoder.decode());
  }
  async function search(code){
    const candidates=[],warnings=[],retrievedAt=new Date(now()).toISOString();
    try{
      const query=new URLSearchParams({q:code,'resources[type]':'product','resources[limit]':'3'});
      const data=await readJSON(OFFICIAL+'/search/suggest.json?'+query);
      const hints=Array.isArray(data.resources?.results?.products)?data.resources.results.products:[];
      const handles=[...new Set(hints.map(p=>p.handle).filter(h=>typeof h==='string'&&/^[a-z0-9][a-z0-9-]{0,180}$/.test(h)))].slice(0,3);
      const details=await Promise.allSettled(handles.map(handle=>readJSON(OFFICIAL+'/products/'+handle+'.js')));
      for(let i=0;i<details.length;i++){
        const result=details[i];if(result.status!=='fulfilled'){warnings.push('Une fiche Draeger n’a pas pu être vérifiée.');continue;}
        const product=result.value,variants=Array.isArray(product.variants)?product.variants:[];
        const rows=variants.map(v=>normalizeCandidate({name:String(product.title||'')+(v.title&&v.title!=='Default Title'?' — '+v.title:''),sku:v.sku,barcode:v.barcode,sourceKind:'draeger',sourceUrl:OFFICIAL+'/products/'+handles[i]+(v.id?'?variant='+encodeURIComponent(v.id):''),brand:product.vendor,imageUrl:imageFor(v.featured_image,v.image,product.featured_image,Array.isArray(product.images)?product.images:[]),retrievedAt},code)).filter(Boolean);
        const exact=rows.filter(p=>p.exact);candidates.push(...(exact.length?exact:rows.slice(0,3)));
      }
    }catch{warnings.push('La recherche Draeger est momentanément indisponible.');}
    if(!candidates.some(p=>p.exact)&&isGTIN(code)){
      if(upcBlockedUntil>now())warnings.push('La limite de recherche externe est atteinte. Réessayez plus tard.');
      else try{
        const data=await readJSON('https://api.upcitemdb.com/prod/trial/lookup?upc='+encodeURIComponent(code));
        for(const item of (Array.isArray(data.items)?data.items:[]).slice(0,5)){
          const barcode=[item.ean,item.upc,item.gtin].find(v=>isGTIN(v)&&v.padStart(14,'0')===code.padStart(14,'0'));
          if(!barcode)continue;
          const p=normalizeCandidate({name:item.title,sku:'',barcode,brand:item.brand,imageUrl:imageFor(Array.isArray(item.images)?item.images:[]),sourceKind:'upcitemdb',sourceUrl:'https://www.upcitemdb.com/upc/'+encodeURIComponent(barcode),retrievedAt},code);if(p)candidates.push(p);
        }
      }catch(error){if(error.status===429)upcBlockedUntil=error.retryAt;if(error.status!==404)warnings.push(error.status===429?'La limite de recherche externe est atteinte. Réessayez plus tard.':'La base externe est momentanément indisponible.');}
    }
    const unique=[...new Map(candidates.map(p=>[p.sourceKind+'|'+p.sku+'|'+p.barcode+'|'+p.sourceUrl,p])).values()];
    return {code,candidates:unique.slice(0,12),warnings:[...new Set(warnings)],status:warnings.length?'partial':'complete'};
  }
  return async req=>{
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method==='GET')return reply(200,{app:'Pikeo product lookup',version:'1.18.1',status:'ready'});
    if(req.method!=='POST')return reply(405,{error:'Méthode non autorisée.'});
    let code;
    try{
      const reader=req.body?.getReader();let text='',size=0;const decoder=new TextDecoder();
      if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2048){await reader.cancel();return reply(413,{error:'Demande trop volumineuse.'});}text+=decoder.decode(part.value,{stream:true});}
      const body=JSON.parse(text+decoder.decode());code=body.code;
      if(!validLookupCode(code))return reply(400,{error:'Saisissez un code ou une référence de 1 à 120 caractères.'});code=code.trim();
    }catch{return reply(400,{error:'Demande invalide.'});}
    const time=now(),ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
    for(const [key,r]of rates)if(r.until<=time)rates.delete(key);
    const rate=rates.get(ip)||{hits:0,until:time+60000};if(rate.hits>=12||rates.size>=2000&&!rates.has(ip))return reply(429,{error:'Trop de recherches. Réessayez dans une minute.'});rate.hits++;rates.set(ip,rate);
    const previous=cache.get(code);if(previous&&previous.until>time)return reply(200,await previous.task);
    const task=search(code);cache.delete(code);cache.set(code,{task,until:time+300000});if(cache.size>100)cache.delete(cache.keys().next().value);
    void task.then(result=>{if(result.status==='partial'&&cache.get(code)?.task===task)cache.delete(code);},()=>{});
    try{return reply(200,await task);}catch{cache.delete(code);return reply(503,{error:'La recherche Internet est indisponible. Réessayez plus tard.'});}
  };
}
