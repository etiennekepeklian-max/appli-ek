# Validation — version 1.9.0

## Version 1.9.0 — Mon poste, récupération et chiffrement

La branche de travail a passé les tests métier et les parcours existants ; les vérifications finales incluent désormais deux parcours supplémentaires : workbench-smoke et cloud-smoke. Les données de test sont synthétiques, les API Google simulées. Aucun compte Google privé, vraie feuille, photo réelle, PIN ni clé réelle n’est utilisé dans les tests.

Contrôles : reprise bloquée tant qu’une référence manque, matériel configurable, consigne avec aide sans perte de saisie et brouillon repris, objectif facultatif, ressenti absent de l’export métier, passation sans notes par défaut, points locaux et restauration en nouvelles révisions, import métier refusé sans écriture si fichier invalide. Clé aléatoire, IV distincts, authentification du contenu, mauvaise clé et contenu modifié refusés, révisions longues réparties pour respecter Google.

Les parcours vérifient aussi l’export/import chiffré réel depuis les boutons (dont photos des repères privés), l’absence de nouvel envoi Google sans clé, la conservation des anciennes lignes en clair, les nouveaux événements et documents chiffrés, le retour binaire des documents sur un second appareil et la préparation d’une nouvelle base sans détruire l’ancienne. Les nouveaux écrans sont parcourus en clair/sombre à 320 et 390 pixels avec lecture agrandie.

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
