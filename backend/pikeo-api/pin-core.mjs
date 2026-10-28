// A four-digit PIN is only a SECOND factor for an already signed, registered
// admin device. Never authenticate a person from a PIN or displayed name alone.
const enc=new TextEncoder();
const hex=bytes=>[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
const unhex=s=>Uint8Array.from(s.match(/../g)||[],x=>parseInt(x,16));
export const validPin=pin=>typeof pin==='string'&&/^\d{4}$/.test(pin);
export function randomSalt(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return hex(bytes);}
export async function digestPin(pin,salt,pepper,iterations=310000){
 if(!validPin(pin))throw Error('Le code administrateur doit comporter exactement quatre chiffres.');
 if(typeof salt!=='string'||!/^[a-f0-9]{32}$/.test(salt))throw Error('Sel de code invalide.');
 if(typeof pepper!=='string'||pepper.length<32)throw Error('Secret serveur PIN non configuré.');
 if(!Number.isSafeInteger(iterations)||iterations<10000||iterations>5000000)throw Error('Paramètre de dérivation invalide.');
 const key=await crypto.subtle.importKey('raw',enc.encode('Pikeo-Admin-PIN-v1\0'+pepper+'\0'+pin),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),hash:'SHA-256',iterations},key,256);
 return hex(new Uint8Array(bits));
}
export function safeHashEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!/^[a-f0-9]{64}$/.test(a)||!/^[a-f0-9]{64}$/.test(b))return false;
 let diff=0;for(let i=0;i<64;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
export async function verifyPin(pin,salt,stored,pepper,iterations=310000){
 if(!validPin(pin))return false;return safeHashEqual(await digestPin(pin,salt,pepper,iterations),stored);
}
export function lockoutMs(consecutiveFailures){
 if(!Number.isSafeInteger(consecutiveFailures)||consecutiveFailures<0)throw Error('Compteur invalide.');
 if(consecutiveFailures<5)return 0;
 return Math.min(24*60*60*1000,15*60*1000*Math.pow(2,Math.min(10,consecutiveFailures-5)));
}
export const isLocked=(lockedUntil,now=Date.now())=>lockedUntil!=null&&Number.isFinite(Date.parse(lockedUntil))&&Date.parse(lockedUntil)>now;
