# Pikéo : suivi des demandes et vérification, 28 octobre 2026

**Source de référence :** branche `codex/capacitor-readiness-20261027`, fondée sur `codex/desktop-v1.18.0` (PR #1). Demande de fusion en brouillon : PR #10. **Aucune des modifications décrites ci-dessous n'est encore publiée sur la branche `main` ni dans l'application GitHub Pages**.

## Réalisé dans la branche et testé

| Demande | Travail enregistré | Vérification |
|---|---|---|
| ENF : créer puis voir le détail | `site/js/enf.js`: création manuelle, photo, sauvegarde et ouverture de la fiche | `tools/enf-smoke.mjs`, `tools/catalogue-photo-smoke.mjs` |
| Import de feuilles par photo | `site/js/catalogue-photo.js`, `site/js/catalogue-photo-core.js` : OCR local, relecture, doublons, noms incohérents, PAC/PAD/RES et confirmation | `tests/catalogue-photo.test.mjs`, `tools/catalogue-photo-smoke.mjs`. **Photos réelles à tester en entrepôt** |
| Réassorts : message, relance, signature | `site/js/app.js`, `site/js/help-core.js`, `site/js/views.js` | `tests/help.test.mjs`, `tools/workflow-smoke.mjs`. Téléphones JC et Serge facultatifs dans Réglages ; **appel réel à tester sur téléphone** |
| Codes inconnus : produit ou casier | `site/js/ops.js` et formulaire d'emplacement | `tools/catalogue-photo-smoke.mjs` |
| Outils et aides actualisées | `site/js/navigation-core.js`, `site/js/help-core.js`, `site/js/views.js`, liens bureau | `tests/navigation.test.mjs`, suite UI |
| Guide bureau autonome | `site/aide-bureau.html` et liens dans `bureau.html` + navigation latérale | `tools/catalogue-photo-smoke.mjs` |
| Préparation Capacitor | Config, preflight, contrat des liens, modèle Android du widget 1×4 | `npm run android:check` et tests de routes. **APK et widget natif non compilés** |
| Cinq propositions de mascotte | `site/propositions-mascotte.html` réutilise `assets/mascot-default.svg` ; cinq GIF autonomes 2,4 s remis dans la conversation | Test navigateur dans `tools/update-smoke.mjs` ; **proposition n° 1 Contraste terrain sélectionnée et intégrée dans la branche, publication en attente** |

## En suspens ou à vérifier physiquement

1. **Sécurité des comptes et code admin à 4 chiffres (issue #11).** La version 1.18 de développement sépare les rôles et prévoit un accès propriétaire privé, mais **ne réalise pas encore une authentification des admins avec code 4 chiffres et limitation des tentatives sur le serveur**, ni une réinitialisation de mot de passe par un autre admin. C'est une demande non terminée. Ne pas afficher la fonctionnalité comme réalisée.
2. **Widget Android final (issue #5).** Le modèle 1×4 est prêt ; génération du projet Android et compilation dans Android Studio, vérification des liens profonds et essais réels attendent les installations sur PC et le GO de migration.
3. **Mascotte (issue #8).** Le même personnage existant est repris ; les cinq prototypes sont proposés, mais aucun GIF définitif n'est imposé à l'ouverture avant le choix de l'utilisateur. Respecter le mouvement réduit.
4. **Documents réels et appels téléphoniques.** Tester l'OCR sur les feuilles d'entrepôt (cadrage, faible contraste, caractères confondus), les casiers et les appels sur téléphone ; conserver la validation manuelle.
5. **Publication de la version web.** La version publique actuelle sur `main` reste distincte de la préparation v1.18 et de cette branche. Les PR #1 et #10 sont en brouillon, sans fusion ni déploiement. Ne publier qu'après revue et accord explicite pour ne pas perturber la production.

## Contrôles

Tests automatiques et parcours Playwright via `.github/workflows/pages.yml` : `verify`, `sessions`, `updates`, `enfs`, `webtools`, `ergonomics`, `diagnostics`, `desktop`. La publication `deploy` est volontairement ignorée pour les branches de préparation. Consulter le dernier run du HEAD avant d'affirmer que tout est vert.

## Liens

- Site web **publié** : https://etiennekepeklian-max.github.io/appli-ek/
- Bureau **après publication** : https://etiennekepeklian-max.github.io/appli-ek/bureau.html
- Aide bureau **après publication** : https://etiennekepeklian-max.github.io/appli-ek/aide-bureau.html
- PR développement : https://github.com/etiennekepeklian-max/appli-ek/pull/10
