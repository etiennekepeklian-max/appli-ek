import {parseDayPage,printedIdentity} from './day-core.js';
import {layoutText} from './ocr-layout-core.js';

export const ORDER_READER_VERSION=2;
export function assessOrderText(text){
 const sections=parseDayPage(text),identified=sections.filter(s=>s.number&&/\d/.test(s.number)),lines=identified.flatMap(s=>s.lines),valid=lines.filter(l=>Number.isInteger(l.quantity)&&l.quantity>0),located=valid.filter(l=>l.location),unread=sections.reduce((n,s)=>n+(s.unreadRows?.length||0),0),conflicts=sections.filter(s=>s.identityConflict).length;
 const score=identified.length*100+Math.min(100,valid.length)*4+Math.min(100,located.length)*3-unread*2-conflicts*100;
 return {sections,score,identified:identified.length,valid:valid.length,unread,confident:!!identified.length&&(located.length>=2||sections.every(s=>s.number&&s.lines.length&&!s.identityConflict)&&valid.length===lines.length)};
}
export function selectOrderText(data){
 const choices=[layoutText(data.tsv,data.text||''),data.text||''].map(text=>({text,...assessOrderText(text)}));
 return choices.sort((a,b)=>b.score-a.score)[0];
}
export function identityText(text){
 const identities=[];
 const lines=String(text||'').split(/\r?\n/);
 for(let i=0;i<lines.length;i++){const identity=printedIdentity(lines[i])||printedIdentity(lines[i]+' '+(lines[i+1]||''));if(identity&&!identities.some(a=>a.kind===identity.kind&&a.value===identity.value))identities.push(identity);}
 return identities.map(a=>(a.kind==='registration'?'Enregistrement : ':'Commande : ')+a.value).join('\n');
}
export function needsOrderRetry(page,{force=false}={}){
 if(page.excluded||page.reviewed)return false;
 if(force)return true;
 return !!page.error||!page.sections?.length||page.sections.some(s=>!s.number||!s.lines?.length||s.unreadRows?.length||s.identityConflict||s.lines.some(l=>!Number.isInteger(Number(l.quantity))||Number(l.quantity)<1));
}
