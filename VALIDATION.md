# Validation — version 1.4.0

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
