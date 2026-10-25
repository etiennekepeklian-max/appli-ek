# Décision du 25 octobre au soir — version 1.10

[Sessions, droits et Google lisible](SESSIONS.md) remplace les propositions antérieures de PIN et de chiffrement intégral ci-dessous. Le projet Supabase est raccordé au service de sessions. Le jeu, Godot et Capacitor restent reportés. Les sections 1.9 suivantes décrivent la version précédente.

# Pikéo 1.9 — évolutions web et reprise

## Ce qui est livré

Le code reste une application web/PWA. Les cinq entrées de navigation sont conservées ; « Mon poste » regroupe les outils occasionnels.

| Choix | Parcours |
| --- | --- |
| 03 | Matériel personnel éditable, vide au départ, cases du jour. Le matériel réel reste à définir avec Étienne. |
| 04, 19 | Repère de reprise : commande, ligne, bac/chariot/palette, point de dépose, prochain geste et photo facultative. Aucune position en direct. |
| 05 | Bilan et jusqu’à trois suggestions issues des manquants, reprises et fiches incomplètes. L’opérateur choisit une action, peut la reformuler ou l’ignorer. Exemple : « revoir le manquant 00123 » demain. Ce n’est pas une nouvelle procédure imposée. |
| 09, 37, 38 | Consignes datées, rappels courts et lexique, avec auteur, source et date de revue ; recherche par référence. Aucun développement inventé de PAC/PAD/RES. |
| 10 | Comparaison de deux versions d’une commande : références ajoutées/retirées et quantités modifiées. |
| 11 | Cause et prochaine action facultatives, repliées avec les précisions du manquant. |
| 13 | Préparations à reprendre après réassort ; les références encore manquantes restent visibles et empêchent de déclarer la préparation débloquée. |
| 14 | Relance JC à relire et copier, avec durée depuis le signalement et commandes concernées. Aucune fausse date d’envoi, aucun envoi automatique. Le premier message choisi reste inchangé. |
| 15 | Passation limitée aux manquants sélectionnés, avec aperçu et précisions désactivées par défaut. |
| 26, 27 | Ressenti privé facultatif et rappels personnels de récupération, uniquement quand la page est ouverte et visible. |
| 31 | Révision de départ conservée, détection de modifications différentes issues du même état, comparaison et choix explicite d’une version ; historique conservé. Les anciens événements sans ascendance ne produisent pas de conflit inventé. |
| 32 | Export CSV par période, commandes ou manquants, précisions sur choix explicite, aperçu avant téléchargement. |
| 33, 34 | Espace estimé, documents/photos/mémos distingués ; diagnostic stockage, service worker, cache, OCR français et dernières sauvegardes. Aucun nettoyage silencieux. |
| 36 | Prise en main orientée vers les exemples de démonstration, séparés des données réelles. |
| 39, 40 | Préférences personnelles pour la main, la lecture et les retours visuels de scan, en complément des sons/vibrations existants. |
| 41, 43 | Retour après enregistrement effectif, célébration facultative d’un objectif confirmé et atteint, réduction des animations respectée ; comparaison volontaire de journées comparables. Aucun classement imposé ni hausse automatique de cadence. |
| 44, 45 | Notes privées d’entraide et un petit objectif personnel à la fois, avec pause sans pénalité. |
| 47 | Accès au site officiel WeWard ; validation des pas et récompenses dans WeWard. Pas de conversion ni validation automatique. |
| 48 | Idées personnelles avec états proposée/examinée/en essai/appliquée/classée, interlocuteur et résultat. |

Le mode sombre, l’import CSV d’emplacements, les familles rétablies sauf Cartes regroupées, la reconnaissance de référence et le remplissage du casier, les codes Code 39, l’OCR groupé, les annulations et les mémos restent disponibles.

## Sauvegardes et versions

- Code 1.8 protégé par la branche backup/v1.8.0-avant-evolutions-2026-10-25-b9f4e37 et le commit b9f4e370172244226838f7ddb040b745e88b4a3f.
- Un point de données est créé dans le navigateur avant l’ouverture de la version 1.9, et avant chaque restauration. Les copies audio se trouvent dans une autre base locale.
- Un point manuel peut être créé dans Mon poste → Espace et sauvegardes. Le retour de données écrit de nouvelles révisions, conserve les anciennes et crée un point de retour. Les fichiers plus récents ne sont pas purgés.
- Les copies locales disparaîtraient si le navigateur est effacé. Une copie téléchargée reste nécessaire pour un autre téléphone.
- L’export personnel .pikeo utilise AES-256-GCM, clé aléatoire 256 bits, IV aléatoire 96 bits par chiffrement et authentification 128 bits. La clé .pikeokey est créée et chargée sur l’appareil, reste en mémoire et n’est envoyée ni à Google ni au dépôt. Conserver la clé séparément ; aucune récupération sans elle.
- L’export personnel conserve aussi les repères privés et les photos de reprise. Il exclut les mémos vocaux ; ceux-ci gardent leur export dans Mémos vocaux.
- L’import métier vérifie tous les événements et fichiers avant une transaction d’écriture. La fusion personnelle et métier utilise deux bases ; un point de sécurité permet de revenir en cas d’interruption ou de quota insuffisant.
- Aucun fichier n’a été écrit sur D:\Pikéo depuis cet environnement. Le ZIP du dépôt contient le code, pas les données privées des téléphones ni les fichiers Google.

## Google

Les quatre onglets sont conservés. Chaque nouveau payload est chiffré ; les colonnes métier visibles sont vides. Un grand payload est réparti dans plusieurs cellules pour respecter la limite de Google, y compris avec des caractères multioctets. L’identifiant aléatoire d’événement et le nom d’onglet restent des métadonnées techniques visibles.

Les documents sont chiffrés avant upload, y compris leur nom et leur type d’origine ; Drive affiche un nom technique opaque. Les mémos et repères privés sont exclus. La restauration de documents chiffre/déchiffre côté téléphone.

Pour activer : charger la clé personnelle, connecter Google, puis synchroniser. Depuis Espace et sauvegardes, « Préparer une base Google chiffrée » lit la base actuelle et récupère les documents accessibles avant de proposer la nouvelle base. Créer cette nouvelle base reste un choix explicite. Ne supprimer aucune ancienne copie avant vérification et export.

L’ancienne feuille et les fichiers historiques peuvent encore contenir des données en clair. Leur historique Google n’est pas chiffré rétroactivement. Les autres appareils doivent recevoir la même clé et la nouvelle référence de feuille. L’authentification réelle dans le compte Google du propriétaire n’est pas réalisable dans les tests simulés.

## Ce qui reste à raccorder ou à fournir

- Comptes personnels avec rôles administrateur/opérateur, chat entre collègues et tableau collectif facultatif : Supabase est connecté et le projet Pikéo a été créé le 25 octobre 2026 dans l’organisation choisie par Étienne, en région Paris. Le tarif de création annoncé est de 0 $/mois. Le projet est sain et ne contient encore aucune table applicative ; comptes, rôles et messagerie restent à configurer et à intégrer. GitHub Pages sert des fichiers et ne contrôle pas des autorisations serveur. Les préférences livrées sont personnelles à l’appareil ; elles ne sont pas encore rattachées à un compte.
- Le PIN de quatre chiffres devra déverrouiller un appareil déjà associé à un compte, avec limitation des essais. Il ne remplace ni une clé de chiffrement ni un mot de passe de service. Ne pas stocker un PIN réversible dans Sheets.
- Pour le chat : historique chiffré sur les téléphones, relais temporaire chiffré de bout en bout, expiration après réception/délai et protection des clés par appareil. Pas de relais à plusieurs téléphones.
- Le tableau collectif devra être facultatif et masquable, centré sur entraide/qualité/progrès consentis, sans rang public des moins productifs ni sanction des absences.
- Portrait de la mascotte à fournir par Étienne : style comics, sourire, tenue de logisticien, carton, marche sur place ; pas de visage inventé.
- Fichier réel de police C39HrP24DhTt et validation au terminal Honeywell : l’import de police existe, mais ce fichier n’a pas été reçu ici.
- Godot et Capacitor sont reportés. Bluetooth/Wi-Fi direct entre téléphones, pas Health Connect (46), raccourci natif WeWard et alarmes fiables écran verrouillé attendent une implémentation Android.

## Jeu logistique — recherche, sans intégration

- Demande du 25 octobre 2026 : un jeu inspiré des principes d’Overcooked! 2, où un logisticien prélève les références dans les allées et remplit progressivement un bac pour terminer des commandes.
- [Recherche et propositions](GAME_RESEARCH.md) : gestes simples, coopération, variété des niveaux, erreurs récupérables, remplissage visible et progression facultative.
- Attendre un nouveau GO explicite d’Étienne avant toute implantation du jeu. Aucune progression de jeu ne doit être comptabilisée comme du picking professionnel.
