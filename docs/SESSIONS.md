# Pikéo 1.10 — sessions simples et Google lisible

Les décisions d’Étienne du 25 octobre au soir remplacent la demande initiale de PIN et de chiffrement intégral. Le jeu reste en attente d’un GO distinct. Godot et Capacitor restent reportés.

## Utilisation quotidienne

- L’espace personnel initial reste accessible et garde ses données, codes, réglages et mémos. Aucune migration destructive de la base `ek-logistique-live`.
- Dans Sessions et collègues, chacun choisit son nom. Il n’y a ni mot de passe ni PIN. Une session déjà ouverte se retrouve sur cet appareil et fonctionne hors ligne.
- Chaque utilisateur possède ses commandes, manquants, photos, brouillons, mémos, repères, horaires et préférences. L’interface revient aux données appropriées lors d’un changement de session. La connexion Google et les anciennes clés en mémoire sont retirées au changement.
- Les noms sont déclaratifs. Cette simplicité ne prouve pas l’identité d’une personne, et une personne ayant accès au même téléphone peut choisir une session déjà ouverte sur cet appareil. Réserver les appareils habilités et le fichier admin à Étienne.

## Accès administrateur

Étienne reçoit séparément un fichier privé `Pikeo-acces-admin-Etienne.json`, exclu du dépôt et des sauvegardes métier. À importer une fois dans Sessions et collègues → Accès administrateur d’Étienne. Le serveur valide cet accès et autorise ensuite l’appareil. Choisir simplement le nom Étienne sur un autre appareil laisse cet appareil opérateur.

Le fichier permet aussi de rétablir l’accès sur un nouvel appareil. Il doit rester personnel. Il ne s’agit pas d’une clé de chiffrement Google, et aucun code de quatre chiffres n’est demandé.

Les administrateurs peuvent configurer les produits, familles, règles et emplacements. Seul l’accès propriétaire d’Étienne peut habiliter ou révoquer les autres appareils. Un administrateur délégué ne peut pas attribuer des habilitations. Les paramètres peuvent être publiés pour l’équipe et actualisés par les opérateurs ; les commandes, mémos et repères privés n’en font pas partie. Les anciennes modifications restent dans les historiques locaux.

L’espace personnel historique garde ses réglages individuels pour ne pas bloquer le travail avant activation. Il ne reçoit aucun pouvoir de publication sur les paramètres partagés sans habilitation serveur.

## Google et anciennes copies

Les nouveaux envois sont lisibles dans les quatre onglets `produit`, `manquant`, `objectif picking`, `historique`. Les documents Drive conservent leur nom et leur format lisibles. Aucune nouvelle clé n’est obligatoire.

À la prochaine synchronisation, les anciennes lignes chiffrées sont rendues lisibles après création d’un point local, si leurs événements sont encore présents sur ce téléphone. Si un événement n’est pas disponible localement, sa clé d’origine ou une copie JSON de l’appareil d’origine reste nécessaire ; aucun secret perdu n’est inventé. La conversion recontrôle les cellules sources et conserve les identifiants et toutes les révisions.

Les anciens fichiers chiffrés sont conservés. Les documents dont le téléphone possède une copie sont sauvegardés dans leur format lisible. Les anciennes versions distantes ne sont pas supprimées silencieusement. L’export personnel JSON est désormais l’action principale ; les anciennes copies chiffrées restent lisibles avec leur ancienne clé et un export confidentiel reste facultatif.

## Messages privés

- Historique sur chaque appareil, dans une base distincte de Google et de l’export métier.
- Transmission par relais avec chiffrement de bout en bout : ECDH P-256 éphémère par envoi, HKDF-SHA-256, AES-256-GCM. Les clés privées d’appareil ne sont pas exportables par l’application.
- Sur le relais, seuls les enveloppes chiffrées et les identifiants techniques nécessaires à la livraison sont conservés. Une copie est supprimée après enregistrement durable et acquittement par son appareil destinataire.
- Les messages non reçus expirent à 24 heures, avec purge physique programmée toutes les dix minutes. Les métadonnées de sessions et les clés publiques restent nécessaires au fonctionnement des profils.
- Sans Internet, la file reste sur le téléphone et réessaie à la réouverture de Messages. « Transmis » confirme le dépôt au relais, jamais la lecture.
- Un nouvel appareil ne déchiffre pas les anciens envois destinés à l’ancien appareil. L’utilisateur peut exporter ses conversations dans un JSON personnel lisible puis les importer sous le même nom. L’import est validé avant écriture, dédupliqué et ne renvoie pas les messages.
- Les points de version des conversations sont locaux et séparés des copies métier, comme les mémos vocaux. Effacer les données du navigateur effacerait aussi ces copies ; un export séparé est nécessaire pour changer d’appareil.
- Pas de relais entre téléphones. La communication directe Bluetooth/Wi-Fi sans Internet attend la phase Android.

## Participation collective facultative

Un bilan d’entraide, de qualité et de petits progrès choisis remplace le podium de cadence. Participation volontaire, retrait immédiat des contributions en ligne, au plus un geste par catégorie et par jour. Conservation de sept jours, puis purge. Aucune mesure d’absence, de retard, de ressenti ou de santé, aucun relevé automatique du picking et aucun objectif professionnel augmenté.

## Contrôle serveur

- Le navigateur signe les demandes avec une clé d’appareil ECDSA P-256, conservée localement. Le serveur vérifie le contenu signé, la date, le nonce et l’habilitation courante ; un rôle modifié dans le navigateur n’accorde aucun droit serveur.
- Les tables sont dans un schéma privé, sans accès direct des rôles navigateur. RLS et politiques explicites de refus sont activées. Aucun `service_role`, mot de passe de base ou clé d’administration n’est publié dans le client.
- L’accès propriétaire est vérifié par empreinte SHA-256 d’un secret aléatoire de 256 bits. Le secret n’est pas stocké en clair en base.
- Les demandes rejouées, signatures incorrectes et opérations non habilitées sont refusées. Des limites réduisent les inscriptions et appels abusifs.
- Les secrets serveur sont fournis par l’environnement Supabase ; le dépôt ne contient que le code et le schéma réutilisable.

## Vérification

Le contrat a été testé contre le serveur réel avec des appareils synthétiques : faux Étienne opérateur, accès propriétaire privé, refus opérateur, refus de délégation par un admin, anti-rejeu, révocation immédiate, chiffrement/déchiffrement de message, acquittement isolé et retrait du partage.

Les parcours navigateur utilisent exclusivement des données synthétiques et un serveur de sessions simulé. Ils vérifient la séparation des données et mémos, le retour aux données initiales, le rechargement, la conversation sur deux appareils, l’aide et les modes clair/sombre à 320 et 390 px. Les parcours existants de commandes, OCR, scanner, codes, imports et annulations restent requis avant publication.
