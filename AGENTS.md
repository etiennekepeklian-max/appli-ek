# Pikéo — règles de maintenance

- Conserver les données, les identifiants de stockage `ek-*`, l’identité du manifeste et la compatibilité des sauvegardes historiques.
- Pour chaque modification fonctionnelle ou visuelle, vérifier l’aide de l’écran **et de la fenêtre/action concernés** dans `site/js/help-core.js`, ainsi que la page Aide. Les mettre à jour si nécessaire ; documenter la vérification dans `VALIDATION.md`.
- Une nouvelle route ou un nouveau formulaire doit avoir un contexte d’aide pertinent, accessible avec `?`, sans remplacer ni réinitialiser la saisie.
- Les messages pour JC sont générés et copiés après relecture. Aucun envoi externe automatique sans instruction explicite de l’utilisateur.
- Garder les parcours mobiles rapides et les codes-barres noirs sur blanc, en modes clair et sombre. Exécuter les tests métier et les parcours navigateur pertinents avant publication.
- Ne publier aucun identifiant de feuille privée, secret, jeton, photo ou donnée de travail.
- Les mémos vocaux utilisent un stockage local séparé. Aucun audio, titre de mémo ou sauvegarde vocale ne doit entrer dans Google Sheets, Drive automatique, le journal métier ou l’export général. Les copies automatiques de version audio restent dans une base locale distincte, sans export ni synchronisation. Seuls les exports/partages déclenchés depuis Mémos vocaux sont autorisés.
- Godot et Capacitor sont reportés par décision explicite d’Étienne. Poursuivre la version web ; ne pas relancer de migration ni de rappels de maturité sans nouvelle instruction. Lire `docs/GODOT_MIGRATION.md` avant tout changement de plateforme.
- Conserver les quatre onglets Google `produit`, `manquant`, `objectif picking`, `historique`. Ne pas recréer les anciens onglets ni supprimer des révisions lors d’un regroupement.

- Décision d’Étienne du 25 octobre au soir : produits, commandes et historique Google en clair, sans clé obligatoire. Conserver la lecture des anciennes copies chiffrées et une conversion explicite avec sauvegarde. Sessions par nom sans mot de passe/PIN ; droits administrateur imposés côté serveur et activés par un accès privé, jamais par le prénom seul.
- Les repères privés de workbench-store (ressenti, entraide, préférences, photos de reprise) ne rejoignent pas la synchronisation métier. Les comptes et autorisations doivent être imposés par un service authentifié ; ne pas présenter un masque de boutons comme une protection.

- Décision d’Étienne du 27 octobre : le suivi picking utilise les chiffres journaliers saisis à partir des managers, modifiables après sauvegarde et visibles en graphiques. Retirer les invitations à photographier/analyser les commandes de ce parcours. Préserver les anciens bilans et photos, leur nettoyage explicite et la compatibilité des sauvegardes.

- Version bureau : conserver `bureau.html` et `index.html` sur la même origine et avec les mêmes identifiants de stockage. La version mobile reste disponible. Ne pas promettre de copie automatique des données entre appareils sans synchronisation Google. Les clés et mémos ne se synchronisent pas.
- Permissions : conserver le modèle identique dans `site/js/permissions-core.js` et `backend/pikeo-api/permissions-core.js`. L’accès propriétaire nécessite le fichier privé, jamais le nom seul ; aucun rôle élevé automatique pour un nouvel appareil. Tester les parcours d’administration avec le relais simulé de `tools/desktop-smoke.mjs`, sans créer de clé propriétaire temporaire sur le serveur réel.
