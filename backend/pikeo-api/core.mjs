export const nameKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
export function cleanName(value){const name=String(value||'').trim().replace(/\s+/g,' ');if(!name||name.length>40||/[<>\x00-\x1f]/.test(name))throw Error('Choisissez un nom de 1 à 40 caractères.');return name;}
export const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export function publicKey(jwk){if(jwk?.kty!=='EC'||jwk.crv!=='P-256'||!/^[-\w]{43}$/.test(jwk.x)||!/^[-\w]{43}$/.test(jwk.y))throw Error('Clé d’appareil invalide.');return {kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y,ext:true};}
export const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function verify(payload,signature,jwk,now=Date.now()){
 if(!uuid(payload?.deviceId)||!uuid(payload.nonce)||!Number.isFinite(payload.timestamp)||Math.abs(now-payload.timestamp)>120000||typeof signature!=='string'||signature.length>120)return false;
 try{const key=await crypto.subtle.importKey('jwk',publicKey(jwk),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,from64(signature),new TextEncoder().encode(JSON.stringify(payload)));}catch{return false;}
}
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function validMessage(m){return uuid(m?.id)&&uuid(m.recipientDevice)&&m.envelope?.version===1&&/^[-\w+/=]{16}$/.test(m.envelope.iv)&&typeof m.envelope.ciphertext==='string'&&m.envelope.ciphertext.length<12000&&/^[-\w+/=]+$/.test(m.envelope.ciphertext)&&!!publicKey(m.envelope.ephemeral);}
