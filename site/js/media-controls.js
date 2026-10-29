import {escapeHTML as esc} from './core.js';
import {createMediaController,mediaAction} from './media-core.js';

let installed=false;
const glyph=kind=>'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'+(kind==='pause'?'<path d="M8 5v14M16 5v14"/>':kind==='play'?'<path d="m8 4 12 8-12 8Z"/>':'<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>')+'</svg>';
export function nativeMediaAdapter(root=globalThis){
 // A migration registers this bridge explicitly; a browser or a PWA has no adapter.
 const cap=root.Capacitor;
 if(!cap?.isNativePlatform?.()||cap.getPlatform?.()!=='android'||!cap.isPluginAvailable?.('PikeoMedia'))return null;
 const plugin=root.PikeoMediaBridge||cap.Plugins?.PikeoMedia;
 return plugin&&['getState','command','openAccessSettings','addListener'].every(key=>typeof plugin[key]==='function')?plugin:null;
}
export function installMediaControls({adapter=nativeMediaAdapter()}={}){
 if(installed)return;installed=true;
 const dock=document.createElement('div');dock.id='media-dock';dock.className='media-dock';dock.setAttribute('role','group');dock.setAttribute('aria-label','Commandes de la musique');
 dock.innerHTML='<button type="button" class="media-main" data-media-action="toggle"><span data-media-glyph>'+glyph('music')+'</span><span data-media-label>Musique</span></button><button type="button" class="media-more" data-media-action="open" aria-label="Choisir un lecteur ou consulter l’aide musique">⋯</button>';
 const panel=document.createElement('dialog');panel.id='media-dialog';panel.dataset.helpContext='music';panel.setAttribute('aria-labelledby','media-title');
 panel.innerHTML='<div class="dialog-top"><h2 id="media-title" tabindex="-1">Musique du téléphone</h2><div class="dialog-header-actions"><button type="button" class="icon-button" data-action="quickhelp" aria-label="Aide pour la musique">?</button><button type="button" class="icon-button" data-media-action="close" aria-label="Fermer les commandes musique">×</button></div></div><div class="media-panel-body"><p data-media-status role="status" aria-live="polite"></p><div data-media-sources></div><p data-media-error role="alert" hidden></p><div class="actions section-gap"><button type="button" class="btn primary" data-media-action="panel-toggle" hidden></button><button type="button" class="btn" data-media-action="access" hidden>Ouvrir les réglages d’accès aux notifications</button><button type="button" class="btn" data-media-action="refresh">Actualiser les lecteurs</button></div><p class="hint section-gap">Le contrôle concerne les lecteurs qui proposent des commandes multimédias Android. Il ne contourne pas les restrictions de lecture en arrière-plan, les appels ou les choix de votre lecteur.</p><p class="hint section-gap">Dans la future version Android, l’accès spécial aux notifications permettra de retrouver ces commandes. Android accorde un accès plus large aux notifications : le relais préparé pour Pikéo n’en collecte pas le contenu. Aucun son ni historique d’écoute n’est enregistré ou synchronisé par cette fonction.</p></div>';
 document.body.append(dock,panel);document.body.classList.add('has-media-controls');
 const error=panel.querySelector('[data-media-error]');
 let controller,current,refreshTimer;
 function rehost(){
  const open=[...document.querySelectorAll('dialog[open]')];
  const active=document.activeElement?.closest('dialog[open]');
  const dialog=active||open.at(-1);
  const inPanel=dialog===panel;dock.hidden=inPanel;
  const host=!inPanel&&dialog?(dialog.querySelector('.dialog-header-actions')||dialog.querySelector('.dialog-top')||dialog):document.body;
  if(dock.parentElement!==host)host.append(dock);
  dock.classList.toggle('media-in-dialog',!!dialog&&!inPanel);
 }
 function render(value){
  current=value;const {state,session,busy}=value,action=mediaAction(session);
  const label=action==='pause'?'Pause':action==='play'?'Lecture':'Musique';
  const main=dock.querySelector('.media-main');main.disabled=busy;
  main.setAttribute('aria-label',busy?'Commande musique en cours':action?(label+' · '+session.label):'Musique · informations et disponibilité');
  main.title=action?label+' · '+session.label:'Musique du téléphone';
  main.setAttribute('aria-busy',String(busy));dock.dataset.available=String(!!action);
  dock.querySelector('[data-media-label]').textContent=label;
  dock.querySelector('[data-media-glyph]').innerHTML=glyph(action||'music');
  panel.querySelector('[data-media-status]').textContent=!state.supported&&adapter?'Le relais Android est indisponible. Revenez à Pikéo puis actualisez les lecteurs.':!state.supported?'Le contrôle de YouTube Music, du lecteur du téléphone et des autres applications n’est pas disponible dans la version web. Il est préparé pour la future version Android. En attendant, utilisez les commandes multimédias dans les notifications du téléphone.':state.permission!=='granted'?'Pour contrôler la musique, autorisez Pikéo dans l’accès spécial aux notifications Android, puis revenez ici.':!session?'Aucun lecteur actif détecté. Lancez d’abord votre musique dans YouTube Music ou dans votre lecteur habituel.':session.label+' · '+({playing:'Lecture en cours',paused:'En pause',buffering:'Chargement',connecting:'Connexion',stopped:'À l’arrêt',error:'Erreur du lecteur',unknown:'État indisponible'}[session.status]);
  const sources=panel.querySelector('[data-media-sources]');
  const markup=state.sessions.length>1?'<fieldset class="media-sources"><legend>Lecteur à commander</legend>'+state.sessions.map(row=>'<label><input type="radio" name="media-session" value="'+esc(row.id)+'" '+(row.id===session?.id?'checked ':'')+(busy?'disabled ':'')+'><span>'+esc(row.label)+'</span></label>').join('')+'</fieldset>':'';
  if(sources.innerHTML!==markup)sources.innerHTML=markup;
  const toggle=panel.querySelector('[data-media-action=panel-toggle]');toggle.hidden=!action;toggle.disabled=busy;toggle.textContent=busy?'Commande en cours…':action==='pause'?'Mettre en pause':'Reprendre la lecture';
  panel.querySelector('[data-media-action=access]').hidden=!state.supported||state.permission==='granted';
  panel.querySelector('[data-media-action=refresh]').hidden=!state.supported;
 }
 controller=createMediaController(adapter,{onChange:render});render(controller.snapshot());
 function open(){error.hidden=true;if(panel.open)panel.close();panel.showModal();panel.querySelector('h2').focus({preventScroll:true});rehost();void refresh();}
 async function refresh(){try{await controller.refresh();}catch{showError('Impossible de lire les commandes du téléphone. Revenez à Pikéo puis réessayez.');}}
 function showError(message){error.textContent=message;error.hidden=false;}
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-media-action]');if(!button||button.disabled)return;
  event.preventDefault();const action=button.dataset.mediaAction;
  if(action==='close'){panel.close();return;}
  if(action==='open'||action==='toggle'&&!mediaAction(current.session)){open();return;}
  error.hidden=true;
  if(action==='refresh'){void refresh();return;}
  if(action==='access'){void controller.openAccessSettings().catch(e=>showError(e.message));return;}
  if(['toggle','panel-toggle'].includes(action))void controller.toggle().then(accepted=>{
   if(accepted){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void refresh(),700);}
  }).catch(e=>{if(!panel.open)open();showError(e.message);});
 });
 panel.addEventListener('change',event=>{if(event.target.name==='media-session')try{controller.select(event.target.value);}catch(e){showError(e.message);}});
 panel.addEventListener('close',()=>{if(panel.open)return;rehost();dock.querySelector('.media-main').focus({preventScroll:true});});
 let scheduled=false;
 new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;rehost();});}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 document.addEventListener('focusin',rehost);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 window.addEventListener('focus',()=>void refresh());
 window.addEventListener('pagehide',()=>{clearTimeout(refreshTimer);});
 void controller.listen().catch(()=>{});void refresh();
}
