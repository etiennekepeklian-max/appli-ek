import {helpFor} from './help-core.js';
import {state,esc} from './ui.js';

function currentContext(){
 const dialog=[...document.querySelectorAll('dialog[open]')].filter(d=>d.id!=='help-dialog').at(-1);
 if(!dialog)return document.querySelector('#work-alert')?'schedule-alert':'';
 const form=dialog.querySelector('[data-form],[data-ops-form],[data-day-form]');
 if(dialog.dataset.helpContext)return dialog.dataset.helpContext;
 const marker=dialog.querySelector('[data-help-context]');if(marker)return marker.dataset.helpContext;
 if(form)return form.dataset.form||form.dataset.opsForm||form.dataset.dayForm;
 if(dialog.querySelector('[data-jc-message]'))return 'message-jc';
 if(dialog.querySelector('[data-photo]'))return 'photo';
 if(dialog.querySelector('#receipt-reference'))return 'receipt';
 if(dialog.querySelector('.product-details'))return 'stock';
 return dialog.dataset.helpFallback||'';
}
export function show(action='quickhelp'){
 const [title,steps]=helpFor({route:state.route,context:currentContext(),action});
 const dialog=document.querySelector('#help-dialog');
 dialog.querySelector('h2').textContent='Aide · '+title;
 dialog.querySelector('.help-body').innerHTML=`<div class="steps">${steps.map(text=>`<div class="step"><div>${esc(text)}</div></div>`).join('')}</div>`;
 if(!dialog.open)dialog.showModal();
 dialog.querySelector('h2').focus({preventScroll:true});
}
export function close(){document.querySelector('#help-dialog')?.close();}
// Photo framing has its own dialog; give it the same contextual entry point.
export function install(){
 new MutationObserver(()=>{
  for(const dialog of document.querySelectorAll('dialog:not(#dialog):not(#help-dialog)')){
   let top=dialog.querySelector('.dialog-top');
   if(!top){const title=dialog.querySelector('h2');if(title){top=document.createElement('div');top.className='dialog-top';title.before(top);top.append(title);}}
   if(top&&!top.querySelector('[data-action=quickhelp]'))top.insertAdjacentHTML('beforeend','<button type="button" class="icon-button context-help" data-action="quickhelp" aria-label="Aide pour cette action">?</button>');
  }
 }).observe(document.body,{childList:true});
}
