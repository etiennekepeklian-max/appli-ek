# Pikéo : sécurité des administrateurs, plan de déploiement (hors Android)

**État : développement sur branche isolée, non activé en production.**
Ne pas fusionner ce dossier directement dans `main` sans réconciliation avec la dernière version publiée.

## Principes de sécurité

- Chaque appareil possède déjà une clé de signature propre ; le PIN **à quatre chiffres** est un deuxième facteur, jamais un substitut à l'appareil autorisé.
- Le PIN est traité uniquement par l'API signée. Il est haché avec PBKDF2-HMAC-SHA256, sel aléatoire et un secret de 256 bits conservé **sur le serveur uniquement** (`PIKEO_PIN_PEPPER`).
- Le navigateur ne conserve ni PIN, ni empreinte, ni secret du propriétaire dans les données métier ou Google Sheets.
- Après cinq erreurs : verrouillage progressif, comptabilisé par le serveur et non effacé par une réponse HTTP d'erreur. Déverrouillage administratif limité à dix minutes.
- Un administrateur déverrouillé peut demander la réinitialisation du PIN **d'un autre compte administrateur** (un second appareil du même compte est refusé). Le propriétaire peut récupérer son propre PIN avec son **fichier privé d'accès propriétaire**, pas avec son nom.
- Une modification des droits, une suspension ou une réactivation invalide le déverrouillage des appareils concernés, sans supprimer leur empreinte PIN ni les données.
- Les opérations de gestion de comptes, de droits et de configuration administrateur doivent être refusées côté serveur lorsque le PIN est verrouillé.
- Il ne doit pas être possible de supprimer une identité ou de transférer des données privées à cause d'une réinitialisation de PIN.

## Prérequis d'activation

1. Vérifier une copie de récupération des données locales **de chaque appareil** et une sauvegarde de la base Supabase. Ne jamais effacer le stockage navigateur pendant les tests.
2. Réconcilier le code administrateur actuellement basé sur la branche bureau 1.18.0 avec la version principale actuelle, **sans écraser les changements 1.17.3–1.17.9**.
3. Exécuter toutes les suites de tests, dont ENF, OCR catalogue, suppression des manquants, raccourci d'accueil, sessions, stockage et bureau.
4. Générer un secret aléatoire serveur de 32 octets minimum et le configurer dans Supabase comme `PIKEO_PIN_PEPPER`. **Ne jamais placer ce secret dans GitHub ou dans une conversation.**
5. Appliquer la migration SQL **additive** `backend/admin-pin-schema.sql`, sans supprimer aucune table existante. Contrôler RLS et les rôles de la connexion d'API.
6. Préparer et tester l'Edge Function en environnement isolé avant de remplacer le service de production ; vérifier que les droits déjà accordés restent intacts.
7. Tester avec **deux comptes administrateurs de démonstration distincts**, y compris l'absence de PIN, le changement de rôle, les PIN erronés, la limite de tentatives, la réinitialisation par un autre administrateur et la récupération du propriétaire.
8. Sur un appareil propriétaire réel, créer personnellement le nouveau code dans Pikéo, en présence du fichier privé du propriétaire. **Ne pas communiquer le PIN à ChatGPT.**
9. Publier seulement après tests et vérification de retour arrière possible.

## Retour arrière

- Ne jamais supprimer les tables `profiles`, `devices`, `shared_config` ni les données métier.
- En cas de problème, restaurer le déploiement précédent de l'Edge Function et de l'application web ; conserver la table additive `admin_pins` intacte pour analyse.
- Réparer l'accès propriétaire avec son fichier de récupération plutôt qu'avec une réinitialisation des utilisateurs.

## Hors périmètre pour le moment

Migration Capacitor/Android, génération d'un APK et widget Android natif : reportés par demande de l'utilisateur.

## Contrat automatisé sur base isolée

Le job `security-db` exécute le véritable gestionnaire signé de `index.ts` avec PostgreSQL 17 local, le schéma de référence et la migration PIN additive. Les seules substitutions concernent le transport Deno/Postgres et les secrets synthétiques du test. Il vérifie les transactions, les échecs persistants, les accès concurrents, les versions périmées, les habilitations, la récupération et les refus RLS. Le script refuse une adresse distante et un nom de base autre que `pikeo_pin_test`. Aucun compte réel n’est nécessaire.

Ces essais complètent les parcours navigateur et ne configurent ni le secret serveur de production ni le code personnel du propriétaire.
