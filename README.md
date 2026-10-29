## Pikéo 1.18.2 — Bureau réservé aux administrateurs

Le lien Bureau de Tous mes outils et du guide apparaît après vérification en ligne d’une session administrateur active sur cet appareil. Le mode personnel, les opérateurs et la consultation n’y ont pas accès ; choisir le nom Étienne ne donne pas de privilège.

L’entrée bureau attend une demande `bureau-access` signée avant d’importer l’application. Le serveur contrôle les rôles et les états actuels du profil et de l’appareil ; la permission `configure` seule ne suffit pas. Une réponse n’est valable qu’une minute en mémoire. Vérification toutes les 30 secondes et au retour dans la fenêtre ; erreur, perte de réseau, changement de session ou retrait des droits verrouillent l’interface en conservant les champs et les données. La version mobile conserve son fonctionnement hors connexion. Le PIN existant continue de protéger les opérations sensibles.

Les fichiers statiques sont hébergés publiquement sur GitHub Pages. Ce contrôle réserve le parcours Bureau dans l’application ; il ne rend pas son HTML ni son code source confidentiels. Les opérations du service restent soumises à leur propre authentification et à leurs permissions serveur. Aucune migration, modification d’habilitation ni suppression de données n’est nécessaire pour cette version.

# Pikéo

## Version 1.18.1 — photos de recherche et nettoyage du cache

- Le scanner recherche automatiquement les codes absents, ambigus ou sans désignation confirmée et affiche les résultats avec leur source.
- Photo publique facultative : miniature Shopify de 480 pixels de large au maximum, affichage à 220 pixels au maximum sans déformation ; photo personnelle prioritaire et absence d’image tolérée.
- Le lien de la photo rejoint la fiche après relecture et Enregistrer, puis reste visible avec Internet. Aucun emplacement ou conditionnement n’est déduit du Web.
- Une fiche modifiée est relue immédiatement même si le même code vient d’être scanné.
- Après une sauvegarde Google réussie, proposition de retirer le cache technique avec espace estimé et confirmation. Fiches, photos, brouillons, mémos et préférences restent conservés ; Internet permet de télécharger de nouveau les fichiers techniques.

## Version 1.18.0 — PIN administrateur web

- Un code à quatre chiffres protège les opérations sensibles des appareils administrateurs, en complément de leur signature. Les sessions ordinaires restent accessibles par nom.
- Création et confirmation du code dans Administration, déverrouillage pendant dix minutes, verrouillage immédiat et limitation des tentatives côté serveur.
- Récupération du propriétaire avec son fichier privé existant et réinitialisation par un autre compte administrateur déverrouillé. Le code personnel se choisit dans Pikéo et ne se communique pas dans une conversation.
- Publication web autorisée le 29 octobre 2026. Mise en service après configuration du secret serveur et migration additive ; les identités, données et mémos sont conservés. Android reste reporté.


## Version 1.17.11 — recherche Internet des codes inconnus ou ambigus

- Le scanner, la lecture photo et la recherche par code consultent automatiquement les fiches publiques si le catalogue ne donne pas de correspondance certaine. Draeger est prioritaire ; une base externe complète les EAN valides.
- Les propositions affichent source, référence et code-barres, avec une distinction entre correspondance et piste. Vérifier avant ajout ouvre une fiche à relire ; Enregistrer confirme. Une fiche existante est proposée à la place d’un doublon.
- Les résultats restent temporaires avant validation. Les adresses, conditionnements, mémos et autres données de travail ne sont pas envoyés aux moteurs de recherche. Seul le code demandé est transmis au relais et aux sources concernées. Les sources externes conservent leurs quotas et leur disponibilité.
- Hors ligne et en cas d’erreur, le code reste à identifier. Le retour du réseau relance la recherche hors ligne affichée. La navigation et les nouvelles recherches restent disponibles.

## Version 1.17.0 — suivi picking manuel

- Ma journée propose la saisie par date des chiffres communiqués par les managers : pickings, et facultativement commandes, colis, palettes, poids, source et note. Sauvegarder applique les modifications, y compris pour un jour passé.
- Graphiques visibles sur 7, 14, 30 ou 90 jours, avec choix de l’indicateur, total, moyenne et meilleure journée. Les jours vides restent inconnus ; les zéros saisis sont pris en compte.
- Historique des journées avec accès Modifier, versions conservées et annulation. Changement de date vers une date libre et suppression confirmée toujours disponibles. PDF du jour et export CSV des chiffres journaliers.
- Le parcours photo/OCR des commandes est retiré du suivi picking. Les anciennes données sont conservées, et le nettoyage des photos par dates reste accessible. Les anciens modules de lecture restent disponibles uniquement pour compatibilité et tests ; ENF et scanner conservent leur fonctionnement.
- Stockage local et synchronisation existante dans objectif picking, sans nouvelle table ni migration destructive.

## Version 1.16.3 — supprimer une journée et corriger sa date

- Supprimer cette journée est disponible dans Ma journée et la session photo, y compris avant l’analyse ou la validation. Après confirmation, la session repart vide et le bilan est retiré pour pouvoir recréer la journée.
- Modifier la date puis Sauvegarder la date déplace ensemble les photos, lectures, corrections, commandes validées et le total corrigé. Une date déjà occupée est refusée pour ne rien écraser ; fermer sans sauvegarder conserve la date initiale.
- Les autres journées, le catalogue et les mémos sont conservés. Les fichiers d’origine et les anciennes valeurs restent récupérables ; Annuler peut restaurer l’action tant que les données concernées n’ont pas changé.
- Ouvrir la journée du reste un sélecteur de session distinct, sans déplacement des photos.

## Version 1.16.2 — journées indépendantes et lecture interrompable

- Photographier aujourd’hui conserve les journées non terminées, avec leurs photos et corrections. Le choix de date ouvre une session distincte ; il ne déplace aucune photo.
- Journées à reprendre et le bandeau de Ma journée permettent de rattraper chaque date séparément. Ces brouillons restent locaux, inclus dans les points de restauration et protégés du retrait de fichiers.
- Mettre l’analyse en pause interrompt le moteur et conserve les lectures terminées. Changer de journée pendant la lecture la met en pause automatiquement. Une limite de 60 secondes par photo évite une attente sans fin ; le moteur est recréé après interruption.
- Les images ne sont plus agrandies artificiellement avant lecture ; les grandes images sont limitées à 3 000 pixels sur leur plus grand côté. Les quatre orientations restent disponibles en secours.


## Version 1.10.0 — sessions par nom, habilitations et données lisibles

- Les sessions ordinaires utilisent le nom. Étienne active son accès administrateur avec son fichier privé ; depuis la version 1.18.0, un PIN protège ensuite les opérations sensibles de chaque appareil administrateur.
- Sessions avec données, mémos et préférences séparés. L’espace personnel initial reste intact.
- Produits, commandes, historique et documents Google lisibles, sans clé obligatoire. Les anciennes lignes connues du téléphone sont converties après sauvegarde.
- Messages avec historique local et relais temporaire chiffré, exports séparés et participation collective facultative sans classement de cadence.
- Aide mise à jour. Le jeu et les migrations de plateforme restent reportés. [Mode d’emploi et limites](docs/SESSIONS.md).

## Version 1.9.0 — Mon poste et sauvegardes chiffrées

- Un accès « Mon poste » pour matériel, reprise, consignes et lexique, passation, progrès privés, idées et diagnostic.
- Préférences personnelles de main et de lecture, retours visuels des scans et réussite discrète/festive facultative.
- Points de restauration locaux avant cette version et avant les restaurations ; historique conservé, copies audio séparées.
- Sauvegardes personnelles .pikeo et nouveaux envois Google chiffrés sur le téléphone. Charger sa clé .pikeokey avant de synchroniser. Les anciennes copies en clair ne sont pas chiffrées rétroactivement.
- Les fonctions existantes restent vérifiées. Godot et Capacitor sont reportés. Comptes, rôles et chat attendent le service sécurisé ; aucune protection fictive par boutons masqués.

Détails, activation Google et état des choix : [évolutions web](docs/WEB_EVOLUTIONS.md).

## Version 1.8.0 — horaires, mémos vocaux et quatre onglets Google

- **Horaires et alertes** dans Plus et sur l’accueil : prise de poste 8 h, pause 10 h 15–10 h 30, déjeuner 12 h 30–13 h 15, fin 16 h. Six rappels à 7 h 52, 10 h 07, 10 h 22, 12 h 22, 13 h 07 et 15 h 52. Lundi à vendredi par défaut, jours et horaires modifiables, heure de Paris. Les rappels sont propres à ce téléphone et restent jusqu’à acquittement. La vibration se relance tant que la page est visible et le navigateur l’autorise ; aucun service d’alarmes écran verrouillé n’est promis par la version web. L’action d’arrêt de la notification est conservée même si la page est fermée.
- **Mémos vocaux** dans Plus : enregistrement avec le microphone, écoute, renommage, suppression confirmée, export audio, partage système et sauvegarde/import dédiés. Quitter l’écran ou passer en arrière-plan arrête et conserve le son. Base locale distincte ; aucun mémo ni son dans Google, Drive automatique, l’historique métier ou le JSON général. L’export explicite des mémos est nécessaire pour changer de téléphone. Si l’espace manque, le son reste exportable en mémoire tant que la page n’est pas fermée.
- **Google Sheets** : uniquement `produit`, `manquant`, `objectif picking`, `historique`. Les types et toutes les révisions restent dans `payload_json`, avec les mêmes douze colonnes et les mêmes identifiants. Une ancienne base non regroupée est signalée, sans recréer les anciens onglets ni effacer les données locales. Les nouvelles bases ont exactement les quatre onglets. Aucun identifiant de base privée n’est publié.
- **Scanner** : caméra ouverte automatiquement, reprise du dernier objectif, arrêt après lecture, recherche manuelle, photo ou départ de l’écran. Une permission refusée laisse disponibles la réouverture, la photo et la saisie.
- **Godot 4** : préparation seulement dans [le plan de migration](docs/GODOT_MIGRATION.md). La migration attend la fin des fonctionnalités et l’accord final d’Étienne. Un bilan est proposé aux étapes importantes et depuis les Réglages.
- **Aide** : les nouveaux écrans/actions et les conseils Google, scanner et sauvegarde sont couverts. Les parcours navigateur couvrent aussi les exports/restaurations audio, les acquittements et le rechargement hors ligne.

## Version 1.7.0 — Pikéo, Contraste terrain et aide contextuelle

- Nom choisi : **Pikéo**. Apparence **Contraste terrain** : noir, blanc et jaune, grandes actions lisibles, modes clair et sombre ; codes-barres toujours noirs sur blanc.
- **Message pour JC** depuis chaque manquant en attente, y compris la vue groupée : le modèle 3 reprend la référence exacte et l’emplacement, avec aperçu et copie. Un casier absent invite à compléter la fiche. Aucun envoi automatique à un tiers.
- **Aide contextuelle** avec `?` sur chaque écran, formulaire et cadrage photo. Une fenêtre séparée conserve la saisie et permet de reprendre l’action. Les conseils de message, journée, CSV, picking, sauvegarde et annulation correspondent aux fonctions actuelles.
- **Maintenance** : `AGENTS.md` exige la vérification de l’aide et sa mise à jour si nécessaire à chaque évolution. Les tests vérifient la couverture des routes.
- **Compatibilité** : mêmes adresses de site, identité PWA, bases locales, préférences et connexion Google. La signature technique des sauvegardes reste `EK Logistique` afin de conserver la compatibilité avec les exports existants. Les anciens fichiers Google ne sont pas renommés ; le nom historique peut encore apparaître dans le consentement Google.

## Version 1.6.0 — moins de saisies et outils regroupés

- **Accueil et navigation** : recherche commune par référence, EAN, nom ou emplacement ; accès direct Accueil, Codes, Manquants, Produits et Plus. Graphiques déplacés dans Ma journée. Les raccourcis personnalisés existants restent utilisables.
- **Manquants** : Enregistrer et suivant conserve la commande et la priorité, puis vide la référence et ses détails. La reconnaissance montre le nom et la photo locale disponible. Scanner une référence revient au formulaire avec le numéro et les détails conservés. Les doublons sont recherchés sur la commande et la référence, même si le casier diffère ; une seconde attente exige un autre casier et une précision. Un réassort reçu ne clôture pas la commande. La clôture groupe les attentes de la commande lorsque plus aucune référence n’attend son réassort.
- **Produits et emplacements** : accès aux adresses, familles/règles, codes inconnus et liste À compléter dans le même ensemble. La fiche donne directement accès au manquant, au code et à la correction d’emplacement. Une préférence d’emplacement peut être choisie explicitement ; plusieurs adresses sans préférence ne sont pas départagées automatiquement.
- **À compléter** : filtres pour nom, emplacement, famille et règle de picking manquants ; les codes inconnus restent accessibles depuis cette liste. Le catalogue public n’est pas supposé décrire tous les casiers de l’entrepôt.
- **Sauvegarde** : état distinct de la connexion Google, heure du dernier succès pour la base sélectionnée, modifications/documents restant à envoyer, erreurs et reprise. Une modification créée pendant l’envoi reste signalée à sauvegarder. Les paramètres en cours de saisie survivent à un rafraîchissement de la page par la synchronisation. Le client OAuth public existant reste préconfiguré ; aucun droit Google supplémentaire n’est demandé.
- **Bilan** : anomalies de lecture et règles manquantes mises en avant ; les autres commandes restent consultables dans une section repliée. La confirmation finale de l’opérateur reste nécessaire. Les libellés parlent de calcul ou d’estimation, sans présenter la formule comme une mesure physique.
- **Écrans allégés** : variantes de codes, téléchargements, exports et saisie manuelle de secours dans des menus secondaires. Les contrôles de stock restent regroupés dans Plus, repliés pour la préparation et ouverts pour le profil stock. Le niveau économique reste conservé et facultatif. Les seuils indiquent la date du constat, indépendamment de la date de modification du réglage.
- **Compatibilité** : pas de suppression de fonction ni de données, même pour les anciennes réceptions partielles, quantités, règles et historiques. Les préférences et adresses nouvelles sont incluses dans les sauvegardes existantes. Les anciennes adresses sans PAC/PAD/RES restent acceptées ; l’aperçu CSV signale les préfixes absents ou répétés.

## Version 1.5.0 — saisie rapide et options terrain

- **Référence manquante** : pendant la saisie, proposition de références proches puis confirmation du nom sur correspondance exacte, sans retirer les zéros initiaux. Un EAN reconnu est rattaché à sa référence. Une référence absente peut être signalée avec avertissement ; les correspondances ambiguës demandent un choix. Un emplacement connu unique est prérempli ; plusieurs emplacements proposent un sélecteur. Un emplacement automatique est effacé si la référence change. Une adresse modifiée manuellement est conservée.
- **PAC / PAD / RES** : sélecteur dans les fiches produit et les manquants. Le préfixe est ajouté à l’enregistrement et prévisualisé. Dans Codes, choisir « Adresse d’emplacement » puis le type. Une référence produit garde son code propre. Les préfixes déjà présents ne sont pas doublés et les anciens emplacements sans type sont conservés.
- **Familles** : retour à la liste détaillée d’origine. Les cartes forment un seul groupe visible ; leurs anciens identifiants restent disponibles dans les données pour préserver les références et règles existantes.
- **Apparence** : Réglages → Votre espace → Apparence : selon le téléphone, clair ou sombre. Le choix est mémorisé. Les codes-barres gardent un fond blanc et des barres noires dans tous les thèmes.
- **C39HrP24DhTt** : le Code 39 est proposé au démarrage. Les débuts/fins sont générés automatiquement, sans ajouter d’astérisques aux données lues. Le Code 128 et ses variantes restent disponibles. Le nom d’une police ne fournit pas ses fichiers ; l’import TTF/OTF existant permet la comparaison avec la police exacte. Aucun fichier de police non fourni n’est présenté comme incorporé.
- **Google Sheets** : validation plus claire des identifiants, sauvegarde des champs avant connexion et première autorisation possible avant la création d’une feuille. La configuration OAuth du propriétaire est une étape distincte ; un compte connecté à ChatGPT ne fournit pas de client OAuth à l’application. L’acceptation du règlement Google et les autorisations requises doivent être terminées dans le compte du propriétaire.

## Version 1.4.0 — usage mobile et bilan en fin de journée

- **Enregistrer ma journée** : photographier les pages à la suite ou choisir plusieurs photos dans la galerie, puis analyser et enregistrer toutes les commandes en une fois. Les numéros regroupent les pages ; les numéros illisibles, confusions O/0, lignes inconnues et pages manquantes sont signalés. Vérifier la quantité réellement préparée, particulièrement si la feuille affiche aussi la quantité commandée. Les documents sans en-têtes fiables nécessitent une relecture. Les photos sont conservées progressivement dans un brouillon local reprenable depuis l’accueil. Limites : 100 photos, 25 Mo par photo, 150 Mo par session, sous réserve de l’espace disponible.
- **Doublons** : une photo identique n’est pas ajoutée deux fois. Une page répétée avec même numéro et même contenu est ignorée ; les cas ambigus sont signalés. Au réimport de la même image, le numéro déjà corrigé est conservé. Les commandes existantes sont écartées par défaut. Pour le même jour, un remplacement explicite ou l’ajout de nouvelles pages identifiables reste possible. Une autre journée est protégée.
- **Manquants** : commande, référence, casier, priorité, état et précisions. Les quantités et la personne sollicitée ne sont plus demandées. En attente → Réassort reçu → Commande terminée. Les anciennes réceptions partielles restent conservées et apparaissent en attente. Réception groupée : cocher les commandes réellement débloquées, sans répartition de quantités. L’alerte à 30 minutes est conservée avec les mêmes limites de suspension du téléphone.
- **Catalogue** : huit grandes familles, plus À classer si nécessaire, avec les types détaillés à l’intérieur. Toutes les cartes sont regroupées. La fiche complète s’ouvre en touchant la carte produit ou avec Entrée/Espace : nom, référence, EAN, photo, famille, emplacements et règle de picking. Les classements absents sont proposés d’après des noms explicites ; un classement personnel existant est conservé. Les emplacements viennent uniquement des données saisies/importées.
- **Picking** : exception produit > règle du type de produit > règle d’une famille parente > estimation signalée. Définir les quantités dans Outils → Familles de produits → Modifier la règle ; laisser l’exception produit vide pour hériter. Aucun 4, 2 ou 6 n’est imposé. Les anciennes commandes gardent les règles utilisées à leur enregistrement.
- **Annulation au pouce** : barre au-dessus de la navigation avec l’intitulé de la dernière modification. Une modification simple est annulée directement ; un import ou une journée groupée demande confirmation. L’accès durable reste dans l’historique. L’historique et la protection contre les changements concurrents sont conservés.
- **Import des emplacements CSV** : Outils → Emplacements → Importer les emplacements, également depuis le Catalogue. Une note visible et un modèle téléchargeable décrivent le format ci-dessous. L’aperçu reste obligatoire ; import et annulation groupés.

La lecture automatique doit encore être confrontée aux véritables modèles de feuilles de l’entrepôt. Le bilan proposé est à relire ; les prises inconnues restent estimatives. La saisie manuelle est conservée comme outil de secours et pour corriger les anciens enregistrements.

## Import CSV et outils conservés

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
- Attentes regroupées par référence avec le nombre et le détail des commandes concernées ; retour possible à la vue par commande. Réception groupée avec sélection explicite des commandes débloquées, sans quantité ni clôture automatique.
- Repère des **30 minutes depuis le signalement initial**, conservé pour les anciennes réceptions partielles encore en attente, supprimé pour les réassorts reçus/clôturés. Notification système après autorisation explicite, option désactivable et rappel visuel. **Sur GitHub Pages sans serveur de notifications, l’heure exacte n’est pas garantie quand l’application est suspendue, le téléphone verrouillé ou l’application fermée. Le contrôle reprend à la réouverture.** Aucun envoi externe de commande ni service tiers de notifications.
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
- Commandes en attente : numéro, référence, casier, priorité, notes, réception complète et clôture de commande.
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
- La synchronisation réelle de la version 1.5 a été vérifiée le 25 octobre 2026 sur le compte du propriétaire. Chaque nouvel appareil doit se connecter et renseigner la base privée ; les fonctionnalités locales ne dépendent pas de Google.

## Catalogue et provenance

Collecte officielle du 23 octobre 2026 : **514 fiches publiques, 2754 variantes, 2691 variantes avec EAN**, **52 entrées de familles et sous-familles proposées, regroupées sous huit grandes familles et À classer**. Les regroupements sont basés sur les types produit publiés ; il ne s’agit pas de la nomenclature interne de l’entrepôt. Le catalogue public peut omettre des présentoirs ou références réservées aux professionnels. Aucun conditionnement logistique n’a été inventé.

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




### Photos par date et manquant vocal (1.16.3)

- Ma journée / Outils → Supprimer des photos par date : choisir les dates, vérifier le récapitulatif et confirmer. Les bilans restent conservés ; les photos des brouillons en cours sont protégées.
- L’option de nettoyage des copies de version retire seulement les images sélectionnées des points locaux. Elles ne sont plus récupérables depuis ces points ; aucune copie Google n’est effacée.
- Noter un manquant → Dicter commande et référence : dire les deux numéros avec leurs libellés, puis relire et enregistrer. L’adresse connue est proposée. Aucun audio n’est conservé par Pikéo ; la reconnaissance du navigateur peut utiliser Internet. Le texte et le micro du clavier restent disponibles en secours.
