import {TOOL_GROUPS,searchTools} from './navigation-core.js';
import {esc,icon,modal} from './ui.js';

const row=t=>`<button type="button" ${t.action?'data-action':'data-nav'}="${esc(t.id)}" class="tool-row"><span class="tool-icon">${icon(t.glyph)}</span><span><strong>${esc(t.title)}</strong><small>${esc(t.description)}</small></span>${icon('arrowright')}</button>`;
const results=(query,compact=false)=>{
 const found=searchTools(query),shown=compact&&!query.trim()?found.slice(0,8):found;
 if(!found.length)return '<div class="empty"><h3>Aucun outil trouvé</h3><p>Essayez « ENF », « manquant », « photo » ou « sombre ».</p></div>';
 return TOOL_GROUPS.map(([group])=>{const rows=shown.filter(t=>t.group===group);return rows.length?`<section class="tool-section"><h2>${esc(group)}</h2><div class="tool-list">${rows.map(row).join('')}</div></section>`:'';}).join('');
};
function searchInput(id){return `<div class="field tool-finder-search"><label for="${id}">Que voulez-vous faire ?</label><div class="search-box">${icon('search')}<input id="${id}" type="search" data-tool-search placeholder="Ex. ENF, manquant, photo, sombre…" autocomplete="off" spellcheck="false" aria-controls="${id}-results"></div><p class="hint" data-tool-count role="status" aria-live="polite">Les fonctions du quotidien sont présentées en premier.</p></div>`;}
export function directory(){return `<div class="page-heading"><div><div class="eyebrow">Tout retrouver au même endroit</div><h1>Tous mes outils</h1><p>Cherchez un geste avec vos mots.</p></div></div><div data-tool-directory>${searchInput('tools-search')}<div id="tools-search-results" data-tool-results>${results('')}</div></div>`;}
export function openFinder(){
 modal('Trouver une fonction',`<div data-tool-directory data-tool-compact>${searchInput('global-tools-search')}<div id="global-tools-search-results" data-tool-results>${results('',true)}</div><div class="form-actions"><button type="button" class="btn" data-nav="more">Voir tous mes outils</button></div></div>`);
 document.querySelector('#dialog').dataset.helpContext='tool-finder';
 requestAnimationFrame(()=>document.getElementById('global-tools-search')?.focus({preventScroll:true}));
}
export function install(){
 document.addEventListener('input',event=>{
  if(!event.target.matches('[data-tool-search]'))return;
  const root=event.target.closest('[data-tool-directory]'),query=event.target.value;
  root.querySelector('[data-tool-results]').innerHTML=results(query,root.hasAttribute('data-tool-compact'));
  root.querySelector('[data-tool-count]').textContent=query.trim()?`${searchTools(query).length} fonction(s) trouvée(s).`:'Les fonctions du quotidien sont présentées en premier.';
 });
}
