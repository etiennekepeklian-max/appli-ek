# EK Logistique

Application web mobile en HTML, CSS et JavaScript. Elle accompagne la préparation de commandes et la gestion de stock, indépendamment de Velocity.

## Démarrer sur le PC

1. Extraire entièrement le ZIP.
2. Double-cliquer sur **INSTALLER-EK.cmd**. Les fichiers sont copiés dans **C:\Users\etien\Desktop\Artil\Appli EK**. Un dossier déjà présent est conservé dans une sauvegarde datée.
3. Dans ce dossier, double-cliquer sur **LANCER-EK.cmd**. L’application s’ouvre à **http://localhost:8765/**. Garder la fenêtre du lanceur ouverte.

Le lanceur utilise PowerShell et .NET intégrés à Windows. Il ne demande pas de droits administrateur et ne change pas la configuration de sécurité permanente de Windows. Le serveur écoute uniquement sur l’ordinateur local.

Alternative avec Node.js 20 ou ultérieur : `npm start`. Aucun `npm install` n’est nécessaire.

## Fonctions incluses

- Code 128 standard, variante avec astérisques dans les données, essai Code 39, zéros initiaux conservés, favoris, historique, affichage agrandi, export SVG/PNG/PDF et planches multi-étiquettes.
- Import d’une police TTF/OTF/WOFF pour un essai séparé. La convention de la police d’Adrien doit encore être fournie et vérifiée sur Honeywell.
- Lecture caméra ou photo via BarcodeDetector et repli ZXing. Identification locale avec le catalogue public Draeger Paris et les références ajoutées par l’utilisateur. Correspondances multiples signalées ; recherche Web proposée en l’absence de nom fiable.
- Commandes en attente : numéro, référence, casier, quantités, personne sollicitée, priorité, notes, réception partielle, réception complète et clôture de commande.
- Photos de feuilles, OCR français/anglais exécuté sur l’appareil, texte à vérifier, édition des lignes, estimation des prises selon les conditionnements connus et saisie manuelle.
- Tableau de bord, objectif journalier paramétrable (1800 par défaut), graphique 7/14/30 jours, commandes distinctes et corrections de jours passés.
- Produits, familles et sous-familles modifiables, import/export de références, conditionnements, emplacements, mouvements, inventaires, contrôle des vides, seuils de réassort, écarts avec photos et historique complet.
- Dictée sur les champs texte principaux lorsque le navigateur la prend en charge. Le clavier et le micro du clavier Android restent utilisables.
- Mode débutant, aide contextuelle, démonstration séparée des données de travail et export de sauvegarde JSON incluant les photos.
- PWA installable depuis HTTPS, cache hors ligne et téléchargement facultatif du moteur OCR pour l’utilisation sans réseau.

## Google Sheets

Dans **Réglages → Sauvegarde Google Sheets**, renseignez l’URL ou l’identifiant de votre feuille privée. Cette valeur est enregistrée sur votre appareil, hors du dépôt public. Vous pouvez aussi créer une nouvelle base depuis les Réglages après connexion.

**La connexion nécessite un identifiant OAuth Google Web.** La connexion Google Drive de ChatGPT ne fournit pas cet identifiant au programme. Le guide pas à pas est dans `site/guide-google.html` et dans les Réglages.

Les saisies fonctionnent sans cet identifiant, avec conservation dans IndexedDB. Une fois Google configuré, les modifications sont synchronisées par événements ajoutés en fin de tableau, sans écraser les anciennes lignes. Le fichier `payload_json` contient l’état de la fiche à cette révision. Les doublons de transport sont ignorés par identifiant d’événement. Si deux appareils modifient la même fiche hors ligne, la révision la plus récente, puis l’identifiant de l’événement en cas d’égalité, est retenue ; les deux restent dans l’historique.

Les photos et les polices sont des fichiers locaux. Lors d’une synchronisation, elles sont envoyées dans un dossier Drive privé créé par l’application ; la feuille conserve leurs métadonnées. Les fichiers ne sont pas accessibles publiquement.

## Publier sur GitHub Pages et installer sur téléphone

Application publiée : **https://etiennekepeklian-max.github.io/appli-ek/**.

Sources : https://github.com/etiennekepeklian-max/appli-ek . Le workflow `.github/workflows/pages.yml` vérifie le projet puis publie uniquement `site/`. Les modifications de la branche `main` déclenchent une mise à jour automatique ; le workflow peut aussi être lancé manuellement depuis Actions.

1. Ouvrir l’application en HTTPS sur le téléphone.
2. Chrome Android → menu ⋮ → **Ajouter à l’écran d’accueil / Installer**.
3. Pour Google Sheets, renseigner sa feuille privée et son identifiant OAuth dans les Réglages, puis ajouter l’origine `https://etiennekepeklian-max.github.io` aux origines autorisées du client OAuth.

Pour publier sa propre copie, activer **Settings → Pages → Build and deployment → GitHub Actions** dans son dépôt.

Seul le code de l’application et le catalogue public sont publiés. Ne pas déposer les exports personnels, des photos d’entrepôt, des jetons d’accès ou des secrets dans GitHub. Aucun secret OAuth n’est nécessaire côté navigateur.

La caméra et le micro ne fonctionnent généralement pas depuis une simple adresse HTTP du réseau local ; utiliser GitHub Pages en HTTPS pour le téléphone. Le mode bureau fonctionne sur `localhost`.

## Calculs et limites explicites

- Règle actuelle : `arrondi supérieur(quantité d’articles / unités par prise)` quand le conditionnement est connu.
- Si le conditionnement manque, une prise minimale est retenue pour la ligne et une fourchette est affichée. Ce résultat reste une **estimation**.
- Chaque commande conserve les règles utilisées au moment de son enregistrement. Modifier une règle produit ne change pas les anciennes commandes en silence : elles peuvent être corrigées individuellement ou via le total du jour.
- Une correction journalière remplace seulement le total retenu dans le dashboard ; elle ne modifie ni les commandes sources ni l’historique initial.
- Le chiffre donné par l’entreprise fait foi. L’estimation ne connaît ni les trajets ni les gestes réellement effectués.
- L’OCR doit être vérifié. Aucun modèle de feuille interne n’a encore été fourni ; l’extraction conservatrice ne garantit pas une bonne reconstruction de toutes les colonnes.
- Scanner un code et retrouver sa dénomination sont deux étapes distinctes. Une référence interne sans correspondance publique ne peut pas être reconnue universellement.
- La police exacte, la caméra réelle, la dictée, l’installation sur le téléphone et la lecture Honeywell doivent encore être vérifiées avec le matériel utilisateur.
- La synchronisation réelle est à tester après configuration OAuth ; les fonctionnalités locales ne dépendent pas de Google.

## Catalogue et provenance

Collecte officielle du 23 octobre 2026 : **514 fiches publiques, 2754 variantes, 2691 variantes avec EAN**, **51 familles et sous-familles proposées**. Les regroupements sont basés sur les types produit publiés ; il ne s’agit pas de la nomenclature interne de l’entrepôt. Le catalogue public peut omettre des présentoirs ou références réservées aux professionnels. Aucun conditionnement logistique n’a été inventé.

Sources : https://draegerparis.com/fr et https://fr.checkout.draegerparis.com/collections/all . Les sources exactes figurent dans chaque fiche JSON. Les catégories médicales de Dräger avaient été utilisées par erreur dans une proposition précédente ; elles sont absentes de ce projet.

Pour actualiser le catalogue, utiliser `tools/update_catalogue.py` (Python standard), puis copier ses deux JSON dans `site/data/` et exécuter `node tools/prepare.mjs`. Lire les arguments du script avec `--help` avant usage.

## Vérifier le projet

`npm test` vérifie les règles métier et les cas d’erreur. `npm run check` vérifie la syntaxe, les fichiers hors ligne et les relations du catalogue. `node tools/prepare.mjs` régénère le cache après modification de fichiers.

Le dossier `vendor/` contient les versions épinglées de JsBarcode, ZXing Browser, jsPDF, Tesseract.js, ses moteurs et ses modèles, avec leurs licences. Les dépendances sont locales pour éviter le chargement d’un CDN pendant le travail.

## Dossiers

- `site/` : application publiable telle quelle.
- `tools/` : lancement Windows/Node, vérification et mise à jour.
- `tests/` : vérifications métier.
- `.github/workflows/` : publication GitHub Pages.
- `VALIDATION.md` : résultats et limites des vérifications effectuées.

L’application n’écrit pas dans Velocity et ne constitue pas le stock officiel. Elle ne gère pas de comptes utilisateurs propres : l’accès aux sauvegardes partagées est défini par les autorisations Google du fichier.
