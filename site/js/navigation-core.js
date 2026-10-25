import {matchesSearch,searchKey} from './ops-core.js';

// One directory for the tool page and the global finder. Aliases use operators' words.
export const TOOL_GROUPS=[
 ['Au quotidien',[
  ['scan','Scanner un produit','Ouvrir directement la caméra','scan','photo code lecture douchette'],
  ['codes','Créer un code-barres','Référence, PAC, PAD, RES et favoris','barcode','étiquette imprimer code barre'],
  ['new-pending','Noter un manquant','Référence, commande et emplacement','clock','réassort JC rupture manque',true],
  ['pending','Suivre les manquants','Réceptions, relances JC et commandes à reprendre','clock','réassort reçu attente JC'],
  ['enfs','ENF — références et quantités','Consulter le contenu ou photographier une feuille','layers','composition ensemble contenu photo'],
  ['stock','Chercher un produit ou un casier','Référence, EAN, nom et emplacement','box','catalogue adresse rechercher trouver article'],
  ['orders','Photos et bilan de ma journée','Toutes les commandes en une seule session','camera','objectif picking fin journée feuilles commande'],
  ['voice','Mémos vocaux','Enregistrer, écouter et exporter sur ce téléphone','mic','mémo vocal note audio son dictaphone']
 ]],
 ['Mon poste et mon équipe',[
  ['post','Mon poste','Matériel et repères de travail','box','équipement checklist'],
  ['resume','Préparations à reprendre','Mes repères pour retrouver une commande','clock','pause reprise attente photo'],
  ['instructions','Consignes et rappels','Retrouver une consigne datée','list','procédure instruction'],
  ['handoff','Passation','Préparer les informations à transmettre','arrow','équipe relève collègues'],
  ['chat','Messages','Échanger avec un collègue','message','chat messagerie collègue JC'],
  ['team','Défis collectifs','Entraide et petits progrès, participation libre','chart','équipe motivation'],
  ['schedule','Horaires et alertes','Rappels avant le travail et les pauses','clock','notification vibration déjeuner planning']
 ]],
 ['Produits et emplacements',[
  ['locations','Emplacements et import CSV','Adresses PAC, PAD et RES','pin','casier importer fichier référence'],
  ['families','Familles et règles de picking','Règles communes et exceptions produit','layers','cartes quantité conditionnement unités lot'],
  ['complete','À compléter','Noms, emplacements et règles manquants','edit','informations incomplètes'],
  ['unknowns','Codes à identifier','Retrouver les lectures inconnues','help','code inconnu scanner']
 ]],
 ['Mes bilans',[
  ['progress','Mes progrès','Mes repères de progression personnels','chart','statistiques objectif picking'],
  ['journal','Journal de la semaine','Bilan, observations et PDF','list','rapport journal bord'],
  ['improvements','Mes améliorations','Noter une idée à reprendre','edit','idée suggestion'],
  ['exports','Partager un bilan','Choisir le contenu à exporter','download','rapport PDF CSV'],
  ['weward','Guide WeWard','Retrouver les étapes dans WeWard','help','pas marche récompense']
 ]],
 ['Préférences et sauvegardes',[
  ['personal','Mes préférences et mon apparence','Thème sombre, lecture agrandie et utilisation à une main','settings','mode sombre clair contraste taille texte main animation mascotte'],
  ['settings','Réglages et sauvegarde Google','Options, raccourcis et connexion Google','settings','son vibration sheets synchroniser sauvegarde accueil'],
  ['storage','Espace et sauvegardes','Mes copies et l’espace utilisé sur cet appareil','shield','JSON restaurer mémoire stockage'],
  ['archive','Archiver mes fichiers','Vérifier une copie puis retirer des fichiers choisis','download','archivage photos espace libérer restaurer'],
  ['users','Sessions et collègues','Mon nom et les habilitations de l’équipe','user','compte profil administrateur opérateur connexion'],
  ['history','Historique et annulation','Retrouver ou annuler une action enregistrée','history','annuler erreur retour correction'],
  ['conflicts','Modifications à comparer','Relire les versions concurrentes','list','conflit historique'],
  ['diagnostic','Diagnostic hors ligne','Vérifier la disponibilité de l’application','sync','connexion panne test'],
  ['training','Prise en main','Trois exercices dans la démonstration','help','formation débutant apprendre essai'],
  ['help','Aide et prise en main','Comprendre l’écran ou le geste à réaliser','help','notice tutoriel']
 ]],
 ['Contrôles de stock',[
  ['movements','Mouvements de stock','Conserver une trace des transferts','arrow','déplacer transfert'],
  ['inventories','Inventaires et contrôles','Comptages et contrôle des vides','list','compter inventaire quantité'],
  ['replenishments','Seuils de réassort','Réglages et constats datés','sync','minimum maximum réassort'],
  ['issues','Écarts et incidents','Noter les faits et préparer un partage','alert','erreur problème casse abîmé']
 ]]
];
export const TOOLS=TOOL_GROUPS.flatMap(([group,rows])=>rows.map(([id,title,description,glyph,aliases,action=false])=>({id,title,description,glyph,aliases,action,group})));
export function searchTools(query=''){
 return TOOLS.filter(t=>matchesSearch(t,['title','description','aliases','group'],query));
}
export function prioritizeProducts(rows,query){
 const key=searchKey(query);if(!key)return rows;
 const score=p=>[p.sku,p.barcode].some(v=>searchKey(v)===key)?0:[p.sku,p.barcode].some(v=>searchKey(v).startsWith(key))?1:2;
 return rows.map((p,index)=>({p,index,score:score(p)})).sort((a,b)=>a.score-b.score||a.index-b.index).map(r=>r.p);
}
