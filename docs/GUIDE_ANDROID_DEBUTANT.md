# Pikéo : préparer une application Android (guide débutant)

Date : 27 octobre 2026. La migration n'est PAS lancée.

## Choix
Conserver le site web Pikéo, puis utiliser Capacitor pour l'emballer en application Android. Ne pas reconstruire dans Godot.

## Logiciels Windows
1. Node.js compatible avec la version de Capacitor choisie : https://nodejs.org/
2. Android Studio : https://developer.android.com/studio
3. Android SDK depuis le gestionnaire SDK d'Android Studio.
4. Git (optionnel si téléchargement ZIP) : https://git-scm.com/downloads
Android Studio fournit normalement le JDK adéquat.

## Avant les changements
- Sauvegarder le dépôt GitHub et les données Supabase/Google Sheets et locales du téléphone.
- Ne jamais partager les secrets dans un dépôt GitHub.
- Vérifier ENF, scanner, saisie vocale, photo OCR, manquants, réassorts, comptes et notifications.
- Valider logo, écran d'accueil et quatre raccourcis du widget.
- Tester l'app web avant la création Android.

## Installation sur PC
1. Installer Node.js et vérifier dans cmd : `node --version` et `npm --version`.
2. Installer Android Studio, démarrer l'assistant, accepter le SDK proposé.
3. Dans Android Studio : SDK Manager, vérifier SDK Platforms et SDK Tools.
4. Sur Samsung : activer Options développeur (tapoter 7 fois « Numéro de version »), puis Débogage USB pour les tests uniquement.
5. Connecter par USB et autoriser le débogage sur le téléphone.

## Le jour du GO
1. Vérifier la structure du dépôt. Il faut un répertoire d'actifs web (ex. www ou dist) contenant index.html.
2. Installer et configurer Capacitor, les dépendances Android, puis générer le projet natif.
3. Synchroniser les fichiers web et ouvrir Android Studio.
4. Tester les permissions caméra, fichiers, notifications, sécurité des sessions et deep links.
5. Programmer le vrai widget Android 1 x 4 (code-barres, manquant, produits, ENF).
6. Générer un APK de test, installer sur le téléphone et tester ; ne pas publier avant validation.

## Vigilances
Les notifications vibrantes persistantes sont limitées par Android ; ne pas promettre une vibration sans fin. L'OCR des photos exige une étape de correction avant import et des alertes d'anomalies. Un raccourci PWA n'est pas un véritable widget natif.

Sources officielles :
- https://capacitorjs.com/docs/getting-started
- https://capacitorjs.com/docs/getting-started/environment-setup

Un PDF lisible a aussi été remis dans la conversation du 27 octobre 2026. Contrôler les prérequis lors de la migration, car les versions évoluent.
