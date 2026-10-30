import {escapeHTML as esc} from './core.js';
import {icon} from './icons.js';

// Canva illustrations are decorative. Every control keeps a visible, specific label.
const cells={scan:0,'new-pending':1,pending:1,enfs:2,codes:3,stock:4,'new-order':5,orders:5,voice:6,schedule:7,help:8,training:8};
export const HOME_ACTIONS=[
 ['scan','Scanner','Lire un code avec la caméra','scan',false],
 ['new-pending','Noter un manquant','Commande, référence et quantité','clock',true],
 ['enfs','Trouver un ENF','Voir tout ce qu’il faut prélever','layers',false],
 ['codes','Créer un code','Afficher une référence en grand','barcode',false],
 ['stock','Chercher un produit','Retrouver sa fiche et son casier','box',false],
 ['new-order','Ma journée','Noter mes chiffres de picking','chart',true]
];
export function pictogram(id,glyph='box'){
 const cell=cells[id];
 return cell===undefined?`<span class="simple-picto simple-picto-fallback" aria-hidden="true">${icon(glyph)}</span>`:`<span class="simple-picto simple-picto-${cell}" aria-hidden="true"></span>`;
}
function actionTile([id,title,hint,glyph,action=false],kind=''){
 return `<button type="button" class="quick simple-action ${kind}" ${action?'data-action':'data-nav'}="${esc(id)}">${pictogram(id,glyph)}<span class="simple-action-copy"><strong>${esc(title)}</strong><small>${esc(hint)}</small></span></button>`;
}
export const homeActions=()=>HOME_ACTIONS.map(item=>actionTile(item)).join('');
export function customActions(shortcuts=[]){
 if(!shortcuts.length)return '';
 return `<details class="simple-custom-shortcuts"><summary>Mes raccourcis personnalisés</summary><div class="simple-custom-grid">${shortcuts.map(([id,glyph,title,hint])=>actionTile([id,title,hint,glyph,!['enfs','codes','scan','stock','locations','unknowns','journal'].includes(id)],'simple-custom-action')).join('')}</div><button type="button" class="btn small" data-nav="settings">Modifier mes raccourcis</button></details>`;
}
export const homeEssentials=()=>`<div class="simple-essentials" aria-label="Mes autres accès rapides">${[['voice','Mémos vocaux','mic'],['schedule','Mes horaires','clock'],['help','Aide','help']].map(([id,label,glyph])=>`<button type="button" data-nav="${id}">${pictogram(id,glyph)}<span>${label}</span></button>`).join('')}</div>`;
const guides={
 codes:['Écrivez ou dictez la référence.','Touchez « Générer le code ».','Vérifiez le texte, puis montrez le code au terminal.'],
 scan:['Autorisez la caméra et cadrez le code entier.','Lisez le produit proposé ; une photo ou une saisie reste possible.','Vérifiez toute proposition Internet avant de l’enregistrer.'],
 pending:['Touchez « Noter un manquant » et indiquez la commande, la référence et la quantité.','Ouvrez « Message pour réassort », relisez puis copiez le message.','Touchez « Reçu » à la livraison, puis « Commande terminée » quand la préparation est finie.'],
 enfs:['Cherchez le numéro de REF concept de votre commande, ou son nom.','Ouvrez « Voir le contenu ».','Prélevez le meuble, la mère et toutes les filles selon les quantités affichées.'],
 stock:['Tapez une référence, un nom ou une adresse dans la recherche.','Touchez la fiche du produit.','Retrouvez son casier, son code ou le bouton pour noter un manquant.'],
 orders:['Choisissez la date de votre journée.','Recopiez les chiffres communiqués par votre manager.','Touchez « Sauvegarder » ; le bilan et les graphiques sont actualisés.'],
 voice:['Touchez « Enregistrer » et autorisez le micro.','Arrêtez l’enregistrement pour conserver votre mémo.','Écoutez-le ou exportez-le depuis cet écran ; les sons restent sur ce téléphone.'],
 schedule:['Vérifiez vos heures de travail et de pause.','Enregistrez vos horaires et essayez une alerte.','Gardez Pikéo ouverte et visible pour recevoir les rappels de la version web.']
};
export function routeGuide(route){
 const steps=guides[route];
 return steps?`<details class="simple-route-guide"><summary>Comment faire ? <span>3 gestes pour commencer</span></summary><ol>${steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><button type="button" class="btn small" data-action="quickhelp">? Aide de cet écran</button></details>`:'';
}
export function enhanceSimpleUI(root,route){
 if(!root.querySelector('.simple-route-guide'))root.querySelector(':scope > .page-heading')?.insertAdjacentHTML('afterend',routeGuide(route));
}
export const gettingStarted=()=>`<div class="simple-start"><p class="dialog-intro">Trois gestes suffisent pour commencer. Vous pouvez toujours revenir à l’accueil avec le bouton du bas.</p><ol><li><strong>Choisissez votre action.</strong><p>Les six gros boutons de l’accueil ouvrent directement le bon écran.</p></li><li><strong>Renseignez l’essentiel.</strong><p>Les champs marqués d’une étoile sont obligatoires. Les détails et les options se déplient seulement si vous en avez besoin.</p></li><li><strong>Vérifiez puis enregistrez.</strong><p>Le bouton principal termine votre saisie. Le bouton ? explique l’action en cours sans effacer vos champs.</p></li></ol><div class="form-actions"><button type="button" class="btn" data-nav="training">M’exercer dans la démonstration</button><button type="button" class="btn primary" data-action="close-dialog">J’ai compris</button></div></div>`;
