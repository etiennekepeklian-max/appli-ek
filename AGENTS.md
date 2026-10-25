# Pikéo — règles de maintenance

- Conserver les données, les identifiants de stockage `ek-*`, l’identité du manifeste et la compatibilité des sauvegardes historiques.
- Pour chaque modification fonctionnelle ou visuelle, vérifier l’aide de l’écran **et de la fenêtre/action concernés** dans `site/js/help-core.js`, ainsi que la page Aide. Les mettre à jour si nécessaire ; documenter la vérification dans `VALIDATION.md`.
- Une nouvelle route ou un nouveau formulaire doit avoir un contexte d’aide pertinent, accessible avec `?`, sans remplacer ni réinitialiser la saisie.
- Les messages pour JC sont générés et copiés après relecture. Aucun envoi externe automatique sans instruction explicite de l’utilisateur.
- Garder les parcours mobiles rapides et les codes-barres noirs sur blanc, en modes clair et sombre. Exécuter les tests métier et les parcours navigateur pertinents avant publication.
- Ne publier aucun identifiant de feuille privée, secret, jeton, photo ou donnée de travail.
- Les mémos vocaux utilisent un stockage local séparé. Aucun audio, titre de mémo ou sauvegarde vocale ne doit entrer dans Google Sheets, Drive automatique, le journal métier ou l’export général. Seuls les exports/partages déclenchés depuis Mémos vocaux sont autorisés.
- Préparer Godot 4 sans lancer la migration : attendre que toutes les fonctions soient terminées et l’accord explicite final d’Étienne. Aux prochaines étapes fonctionnelles importantes, lui proposer brièvement de faire le point sur cette maturité ; ne pas créer de rappel calendaire à cette seule fin. Lire `docs/GODOT_MIGRATION.md` avant tout changement de plateforme.
- Conserver les quatre onglets Google `produit`, `manquant`, `objectif picking`, `historique`. Ne pas recréer les anciens onglets ni supprimer des révisions lors d’un regroupement.
