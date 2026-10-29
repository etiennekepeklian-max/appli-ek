// This contract controls external Android sessions. It never captures audio or memos.
export const MEDIA_SCHEMA=1;
const statuses=new Set(['playing','paused','buffering','connecting','stopped','error','unknown']);
const text=(v,max)=>typeof v==='string'?v.slice(0,max):'';
export function mediaState(value){
 const supported=value?.schema===MEDIA_SCHEMA&&value?.platform==='android'&&value?.supported===true;
 const permission=supported?(value.permission==='granted'?'granted':'required'):'unsupported';
 const seen=new Set(),sessions=[];
 if(permission==='granted')for(const row of Array.isArray(value.sessions)?value.sessions.slice(0,100):[]){
  const id=text(row?.id,256);if(!id||seen.has(id))continue;seen.add(id);
  sessions.push({id,label:text(row.label,160)||'Lecteur multimédia',status:statuses.has(row.status)?row.status:'unknown',canPlay:row.canPlay===true,canPause:row.canPause===true});
 }
 return {schema:MEDIA_SCHEMA,platform:supported?'android':'web',supported,permission,sessions};
}
export function mediaSession(state,selectedId=''){
 if(state.permission!=='granted')return null;
 return state.sessions.find(s=>s.id===selectedId)||state.sessions.find(s=>['playing','buffering','connecting'].includes(s.status))||state.sessions[0]||null;
}
export function mediaAction(session){
 if(!session)return '';
 if(['playing','buffering','connecting'].includes(session.status))return session.canPause?'pause':'';
 if(['paused','stopped'].includes(session.status))return session.canPlay?'play':'';
 return '';
}
// Calls use an exact session and an expected state: never redirect to another app.
export function createMediaController(adapter,{onChange=()=>{}}={}){
 let state=mediaState(),selectedId='',busy=false,generation=0,disposed=false,listener;
 const snapshot=()=>({state,session:mediaSession(state,selectedId),busy});
 const publish=()=>{if(!disposed)onChange(snapshot());};
 const accept=value=>{state=mediaState(value);if(selectedId&&!state.sessions.some(s=>s.id===selectedId))selectedId='';publish();return snapshot();};
 async function refresh(){
  const run=++generation;
  try{const value=adapter?await adapter.getState():null;if(run===generation&&!disposed)return accept(value);}
  catch(error){if(run===generation&&!disposed)accept(null);throw error;}
  return snapshot();
 }
 async function listen(){
  if(!adapter?.addListener)return;
  const handle=await adapter.addListener('stateChanged',()=>{void refresh().catch(()=>{});});
  if(disposed)await handle?.remove?.();else listener=handle;
 }
 async function toggle(){
  if(busy||disposed)return false;
  const before=snapshot(),action=mediaAction(before.session);
  if(!action)throw Error('La commande de ce lecteur n’est pas disponible.');
  busy=true;publish();
  try{
   await refresh();const current=mediaSession(state,selectedId);
   if(current?.id!==before.session.id||current.status!==before.session.status||mediaAction(current)!==action)throw Error('La lecture ou la source a changé. Vérifiez le bouton puis réessayez.');
   const response=await adapter.command({sessionId:current.id,action,expectedStatus:current.status});
   if(response?.accepted!==true)throw Error('Le lecteur n’a pas accepté la commande.');
   // An accepted command is not proof of playback: only native state updates change the icon.
   await refresh();return true;
  }catch(error){await refresh().catch(()=>{});throw error;}
  finally{busy=false;publish();}
 }
 return {
  snapshot,refresh,listen,toggle,
  select(id){if(!state.sessions.some(s=>s.id===id))throw Error('Ce lecteur n’est plus disponible.');selectedId=id;publish();},
  async openAccessSettings(){if(!adapter?.openAccessSettings)throw Error('L’accès aux médias du téléphone nécessite la future version Android.');return adapter.openAccessSettings();},
  async destroy(){disposed=true;generation++;await listener?.remove?.();}
 };
}
