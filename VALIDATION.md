# Vérification de la version 1.0.0

Vérifications effectuées le 23 octobre 2026.

## Contrôles réussis

- **23 tests métier** : lots de 1/2/3/4/6, arrondi à la prise supérieure, conditionnements inconnus, correction par ligne, quantités invalides, correction d’un jour passé, jour sans données, retraits, fusion idempotente, conservation des zéros, dictée numérique, séparation Code 128/Code 39, extraction de texte, export CSV et cycles de familles.
- Vérification de syntaxe des modules JavaScript et des outils Node.
- Catalogue : 514 fiches officielles et 2754 variantes, 51 familles, relations vérifiées. Les 2691 EAN présents passent le contrôle EAN13. Les correspondances multiples sont conservées ; aucune règle de conditionnement n’a été inventée.
- Bibliothèques vendoriées : versions, empreintes SHA-256, licences, modèles OCR gzip et moteurs WASM contrôlés.
- Interface vérifiée dans le navigateur, sur écran d’ordinateur et dans un viewport de **390 pixels** : tableau de bord, navigation mobile, formulaires, lignes de commande sous forme de cartes, champs numériques et boutons de dictée.
- Génération de **001234** et **\*001234\*** en Code 128 : texte exact affiché, favoris et historique.
- Décodage réel par ZXing d’une image de Code 128 contenant **3045671191401**, puis identification du produit officiel correspondant **76013491**, « Porte-monnaie à motif - Jouy rose ».
- OCR local sur une feuille d’exercice intégrée : deux références reconnues, quantités et lots extraits après vérification, **12/4 + 6/3 = 5 pickings**.
- Réassort : réception partielle **4 sur 12**, réception complète **12 sur 12**, puis clôture de la commande dans le bon filtre.
- Picking : estimation minimale **4** avec intervalle **4 à 9** pour une commande dont une règle est inconnue ; le total est marqué estimatif.
- Blocage de l’enregistrement d’un second exemplaire du même numéro de commande.
- Conditionnement d’une référence créée dans l’application réutilisé dans une nouvelle commande : **12 articles par lots de 4 = 3 prises**.
- Correction d’un jour passé : total retenu **1600**, calcul source **1640** conservé et affiché ; changement de date immédiatement visible.
- Données de démonstration retrouvées après rechargement et séparées des données de travail.
- PDF journalier produit dans l’interface, avec un fichier d’environ **6 Ko** et un lien de téléchargement de secours. Génération de fichiers PDF et d’images Code 128 également vérifiée avec les bibliothèques. Le navigateur de contrôle n’a pas fourni d’événement de téléchargement exploitable : la récupération effective dans le dossier Téléchargements de l’utilisateur reste à vérifier sur son navigateur.
- Base native Google Sheets créée : **15 onglets**, noms et en-têtes contrôlés, première ligne figée et quantités/références conservées comme texte dans le stockage événementiel.
- Archive ZIP contrôlée, chemins relatifs et absence de fichier de données utilisateur ou de secret dans le projet.

## Publication GitHub vérifiée

- Les **68 fichiers** du projet sont publiés dans `etiennekepeklian-max/appli-ek`. L’empreinte Git de l’arbre distant correspond exactement à celle des sources vérifiées.
- Le workflow **Publier EK Logistique** a réussi : tests métier, syntaxe, catalogue, configuration Pages, préparation et déploiement de l’artefact.
- Site HTTPS ouvert et contrôlé : https://etiennekepeklian-max.github.io/appli-ek/ . Accueil, démonstration, tableau de bord, génération du Code 128 **001234** et réglages Google vérifiés sur la version publique.
- L’identifiant et le lien de la feuille Google privée ont été retirés des sources publiques. Le champ de feuille est vide au premier démarrage ; la valeur saisie ensuite reste dans les réglages locaux de l’appareil.

## Vérifications à effectuer sur le matériel et les comptes de l’utilisateur

- Exécution des lanceurs PowerShell sur Windows et placement effectif dans `C:\Users\etien\Desktop\Artil\Appli EK` : l’environnement de développement n’a pas accès à ce disque Windows.
- Installation de la PWA et accès hors ligne sur le téléphone. Le navigateur de contrôle servait l’aperçu en HTTP non sécurisé ; il ne permettait pas de tester les permissions caméra/micro ni le service worker.
- Lecture en direct avec la caméra réelle et dictée avec le navigateur choisi.
- OCR sur une vraie feuille de préparation : la structure interne n’a pas encore été fournie. Toutes les lignes doivent être relues.
- Lecture des deux variantes sur le terminal Honeywell et vérification du texte réellement reçu dans Velocity.
- Import et convention de la police spécifique fournie par Adrien.
- Connexion Google OAuth réelle : l’identifiant client de cette application doit encore être créé. Les appels de synchronisation ne peuvent pas être validés sans lui. Les règles de sérialisation, fusion et conservation d’historique sont couvertes par les tests métier ; la sauvegarde fonctionne localement entre-temps.

## Portée de la version

Application personnelle autonome. Chaque collègue peut utiliser sa propre base Google Sheets. Une base commune rend les fiches et les totaux communs aux personnes autorisées ; cette version n’isole pas les tableaux de bord individuels par compte au sein d’une base partagée. Les mouvements du stock officiel restent dans Velocity.
