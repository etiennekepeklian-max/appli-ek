import {localDate} from './core.js';
import {restartDayPlan} from './day-core.js';

export function validDraftDate(date){
  return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&localDate(new Date(date+'T12:00:00'))===date;
}

export function pendingDayDrafts(active,backlog={}){
  const days=new Map();
  for(const draft of Object.values(backlog||{}))if(validDraftDate(draft?.date)&&draft.pages?.length)days.set(draft.date,draft);
  if(validDraftDate(active?.date)){
    days.delete(active.date);
    if(active.pages?.length)days.set(active.date,active);
  }
  return [...days.values()].sort((a,b)=>b.date.localeCompare(a.date));
}

// Keep the historical active key readable by older versions. Switching dates
// moves the outgoing draft, including manual corrections, into a separate key.
export function switchDayDraftState(date,active,backlog={}){
  if(!validDraftDate(date))throw Error('Choisissez une journée valide.');
  const saved=Object.fromEntries(pendingDayDrafts(active,backlog).map(d=>[d.date,structuredClone(d)]));
  const draft=active?.date===date?structuredClone(active):saved[date]||{date,pages:[],choices:{}};
  delete saved[date];
  return {draft,backlog:saved};
}

// Move a whole day, including a saved balance and its local photo draft.
// Occupied dates are rejected; this action never merges two days implicitly.
export function moveDayPlan(date,newDate,orders,days,active,backlog={}){
  if(!validDraftDate(date)||!validDraftDate(newDate))throw Error('Choisissez une journée valide.');
  if(date===newDate)throw Error('Choisissez une date différente.');
  const source=restartDayPlan(date,orders,days,active,backlog),target=restartDayPlan(newDate,orders,days,active,backlog);
  if(!source.items.length&&!source.photos)throw Error('Aucune commande, correction ou photo pour cette journée.');
  if(target.items.length||target.photos)throw Error('Cette date contient déjà une journée ou des photos. Choisissez une date libre pour ne rien écraser.');
  const saved=Object.fromEntries(pendingDayDrafts(active,backlog).map(d=>[d.date,structuredClone(d)]));
  let draft=active?structuredClone(active):{date:newDate,pages:[],choices:{}};
  const sourceDraft=active?.date===date?active:saved[date];
  delete saved[date];delete saved[newDate];
  if(sourceDraft){
    const moved={...structuredClone(sourceDraft),date:newDate};
    if(!active||active.date===date||active.date===newDate)draft=moved;
    else if(moved.pages?.length)saved[newDate]=moved;
  }
  if(draft)delete saved[draft.date];
  return {date,newDate,signature:source.signature,commands:source.commands,photos:source.photos,
    items:source.items.map(({type,record})=>({type,record:{...record,date:newDate,deleted:false}})),draft,backlog:saved};
}
