# Pikéo : dossier de préparation Capacitor (non publié)

**Décision du 27 octobre 2026 : préparation autorisée, conversion Android et APK non lancés.** 
Ce dossier suit la version 1.18.0 de développement. Ne pas fusionner vers `main`, déployer Pages ou supprimer la PWA sans accord.

## État et architecture validés

- Le site actuel est **statique** : répertoire `site/`, page `site/index.html` avec `<head>`. Aucun bundler n'est nécessaire pour copier les fichiers web dans un premier projet Capacitor.
- `capacitor.config.json` pointe vers `webDir: "site"` ; **aucun `server.url`** afin de ne pas dépendre de l'hébergement web dans l'APK.
- L'identifiant proposé `io.github.etiennekepeklianmax.pikeo` est provisoire : le figer avant le premier APK distribué. Le changer après installation peut créer une application différente et séparer ses données.
- Les actions à l'ouverture sont autorisées via un unique contrat : `site/js/android-shortcuts-core.js`. Le manifeste PWA expose déjà les quatre destinations, dont `missing` qui ouvre la saisie directe.
- En environnement Android natif reconnu, `site/js/updates.js` ignore la logique de mise à jour PWA/service worker. Les mises à jour passent par un nouvel APK.
- Les modèles natifs de widget sont dans `android-widget-template/` ; ils ne sont pas encore installés dans un projet Android, ni vérifiés sous Android Studio.
- Mascotte originale **uniquement** : `site/assets/mascot-default.svg`, animée par `site/js/mascot.js`. Aucune autre mascotte ne doit être dessinée. L'écran d'ouverture de 2,5 secondes et son GIF ne sont pas encore produits ; possibilité d'animer les images existantes avec une préférence `prefers-reduced-motion`.

## Logiciels à installer sur ton PC Windows

1. **Node.js 22 ou plus récent** (branche LTS compatible) : <https://nodejs.org/>. Vérifier avec `node --version` et `npm --version`.
2. **Android Studio** (Capacitor 8 demande au moins la version 2025.2.1) : <https://developer.android.com/studio>. L'assistant installe normalement le JDK nécessaire.
3. Installer Android SDK via Android Studio > **More Actions > SDK Manager** (plateforme API 24 ou supérieure selon la version de Capacitor et outils associés).
4. Git facultatif : <https://git-scm.com/> ; privilégier Git pour récupérer les mises à jour sur la bonne branche.

## Préparer tes données (obligatoire avant premier APK)

- Exporter la **sauvegarde générale** depuis Pikéo web et vérifier le fichier obtenu.
- Exporter **séparément** chaque mémoire vocale ou l'archive audio dédiée. Ne pas les synchroniser automatiquement.
- Exporter et noter tes horaires, préférences privées et clés d'accès de manière sécurisée. Les sessions et leurs habilitations seront à réactiver selon l'authentification prévue.
- Sauvegarder le projet GitHub et vérifier que les données Google/Supabase sont récupérables. Aucun jeton ni fichier propriétaire privé sur GitHub.
- **Important** : les données IndexedDB/localStorage de Chrome/PWA ne deviennent PAS automatiquement celles de l'APK Capacitor. Restaurer explicitement les sauvegardes avant de retirer la PWA.

## Procédure de migration, uniquement après ton GO

Dans le dossier local du projet (branche de migration approuvée) :

```powershell
node --version
npm --version
npm run android:check
npm install @capacitor/core@8 @capacitor/android@8 @capacitor/app@8
npm install --save-dev @capacitor/cli@8
npx cap add android
npx cap sync android
npx cap open android
```

Une fois les modules installés, conserver le `package-lock.json`. Vérifier les versions publiées et leur sécurité avant de figer les dépendances. `npx cap add android` crée le répertoire `android/`, qui doit ensuite être versionné **sans** `local.properties`, APK, secrets, clés privées, ou dossiers de build.

L'application ne doit pas solliciter de connexion à `release.json` pour remplacer ses assets natifs. Le projet n'ouvre pas le micro ni la caméra sans action explicite et les permissions doivent être demandées au bon moment.

## Widget Android 1 ligne × 4 colonnes : validé

| Position | Texte | Identifiant | Destination |
|---|---|---|---|
| 1 | Code-barres | barcode | `#codes` |
| 2 | Manquant | missing | `#pending` + formulaire |
| 3 | Produits | products | `#stock` |
| 4 | ENF | enf | `#enfs` |

- Les fichiers `android-widget-template/` contiennent l'implémentation de départ : `PikeoWidgetProvider.kt`, le layout 4 boutons, les métadonnées et le fragment de manifest Android.
- À importer dans le projet Android **après** `npx cap add android`, en conservant l'identifiant de package.
- Ajouter une dépendance `@capacitor/app` correctement synchronisée et vérifier sur appareil physique la livraison des événements `appUrlOpen` et `getLaunchUrl`. Une application froide et une application déjà ouverte doivent ouvrir la même section.
- Les icônes du widget devront reprendre celles validées dans Pikéo. Le layout natif fourni est une ossature de test et ne doit pas être considéré comme rendu graphique final.
- Ne jamais incorporer le nom d'utilisateur, les numéros de téléphone ou des données d'entrepôt dans un widget public.

## Liste de vérification avant premier test

- `npm test` et `npm run check` en vert avant/sans Android ; `npm run android:check` en vert.
- Navigation quatre raccourcis, accès direct `missing`, gestion de la session et rôles opérateurs/admin.
- Numérisation et permissions caméra, chargement des moteurs OCR hors connexion, saisie vocale et dictée.
- Sauvegarde/restauration hors ligne, Google/Supabase, données locales privées et mémos.
- Alertes à 8 minutes : les restrictions Android peuvent empêcher une vibration continue à l'écran éteint. Un service natif et les permissions correspondantes demandent un développement distinct.
- Tester directement sur téléphone, y compris Android verrouillé, reprise à froid, mode avion, application fermée, retour arrière, et mise à jour APK.

## Références officielles

- <https://capacitorjs.com/docs/getting-started>
- <https://capacitorjs.com/docs/getting-started/environment-setup>
- <https://capacitorjs.com/docs/android>
- <https://developer.android.com/develop/ui/views/appwidgets>

Le projet web actuel reste la référence et aucun APK ne doit être publié automatiquement.
