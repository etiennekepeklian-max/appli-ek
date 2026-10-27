# Modèle Android du widget Pikéo, approuvé 1 × 4

**Ne pas copier ce dossier directement dans la PWA** : il s'agit de sources natifs à placer après la génération du projet Android.

1. `npx cap add android` crée `android/`.
2. Copier `PikeoWidgetProvider.kt` dans `android/app/src/main/java/io/github/etiennekepeklianmax/pikeo/`.
3. Copier `pikeo_widget.xml` dans `android/app/src/main/res/layout/`.
4. Copier `pikeo_widget_info.xml` dans `android/app/src/main/res/xml/`.
5. Intégrer le fragment `AndroidManifest-fragment.xml` aux éléments existants. Il ne doit pas remplacer le manifeste complet.
6. Installer `@capacitor/app`, synchroniser les plugins et tester les liens `pikeo://shortcut/{barcode,missing,products,enf}` avec l'application fermée et déjà ouverte.
7. Remplacer les icônes système de ce modèle par les quatre icônes approuvées avant publication.

**Statut** : code source préparatoire, **pas encore compilé**, pas installé ni vérifié sur appareil physique. Les quatre destinations sont définies dans `site/js/android-shortcuts-core.js`.
