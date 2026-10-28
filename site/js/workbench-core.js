import {refKey,localDate} from './core.js';

export const KINDS=['equipment','resume','instruction','card','term','gratitude','goal','improvement','fatigue','day-action','appearance'];
export const CAUSES=[['','Non précisé'],['empty','Emplacement vide'],['address','Adresse à vérifier'],['damaged','Article abîmé'],['identify','Référence à confirmer'],['other','Autre']];
export const IMPROVEMENT_STATES=[['proposed','Proposée'],['reviewed','Examinée'],['trial','En essai'],['applied','Appliquée'],['closed','Classée']];
export const PERSONAL_DEFAULTS={hand:'both',textSize:'normal',scanVisual:true,celebration:'discreet',shareAchievements:false,recoveryTimes:[]};

export function cleanRecord(kind,input,now=new Date()){
 if(!KINDS.includes(kind))throw Error('Type de fiche inconnu.');
 const row={...input,kind,title:String(input.title||'').trim().slice(0,160),notes:String(input.notes||'').trim().slice(0,4000)};
 if(!row.title)throw Error('Donnez un titre à cette fiche.');
 row.date=input.date||localDate(now);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(Date.parse(row.date+'T12:00:00Z'))||new Date(row.date+'T12:00:00Z').toISOString().slice(0,10)!==row.date)throw Error('Date invalide.');
 if(kind==='resume'){row.orderNumber=refKey(input.orderNumber);row.line=String(input.line||'').slice(0,80);row.bin=String(input.bin||'').slice(0,80);row.location=refKey(input.location);row.next=String(input.next||'').trim().slice(0,400);}
 if(['instruction','card','term'].includes(kind)){row.author=String(input.author||'').trim().slice(0,80);row.source=String(input.source||'').trim().slice(0,160);row.sku=refKey(input.sku);row.reviewDate=input.reviewDate||'';row.confirmed=!!input.confirmed;if(row.reviewDate&&!/^\d{4}-\d{2}-\d{2}$/.test(row.reviewDate))throw Error('Date de revue invalide.');}
 if(kind==='goal'){row.target=Number(input.target);row.progress=Number(input.progress||0);if(!Number.isInteger(row.target)||row.target<1||row.target>999||!Number.isInteger(row.progress)||row.progress<0)throw Error('Choisissez un objectif de 1 à 999 et une progression entière positive.');row.active=input.active!==false&&input.active!=='false';}
 if(kind==='improvement'){row.status=input.status||'proposed';if(!IMPROVEMENT_STATES.some(s=>s[0]===row.status))throw Error('État inconnu.');row.owner=String(input.owner||'').slice(0,80);row.result=String(input.result||'').slice(0,1000);}
 if(kind==='fatigue'){row.level=Number(input.level);if(![1,2,3,4,5].includes(row.level))throw Error('Choisissez un ressenti entre 1 et 5.');}
 if(kind==='gratitude'){row.direction=input.direction==='given'?'given':'received';row.person=String(input.person||'').slice(0,80);}
 return row;
}

export function personalPreferences(input={}){
 const p={...PERSONAL_DEFAULTS,...input};
 if(!['both','left','right'].includes(p.hand))p.hand='both';
 if(!['normal','large'].includes(p.textSize))p.textSize='normal';
 if(!['off','discreet','festive'].includes(p.celebration))p.celebration='discreet';
 p.scanVisual=p.scanVisual!==false;p.shareAchievements=p.shareAchievements===true;
 p.recoveryTimes=[...new Set((Array.isArray(p.recoveryTimes)?p.recoveryTimes:[]).filter(t=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort().slice(0,8);
 return p;
}

export function resumeQueue(rows){
 const groups=new Map();
 for(const r of rows.filter(r=>!r.deleted&&r.status!=='done')){const key=refKey(r.orderNumber);if(!groups.has(key))groups.set(key,{orderNumber:r.orderNumber,received:[],waiting:[]});groups.get(key)[r.status==='received'?'received':'waiting'].push(r);}
 return [...groups.values()].filter(g=>g.received.length).map(g=>({...g,ready:g.waiting.length===0})).sort((a,b)=>Number(b.ready)-Number(a.ready)||a.orderNumber.localeCompare(b.orderNumber));
}

export function orderChanges(before={},after={}){
 const sum=order=>{const out=new Map();for(const l of order.lines||[]){const sku=refKey(l.sku);out.set(sku,(out.get(sku)||0)+Number(l.quantity||0));}return out;};
 const left=sum(before),right=sum(after);
 return [...new Set([...left.keys(),...right.keys()])].map(sku=>({sku,before:left.get(sku)||0,after:right.get(sku)||0})).filter(r=>r.before!==r.after).map(r=>({...r,delta:r.after-r.before,kind:r.before===0?'added':r.after===0?'removed':'changed'}));
}

export function reminderMessage(row,rows,now=Date.now()){
 if(!row?.sku)throw Error('Complétez la référence avant de préparer la relance.');
 const started=Date.parse(row.waitingSince||row.createdAt||row.updatedAt),minutes=Number.isFinite(started)?Math.max(0,Math.floor((now-started)/60000)):null;
 const commands=[...new Set(rows.filter(r=>!r.deleted&&['waiting','partial'].includes(r.status)&&refKey(r.sku)===refKey(row.sku)).map(r=>String(r.orderNumber)))];
 return 'Bonjour, je reviens vers toi pour la référence '+row.sku+'. '+(minutes===null?'Le manquant est toujours en attente.':'Le manquant est signalé depuis '+minutes+' min.')+(commands.length?' Commande'+(commands.length>1?'s':'')+' concernée'+(commands.length>1?'s':'')+' : '+commands.join(', ')+'.':'')+' Peux-tu me tenir au courant du réassort ? Merci !';
}

export function handoffText(rows,{includeNotes=false}={}){
 if(!rows.length)throw Error('Sélectionnez au moins un manquant.');
 return 'Passation — commandes à suivre\n\n'+rows.map(r=>'Commande '+r.orderNumber+' · Référence '+r.sku+'\nCasier : '+(r.location||'à préciser')+' · '+(r.status==='received'?'Réassort reçu, préparation à reprendre':'En attente de réassort')+(r.nextAction?'\nProchaine action : '+r.nextAction:'')+(includeNotes&&r.notes?'\nPrécisions : '+r.notes:'')).join('\n\n');
}

const normalized=value=>{if(Array.isArray(value))return value.map(normalized);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).filter(k=>!['_eventId','updatedAt'].includes(k)).sort().map(k=>[k,normalized(value[k])]));return value;};
export function concurrentChanges(events){
 const resolved=new Set(events.flatMap(e=>e.resolves||[])),groups=new Map();
 for(const e of events){if(!e.baseEventId||e.record?.deleted||resolved.has(e.id))continue;const key=e.type+':'+e.record.id+':'+e.baseEventId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
 return [...groups.values()].filter(g=>new Set(g.map(e=>JSON.stringify(normalized(e.record)))).size>1).map(g=>({type:g[0].type,id:g[0].record.id,events:g.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))}));
}

export function dayFeedback(stats){
 if(!stats.hasData)return {kind:'none',title:'Votre journée reste à enregistrer.',celebrate:false};
 if(stats.status==='estimated')return {kind:'review',title:'Bilan enregistré. Quelques règles restent à confirmer.',celebrate:false};
 if(stats.goal>0&&stats.total>=stats.goal)return {kind:'goal',title:'Bravo, votre objectif personnel est atteint !',celebrate:true};
 return {kind:'saved',title:'Votre journée est enregistrée. Chaque commande terminée compte.',celebrate:false};
}

export function endOfDayActions(rows,completionCount=0){
 const waiting=rows.filter(r=>!r.deleted&&['waiting','partial'].includes(r.status));
 const result=waiting.slice(0,2).map(r=>({title:'Revoir le manquant '+r.sku,notes:'Commande '+r.orderNumber+' · '+(r.location||'casier à préciser')}));
 if(resumeQueue(rows).length)result.push({title:'Reprendre les commandes débloquées',notes:'Vérifier la file de reprise après réception.'});
 if(completionCount)result.push({title:'Compléter une fiche produit',notes:'Choisir une référence dont les informations manquent.'});
 return result.slice(0,3);
}
