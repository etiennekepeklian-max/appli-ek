# Sécurité des administrateurs Pikéo : préparation contrôlée

**Statut au 28 octobre 2026 : code préparé sur une branche, non activé en production.**
La version publique de Pikéo reste accessible avec son authentification actuelle. N'utiliser aucun code fictif et ne jamais partager un PIN ou le fichier propriétaire dans une conversation, un commit ou une capture d'écran.

## Protection mise en place dans le code

- Code de **4 chiffres exactement**, seconde confirmation après l'authentification **par signature cryptographique de l'appareil**.
- Empreinte PBKDF2-HMAC-SHA256 avec sel aléatoire, 310 000 itérations et un secret du serveur **PIKEO_PIN_PEPPER** de 32 octets minimum. Ni le PIN, ni le secret ne sont écrits dans GitHub ou Google Sheets.
- Vérification côté serveur, invalidation et comptage persisté après chaque échec ; verrouillage à partir de cinq mauvaises tentatives, délai progressif maximal 24 h.
- Déverrouillage des actions administrateur pour **10 minutes**, lié à l'appareil enregistré ; verrouillage immédiat sur demande.
- Routes signées **admin-pin-status, admin-pin-enroll, admin-pin-unlock, admin-pin-lock, admin-pin-peers, admin-pin-reset, admin-pin-recover**.
- Protection serveur des opérations sur les comptes, habilitations et appareils, **ainsi que de la publication de la configuration partagée** lorsqu'elle est réalisée par un administrateur.
- Réinitialisation du code d'un *autre compte* administrateur (jamais entre deux appareils du même compte) depuis une session administrateur déverrouillée ; récupération propriétaire par le fichier privé original, contrôlé sur le serveur.
- Interface de saisie, confirmation, verrouillage, récupération et réinitialisation développée pour l'écran d'administration ; saisie masquée et aucun PIN conservé en local.
- Une modification des habilitations ou une suspension/réactivation retire le déverrouillage existant sans effacer les empreintes PIN. Les réponses tardives de l’interface ne sont pas reprises dans une autre session.
- Migration **additive** `backend/admin-pin-schema.sql` : nouvelle table privée, aucune suppression des fiches métier existantes.

## Conditions impératives AVANT mise en service

1. Sauvegarder et vérifier la restauration de la base Supabase et du dépôt GitHub. Contrôler la non-régression des données locales et des identités existantes sur ordinateur et téléphone.
2. Configurer **PIKEO_PIN_PEPPER** uniquement dans les *secrets* de la fonction Edge Supabase. Générer au moins 32 octets aléatoires avec un générateur cryptographique. Ne pas inscrire la valeur dans les fichiers, tickets, journaux ou messages.
3. Vérifier et appliquer la migration additive `backend/admin-pin-schema.sql` à l'aide des migrations contrôlées Supabase. Ne pas modifier directement les comptes ou leurs droits par une migration destructive.
4. Vérifier la fonction Edge avec toutes ses dépendances ; mettre en place le contrôle de débit de bout en bout, signer chaque action, tester les erreurs 401, 403, 423 et 429 et garantir que les erreurs PIN enregistrent réellement les compteurs d'échec.
5. Tester sur **deux appareils administrateurs distincts** : création, erreurs successives, verrouillage, expiration, renouvellement, récupération avec fichier propriétaire, réinitialisation par un autre administrateur, retrait de rôle et réinitialisation de mot de passe/code.
6. **Réconcilier la branche sécurité avec la version web publiée**, comprenant les messages, suppressions de manquants, OCR, ENF et bureau. Exécuter tous les tests CI et un essai réel avant tout déploiement.
7. Demander à l'utilisateur de **choisir lui-même son PIN dans l'interface protégée**, jamais dans le chat. Déployer seulement une fois qu'un propriétaire peut récupérer son accès en cas d'erreur.

## Règle de mise en production

Ne pas fusionner cette branche vers `main`, ni remplacer la fonction Edge de production, **avant** que ces sept étapes soient validées. Un service PIN déployé sans secret, base ou récupération opérationnelle risquerait de bloquer les opérations de l'administrateur. Aucun APK ni travail de migration Android ne fait partie de ce chantier.
