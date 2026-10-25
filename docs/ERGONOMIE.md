# Pikéo 1.13 — accès, lisibilité et mascotte

## Demande et choix

Étienne a fourni sa photo et choisi le geste 3, « Dépose soignée ». La version illustrée est préparée en fichier privé à importer sur le téléphone. Aucune illustration personnelle ni portrait original ne rejoint le dépôt public. La mascotte est un asset de présentation, pas une donnée utilisateur ou un mémo.

- La dépose se joue à l’ouverture, sur place. L’accueil est utilisable dès que ses données sont prêtes, même si le bref salut se termine encore.
- La marche sur place accompagne les chargements réels et la lecture OCR. Les opérations rapides n’attendent pas pour afficher une animation ; le retour de chargement est différé de 150 ms pour éviter les clignotements.
- Aucun temps de traitement n’est inventé pour la mascotte. La préférence système de réduction des animations affiche une pose fixe.
- La planche personnelle contient huit poses (1536 × 1024, WebP transparent, environ 214 Kio). Elle est importable dans Mes préférences → Ma mascotte. Elle est conservée dans les repères privés de la session et ses copies personnelles, sans synchronisation métier ni publication. La mascotte générique de repli reprend uniquement les symboles SVG déjà présents dans le dépôt.

## Retrouver les fonctions

- La loupe de l’en-tête ouvre la recherche des fonctions depuis chaque écran. L’aide de cette fenêtre conserve la recherche et rend le focus au retour.
- « Outils » remplace le libellé « Plus ». La page et la fenêtre utilisent le même annuaire, avec des mots du métier : ENF, manquant, réassort JC, photo, vocal, CSV, sombre, etc. Les fonctions moins visibles (messages, reprise, passation, préférences, archives) y figurent aussi.
- Les quatre raccourcis choisis restent conservés, dans une grille compacte. Un accès ENF demeure disponible sur l’accueil. La recherche des références reste distincte de celle des fonctions et porte un libellé explicite.
- Les résultats du catalogue montrent les adresses directement et privilégient une référence/EAN exact avant les correspondances partielles. Les zéros restent significatifs.
- La recherche différée de produits est annulée lorsqu’on quitte l’écran, pour éviter de réappliquer une ancienne recherche à l’écran suivant.
- Les opérateurs peuvent changer le thème depuis Mes préférences ; leurs droits sur les paramètres communs restent inchangés.

## Contraste

La feuille finale `ergonomics.css` corrige les surfaces restées blanches et les textes sombres hérités : pieds de fenêtre, fiches produit, exemples CSV, import de photos, réglages caméra, consignes, tableaux, légendes de graphiques, champs et boutons. Les codes-barres restent noirs sur blanc. Les couleurs des états gardent leurs libellés.

Le contrôle de contraste vérifie les couleurs calculées des textes/champs et leurs arrière-plans, y compris les ancêtres transparents, en clair/sombre et sur petits écrans. Ce contrôle ciblé ne remplace pas un audit WCAG complet ni un essai terrain avec les opérateurs.

## Recherche utilisée

- W3C, [contraste minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) : seuil de 4,5:1 pour le texte courant, 3:1 pour le grand texte. Les éléments inactifs ont des règles distinctes.
- W3C, [animation et interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) : respecter les préférences de réduction des animations.
- Nielsen Norman Group, [étude sur la navigation cachée](https://www.nngroup.com/articles/hamburger-menus/) : les tâches de l’étude étaient plus difficiles et plus longues lorsque la navigation était cachée. Application ici : préserver les raccourcis visibles et ajouter une recherche nommée, plutôt que demander aux opérateurs de mémoriser des rubriques.

Les bénéfices précis en secondes restent à mesurer en entrepôt. Un prochain essai utile consiste à faire retrouver un ENF, noter un manquant et chercher une adresse, puis compter les touchers et hésitations.

## Confidentialité de la mascotte

La publication de l’illustration personnelle dans GitHub reste en attente d’une autorisation explicite pour cette destination publique. L’application permet son import local ; aucun service en ligne n’est sollicité pour cet import. Le format doit être celui de la planche fournie, en PNG ou WebP, de moins de 3 Mo. Une image incompatible est refusée avant enregistrement. Le retour à la mascotte générique est disponible.
