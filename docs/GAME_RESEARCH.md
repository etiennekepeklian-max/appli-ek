# Jeu de préparation de commandes — recherche préalable

Date : 25 octobre 2026.
Statut : idée ajoutée aux travaux en attente. Recherche et propositions uniquement.
Aucun développement, prototype jouable, écran, ressource ou intégration du jeu sans nouveau GO explicite d’Étienne. Godot et Capacitor restent reportés.

## Demande retenue

Un logisticien parcourt les allées d’un entrepôt, attrape les références d’une commande les unes après les autres et les dépose dans un bac. Le contenu du bac devient visiblement plus important à chaque article. Quand la commande est complète, le bac part à l’expédition et une nouvelle commande arrive. L’inspiration est Overcooked! 2 ; l’univers, les personnages, les niveaux et les sons de notre jeu seront propres à Pikéo.

## Ce que les sources permettent de conclure

Les entretiens expliquent les intentions des créateurs et leurs observations en tests. Ils ne prouvent pas à eux seuls qu’une mécanique cause les ventes ni que la reprendre garantirait le même succès.

Le premier Overcooked a obtenu les BAFTA British Game et Family en 2017 [6]. Overcooked! 2 apparaît parmi les nommés British Game, Family et Multiplayer de 2019, sans victoire dans ces catégories [7]. Ces distinctions sont un indice de reconnaissance ; elles ne mesurent pas la rétention de joueurs.

## Principes de conception à retenir

| Observation documentée | Adaptation proposée pour l’entrepôt |
| --- | --- |
| Les commandes doivent être comprises et les gestes appris rapidement. Les créateurs ont travaillé avec des personnes jouant peu aux jeux vidéo [1]. | Peu de références au départ, gros objets reconnaissables, quantités lisibles, un déplacement et une action contextuelle. |
| La coopération est au centre : le succès repose sur l’organisation du groupe et la participation de chacun [2]. | En coopération, se passer le bac, répartir les rayons et préparer l’expédition. Éviter un joueur expert qui fait tout pendant que l’autre attend. |
| Chaque niveau est construit autour d’une idée de jeu, puis affiné. La disposition des espaces crée des problèmes différents [3]. | Un niveau apprend le bon trajet ; un autre introduit un convoyeur ; un troisième change l’accès à un rayon. Une nouveauté principale à la fois. |
| Les développeurs ont retiré des possibilités d’erreurs parasites qui rendaient le jeu frustrant [1,2]. | Prise assistée près d’une étagère, case de dépôt généreuse, article erroné récupérable, lecture claire du bac. La difficulté ne doit pas venir de boutons imprécis. |
| Les combinaisons de commandes réussies, étoiles et défis supplémentaires donnent des objectifs à rejouer [4]. | Récompenses de précision, de régularité et d’entraide ; tenues et bacs décoratifs. Le chrono reste un défi choisi. |
| La suite a enrichi les situations et ajouté le jeu en ligne ; Team17 décrit aussi une production élargie et une diffusion sur plusieurs plateformes [3,5]. | Prévoir une place pour une coopération future, tout en validant d’abord les sensations. Un jeu en solo et une coopération réseau sont deux périmètres différents. |

La variété des environnements et les situations spectaculaires contribuent aussi à leur présentation et à leur partage : Team17 les décrit comme un atout pour les bandes-annonces et vidéos [3]. Dans Pikéo, l’équivalent serait un entrepôt cartoon lisible, des petits incidents comiques et un bac dont on voit immédiatement la progression. Cette dernière adaptation est notre proposition, pas une recette validée par les créateurs.

## Le point à ne pas manquer

Un trajet « rayon → article → bac » répété sans décision pourrait devenir monotone. Copier le décor ou la vue d’Overcooked ne suffirait pas.

- En solo : donner des choix de trajets, d’ordre de prélèvement et, plus tard, de commandes à regrouper. Éviter les longues marches sans action.
- En coopération : créer une véritable dépendance utile entre joueurs et permettre de changer de rôle.
- Garder l’action très simple. Ajouter de la variété aux situations plutôt que multiplier les procédures et menus.
- Tester avec des débutants et des habitués. Les créateurs expliquent avoir beaucoup ajusté leurs niveaux, leurs erreurs possibles et leurs scores selon le nombre de joueurs [1,2].

## Proposition à discuter avant tout développement

- Vue de dessus ou de trois quarts, entrepôt compact et style cartoon original.
- Boucle : recevoir un bon illustré → choisir son trajet → saisir les bonnes références → voir le bac se remplir → déposer la commande complète.
- Le remplissage doit être visible article par article sans masquer le contenu restant à prélever. Animation brève, son facultatif et compteur clair.
- Commencer par une commande et un bac. Introduire plusieurs commandes seulement quand le premier parcours est agréable.
- Mode Détente sans limite de temps ; mode Défi court facultatif. Pause immédiate et reprise locale.
- Coopération à deux à étudier séparément. Si nous voulons retrouver le cœur d’Overcooked, elle aura une valeur supérieure à la simple course au meilleur score.
- Qualité et coordination récompensées. Les erreurs se corrigent ; elles ne servent pas à humilier un joueur.
- Jeu facultatif, progression fictive indépendante des commandes professionnelles, du picking réel et du tableau de bord de travail.
- Aucune reprise de commandes client, de photos, de données privées ni de stock réel pour alimenter le jeu.
- Les classements éventuels du jeu seront distincts du suivi des collègues au travail et masquables.

## Essai à prévoir après le GO

Ces chiffres sont une proposition de départ, pas des paramètres déjà validés :

- Un petit entrepôt, deux allées et six types d’articles fictifs.
- Une commande de trois à cinq articles, un bac qui se remplit et une zone d’expédition.
- Un essai de deux à trois minutes ; d’abord vérifier le plaisir de saisir/déposer, puis l’intérêt des trajets.
- Observer : première commande comprise, erreurs de commandes tactiles, temps passé à marcher sans décider, demandes d’aide, moments amusants, envie libre de rejouer.
- N’ajouter ensuite qu’une contrainte à la fois. Si l’essai est monotone ou frustrant, revoir la boucle avant les graphismes et le multijoueur.
- Après validation des sensations et des commandes tactiles, choisir la technique et le périmètre d’intégration. Aucun changement de moteur n’est décidé ici.

## Sources consultées

1. [Entretien de Phil Duncan, Ghost Town Games — Push Square, 6 août 2018](https://www.pushsquare.com/news/2018/08/interview_chewing_the_fat_with_overcooked_2_developer_ghost_town_games) : simplicité, erreurs, accessibilité, construction et tests des niveaux.
2. [Entretien de Phil Duncan — Game Developer, 10 février 2017](https://www.gamedeveloper.com/design/road-to-the-igf-ghost-town-games-i-overcooked-i-) : coopération au centre, équilibre liberté/restrictions, ajustement des scores.
3. [Gavin Hood et le développement d’Overcooked! 2 — Team17, 1er mars 2019](https://www.team17.com/news/team17s-100-games-the-final-chapter-2018-overcooked-2-planet-alpha-yokus-island-express-more) : une idée de jeu par niveau, coopération des studios, environnements dynamiques et jeu en ligne.
4. [The A–Z of Overcooked! 2 — Team17, 5 août 2018](https://www.team17.com/news/the-a-z-of-overcooked-2) : combinaisons, étoiles, arcade, émotes et défis.
5. [Introducing Overcooked! 2 — Team17, 12 juin 2018](https://www.team17.com/news/introducing-overcooked-2) : coopération locale/en ligne et plateformes de lancement.
6. [BAFTA : lauréats des Games Awards 2017](https://www.bafta.org/media-centre/press-releases/winners-announced-for-the-british-academy-games-awards-in-2017/).
7. [BAFTA : résultats des Games Awards 2019](https://www.bafta.org/awards/games/?award-year=2019).
