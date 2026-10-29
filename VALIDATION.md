# Version 1.17.1 · animation d'ouverture Pikéo n°1 (28 octobre 2026)

Mise à jour **web uniquement**, issue du choix explicite de la proposition n°1 « Contraste terrain ».
- Mascotte **originale** : `site/assets/mascot-default.svg`, inchangée. Pas de nouveau personnage.
- Slogan « Scannez. Préparez. Avancez. » et fond jaune, durée 2,4 secondes.
- Animation décorative sans interaction, absente si réduction des animations, ou lancement direct d'un écran.
- La mise à jour n'efface ni les données locales ni les mémos et ne migre pas vers Android.
- Correctif isolé basé sur la version publiée 1.17.0 : aucun autre chantier 1.18.0 n'est fusionné.
- Contrôles : `npm test`, `npm run check`, tests de navigateur de GitHub Actions et disponibilité du site après déploiement.

---

# Validation — version 1.17.0 (27 octobre 2026)

Le suivi picking est désormais une saisie journalière des chiffres communiqués par les managers. Les points d’entrée accueil, raccourcis, Outils, Ma journée et l’aide n’invitent plus à photographier les commandes. Les anciens enregistrements et brouillons photo restent intacts ; les modules de lecture sont conservés pour compatibilité, avec ouverture explicite dans leurs tests.

Sept tests métier supplémentaires : remplacement des anciens calculs sans addition, champs facultatifs et zéro, validation des dates/nombres, périodes et moyennes excluant les jours absents, historique par date, sérialisation Google avec quantité lisible et bilan hebdomadaire avec commandes inconnues signalées.

Le parcours picking-smoke vérifie les véritables formulaires : création/sauvegarde, modification sans duplication, rechargement, annulation, graphiques et leurs cinq indicateurs, indépendance des dates, données historiques conservées, refus d’une révision périmée et d’un changement de session, déplacement, annulation et confirmation d’une suppression, recréation et saisie hors ligne. Il vérifie l’absence de chargement du moteur OCR et de commandes photo dans le parcours normal, ainsi que le contraste et l’absence de débordement à 320/390 px en clair/sombre.

Aide de Ma journée, de la saisie, de la suppression, du changement de date et page Aide révisées. PDF du jour, CSV et journal hebdomadaire utilisent les chiffres retenus ; les notes facultatives restent exclues du CSV sans sélection explicite. Le cache et les identifiants de stockage existants sont conservés ; aucun schéma serveur n’est modifié.

Validation locale : 216 tests métier réussis ; 127 modules, 694 dépendances, 28 empreintes fournisseur et 109 ressources hors ligne vérifiés. Les suites picking, diagnostic, ui, day-restart, order-ocr, document-day, day-management et day-independent réussissent sous Chromium 141. Les contrôles de compatibilité ouvrent les anciens parcours explicitement, sans réintroduire leurs boutons dans le tableau quotidien. Les raccourcis de secours et l’aide des anciennes commandes orientent aussi vers la saisie des chiffres managers.

Les axes du graphique utilisent des bornes arrondies et les dates des extrémités restent lisibles sur le petit écran. Un graphique renseigné en mode sombre a été inspecté, avec jours absents et journée à zéro. Le diagnostic intégré teste la saisie manager et la moyenne des jours renseignés sur un exemple fictif.

Sauvegarde du code précédent : backup/v1.16.3-before-manual-picking-2026-10-27. Les sept contrôles GitHub restent obligatoires avant mise en ligne.

Le tableau de saisie reste visible après sauvegarde : il autorise alors les mises à jour de l’application. Une saisie modifiée non sauvegardée continue de les bloquer, comme les fenêtres ouvertes. L’aide Actualiser précise ce comportement. update-smoke vérifie les deux états avec conservation des chiffres après le véritable rechargement, depuis les copies 1.5 et 1.7 simulées.

# Validation — version 1.12.0

Onze tests supplémentaires : intégrité binaire des archives, noms/liste contrôlés, refus d’une autre sélection, audio/polices exclus, bornes de volume et protection des fichiers utilisés ; exercices d’adresse, quantités et progression fondée sur le manquant correspondant.

Le parcours web-tools-smoke vérifie le téléchargement réel d’une archive, sa sélection et sa vérification, le refus intégral si une photo devient utilisée, le retrait facultatif puis l’import binaire sans écraser les fichiers présents, la conservation des événements et des mémos. Il exécute les trois missions par leurs vrais formulaires de démonstration, la reprise hors ligne, la remise à zéro et le retour inchangé aux données réelles ; il contrôle les liens officiels WeWard et l’aide à 320/390 px en clair/sombre. Ces vérifications complètent les huit parcours antérieurs.

Aide archive, missions, WeWard et page Aide relues. Aucun effacement automatique de copies de version. Pas d’Android, pas de jeu et pas de mascotte définitive sans le choix/photo. Aucun accès au PC D:\Pikéo revendiqué.

# Validation — version 1.11.0

ENF : huit tests métier supplémentaires couvrent références/zéros, code compact, EAN, nombres de descriptions, quantité absente/invalide, doublons et regroupement volontaire, sérialisation Google dans produit, conservation des compositions lors d’une ancienne publication et retrait explicite. Le parcours enf-smoke exécute le véritable OCR local sur une photo de feuille synthétique, la relecture obligatoire, la déduplication de photo, l’aide, le brouillon rechargé, l’export/import et le refus atomique d’une composition invalide, l’interdiction de modification opérateur et les largeurs 320/390 en clair/sombre. Ces vérifications complètent les sept parcours existants.

L’aide ENF et les points d’accès accueil/catalogue/Plus ont été révisés. Aucun modèle réel de feuille ENF n’a encore été fourni. Android et jeu restent en attente ; la mascotte reste un prototype distinct à choisir.

# Validation — version 1.10.1

Correction des mises à jour PWA : contrôle de version publié indépendant du cache, activation d’une coque complète avant import des modules, actualisation des styles et page de récupération sans effacement. Formulaires ouverts protégés ; point local avant rechargement volontaire. Le parcours update-smoke vérifie les passages depuis des caches 1.5 et 1.7 simulés, la conservation des fiches/fichiers/brouillons/mémos et le redémarrage hors ligne, en plus des 96 tests métier et des six parcours existants. Aide actualisation et sauvegardes relue.

Audit des demandes : voir docs/TASK_AUDIT.md. Le personnage définitif et le choix de son animation restent à finaliser avec Étienne. Les cinq propositions sont isolées de l’application ; aucun jeu ni déploiement Android ajouté.

# Validation — version 1.10.0

96 tests métier. Contrat du serveur réel validé avec des profils synthétiques : signature, expiration, anti-rejeu, permissions, propriétaire distinct du simple nom Étienne, révocation, message chiffré et accusé réservé au destinataire. Les tables privées refusent les accès directs des rôles navigateur ; les conseillers de sécurité Supabase ne signalent aucun problème après configuration. Une purge planifiée vérifie la durée des copies temporaires.

Les parcours navigateur vérifient les fonctions existantes et le nouveau parcours de sessions : données, voix et ressenti séparés, retour aux données initiales, opérateur limité, admin activé par fichier privé, deux appareils pour le chat, export/import sans renvoi, opt-in collectif, aide et largeur mobile. Google est simulé dans ces parcours : nouveaux envois lisibles sans clé, documents binaires identiques, conservation des révisions et conversion des anciennes lignes depuis une clé ou une copie locale.

Aide révisée : sessions/habilitations, messages, sauvegardes, Google lisible, collectif facultatif et page Aide. Aucune nouvelle demande de PIN ; aucune clé réelle ni donnée privée dans le dépôt ou les tests. Les copies 1.9 sont conservées. Les clés d’accès administrateur sont fournies séparément à Étienne. Le code du jeu est inchangé.

Limites inchangées : la version web doit être ouverte pour les alertes ; pas de Bluetooth direct, de Health Connect ni de tests matériels Honeywell. Aucune connexion au compte Google réel ni accès au PC D:\Pikéo depuis cet environnement.

# Validation — version 1.9.0

## Version 1.9.0 — Mon poste, récupération et chiffrement

91 tests métier réussis. Les cinq parcours navigateur ui-smoke, workflow-smoke, day-tools-smoke, workbench-smoke et cloud-smoke sont passés sur la branche de travail. Les données de test sont synthétiques, les API Google simulées. Aucun compte Google privé, vraie feuille, photo réelle, PIN ni clé réelle n’est utilisé dans les tests.

Contrôles : reprise bloquée tant qu’une référence manque, matériel configurable, consigne avec aide sans perte de saisie et brouillon repris, objectif facultatif, ressenti absent de l’export métier, passation sans notes par défaut, points locaux et restauration en nouvelles révisions, import métier refusé sans écriture si fichier invalide. Clé aléatoire, IV distincts, authentification du contenu, mauvaise clé et contenu modifié refusés, révisions longues et multioctets réparties pour respecter Google.

Les parcours vérifient aussi l’export/import chiffré réel depuis les boutons (dont photos des repères privés), l’absence de nouvel envoi Google sans clé, la conservation des anciennes lignes en clair, les nouveaux événements et documents chiffrés, le retour binaire des documents sur un second appareil et la préparation d’une nouvelle base sans détruire l’ancienne. Les nouveaux écrans sont parcourus en clair/sombre à 320 et 390 pixels avec lecture agrandie. La fusion de sauvegarde garde un seul petit objectif actif et conserve l’objectif déjà en cours.

Aide relue et mise à jour : nouvelles routes et formulaires, Google et chiffrement, import/restauration, mémos et copies audio séparées, cause/suite des manquants, consignes produit et page Aide. Les ouvertures de ? conservent les saisies.

Limites : aucun test matériel Honeywell ou Bluetooth, aucune alarme Android en arrière-plan, aucun service d’authentification multi-utilisateur connecté, aucun test dans le compte Google réel du propriétaire. Godot et Capacitor restent reportés. Le ZIP source est sauvegardé via GitHub ; aucun accès à D:\Pikéo ni export des données privées du téléphone depuis cette session.


## Version 1.8.0 — horaires, audio local et quatre onglets

77 tests métier réussis. Les six transitions donnent 07:52, 10:07, 10:22, 12:22, 13:07 et 15:52 avec les horaires demandés. Vérifications des durées modifiées, jours non travaillés, dimanche explicite, heure de Paris été/hiver, fenêtre de rattrapage de huit minutes, rappel acquitté, désactivation et horaires invalides. Chaque type d’événement est reconstruit dans son onglet regroupé en conservant les zéros et la révision.

Trois parcours Chromium réussis : `ui-smoke`, `workflow-smoke`, `day-tools-smoke`. Les fonctions précédentes (dont OCR réel sur pages synthétiques, imports, brouillons, annulations, codes, aide et synchronisation sur serveur Google simulé avec fusion de deux appareils) restent vérifiées. Les nouveaux parcours ouvrent réellement la caméra avec un périphérique synthétique sans bouton d’ouverture, libèrent le flux en quittant le scanner et enregistrent un vrai flux audio synthétique via MediaRecorder. Le son est lu, renommé, téléchargé, supprimé puis restauré par le sélecteur de fichier. Son empreinte SHA-256 est identique après restauration ; un second import n’ajoute aucun doublon. Quitter l’écran conserve l’enregistrement et libère le microphone. Un rechargement réellement hors ligne retrouve les mémos. Aucun audio n’entre dans les fichiers synchronisés ni le JSON général.

Les alertes restent présentes après navigation et rechargement ; l’arrêt est conservé et empêche une nouvelle alerte pour la même occurrence. La vibration est simulée pour vérifier sa relance et son annulation. Un arrêt reste accessible à l’intérieur d’une fenêtre modale, sans fermer ni modifier sa saisie. Les nouveaux écrans et l’aide sont vérifiés en clair/sombre à 320, 390, 480 et 1280 px (32 couples supplémentaires), en plus des 52 vérifications précédentes. Revue visuelle des nouveaux écrans effectuée, avec boutons longs empilés sur le mobile.

La base Google existante a été regroupée en exactement quatre onglets, après copie de sécurité séparée. Les 67 lignes d’événements ont été comparées cellule par cellule (douze colonnes), avant et après, avec les mêmes identifiants et contenus. La notice a été conservée dans les notes des en-têtes ; aucun historique n’a été écrasé. Les formats natifs et les quatre rendus issus d’un export de contrôle ont été inspectés ; l’importeur de rendu affiche quelques cellules vides et panneaux figés de manière imparfaite, vérifiés directement dans l’API native comme vides. Aucune valeur artificielle n’a été réécrite dans Google. Le consentement OAuth reste celui de la version précédente ; le code de synchronisation n’ajoute aucun onglet ancien. Aucun identifiant de feuille privée n’est enregistré dans le dépôt.

Revue de l’aide : deux nouvelles routes (horaires et mémos), arrêt d’alerte, renommage/suppression/export audio, scanner automatique, accueil, sauvegarde générale et organisation Google. La page Aide et le guide Google correspondent aux nouvelles fonctions. Les consignes et contrats Godot sont préparés dans `docs/GODOT_MIGRATION.md` et `AGENTS.md` ; aucune migration, création de projet Godot ou livraison APK n’a été effectuée.

Limites : la vibration physique et les autorisations du téléphone réel restent à tester sur l’appareil d’Étienne. La version web relance la vibration tant qu’elle est visible, mais ne garantit aucun rappel à écran verrouillé/application fermée. Le futur planificateur Android est requis pour ce comportement. Les données audio locales peuvent disparaître si le navigateur est effacé ; l’export des mémos est explicite et séparé. L’écoute/export synthétique n’établit pas la qualité du microphone physique.

La version 1.4 conserve les enregistrements, historiques, fichiers et sauvegardes existants. Aucun effacement global ni migration destructive.

## Vérifications métier

60 tests : caméra native et ZXing, changement de caméra, annulation de flux, lampe/zoom, calculs et arrondis, conditionnements inconnus, sauvegardes et événements, import CSV (UTF-8, zéros, guillemets, doublons, erreur atomique), hiérarchie des familles, règles héritées et exceptions, parsing multipages/multicommandes, quantités préparées, doublons d’images/pages, numéros OCR ambigus, réimport avec correction, remplacement explicite et protection d’une autre journée, anciens réassorts partiels, délai de 30 minutes, journal hebdomadaire et perspective.

## Vérifications d’interface

Le workflow GitHub exécute les parcours réels sur Chrome mobile simulé : CSV/aperçu/annulation, photo et recherche produit, anciens brouillons et enregistrements, suivi simplifié, choix des commandes débloquées, annulation au pouce, PDF, règle familiale, fiche cliquable et lecture OCR locale de trois photos de test (une commande sur deux pages et une seconde commande). Le réimport et l’annulation de toute la journée sont vérifiés. Les feuilles et données de test sont synthétiques et ne contiennent aucune donnée utilisateur.

Contrôle des débordements à 320, 390, 480 et 1280 pixels ; captures et PDF déposés dans les artefacts du workflow. Le dossier vendor et ses modèles OCR restent ceux déjà vérifiés dans le dépôt. Le cache inclut les nouveaux modules.

## Limites

- Les modèles réels de feuilles de l’entrepôt n’ont pas été fournis. Les lectures ambiguës et quantités à vérifier doivent être relues. Les corrections et l’acceptation finale restent explicites.
- Les valeurs par famille sont à confirmer dans l’entrepôt ; aucun conditionnement n’a été inventé.
- L’exactitude des alertes à téléphone suspendu/fermé et les objectifs physiques exposés restent tributaires du navigateur et du matériel.
- Les anciennes quantités/réceptions partielles restent dans les sauvegardes et l’historique ; l’interface ne les demande plus.
- Les sessions de photos en cours sont des brouillons locaux ; les commandes validées et leurs pièces sont incluses dans les sauvegardes existantes. Les anciennes journées ne sont pas recalculées après modification d’une règle.
- La connexion Google réelle reste soumise à sa configuration OAuth existante.

## Version 1.5.0

Tests ajoutés : préfixes PAC/PAD/RES, changement de zone et zéros initiaux ; reconnaissance exacte/EAN et propositions ; restauration des familles ; validation des paramètres Google et autorisation préalable sans feuille. Parcours mobiles ajoutés : référence confirmée et emplacement prérempli/effacé lors d’un changement de référence, préfixe enregistré sans doublon, vrai Code 39 décodé par ZXing, liste des familles détaillée, préférence sombre et codes sur fond blanc.

65 tests métier et les parcours Chrome mobiles ont réussi, dont les 28 contrôles de largeur sans débordement ni erreur JavaScript. La version 1.5.0 a été publiée sur GitHub Pages après ces vérifications.

Le 25 octobre 2026, la configuration OAuth du propriétaire a été terminée et la synchronisation réelle de la version publiée avec sa base privée a affiché « Sauvegarde Google à jour ». Chaque autre appareil doit se connecter au même compte et renseigner sa base privée. L'identifiant public du client OAuth est intégré ; aucun identifiant de feuille privée, jeton ou secret client n'est publié. Le fichier de police exact n'a pas été fourni à cette étape.


## Version 1.6.0

70 tests métier : nouveaux cas de doublons avec exception justifiée, emplacement habituel explicite, filtres de complétude, distinction connexion/sauvegarde et priorisation des anomalies de journée.

Les deux parcours Chrome couvrent les fonctions existantes (OCR réel local sur photos synthétiques, CSV, photos, annulation, journaux, caméra simulée et Code39 décodé) ainsi que les nouveaux enchaînements : plusieurs manquants d’une commande, doublon ouvert ou justifié, réception distincte de clôture, scanner avec retour au formulaire, préférence d’emplacement, recherche de casier, niveau économique facultatif et date du constat. 52 couples écran/largeur sont vérifiés à 320, 390, 480 et 1280 px.

Le nouveau parcours utilise un service worker réel pour vérifier le rechargement hors ligne et la conservation d’un brouillon. Un serveur Google simulé, avec données et jeton synthétiques, exerce le véritable code de synchronisation : échec réseau, réessai, modification pendant l’envoi, saisie de réglages protégée et fusion de deux appareils. Aucune donnée de production ni autorisation de compte n’est utilisée dans les tests. La connexion réelle configurée en 1.5 conserve son client et ses périmètres ; aucun nouvel accès Google n’est créé par cette mise à jour.

Les limites sur les modèles réels de feuilles, le matériel Honeywell, la caméra physique et les notifications lorsque le téléphone est suspendu restent celles des versions précédentes. Les contrôles de stock sont des outils complémentaires à Velocity. Les anciennes dates de comptage inconnues ne sont pas remplacées par la date de modification des seuils.

Le verrou de soumission est propre à chaque formulaire : une recherche Web lente laissée en arrière-plan ne bloque pas un nouveau manquant. Un parcours dédié garde la réponse réseau en attente pendant l’enregistrement d’un autre formulaire.


## Version 1.7.0 — Pikéo

72 tests métier réussis. Le modèle de message 3 conserve la référence exacte (dont les zéros) et l’emplacement ; un champ absent bloque la génération avec accès à la correction. Le parcours navigateur vérifie la copie réelle du texte, la demande de complément, ainsi que l’ouverture/fermeture de l’aide sans perte de la saisie et sans fermeture du formulaire.

Revue de l’aide effectuée pour les 19 routes et les principales actions : manquant, message JC, produit, familles, import CSV, journée et vérification de page, cadrage photo, contrôles, historique et sauvegardes. Le test de couverture signale toute route sans aide. Les 19 écrans sont parcourus en mode clair et sombre, en plus des 52 contrôles écran/largeur existants à 320, 390, 480 et 1280 px. Aucun débordement ni erreur JavaScript. Le cadrage bénéficie du même bouton contextuel ; son contenu et ses réglages ne sont pas remplacés.

Les parcours existants passent : OCR réel sur feuilles synthétiques, regroupement par commande, CSV et annulation, brouillons et rechargement hors ligne, scanner simulé, Code 39 relu par ZXing et logique Google sur serveur synthétique avec reprise et fusion de deux appareils. Les nouvelles vérifications n’utilisent aucun compte ni donnée de production. Le rendu Contraste terrain a été vérifié visuellement ; les codes restent noirs sur blanc.

Le nom affiché et les icônes deviennent Pikéo. Identité du manifeste, IndexedDB, préférences, périmètres OAuth et signature technique des sauvegardes existantes conservés. Aucun fichier Google existant n’est renommé et aucun message n’est envoyé à JC par l’application.


## Version 1.13.0 — mascotte, navigation et contraste

- Demande d’Étienne : portrait dédié et choix 3 « Dépose soignée », présence à l’ouverture ; accès plus intuitifs et contraste du mode sombre.
- Sauvegarde du code : branche `backup/v1.12.0-before-ux-mascot-2026-10-25`, avant toute modification de publication. Le portrait original et l’illustration personnelle restent hors dépôt. L’import local de la planche s’effectue dans Mes préférences, avec repli générique.
- Mascotte illustrée : huit poses transparentes, asset WebP optimisé, dépose à l’ouverture et marche sur place pendant les traitements réels. Aucun blocage de l’interface ni durée artificielle ; réduction des animations respectée.
- Recherche de fonctions dans l’en-tête et dans Outils, annuaire commun et alias métier. Accueil compact, raccourcis conservés, ENF visible, adresses dans les résultats produits et priorité aux correspondances exactes.
- Contraste corrigé dans les surfaces, champs, textes secondaires, graphiques et pieds de fenêtre ; codes noirs sur blanc conservés. Apparence accessible à l’opérateur dans Mes préférences.
- Aide revue : écran Accueil, Outils, Préférences, catalogue, page Aide et nouveau contexte de fenêtre `tool-finder`. Le retour de l’aide ne réinitialise pas la recherche.
- Vérifications locales : 119 tests métier réussis et syntaxe/assets vérifiés. Contrôle visuel dans l’aperçu : recherche « mode sombre », aide et retour, accès aux préférences puis accueil sombre.
- Les vérifications navigateur complètes et les mesures de contraste sont exigées par le job `ergonomics` avant publication ; résultats consignés dans les artifacts CI.


### Complément 1.13.0 — photos de commandes et données des feuilles

- Caméra directe conservée ouverte entre les prises de vues ; galerie et caméra native de secours. Arrêt du flux à la fermeture, au passage en arrière-plan et avant l’analyse.
- Analyse photo locale sérialisée : reconstruction des lignes de tableaux avec les coordonnées TSV. Reprise de la session et affichage de la progression dans Ma journée et Accueil, y compris pendant le traitement.
- Les marques de complétion ne changent pas le calcul. Une quantité lisible barrée/entourée reste comptée ; une quantité ambiguë bloque la validation et demande une relecture. Aucun modèle de vision fiable des annotations manuscrites n’est revendiqué.
- Les pages relues conservent article, quantité, adresse PAC/PAD/RES, désignation et code alpha. Mise à jour facultative du catalogue pour les administrateurs : création de références et ajout d’adresses sans écraser nom vérifié, adresse existante, emplacement habituel ou règle de picking. Aucun conditionnement n’est déduit des quantités commandées. Le code alpha descriptif ne fusionne pas deux produits.
- Une seule écriture groupée pour la journée et le catalogue associé ; annulation groupée. Les anciennes journées gardent leurs règles figées. Les opérations en cours sont terminées avant un changement de session ou de mode démonstration.
- Aide revue : Ma journée, vérification d’une page, caméra dans le contexte Ma journée et FAQ de la page Aide ; aucune saisie perdue en consultant ?.
- Tests synthétiques dédiés : quantités annotées/ambiguës, tableau physique, métadonnées, collisions de références, caméra ouverte sur plusieurs photos, autorisation tardive et fermeture pendant encodage. Parcours navigateur avec caméra de test et lecture différée pour vérifier navigation/reprise, catalogue et annulation ; l’OCR réel reste exercé par ui-smoke.
- Les photos, relevés et totaux de travail restent privés et hors dépôt. Le contrôle chiffré sur les feuilles réelles dépend d’une transcription lisible des conditionnements ; il ne doit pas être déclaré réussi sur la seule base de tests synthétiques.


## Version 1.14.0 — identité des commandes et reprise de journée

- Commande et enregistrement décrivent la même commande. Les en-têtes numériques imprimés, avec padding ou suffixe d’enregistrement séparé, sont rapprochés ; le numéro original reste affiché et les deux lectures sont conservées dans les sources. Le numéro du bon de préparation et la référence du client ne servent pas de numéro de commande. Aucune modification de la normalisation des références produits.
- Une contradiction entre les deux en-têtes demande relecture ; des pages 1 et 3 signalent la page 2 manquante même sans total annoncé. Une nouvelle photo d’une page déjà enregistrée peut remplacer la lecture après choix explicite, jamais s’ajouter en double.
- Ma journée propose une annulation de la date sélectionnée avec récapitulatif et confirmation. Commandes, correction manuelle et remise à zéro de la session photo sont écrites atomiquement. Le catalogue, les autres dates et les fichiers sont conservés. Une session active d’une autre date est protégée.
- L’annulation de cette reprise restaure commandes et correction ; le brouillon précédent est restauré si aucune nouvelle photo ne l’a remplacé. Les nouvelles photos sont préservées. Les révisions restent dans l’historique et la même journée peut être photographiée à nouveau sans doubler ses anciens totaux.
- Revue de l’aide : Ma journée, Vérifier une page, nouvelle confirmation day-restart et FAQ de la page Aide. Les données réelles et les photos restent hors dépôt ; seuls des exemples synthétiques entrent dans les tests.
- Vérifications requises : tests métier, regroupement commande/enregistrement, vrai stockage IndexedDB avec annulation/reprise/conflit et retour OCR, contrôle des nouvelles fenêtres à 320/390 px dans les deux thèmes et parcours existants.


## Version 1.14.1 — choix du bandeau d’annulation

- La croix mémorise le masquage de l’action courante dans la base locale de la session. Ce choix survit à la navigation, au rechargement, à la fermeture et à la réouverture. L’action reste annulable depuis Historique ; une nouvelle action peut afficher son propre bandeau. Aucun choix de masquage n’est envoyé à Google.
- Annuler écrit la révision inverse et efface la cible d’annulation dans la même transaction IndexedDB. Aucun observateur ne peut relire l’ancienne cible entre ces deux écritures. Une annulation échouée conserve sa cible.
- Un identifiant propre à chaque action protège les clics devenus obsolètes, y compris si deux actions ont la même heure. Les anciennes cibles sans identifiant restent compatibles.
- Aide revue : Historique, confirmation d’annulation dans le même contexte et FAQ de la page Aide. Le comportement du bandeau ne crée aucun formulaire supplémentaire.
- Vérification navigateur requise : masquage persistant, nouvelle action, annulation simple et groupée après confirmation, rechargement, ancienne cible, clic obsolète et séparation des espaces. Les cas utilisent uniquement des données synthétiques.


## Version 1.15.0 — audit et diagnostic intégré

Copie du code 1.14.1 conservée dans `backup/v1.14.1-before-audit-2026-10-27`. Les données privées des téléphones ne sont pas dans cette copie Git. Les points locaux automatiques avant changement de version restent actifs ; aucun effacement ni changement des identifiants `ek-*` ou de l’identité du manifeste.

Audit automatisé élargi à tous les modules JavaScript/TypeScript du client, serveur, outils et tests : syntaxe, dépendances locales, ressources HTML/CSS, empreintes SHA-256 et tailles des 28 bibliothèques fournies, cohérence des versions, catalogue de 2 754 variantes, 52 familles sans cycle, ressources hors ligne et présence des quatre moteurs OCR autonomes. Le numéro résiduel de `site/package.json` est aligné sur la version courante. Les règles métier et contrôles de diagnostic portent le total à 165 tests locaux réussis. Le service Supabase existant est actif : audit de sécurité sans alerte, huit tables privées avec RLS et sans lecture directe anon/authenticated, purge périodique active. Aucun compte, message ou réglage du serveur n’est modifié par cet audit.

Allègement : la préparation OCR et la liste hors ligne utilisent les huit ressources réellement chargées par Tesseract 6, dont ses quatre moteurs autonomes avec ou sans SIMD. Les huit paires binaires/enveloppes redondantes restent disponibles dans les sources fournisseur, mais ne sont plus téléchargées dans le cache. La mise à jour retire uniquement leurs copies du cache OCR et conserve langues, moteurs utiles et données métier. Volume OCR préparé : 34 423 842 → 21 245 150 octets, soit 13 178 692 octets et 38,3 % évités. Les JSON catalogue/familles sont compactés par la préparation de publication, avec les mêmes valeurs et zéros. Le catalogue passe de 1 317 157 à 1 091 106 octets. La recherche exacte produit utilise un index invalidé après modification ; les suggestions s’arrêtent à cinq résultats. Les codes article et références alternatives rejoignent la reconnaissance du formulaire manquant, avec choix explicite en cas d’ambiguïté.

Outils et Réglages proposent Vérifier l’application. Le contrôle utilise des exemples fictifs : calculs et héritage, commandes multipages et doublons, bilan/reprise, enrichissement du catalogue, CSV, ENF, événements Google, archives, chiffrement des anciennes copies et messages, horaires de Paris, confidentialité des partages, cadrage et aide. Il crée et relit une base IndexedDB de test séparée puis la supprime, décode de vrais Code 39/128 et crée un PDF en mémoire. Il contrôle le cache réellement identifié par le service worker et conserve les informations du dernier point local et du dernier succès Google. Si Google est déjà connecté, un GET vérifie les quatre onglets ; aucun envoi, reconnexion ou message n’est déclenché. La lecture Google de diagnostic est bornée à six secondes ; les délais des envois de documents existants sont conservés.

Le bilan est conservé dans les métadonnées personnelles de la session, hors Google et sauvegarde métier. Un changement de session interrompt les résultats en cours ; le diagnostic ne remplace aucun écran ou formulaire pendant la navigation. Une ancienne version, un bilan incomplet, une ressource absente et un contrôle en échec sont distincts d’une réussite. Tester la lecture photo crée puis reconnaît une image fictive localement. Les tests matériels, notifications, réception entre collègues, documents réels et envoi Google restent explicitement manuels.

Parcours navigateur imposés avant publication : suites existantes (caméra, photos/OCR, Ma journée et reprise, ENF, CSV, PDF, mémos, sessions, messages et autorisations, synchronisation simulée, annulation persistante, mise à jour depuis 1.5/1.7, hors ligne, ergonomie) et nouvelle suite diagnostic. Cette dernière vérifie les données/brouillons/annulations inchangés, le rapport après rechargement, la séparation des sessions, l’échec visible d’un lecteur ou cache volontairement indisponible, la conservation des contrôles suivants, le cache allégé, une vraie lecture OCR hors ligne avec sélection automatique et moteur sans SIMD, ainsi que le contraste à 320/390 px en clair/sombre. La publication dépend des sept jobs de validation.

Aide revue : contexte Diagnostic, page Aide et FAQ, répertoire Outils, Réglages/Sauvegardes et reconnaissance de référence dans le formulaire manquant. Le bouton ? reste superposé et ne réinitialise pas une saisie. Limites : ces contrôles et exemples synthétiques ne prouvent pas l’exactitude de chaque document réel ni le fonctionnement physique du téléphone/terminal. Les conditionnements privés et leur calibration réelle restent à terminer séparément ; aucun total réel n’est forcé. Android et jeu restent reportés.


### Ajustement 1.15.1

Le délai de six secondes reste limité au GET de diagnostic Google et n’interrompt pas les gros envois sur réseau lent. Le test photo conserve la date du contrôle général et affiche séparément sa propre date. Les liens d’un bilan conservé sont limités aux écrans internes prévus et leurs libellés sont échappés ; un bilan mal formé n’empêche pas de relancer le diagnostic. Les mêmes suites restent requises pour la publication.


### Ajustement 1.15.2 — catalogue séparé à chaque changement d’espace

Un test de non-régression reproduit d’abord un ancien défaut de cache : après passage du catalogue personnel à une démonstration déjà créée, une référence pouvait encore être trouvée dans le catalogue mémorisé précédent. Le catalogue et l’index vérifient désormais aussi le périmètre actif avant chaque réutilisation. Le même test réussit ensuite dans les deux sens, avec les références et leurs alias séparés, sans aucune modification des bases. Le total est de 166 tests métier. Les identifiants et le stockage de démonstration restent ceux existants. La séparation de l’index entre deux profils est aussi contrôlée dans le navigateur sur de vraies bases IndexedDB. Aide revue : aucun geste ni conseil supplémentaire ne change pour cette correction.


## Version 1.16.0 — lecture des commandes et reprise des photos non reconnues

Sauvegarde du code 1.15.2 : `backup/v1.15.2-before-order-ocr-2026-10-27`. Les photos de travail restent hors dépôt. Aucun numéro d’une vraie commande, client ou document privé ne rejoint les fixtures publiques.

Défauts reproduits : les photos de côté étaient reconnues sans rotation de page ; la reconstruction TSV séparait les chiffres et libellés d’une même ligne lorsque leur hauteur différait ; un libellé Enregistrement déformé par l’OCR ou un numéro coupé entre deux lignes pouvait être perdu. Les mots CDE/ECR et certaines références client pouvaient être interprétés comme des numéros. L’analyse sautait ensuite toute photo possédant déjà des sections, y compris avec un numéro vide, ce qui empêchait une nouvelle tentative sur les anciens brouillons.

La lecture des feuilles de journée essaie les rotations par quarts de tour, agrandit les petits caractères jusqu’à une taille bornée, améliore le contraste sans binariser les marques manuscrites, puis compare texte brut et lignes TSV. Une orientation donnant un numéro et des lignes exploitables arrête les essais inutiles. Une relecture ciblée de l’en-tête est tentée si le numéro manque. Les bitmaps/canvas sont libérés entre les essais ; le fichier d’origine n’est pas modifié. Un repli Image est prévu si createImageBitmap est absent.

Les labels proches d’Enregistrement tolèrent au plus deux erreurs de caractères, sans correction automatique d’un seul chiffre. Les groupes de chiffres espacés, suffixes imprimés séparés et preuves des deux identifiants sont conservés. Les deux champs sont rapprochés avant les vraies lignes d’articles, même si l’en-tête du tableau les sépare ; un désaccord reste visible. Bon de préparation et référence client restent distincts. Le numéro de page sur la ligne d’un identifiant et l’en-tête avant Commande sont conservés. Les adresses client et mots isolés ne deviennent pas des références d’articles.

Les anciens textes non validés sont reparsés à l’ouverture, sans effacer les corrections validées. Relire les pages non reconnues et Relire cette page reprennent les fichiers existants. Les pages reconnues, écartées et corrigées sont protégées. Une nouvelle lecture moins exploitable ne remplace pas une meilleure lecture conservée. Les quantités illisibles et lignes d’adresse non reconnues sont signalées dans la vérification de page. Retour dans Ma journée pendant la lecture reste possible ; ni commande, ni produit n’est enregistré par la simple relecture.

176 tests métier réussis localement. Nouvelle suite navigateur avec vraie OCR sur une feuille d’entrepôt fictive dans les quatre orientations : cinq lignes par page, identifiants commande/enregistrement et regroupement des quatre pages. Une seconde partie reprend trois anciennes photos non identifiées et contrôle les appels OCR, corrections manuelles, pages reconnues, nombre et identifiants des fichiers, navigation en arrière-plan, aide, contraste et largeur à 320/390 px. Les anciennes suites restent imposées avant publication. Le test photo intégré au diagnostic lit désormais une feuille fictive avec numéro d’enregistrement, référence et quantité.

Essai local dans le vrai navigateur sur trois photos réelles déjà transmises : les trois numéros ont été retrouvés, sans publier les images ni leurs contenus. Ce résultat ne valide pas l’intégralité de leurs lignes : ces copies de résolution réduite gardent des lignes/chiffres à vérifier et compléter. Aucun total réel de picking n’est forcé. Les règles de picking privées et leur calibration restent séparées de ce correctif.

Aide revue et actualisée : écran Ma journée, fenêtre Enregistrer ma journée, vérification d’une page, diagnostic photo, page Aide/FAQ. Les conseils expliquent la relecture, les corrections conservées et les ambiguïtés à vérifier. La migration Android et le jeu restent reportés.


## Version 1.16.1 — relancer, comparer et agrandir les photos

Un bouton principal « Relancer l’analyse des photos » est présenté en haut de la session, accessible depuis Reprendre mes photos. Il relit les photos non validées, y compris celles qui avaient déjà un numéro et des lignes reconnus. Le choix ciblé « Relire les pages non reconnues » reste disponible ; « Relire cette page » permet aussi la relecture d’une page reconnue non validée. Les pages validées manuellement et écartées restent protégées.

La relance réutilise les fichiers locaux existants sans nouveau document ni commande. Les meilleures lectures restent conservées si une nouvelle tentative est moins exploitable, même après une erreur de lecture précédente. Le traitement persiste après chaque photo ; le retour vers Ma journée et la reprise du brouillon restent possibles. Le bilan indique le nombre de photos traitées et les échecs, sans promettre une reconnaissance complète des vraies feuilles.

184 tests métier réussis localement. Un test couvre la relance explicite des pages reconnues et les validations/exclusions protégées. La suite navigateur OCR couvre la relance globale, une page reconnue ciblée, les rechargements et la protection d’une meilleure lecture après erreur, sans doublon de fichier ni commande créée. Les quatre orientations OCR et les anciens parcours restent imposés par GitHub Actions avant publication.

Aide revue et actualisée pour Ma journée / Enregistrer ma journée, Vérifier une page et la FAQ de la page Aide. Aucun fichier de travail, photo, numéro réel ou secret n’est ajouté au dépôt.

Le bouton « Vérifier les doublons » affiche les paires de photos à comparer. Il utilise l’empreinte du fichier, la commande et la page imprimée, puis le texte ou les lignes identiques/très proches lorsque la pagination ne distingue pas les feuilles. Les alias commande/enregistrement sont les mêmes que pour le calcul. Deux numéros de page différents ne sont pas fusionnés sur leurs seuls articles identiques. Une correction divergente d’une quantité empêche l’ignorance silencieuse de deux lectures d’une même page. Les ressemblances restent des candidats, jamais une suppression automatique.

Les doublons possibles doivent être comparés avant l’enregistrement. Chaque photo peut être ouverte, écartée puis réintégrée ; les fichiers restent conservés. Confirmer deux pages différentes demande une case de relecture. Cette confirmation est liée au contenu des deux lectures et devient caduque si celui-ci change ; elle est reprise après rechargement. Les photos à lecture incomplète limitent explicitement le contrôle, qui ne garantit pas de détecter tous les doublons.

« Voir la photo » ouvre une fenêtre occupant tout l’écran, avec zoom au pincement et aux boutons (jusqu’à huit fois l’affichage ajusté), déplacement tactile/souris, défilement clavier, rotation et ajustement. Dans Vérifier, toucher l’image ouvre le même lecteur. Le formulaire reste sous cette fenêtre : fermeture, Échap et aide conservent les champs non enregistrés. La consultation fonctionne hors ligne et ne modifie pas les fichiers ni les quantités. Les URL de consultation sont libérées à la fermeture ; le recadrage reste séparé.

Sept tests métier supplémentaires vérifient les doublons, divergences, pages multiples, alias, exclusions et confirmations périmées. Nouveau parcours photo-review-smoke : garde avant sauvegarde, comparaison et confirmation persistante, exclusion/réintégration, véritable pincement via événements tactiles Chromium, déplacement, rotation, fermeture, conservation de saisie, aide, hors ligne, fichiers inchangés et contraste/absence de débordement à 320/390 px en clair et sombre. Revue visuelle du lecteur effectuée ; aucun bouton masqué sur le petit écran. Les parcours order-ocr, document-day, day-restart et update sont également réussis localement. La suite photo-review est imposée dans le contrôle diagnostics de GitHub Actions avant publication.

Aide vérifiée et actualisée : Ma journée / Enregistrer ma journée, Vérifier une page, lecteur plein écran, comparaison et confirmation des doublons, FAQ. Les tests et captures utilisent uniquement des feuilles fictives. Sauvegarde préalable du code publié : backup/v1.16.0-before-photo-review-2026-10-27.


## Version 1.16.2 — journées indépendantes et lecture bornée

Cause relevée dans 1.16.1 : une seule métadonnée de session photo ; le choix de date changeait cette session au lieu d’en ouvrir une autre. Le moteur OCR essayait jusqu’à quatre orientations à grande résolution sans délai maximal ni interruption.

Une session active historique `day-capture` est conservée pour compatibilité. `day-capture-backlog` garde les autres dates. Le changement est atomique, conserve les identifiants de fichiers, lectures, corrections et choix, et ne valide ni ne déplace les photos. La validation et l’abandon ne retirent que la session active. Les photos de toutes les journées sont protégées contre le retrait local. Les points de restauration incluent les deux métadonnées. Recommencer une journée archive la session d’une autre date ; annuler cette action ne restaure ces métadonnées que si les deux sont encore inchangées, pour préserver les nouvelles photos.

La pause interrompt la lecture et libère le moteur. Le changement de journée et de session interrompt aussi le travail actif avant de poursuivre. Une limite de 60 secondes couvre la préparation et l’ensemble de la lecture d’une photo ; un dépassement conserve les fichiers et la meilleure lecture précédente. Un moteur reçu tardivement après interruption est terminé. Un module qui ne charge pas expire après 25 secondes et peut être rechargé. Les photos ne sont plus agrandies artificiellement ; le plus grand côté est limité à 3 000 pixels, avec les quatre orientations de secours.

193 tests métier passent localement ; syntaxe, dépendances, intégrité fournisseur, catalogue, cache et versions vérifiés. Neuf tests supplémentaires couvrent les journées indépendantes, protections, garde de concurrence, pauses et délais dépassés. Le nouveau parcours navigateur `day-independent-smoke` vérifie la capture sans OCR, le changement de date pendant un moteur bloqué, la pause/reprise, la validation d’aujourd’hui avant hier, le rechargement, le délai dépassé, l’initialisation tardive, l’aide et l’affichage mobile. Le parcours day-restart inclut la conservation des deux journées et la restauration des brouillons. Les parcours day-independent, order-ocr, document-day, day-restart, photo-review, update, ui, workflow, undo-choice, ergonomics et web-tools réussissent localement sous Chromium 153.0.8010.0. La reconnaissance réelle est vérifiée dans les quatre orientations et sur trois pages regroupées ; les vérifications couvrent la conservation des données après mise à jour, les reprises hors ligne, les annulations et le mobile clair/sombre à 320/390 px. Les garde-fous de version des parcours navigateur utilisent désormais VERSION, pour rester valables lors des prochaines publications. Les contrôles GitHub Actions restent imposés avant publication.

Aide revue et actualisée : Ma journée / Enregistrer ma journée, choix de journée, pause et reprise, fenêtre de reprise complète, FAQ. Les tests utilisent uniquement des données fictives ; aucun fichier de travail ni secret n’est ajouté au dépôt.

## Version 1.16.3 — suppression de journée et correction de date

Le bouton Supprimer cette journée, disponible dans Ma journée et la session photo, réutilise le retrait atomique du bilan après confirmation et fonctionne aussi avec des photos non analysées, sans commande ni correction enregistrée. La session de cette date repart vide ; les autres journées, le catalogue, les attentes, les fichiers d’origine et les mémos sont conservés. L’annulation est aussi disponible pour une modification portant uniquement sur une session photo. Les nouvelles photos empêchent une restauration qui les écraserait.

Modifier la date ouvre un formulaire distinct du sélecteur Ouvrir la journée du. Sauvegarder la date déplace ensemble les commandes, corrections du bilan et photos, avec lectures, corrections de pages et choix de commandes. Les dates occupées par des commandes, corrections ou photos sont refusées, ainsi que les dates invalides ou inchangées. Une modification intervenue depuis l’ouverture empêche l’enregistrement. L’opération et ses métadonnées sont atomiques et annulables ; les photos restent locales et ne rejoignent pas le journal métier.

Aide revue et actualisée : Ma journée, Enregistrer ma journée, Journées indépendantes, confirmation de suppression, formulaire Modifier la date et FAQ de la page Aide. L’aide conserve la date saisie. Le libellé Ouvrir la journée du distingue le choix de session de la modification de date.

Six tests métier supplémentaires couvrent le déplacement complet, les dates occupées, les brouillons en attente, les dates invalides, les sessions photo seules et les bilans sans brouillon. Le parcours navigateur day-management couvre sauvegarde explicite, abandon, aide sans perte de saisie, rechargement, suppression et annulation d’une journée validée ou non analysée, conservation des autres dates, gardes de concurrence, modifications depuis Ma journée et la session photo, absence de brouillon, et mobile clair/sombre 320/390 px. Aucun secret, identifiant privé, photo réelle ou donnée de travail n’est ajouté au dépôt.

Validation locale : 199 tests métier réussis ; syntaxe de 116 modules, 615 dépendances, 28 empreintes fournisseur, versions et ressources hors ligne vérifiées. Les parcours day-management, day-restart, day-independent, undo-choice, photo-review et update réussissent sous Chromium 153.0.8010.0. Les contrôles GitHub restent requis avant publication.

Protection complémentaire : les nouveaux totaux corrigés reçoivent un identifiant indépendant de la date. Recréer l’ancienne date après un déplacement ne réutilise donc pas l’identifiant historique du bilan déplacé. Le parcours day-management vérifie ce cas depuis le formulaire réel de correction, ainsi que le déplacement d’un bilan sans session photo. Aide de correction du total relue : parcours et conseils existants restent adaptés.

Contrôle complémentaire après protection des identifiants de correction : 199 tests métier, contrôle du projet, parcours day-management et workflow réussis.


### Complément 1.16.3 — photos par dates et manquant dicté

Outils, Espace et sauvegardes et Ma journée donnent accès à Photos par journée. Une sélection multiple de dates présente le nombre et le volume des images ; la date métier prime sur la date de capture. La correction de date conserve aussi un repère local pour retrouver une photo de brouillon après abandon de la journée. Les photos partagées par plusieurs dates exigent leur sélection complète. Les brouillons en cours, photos produit et autres usages restent protégés ; les autres dates et les mémos sont conservés.

Le récapitulatif de suppression impose une case et un second bouton. Conserver mes photos et la croix ne retirent rien. La suppression ne modifie aucune commande, quantité, calcul ni événement métier. Une option explicite retire aussi les copies des images sélectionnées dans les points de restauration locaux, sans retirer les points ni leurs données métier. Ces images ne pourront plus être restaurées depuis ces points. Google et les fichiers déjà exportés ne sont pas supprimés. Le volume affiché compte les fichiers ; le stockage du navigateur peut partager ou différer la libération physique de blocs.

La sélection est recalculée avant confirmation puis contrôlée dans la transaction IndexedDB : une photo devenue utilisée ou déplacée refuse l’ensemble du retrait local. Le nettoyage d’une autre base/session est refusé. Les copies de points locaux sont nettoyées ensuite ; une erreur est signalée sans prétendre qu’elles ont toutes disparu. Aucun point de restauration supplémentaire contenant les photos à supprimer n’est créé par cette action.

Dans Noter une référence manquante, Dicter commande et référence propose les deux champs depuis une seule phrase étiquetée, conserve les zéros, accepte les nombres français et certaines références alphanumériques épelées. Les valeurs contradictoires ou non identifiées restent à compléter. Le formulaire existant confirme le produit, propose son adresse habituelle et vérifie les doublons. Aucun manquant n’est enregistré avant validation du formulaire. Une saisie modifiée pendant la dictée et les nouveaux formulaires sont protégés contre les résultats tardifs. Arrêter, fermer ou masquer la page coupe la dictée. Les micros de champs et la dictée globale sont exclusifs. Un texte de secours fonctionne avec le micro du clavier ou une saisie normale. Pikéo n’enregistre pas d’audio et ne joint aucun son aux sauvegardes.

Le service de reconnaissance vocale dépend du navigateur et peut utiliser Internet ; cette information est visible avant usage. Référence technique : https://wicg.github.io/speech-api/ (API permettant des moteurs locaux ou distants). Les tests navigateur simulent les résultats de reconnaissance et le refus/l’absence du moteur ; ils ne certifient pas le microphone ni la qualité de transcription du téléphone réel.

Validation : 209 tests métier réussis. Le parcours photos-voice-smoke couvre confirmation/cancel, retrait des seules dates choisies, protection des brouillons/produits/autres dates/voix, suppression des copies et restauration sans réapparition des images supprimées, garde de concurrence dans le formulaire et dans le stockage, date corrigée conservée après abandon, dictée avec emplacement automatique, saisie concurrente, résultat après fermeture, secours sans reconnaissance et validation finale réelle. Aide et contraste à 320/390 px en clair/sombre contrôlés. Les parcours day-management, day-independent, day-restart, diagnostic, ui et update ont aussi réussi localement. Le diagnostic intégré exerce les deux nouveaux helpers avec des données fictives ; la nouvelle suite est imposée dans GitHub Actions.

Aide revue et mise à jour : nouveau parcours Photos par journée, Manquants et sa fenêtre de saisie, suppression confirmée, Espace et sauvegardes et FAQ. Les captures de contrôle de la confirmation et du formulaire vocal ont été inspectées. Aucun fichier réel ni numéro de travail n’est ajouté aux fixtures ou au dépôt.

## 29 octobre 2026 — recherche produit web 1.17.11

Le scanner, la lecture photo et la recherche par code partagent la recherche automatique des codes absents, des correspondances multiples et des noms non confirmés. Un code connu unique reste local. Le relais lit les fiches publiques Draeger puis UPCitemdb pour les GTIN valides ; JWT conservé à la passerelle, clé anon publique côté client, aucune connexion à la base de données et aucune écriture serveur. Corps et réponses sont bornés, origines des liens validées, quotas externes et indisponibilités signalés ; aucune clé privée ni donnée de compte n'est transmise aux sources.

Les propositions ne rejoignent le catalogue qu'après relecture du formulaire et Enregistrer. Les valeurs de la fiche existante, ses emplacements et ses règles de prise sont conservés. Les nouveaux conflits de références/EAN sont refusés ; une ambiguïté persistante ne classe pas le code comme identifié. Les permissions de configuration s'appliquent aux boutons et à l'enregistrement. Les retours tardifs, le changement de code/espace et la navigation sont protégés ; la recherche ne bloque plus le formulaire de saisie d'un autre code. Le retour du réseau relance la recherche affichée hors connexion.

Aide revue : scanner, recherche de produit, proposition dans la fiche et FAQ. Les tests utilisent uniquement des références fictives et des sources simulées. La suite product-lookup-smoke complète les suites existantes avec confirmation, abandon, provenance, doublons, variantes, droits, réponses tardives, hors ligne, mobile/bureau et contraste. Les résultats GitHub font foi avant publication. PIN et Android ne sont pas activés par cette version.

Validation locale : 245 tests métier réussis, syntaxe et dépendances, empreintes fournisseur, références, familles, versions et ressources hors ligne vérifiés. Le parcours navigateur est imposé avant publication. Le catalogue public et les familles du dépôt restent strictement inchangés ; le compactage se fait uniquement pendant la préparation du site.

### Maintien du résultat lors du réaffichage

Le rendu général restaure désormais le résultat de recherche courant (y compris chargement ou erreur) et ne relance pas la caméra après lecture. La restauration ne refait ni requête ni écriture et refuse un autre espace. Le parcours navigateur attend la fermeture effective de la prise en main initiale et vérifie qu’un réaffichage conserve la proposition sans nouvelle requête ni ajout. L’aide reste adaptée : aucun geste utilisateur ne change. L’activation du PIN est un chantier actif demandé par Étienne ; Android reste reporté.
