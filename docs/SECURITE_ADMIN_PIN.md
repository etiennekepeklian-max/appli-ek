# Sécurité PIN administrateur, chantier en cours

**Ne pas publier comme terminé.** Ceci est une préparation non déployée. La production Pikéo conserve ses authentifications de session actuelles.

## Principe

Un PIN de quatre chiffres n'est jamais une preuve d'identité suffisante : 10 000 combinaisons seulement. Il doit constituer une confirmation complémentaire *après* la signature cryptographique de l'appareil enregistré. Il est vérifié par le serveur, jamais dans le JavaScript du navigateur.

- Empreinte PBKDF2-HMAC-SHA256 avec sel aléatoire 128 bits, 310 000 itérations et secret serveur indépendant d'au moins 256 bits. Aucun PIN, sel/empreinte ou secret serveur dans le dépôt public.
- Verrouillage après cinq erreurs, délais progressifs plafonnés à 24 heures, limitation par appareil ET par IP / compte; journaux sans PIN en clair.
- Une session de déverrouillage administrative doit être brève, associée au périphérique signé, révoquée en cas de retrait d'un rôle.
- En cas d'oubli, un autre administrateur authentifié peut imposer la réinitialisation. Le propriétaire doit disposer d'une récupération par son fichier d'accès privé fort et d'une procédure de secours testée.
- Ne jamais désactiver l'accès propriétaire existant sans avoir vérifié et testé un nouveau code, le verrouillage et la récupération sur deux appareils.
- Migration SQL additive dans `backend/admin-pin-schema.sql` ; aucune ligne de données métier n'est effacée.

## Ce qu'il reste à implémenter avant activation

1. Routes signées `pin-enroll`, `pin-unlock`, `pin-lock`, `pin-reset` et `pin-status` dans le service Edge, avec débit limité **hors transaction révoquée lors d'une erreur**.
2. Déclenchement du contrôle PIN avant chaque mutation de comptes, droits ou paramètres administrateurs, avec prévention des sessions périmées.
3. Interface bureau/téléphone : définir un PIN, déverrouiller, changer, récupération, et vérification des droits serveur.
4. Secrets sécurisés Supabase et tests de bout en bout (échecs, course concurrente, deux appareils, perte de code, suspension du compte).
5. Revue de sécurité, sauvegarde préalable et activation explicite. Ne jamais utiliser un code PIN choisi à la place de l'utilisateur.

## Limites de la préparation

Le module `backend/pikeo-api/pin-core.mjs` fournit la validation, la dérivation et la règle de verrouillage testées. Il n'est pas encore branché à l'API publiée, à la base de données, ou à l'interface.
