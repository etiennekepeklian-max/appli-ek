# Migration autorisée — 17 novembre 2026

Le GO d’Étienne remplace le report décrit dans GODOT_MIGRATION.md. Capacitor est retenu ; les règles métier et les quatre onglets Google restent inchangés. Chaque appareil Android utilise une clé non exportable et doit être autorisé par Étienne. Le web conserve seulement l’accès propriétaire et l’export de transition des données locales. Les nouveaux modules de pilotage sont privés, hors sauvegardes Google et exports terrain. Les fichiers audio gardent leur export explicite séparé.

Avant bascule : conserver les exports, vérifier la restauration dans l’APK, préserver la signature et contrôler les notifications sur téléphone. Les tests automatiques ne constituent pas un essai physique.
