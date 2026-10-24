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

La sauvegarde Google réelle reste à vérifier après acceptation du règlement et configuration du client OAuth. Le fichier de police exact n’a pas été fourni à cette étape.
