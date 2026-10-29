import {normalizeCandidate} from './product-lookup-core.js';
export const LOOKUP_ENDPOINT='https://wcmuffmyozjolaaahhff.supabase.co/functions/v1/pikeo-product-lookup';
// Public anon key, used only to pass the read-only function's JWT gateway.
const PUBLIC_LOOKUP_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjbXVmZm15b3pqb2xhYWFoaGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NDUyMTAsImV4cCI6MjEwODUyMTIxMH0.ZPIvvT1qpDqombpK5E7g7-4ePCxHiOqPW3cHVbpvQ9E";
export async function searchProductWeb(code,{signal}={}){
 const response=await fetch(LOOKUP_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLIC_LOOKUP_KEY,Authorization:'Bearer '+PUBLIC_LOOKUP_KEY},body:JSON.stringify({code}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(14000)]):AbortSignal.timeout(14000),credentials:'omit',cache:'no-store'});
 const data=await response.json();if(!response.ok)throw Error(data.error||'La recherche Internet est indisponible.');
 const candidates=(Array.isArray(data.candidates)?data.candidates:[]).slice(0,12).map(p=>normalizeCandidate(p,code)).filter(Boolean);
 return {candidates,warnings:(Array.isArray(data.warnings)?data.warnings:[]).filter(v=>typeof v==='string').slice(0,4)};
}
