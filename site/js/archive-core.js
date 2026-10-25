import {latestRecords} from './core.js';
import {toBase64,fromBase64} from './secure-core.js';
export const MAX_ARCHIVE_BYTES=60*1024*1024;
export const hashBytes=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
export function protectedFiles(files,events,metadata=[]){
 const ids=new Set(files.map(f=>f.id)),out=new Map();
 const mark=(value,reason)=>{if(typeof value==='string'&&ids.has(value))out.set(value,reason);else if(Array.isArray(value))for(const v of value)mark(v,reason);else if(value&&typeof value==='object'&&!(value instanceof Blob))for(const v of Object.values(value))mark(v,reason);};
 for(const f of files)if(f.kind==='voice'||f.blob?.type?.startsWith('audio/'))out.set(f.id,'Mémo : utiliser Mémos vocaux');else if(f.kind==='font'||f.blob?.type?.startsWith('font/'))out.set(f.id,'Police de codes-barres conservée');
 for(const [key,row] of latestRecords(events))if(!row.deleted&&(key.startsWith('products:')||key.startsWith('preferences:')))mark(row,'Fichier utilisé par une fiche produit ou les réglages');
 for(const r of metadata)if(r.key?.startsWith('draft-')||['day-capture','enf-draft','last-undo'].includes(r.key))mark(r.value,'Brouillon ou action encore récupérable');
 return out;
}
function info(f){return {id:f.id,name:f.name,kind:f.kind,mime:f.mime,createdAt:f.createdAt,size:f.size,sha256:f.sha256};}
export async function createFileArchive(rows,label='',progress=()=>{}){
 if(!Array.isArray(rows)||!rows.length||rows.length>500)throw Error('Choisissez entre 1 et 500 fichiers.');
 if(rows.reduce((n,f)=>n+f.blob.size,0)>MAX_ARCHIVE_BYTES)throw Error('Choisissez moins de 60 Mo par archive.');
 const files=[],seen=new Set();
 for(const [i,row] of rows.entries()){if(seen.has(row.id)||row.kind==='voice'||row.kind==='font'||row.blob.type.startsWith('audio/'))throw Error('Un fichier ne peut pas rejoindre cette archive.');seen.add(row.id);progress(i+1,rows.length);const bytes=await row.blob.arrayBuffer();files.push({id:row.id,name:row.name||'fichier',kind:row.kind||'document',mime:row.blob.type||'application/octet-stream',createdAt:row.createdAt||'',size:row.blob.size,sha256:await hashBytes(bytes),data:toBase64(new Uint8Array(bytes))});}
 const manifest=files.map(info);return {app:'PikeoFileArchive',schema:1,label:String(label).slice(0,60),exportedAt:new Date().toISOString(),manifestHash:await hashBytes(new TextEncoder().encode(JSON.stringify(manifest))),files};
}
export async function parseFileArchive(data){
 if(data?.app!=='PikeoFileArchive'||data.schema!==1||!Array.isArray(data.files)||!data.files.length||data.files.length>500)throw Error('Choisissez une archive de fichiers Pikéo.');
 const rows=[],manifest=[],seen=new Set();let total=0;
 for(const f of data.files){if(typeof f.id!=='string'||!f.id||f.id.length>160||seen.has(f.id)||typeof f.name!=='string'||f.name.length>300||typeof f.kind!=='string'||typeof f.mime!=='string'||f.mime.length>160||typeof f.createdAt!=='string'||f.createdAt&&!Number.isFinite(Date.parse(f.createdAt))||typeof f.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.data)||f.data.length%4||!Number.isInteger(f.size)||f.size<1||f.kind==='voice'||f.kind==='font'||f.mime.startsWith('audio/')||f.mime.startsWith('font/'))throw Error('L’archive contient un fichier invalide ou protégé.');seen.add(f.id);total+=f.size;if(total>MAX_ARCHIVE_BYTES||f.data.length>MAX_ARCHIVE_BYTES*1.4)throw Error('L’archive dépasse 60 Mo.');const bytes=fromBase64(f.data);if(bytes.byteLength!==f.size||await hashBytes(bytes)!==f.sha256)throw Error('Un fichier est incomplet ou modifié.');manifest.push(info(f));rows.push({id:f.id,name:f.name,kind:f.kind,createdAt:f.createdAt,sha256:f.sha256,blob:new Blob([bytes],{type:f.mime})});}
 const manifestHash=await hashBytes(new TextEncoder().encode(JSON.stringify(manifest)));if(manifestHash!==data.manifestHash)throw Error('La liste des fichiers a changé.');return {rows,manifest,manifestHash};
}
export async function verifyFileArchive(data,expected){
 const parsed=await parseFileArchive(data);if(!expected||parsed.manifestHash!==expected.manifestHash)throw Error('Cette archive ne correspond pas aux fichiers que vous venez de sélectionner.');return parsed;
}
