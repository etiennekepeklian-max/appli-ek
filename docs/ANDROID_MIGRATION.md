# Migration autorisée — 17 novembre 2026

Le GO d’Étienne remplace le report décrit dans GODOT_MIGRATION.md. Capacitor est retenu ; les règles métier et les quatre onglets Google restent inchangés. Chaque appareil Android utilise une clé non exportable et doit être autorisé par Étienne. Le web conserve seulement l’accès propriétaire et l’export de transition des données locales. Les nouveaux modules de pilotage sont privés, hors sauvegardes Google et exports terrain. Les fichiers audio gardent leur export explicite séparé.

Avant bascule : conserver les exports, vérifier la restauration dans l’APK, préserver la signature et contrôler les notifications sur téléphone. Les tests automatiques ne constituent pas un essai physique.

## Installation et reprise

1. Télécharger l’APK signé livré séparément ; autoriser son installation depuis le navigateur ou le gestionnaire de fichiers choisi. Android 7 / API 24 minimum.
2. Avant de quitter le web, exporter la copie personnelle contenant les données et photos depuis Espace et sauvegardes. Les collègues disposent d’un écran d’export de transition après identification. Exporter les mémos séparément si souhaité.
3. Ouvrir Pikéo Android : IntroK.gif, puis identifiant et code personnel. Internet est requis pour une nouvelle ouverture ; une session déjà ouverte conserve ses outils locaux en cas de coupure.
4. Étienne importe une fois son fichier privé existant Pikeo-acces-admin-Etienne.json dans les détails de connexion. Son nom seul ne suffit pas. Les autres appareils affichent leur empreinte à faire approuver dans Comptes et habilitations.
5. Importer la copie dans Espace et sauvegardes ; vérifier les quantités et les photos avant toute opération de nettoyage. Importer les mémos via leur outil séparé. Aucun retrait de l’ancienne copie n’est automatique.
6. Tous les outils → Pilotage privé : déverrouiller le code administrateur puis créer les premières tâches et fiches autorisées. Les modules restent vides tant qu’aucune donnée réelle n’est saisie ou importée. Les imports CSV ajoutent les fiches nouvelles, avec prévisualisation et détection des doublons.
7. Tous les outils → Musique et alertes Android : accorder, si souhaité, la superposition et l’accès aux sessions multimédias ; revenir et réappuyer après chaque autorisation. Un seul bouton Lecture/Pause est fourni. Autoriser séparément notifications et alarmes précises.

## Signature et confidentialité

L’application est fr.pikeo.logistique, versionName 2.0.0, versionCode 20000. Les futures versions doivent réutiliser le certificat de signature privé conservé séparément, avec un versionCode croissant. Ne jamais publier cette archive privée, son mot de passe ni le fichier d’activation propriétaire. Le dépôt et les artefacts de compilation contiennent uniquement un APK non signé ; la signature finale est locale. L’original IntroK.gif est incorporé avant signature et son empreinte est vérifiée.

Les clés d’appareil restent dans AndroidKeyStore. Une approbation d’appareil enregistré est exigée ; ce mécanisme n’est pas une attestation Google Play. Les données de pilotage sont dans le schéma privé, protégées par autorisations serveur, RLS et absence de droits SQL directs pour les navigateurs. Elles ne rejoignent pas Google Sheets. Les tâches interrompues par le réseau utilisent une file locale chiffrée ; les autres données RH ne sont pas mises en cache par ce module. Les captures sont protégées pendant l’écran de pilotage Android. Les pièces jointes administratives doivent rester pertinentes au poste, sans dossier médical.

## Limites à vérifier sur téléphone

La connexion Google actuelle utilise un client web. Elle reste disponible dans le web administrateur ; sur Android, le bouton explique de passer par la copie personnelle plutôt que lancer une connexion WebView incompatible. Les quatre onglets Google existants sont conservés.

La caméra, les mémos, la dictée du clavier, les lecteurs multimédias, les permissions, les alarmes après veille/redémarrage et la restauration avec de vrais fichiers nécessitent une recette sur le téléphone. Une fermeture forcée ou les politiques batterie peuvent empêcher les rappels. Une compilation et des tests automatisés réussis ne constituent pas une validation physique de ces comportements.

Le HTML et le code GitHub Pages restent publics ; l’utilisation et les API métier sont réservées au propriétaire sur le web. Les anciennes copies hors connexion ne peuvent pas être effacées à distance.
