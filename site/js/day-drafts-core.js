import {localDate} from './core.js';

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
