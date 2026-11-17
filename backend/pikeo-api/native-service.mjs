const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const fail=message=>{const e=Error(message);e.status=403;throw e;};
export function rawSignature(bytes){
 if(bytes.length===64)return bytes;if(bytes[0]!==48)throw Error('Signature invalide.');let i=2;if(bytes[1]&128)i=2+(bytes[1]&127);if(bytes[i++]!==2)throw Error('Signature invalide.');let n=bytes[i++],r=bytes.slice(i,i+n);i+=n;if(bytes[i++]!==2)throw Error('Signature invalide.');n=bytes[i++];let s=bytes.slice(i,i+n);if(r.length===33&&r[0]===0)r=r.slice(1);if(s.length===33&&s[0]===0)s=s.slice(1);if(r.length>32||s.length>32)throw Error('Signature invalide.');const out=new Uint8Array(64);out.set(r,32-r.length);out.set(s,64-s.length);return out;
}
async function valid(publicKey,payload,signature){try{if(typeof signature!=='string'||signature.length>200)return false;const k=await crypto.subtle.importKey('spki',decode(publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},k,rawSignature(decode(signature)),new TextEncoder().encode(JSON.stringify(payload)));}catch{return false;}}
export async function register(sql,device,p,signature,ownerApproved){
 if(!p.nativePublicKey)return;
 if(typeof p.nativePublicKey!=='string'||p.nativePublicKey.length>200||!await valid(p.nativePublicKey,p,signature))fail('Preuve de l’appareil Android invalide.');
 const existing=(await sql`select * from pikeo_private.native_devices where device_id=${device.id}`)[0];
 if(existing&&existing.public_key!==p.nativePublicKey)fail('La clé Android de cet appareil a changé. Contactez Étienne.');
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',decode(p.nativePublicKey))),fingerprint=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
 await sql`insert into pikeo_private.native_devices(device_id,public_key,fingerprint,approved,approved_at,approved_by) values(${device.id},${p.nativePublicKey},${fingerprint},${ownerApproved},${ownerApproved?new Date():null},${ownerApproved?device.id:null}) on conflict(device_id) do nothing`;
}
export async function inspect(sql,device,p,signature){
 if(!signature)return {native:false,approved:false};
 const row=(await sql`select * from pikeo_private.native_devices where device_id=${device.id}`)[0];
 if(!row||!await valid(row.public_key,p,signature))fail('La signature de l’appareil Android est invalide.');
 return {native:true,approved:row.approved,fingerprint:row.fingerprint};
}
export async function requirePlatform(sql,device,native){
 if(device.is_owner&&device.role==='admin')return;
 const policy=(await sql`select web_admin_only from pikeo_private.platform_policy where id=true`)[0];
 if(!policy?.web_admin_only)return;
 if(!native.native||!native.approved)fail(native.native?'Étienne doit autoriser cet appareil Android.':'La version web est réservée à Étienne. Utilisez l’application Android.');
}
