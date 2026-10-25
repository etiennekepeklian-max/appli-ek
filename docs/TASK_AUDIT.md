# Audit des demandes Pikéo — 25 octobre 2026

Sources : échanges disponibles du projet et PDF « Pikeo-50-idees-terrain.pdf », 21 pages. Le GO englobe les idées retenues ; la mention initiale « réflexion » ne les annule plus. Seuls le jeu et la phase Android (Godot ou Capacitor) restent reportés. Présence dans le code et essais synthétiques ne remplacent pas les essais sur téléphone/terminal réel.

## Versions et données

- 1.10.0 publiée, mais anciennes copies 1.5/1.7 encore possibles en mémoire. L’ancien code invitait simplement à fermer/rouvrir.
- Correctif 1.10.1 : vérification indépendante du cache, activation des fichiers complets avant ouverture, bouton Vérifier la version et page actualiser.html.
- Saisies ouvertes protégées ; point local avant rechargement volontaire ; aucune suppression des bases, photos, préférences, sessions ou mémos.
- Hors ligne, la version installée reste utilisable ; chaque appareil doit retrouver Internet pour télécharger la publication.

## Demandes principales : présence vérifiée

- Manquants sans quantité ni personne sollicitée ; réception partielle retirée des choix, priorité/précisions conservées, anciens champs historiques préservés.
- Référence confirmée/EAN reconnu et casier proposé ; PAC/PAD/RES et zéros conservés.
- Catalogue cliquable, familles détaillées rétablies sauf Cartes regroupées ; règles par famille et exceptions produit.
- Import CSV des emplacements avec modèle, note de format et aperçu avant écriture.
- Photographies groupées en fin de journée, OCR local, reconnaissance des numéros, regroupement et picking ; ambiguïtés à relire, modèles réels de feuilles à valider.
- Codes Code39/dictée/scanner, noir sur blanc y compris en sombre ; import de police existant. Le nom C39HrP24DhTt ne remplace pas son fichier TTF/OTF, encore non identifié dans les pièces du projet.
- Message JC modèle 3 généré avec référence/emplacement, à relire et copier ; aucun faux envoi automatique.
- Aide des écrans et des fenêtres ; revue exigée à chaque évolution dans AGENTS.md.
- Navigation mobile, brouillons, annulation accessible, mode sombre et préférences individuelles.
- Six rappels huit minutes avant les transitions ; vibrations lorsque la page est visible. Écran verrouillé/application fermée : phase Android.
- Mémos vocaux locaux, export/import séparé, absents de Google et de l’export métier.
- Google : quatre onglets et nouveaux envois lisibles sans clé, selon la dernière décision. Conversion ancienne après copie locale si événements locaux ou ancienne clé disponibles.
- Sessions par nom sans PIN/mot de passe selon la dernière décision ; espaces séparés, droits imposés par le serveur, habilitations attribuées seulement par Étienne.
- Chat : historique local chiffré, relais temporaire chiffré de bout en bout, suppression après réception/expiration, export séparé. Bluetooth/Wi-Fi direct attend Android ; relais entre téléphones abandonné.
- Collectif facultatif axé entraide/qualité/progrès, sans podium de cadence ni sanction d’absence.
- Sauvegardes du code par versions, points locaux automatiques avant nouvelle version/restauration, export JSON manuel. Le dépôt ne sauvegarde pas les données privées des téléphones.
- D:\Pikéo : aucune sauvegarde intégrale confirmée sur ce disque. Ne pas la présenter comme réalisée ; terminal PC actuellement en erreur.

## Les 28 idées retenues

| N° | Idée | État vérifié |
| --- | --- | --- |
| 03 | Contrôle du matériel | Écran présent ; matériel réel à définir avec Étienne. |
| 04 | Reprise après interruption | Présente : ligne, bac, geste suivant et photo facultative. |
| 05 | Retour de fin de poste | Présent : jusqu’à trois suggestions choisies/reformulables, aucune obligation. |
| 09 | Consigne datée et attribuée | Présente, source et date de revue. |
| 10 | Comparer une commande révisée | Présent : références et quantités modifiées. |
| 11 | Cause et prochaine action du manquant | Présentes, facultatives et repliées. |
| 13 | File des commandes à reprendre | Présente ; tout autre manque maintient le blocage. |
| 14 | Relance JC avec contexte | Présente, à relire/copier, sans faux envoi. |
| 15 | Passation à un collègue | Présente : sélection, aperçu, précisions privées décochées. |
| 19 | Repère chariot/palette | Présent dans la reprise, sans position automatique. |
| 26 | Fatigue privée | Présente, facultative, hors Google/partages. |
| 27 | Rappels de récupération | Présents et désactivables, page visible nécessaire. |
| 31 | Conflits de saisie | Présents avec ascendance des événements ; historique ancien conservé. |
| 32 | Export limité | Présent : période/type/notes facultatives et aperçu. |
| 33 | Espace et archivage | Partiel : volumes et exports ; archivage guidé par sélection à finaliser. |
| 34 | Diagnostic hors ligne | Présent : cache, OCR, stockage, sauvegardes. |
| 36 | Parcours guidé | Partiel : exemples de démonstration ; petites missions et progression à finaliser. |
| 37 | Fiches de rappel | Présentes et éditables. |
| 38 | Lexique métier | Présent ; définitions réelles à renseigner/valider. |
| 39 | Utilisation à une main | Présente ; préférence gauche/droite et lecture agrandie, essai terrain nécessaire. |
| 40 | Retour de scan | Présent : motifs son/vibration distincts et retour visuel ; vibration physique à tester. |
| 41 | Célébration de journée | Présente, facultative, bilan confirmé et mouvements réduits respectés. |
| 43 | Comparaison à soi | Présente avec choix de journées comparables. |
| 44 | Reconnaissance de l’entraide | Présente dans le bilan privé, aucun envoi automatique. |
| 45 | Petit objectif choisi | Présent, un seul actif, pause sans pénalité. |
| 46 | Pas de la journée/du poste | Report Android/Health Connect ; aucun compteur inventé dans le web. |
| 47 | Accès guidé WeWard | Partiel : lien au site officiel ; ouverture directe/validation dans l’application non livrées. |
| 48 | Boîte à améliorations | Présente : états, interlocuteur et résultat. |

## Omission confirmée : personnage animé

- Le GO n’annulait pas cette tâche : les transitions avec personnage ne sont pas intégrées.
- Cible : portrait comics d’Étienne souriant, logisticien portant un carton, marche sur place.
- Le portrait dédié au projet n’est pas identifié dans les pièces disponibles ; la dernière image est une capture de l’application.
- Cinq propositions d’ouverture séparées dans propositions-mascotte.html ; personnage provisoire et aucun changement des transitions tant que le choix n’est pas effectué.
- Geste de salut, scan du carton, dépose soignée, ajustement sur place ou tampon de validation.
- Aucun délai artificiel de navigation pour finir l’animation ; pas de pourcentage fictif ; version statique si mouvements réduits.

## Travail restant hors Android et jeu

- Portrait dédié, choix de l’ouverture et intégration du personnage.
- Archivage guidé (33), missions guidées (36), accès WeWard à préciser (47).
- Matériel réel (03), consignes/lexique et conditionnements à valider sur le terrain.
- Police exacte TTF/OTF et essais Honeywell.
- Contrôle PC/téléphone de l’actualisation ; activation admin et synchronisation Google sur les appareils concernés.
- Copie sur D:\Pikéo à réaliser lorsque ce chemin devient accessible ; conserver une copie externe des données locales.
