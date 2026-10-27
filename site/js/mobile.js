import {icon} from './icons.js';

// The same phone interface is used at every screen width.
export function renderMobileNav(route, pendingCount=0){
  const items=[['home','Accueil','home'],['codes','Codes','barcode'],['pending','Manquants','clock'],['stock','Produits','box'],['more','Outils','more']];
  const active=['stock','enfs','families','locations','complete','unknowns'].includes(route)?'stock':items.some(([key])=>key===route)?route:'more';
  return items.map(([key,label,glyph])=>`<button type="button" data-nav="${key}" class="${active===key?'active ':''}${key==='scan'?'scan-tab':''}" ${active===key?'aria-current="page"':''}><span class="nav-icon">${icon(glyph)}${key==='pending'&&pendingCount?`<span class="nav-count" aria-label="${pendingCount} attente(s)">${pendingCount>99?'99+':pendingCount}</span>`:''}</span><span>${label}</span></button>`).join('');
}

export function mobileTools(profile='preparer'){
 const groups=[
  ['Ma journée',[['post','Mon poste','Matériel, repères, consignes et passation','box'],['schedule','Horaires et alertes','Huit minutes avant chaque début et fin','clock'],['voice','Mémos vocaux','Enregistrer et exporter sur ce téléphone','mic'],['orders','Suivi picking','Mes chiffres et graphiques par date','chart'],['journal','Journal de la semaine','Bilan, observations et PDF','list']]],
  ['Produits et emplacements',[['enfs','ENF — références et quantités','Photographier une feuille ou consulter sa composition','layers'],['stock','Chercher un produit ou un casier','Référence, EAN, nom ou adresse','box'],['locations','Emplacements et import CSV','Adresses PAC, PAD et RES','pin'],['complete','À compléter','Emplacements, noms et règles manquants','edit'],['families','Familles et règles de picking','Règles communes et exceptions produit','layers'],['unknowns','Codes à identifier','Retrouver les lectures inconnues','help']]],
  ['Manquants et réassorts',[['pending','Suivre les manquants','Par commande ou par référence','clock']]],
  ['Codes-barres',[['codes','Créer et retrouver mes codes','Favoris, récents et étiquettes','barcode'],['scan','Scanner un produit','Caméra, photo ou saisie','scan']]],
  ['Mon espace',[['users','Sessions et collègues','Mon nom, mes messages et les habilitations','user'],['history','Historique et annulation','Retrouver les actions enregistrées','history'],['settings','Réglages et sauvegardes','Apparence, options et copies','settings'],['help','Aide et prise en main','Les gestes essentiels','help']]]
 ];
 const list=items=>`<div class="tool-list">${items.map(([route,title,description,glyph])=>`<button type="button" data-nav="${route}" class="tool-row"><span class="tool-icon">${icon(glyph)}</span><span><strong>${title}</strong><small>${description}</small></span>${icon('arrowright')}</button>`).join('')}</div>`;
 return `<div class="page-heading"><div><div class="eyebrow">À portée de main</div><h1>Mes outils</h1><p>Les fonctions regroupées par usage.</p></div></div>${groups.map(([label,items])=>`<section class="tool-section"><h2>${label}</h2>${list(items)}</section>`).join('')}<details class="tool-section" ${profile==='stock'?'open':''}><summary>Contrôles de stock</summary><p class="hint">Suivi personnel complémentaire aux opérations réalisées dans Velocity.</p>${list([['movements','Mouvements de stock','Trace des transferts','arrow'],['inventories','Inventaires et contrôles','Comptages et contrôle des vides','list'],['replenishments','Seuils de réassort','Réglages et constats datés','sync'],['issues','Écarts et incidents','Noter et préparer un partage','alert']])}</details>`;
}

function moveContents(from,to){while(from.firstChild)to.append(from.firstChild);}
function actionLabel(button){
  if(button.textContent.trim())return;
  const action=button.dataset.action||'';
  const label=action==='edit-product'?'Compléter':action.startsWith('edit-')?'Modifier':action==='remove-record'?'Supprimer':action==='share-issue'?'Partager':action==='view-photo'?'Photo':'Ouvrir';
  const span=document.createElement('span');span.textContent=label;button.append(span);button.classList.add('labeled-action');
}

// Replace read-only tables with semantic cards. Original controls and event
// delegation are retained; no record is truncated or hidden on small screens.
export function enhanceMobileTables(root,route=''){
  for(const table of root.querySelectorAll('table.data-table:not(.editor-lines)')){
    const labels=[...table.querySelectorAll('thead th')].map(el=>el.textContent.trim());
    const list=document.createElement('div');list.className='record-list';
    if(table.closest('details'))list.classList.add('compact-records');
    const rows=[...table.querySelectorAll('tbody > tr')];
    if(!rows.length)list.innerHTML='<div class="empty"><h3>Aucun résultat</h3><p>Essayez un autre mot dans la recherche.</p></div>';
    for(const row of rows){
      const cells=[...row.children];if(!cells.length)continue;
      const card=document.createElement('article');card.className='record-card';
      if(route==='families')card.classList.add('family-record');
      if(route==='stock'){card.classList.add('product-record');const id=row.querySelector('[data-action="edit-product"]')?.dataset.id;if(id){card.dataset.action='view-product';card.dataset.id=id;card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','Voir la fiche '+(cells[1]?.textContent||'produit').trim());}}
      const heading=document.createElement('div');heading.className='record-heading';
      const titleIndex=route==='stock'||route==='history'||route==='movements'?1:0;
      const title=document.createElement('h3');moveContents(cells[titleIndex]||cells[0],title);heading.append(title);card.append(heading);
      const facts=document.createElement('dl');facts.className='record-facts';
      const actions=document.createElement('div');actions.className='record-actions';
      cells.forEach((cell,index)=>{
        if(index===titleIndex)return;
        const controls=cell.querySelector('button,[data-action]');
        const isActions=controls&&(!labels[index]||labels[index]==='Actions');
        if(isActions){moveContents(cell,actions);return;}
        const fact=document.createElement('div');fact.className='record-fact';
        const term=document.createElement('dt');term.textContent=labels[index]||cell.querySelector('th')?.textContent||'Valeur';
        const value=document.createElement('dd');moveContents(cell,value);fact.append(term,value);facts.append(fact);
      });
      if(facts.children.length)card.append(facts);
      if(actions.childNodes.length){actions.querySelectorAll('button.icon-button').forEach(actionLabel);card.append(actions);}
      list.append(card);
    }
    const wrap=table.parentElement.classList.contains('table-wrap')?table.parentElement:table;
    wrap.replaceWith(list);
    const section=list.parentElement;
    if(section?.classList.contains('card')&&!section.querySelector('.card-header'))section.classList.add('list-surface');
  }
}

export function enhanceMobileView(root,route,customShortcuts){
  root.dataset.view=route;
  if(route==='more')return;
  const tabs=root.querySelector('.tabs');
  if(tabs){
    const links=[...tabs.querySelectorAll('[data-nav]')];
    const nav=document.createElement('nav');nav.className='stock-switcher';nav.setAttribute('aria-label','Produits et emplacements');
    const label=document.createElement('label');label.htmlFor='stock-tool';label.textContent='Produits et emplacements';
    const select=document.createElement('select');select.id='stock-tool';select.dataset.routeSelect='';
    for(const link of links){const option=document.createElement('option');option.value=link.dataset.nav;option.textContent=link.textContent;option.selected=link.dataset.nav===route;select.append(option);}
    nav.append(label,select);tabs.replaceWith(nav);
  }
  enhanceMobileTables(root,route);
  if(route==='home'){
    root.querySelector('.hero')?.remove();
    const quick=root.querySelector('.quick-grid')?.closest('section');
    if(quick){
      quick.classList.add('mobile-quick-card');
      quick.querySelector('h2').textContent='Que voulez-vous faire ?';
      const shortcuts=customShortcuts?.length?customShortcuts:[['codes','barcode','Créer un code','Saisir ou dicter'],['scan','scan','Scanner','Caméra ou photo'],['new-order','chart','Ma journée','Chiffres et graphiques'],['new-pending','clock','Un manquant','Suivre le réassort']];
      quick.querySelector('.quick-grid').innerHTML=shortcuts.map(([action,glyph,title,hint])=>`<button class="quick" ${['enfs','codes','scan','stock','locations','unknowns','journal'].includes(action)?`data-nav="${action}"`:`data-action="${action}"`}><span class="quick-icon">${icon(glyph)}</span><span>${title}<small>${hint}</small></span></button>`).join('');
      root.insertBefore(quick,root.querySelector('.common-search'));
      quick.insertAdjacentHTML('afterend','<div class="home-enf-link"><button type="button" class="btn" data-nav="enfs">'+icon('layers')+'ENF — références et quantités</button></div>');
    }
  }
}

export function installMobileViewport(){
  const update=()=>{
    const viewport=window.visualViewport;
    document.documentElement.style.setProperty('--visual-height',`${viewport?.height||window.innerHeight}px`);
    const typing=document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea');
    document.body.classList.toggle('keyboard-open',!!typing&&!!viewport&&window.innerHeight-viewport.height>120);
  };
  window.visualViewport?.addEventListener('resize',update);
  window.addEventListener('resize',update);
  document.addEventListener('focusin',update);
  document.addEventListener('focusout',()=>requestAnimationFrame(update));
  update();
}


