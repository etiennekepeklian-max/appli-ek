export const TRAINING={sku:'EXERCICE-0001',other:'EXERCICE-0002',location:'PAC0102',enfId:'training-enf',enfCode:'EXERCICE-ENF'};
export function trainingStatus(progress,pending=[]){
 const row=progress?.orderNumber?pending.find(r=>!r.deleted&&r.orderNumber===progress.orderNumber&&r.sku===TRAINING.sku&&r.location===TRAINING.location):null;
 return {address:!!progress?.address,missing:!!row&&!!progress?.message&&['received','done'].includes(row.status),content:!!progress?.content,row};
}
export function checkAddress(zone,address){return zone==='PAC'&&String(address||'').trim()==='0102';}
export function checkContents(first,second){return String(first).trim()!==''&&String(second).trim()!==''&&Number(first)===4&&Number(second)===2;}
