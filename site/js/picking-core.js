import {dailyStats,localDate,number} from './core.js';

export const PICKING_METRICS=[
  {key:'total',label:'Pickings',unit:'pickings'},
  {key:'commands',label:'Commandes',unit:'commandes'},
  {key:'parcels',label:'Colis',unit:'colis'},
  {key:'pallets',label:'Palettes',unit:'palettes'},
  {key:'weightKg',label:'Poids (kg)',unit:'kg'}
];
export function validPickingDate(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return false;
  const d=new Date(date+'T12:00:00');return Number.isFinite(d.getTime())&&localDate(d)===date&&date>='1900-01-01'&&date<='2100-12-31';
}
export function latestPickingDay(date,days){
  return days.filter(d=>!d.deleted&&d.date===date).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))||String(b.id).localeCompare(String(a.id)))[0];
}
export function pickingDayRecord(input,previous={}){
  const date=String(input.date||'');if(!validPickingDate(date))throw Error('Choisissez une date valide.');
  const quantity=(name,label,integer=true,optional=true)=>{try{return number(input[name],{integer,optional});}catch{throw Error(label+' : saisissez '+(integer?'un entier positif ou nul.':'un nombre positif ou nul.'));}};
  return {...previous,date,deleted:false,source:'manager',manualTotal:quantity('manualTotal','Pickings',true,false),
    manualCommands:quantity('manualCommands','Commandes'),manualParcels:quantity('manualParcels','Colis'),manualPallets:quantity('manualPallets','Palettes'),manualWeightKg:quantity('manualWeightKg','Poids',false),
    reason:String(input.reason||'').trim().slice(0,200),notes:String(input.notes||'').trim().slice(0,1000)};
}
export function pickingSeries(endDate,count,orders,days){
  if(!validPickingDate(endDate)||![7,14,30,90].includes(count))throw Error('Période invalide.');
  const dates=[];for(let i=count-1;i>=0;i--){const d=new Date(endDate+'T12:00:00');d.setDate(d.getDate()-i);dates.push(localDate(d));}
  return dates.map(date=>dailyStats(date,orders,days));
}
export function pickingSummary(series,metric='total'){
  if(!PICKING_METRICS.some(m=>m.key===metric))throw Error('Indicateur inconnu.');
  const values=series.filter(s=>s.hasData&&s[metric]!=null).map(s=>s[metric]);
  return {days:values.length,total:values.length?values.reduce((a,b)=>a+b,0):null,average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,best:values.length?Math.max(...values):null};
}
export function pickingHistory(orders,days){
  const dates=[...new Set([...orders.filter(o=>!o.deleted&&o.status==='completed'),...days.filter(d=>!d.deleted)].map(r=>r.date).filter(validPickingDate))].sort().reverse();
  return dates.map(date=>dailyStats(date,orders,days)).filter(s=>s.hasData);
}
