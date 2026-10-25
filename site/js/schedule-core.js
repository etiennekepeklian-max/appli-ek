// Portable rules: no DOM, storage or timer dependency. Port these fixtures to Godot.
export const DEFAULT_SCHEDULE={enabled:true,timeZone:'Europe/Paris',leadMinutes:8,days:[1,2,3,4,5],start:'08:00',breakStart:'10:15',breakMinutes:15,lunchStart:'12:30',lunchMinutes:45,end:'16:00'};
const clock=value=>{if(!/^\d{2}:\d{2}$/.test(value))throw Error('Saisissez une heure valide.');const [h,m]=value.split(':').map(Number);if(h>23||m>59)throw Error('Saisissez une heure valide.');return h*60+m;};
export const timeLabel=minutes=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
export function validateSchedule(input={}){
 const s={...DEFAULT_SCHEDULE,...input,leadMinutes:8,timeZone:'Europe/Paris'};
 s.days=[...new Set((s.days||[]).map(Number))].sort();
 if(s.days.some(d=>!Number.isInteger(d)||d<0||d>6)||s.enabled&&!s.days.length)throw Error('Choisissez au moins un jour de travail.');
 for(const name of ['breakMinutes','lunchMinutes']){s[name]=Number(s[name]);if(!Number.isInteger(s[name])||s[name]<1||s[name]>180)throw Error('La durée doit être comprise entre 1 et 180 minutes.');}
 const a=clock(s.start),b=clock(s.breakStart),c=clock(s.lunchStart),d=clock(s.end);
 if(a<8||!(a<b&&b+s.breakMinutes<c&&c+s.lunchMinutes<d))throw Error('Vérifiez l’ordre des horaires et la durée des pauses.');
 return s;
}
export function scheduleEvents(input=DEFAULT_SCHEDULE){
 const s=validateSchedule(input);
 return [['start','Prise de poste',clock(s.start)],['break-start','Début de pause',clock(s.breakStart)],['break-end','Fin de pause',clock(s.breakStart)+s.breakMinutes],['lunch-start','Début du déjeuner',clock(s.lunchStart)],['lunch-end','Fin du déjeuner',clock(s.lunchStart)+s.lunchMinutes],['end','Fin de journée',clock(s.end)]].map(([id,label,minute])=>({id,label,minute,time:timeLabel(minute),reminderMinute:minute-s.leadMinutes,reminder:timeLabel(minute-s.leadMinutes)}));
}
export function zonedParts(now=new Date(),timeZone='Europe/Paris'){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,day:new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`).getUTCDay(),minute:Number(p.hour)*60+Number(p.minute),second:Number(p.second)};
}
// Catch up only in the eight-minute window. Existing alerts stay until acknowledged.
export function dueReminders(schedule,now=new Date(),seen={}){
 const s=validateSchedule(schedule),p=zonedParts(now,s.timeZone);
 if(!s.enabled||!s.days.includes(p.day))return [];
 return scheduleEvents(s).filter(e=>p.minute>=e.reminderMinute&&p.minute<e.minute).map(e=>({...e,date:p.date,key:`${p.date}:${e.id}`})).filter(e=>!seen[e.key]);
}
