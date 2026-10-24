# EK Logistique

## Outils terrain — version 1.3.0

### Import des emplacements par référence

Dans **Outils → Emplacements → Importer les emplacements** (aussi disponible dans le Catalogue), choisissez un fichier **CSV UTF-8** ou collez son contenu. Le modèle est téléchargeable dans la fenêtre. Les colonnes obligatoires sont `reference` et `emplacement`, séparées par un point-virgule :

```csv
reference;emplacement
001234;A-01-02
001234;RESERVE-B-04
TRJDUPOR;C-03-01
```

Une ligne par association, plusieurs lignes pour plusieurs casiers d’une référence. Dans Excel, formatez les deux colonnes en **Texte avant la saisie** pour garder les zéros initiaux, puis **Enregistrer sous → CSV UTF-8**. Une fois les zéros perdus dans Excel, l’application ne peut pas les deviner. Les séparateurs virgule et tabulation, le BOM et les cellules entre guillemets sont acceptés ; `.xlsx` n’est pas accepté. Limites : 5 000 lignes / 3 Mo. Un aperçu est obligatoire avant validation. Les doublons sont ignorés ; un fichier mal formé est refusé entièrement. Par défaut les casiers sont ajoutés ; l’option Remplacer ne concerne que les références du fichier. Les références inconnues sont créées avec un nom à compléter. Les conditionnements, photos et autres références sont conservés. L’import est atomique et annulable en une action.

### Fonctions mobiles ajoutées

- Lampe et zoom matériel dans le scanner, uniquement si l’objectif et le navigateur les exposent ; explication sinon. Son distinct pour lecture reconnue/inconnue/erreur et vibration, désactivables séparément dans **Réglages → Options terrain**. Le mode silencieux et le système peuvent les empêcher.
- Photo produit depuis la caméra ou la galerie, compressée localement, visible dans le catalogue et le résultat du scan. Les photos sont incluses dans les sauvegardes JSON et Google Drive déjà configuré.
- Liste **Outils → Codes inconnus** : conservation locale des codes sans correspondance, nombre et date des lectures, création d’une fiche ou classement sans suite.
- Recherche tolérante aux accents, espaces et tirets ; faute simple pour les mots longs ; noms alternatifs configurables dans les fiches.
- De 1 à 4 raccourcis d’accueil personnalisables et ordonnés dans les options.
- Brouillons locaux des commandes, manquants, produits, écarts, mouvements, comptages et seuils. Reprise depuis l’accueil, conservation des lignes et photos de commande, suppression après enregistrement. Les brouillons ne sont pas synchronisés entre appareils ; les fichiers joints et les données définitives restent inclus dans les sauvegardes.
- Annulation de la dernière action modifiable depuis l’accueil, les outils ou l’historique. Une nouvelle révision restaure l’état précédent, sans effacer l’historique. Un import ou une réception groupée s’annule en un bloc. Refus si une fiche a été modifiée depuis sur un autre appareil.
- Attentes regroupées par référence avec total restant et détail des commandes ; retour possible à la vue par commande. Réception groupée avec proposition priorité/ancienneté, relecture et ajustement des quantités avant confirmation. Aucune sur-réception ni clôture automatique des commandes.
- Repère des **30 minutes depuis le signalement initial**, conservé en réception partielle, supprimé pour les réassorts reçus/clôturés. Notification système après autorisation explicite, option désactivable et rappel visuel. **Sur GitHub Pages sans serveur de notifications, l’heure exacte n’est pas garantie quand l’application est suspendue, le téléphone verrouillé ou l’application fermée. Le contrôle reprend à la réouverture.** Aucun envoi externe de commande ni service tiers de notifications.
- Photos de feuilles : proposition de cadrage pour une feuille claire sur fond sombre, correction manuelle des quatre coins, rotation, redressement réel de perspective, choix de garder l’original ou d’annuler avant OCR. Les coordonnées peuvent aussi être réglées par champs. L’utilisateur vérifie le cadrage et les résultats OCR.
- **Outils → Journal hebdomadaire** : semaine lundi-dimanche, activité enregistrée, incidents, difficultés, apprentissages et améliorations, notes sauvegardées et export PDF relu. Les jours absents restent absents ; le PDF distingue calculs, estimations et corrections.

### Quantités du site Draeger et pickings

Vérification du 24 octobre 2026 sur les fiches publiques Draeger Paris : certains produits contiennent plusieurs pièces (ex. 4 dessous de verre, réf. 06000076 ; 8 range-couverts, réf. 06000075). Ce **contenu de l’article vendu** ne prouve ni un minimum de commande professionnel ni le **nombre d’unités par prise dans l’entrepôt**. La règle reste donc `plafond(quantité d’unités logistiques / unités confirmées par prise)`, sans modifier l’objectif journalier, ni déduire un conditionnement d’un nom de produit. Exemple : si la commande exprime des sachets de 8 pièces, le nombre « 8 » n’est pas automatiquement un diviseur. Une valeur confirmée dans la fiche produit reste prioritaire ; les lignes sans règle restent signalées comme estimatives.

Sources examinées : https://fr.checkout.draegerparis.com/products/4-dessous-de-verre-en-papier-06000076 et https://fr.checkout.draegerparis.com/products/8-range-couverts-en-papier-06000075 .

Application web mobile en HTML, CSS et JavaScript. Elle accompagne la préparation de commandes et la gestion de stock, indépendamment de Velocity.

## Caméras multiples — version 1.2.0

Dans **Scanner → Ouvrir la caméra**, autorisez l’accès puis choisissez **Caméra utilisée**, ou touchez **Changer de caméra** pour passer à la suivante. Le dernier objectif est conservé localement sur cet appareil, séparément des sauvegardes et des autres téléphones.

La liste contient les caméras vidéo exposées par le navigateur après autorisation, avec leurs noms disponibles. Le navigateur peut regrouper ou masquer certains capteurs physiques ; si une seule caméra est proposée, le sélecteur et la bascule sont désactivés avec une explication. Le choix concerne le scanner vidéo ; le bouton « choisir une photo » continue d’utiliser l’interface photo du téléphone.

L’ancien flux est fermé avant chaque changement. Le lecteur natif et ZXing utilisent le même objectif sélectionné. Si une ancienne préférence n’est plus disponible, le scanner revient à une caméra disponible et le signale. Quitter l’écran ou masquer l’application arrête la capture, même si une autorisation ou une ouverture était encore en cours.

## Version mobile 1.1.0

L’interface est conçue exclusivement pour le téléphone : navigation fixe Accueil / Codes / Scanner / Attentes / Outils, cartes à la place des tableaux, formulaires plein écran, boutons tactiles et champs de 16 px. Le catalogue affiche 20 références par page. Le menu Outils regroupe la préparation, le stock et les réglages ; un sélecteur permet de changer d’outil de stock.

La présentation reste celle d’un téléphone sur grand écran (largeur maximale de 480 px). Le zoom du navigateur reste disponible. Les données, sauvegardes et calculs existants sont conservés. La PWA demande une orientation portrait lorsque le système la prend en charge.

Après une mise à jour, fermer tous les onglets de l’application puis la rouvrir pour activer le nouveau cache hors ligne.

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


