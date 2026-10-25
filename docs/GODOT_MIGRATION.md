# Pikéo : préparer Godot 4, migrer à la toute fin

État : préparation uniquement, aucune application native ni APK livrés. La version web reste utilisée. Attendre la fin des fonctionnalités et l’accord final explicite d’Étienne. À chaque étape fonctionnelle importante, proposer de refaire le point sur la maturité de l’application ; sa réponse décide de la suite. Le volet des Réglages recueille aussi une demande de bilan final, sans autoriser une migration automatique.

## Interfaces à conserver

| Domaine | Contrat existant à reprendre | Adaptateur Godot/Android futur |
| --- | --- | --- |
| Métier | Modules sans DOM `core`, `catalogue-core`, `day-core`, `workflow-core`, `field-core`, `ops-core`, `schedule-core` et jeux d’essai | Porter les règles en GDScript/C# en reproduisant les résultats des tests ; ne pas réinterpréter les règles de picking |
| Fiches et historique | JSON `app: EK Logistique`, `schema: 1`, identifiants et événements inchangés | Importer l’export JSON, vérifier les nombres de fiches/événements, reprendre la même fusion |
| Google | Quatre onglets, douze colonnes historiques, `payload_json.type` fait foi | Adaptateur réseau/OAuth natif à développer ; aucun secret dans le client ni identifiant de feuille dans le dépôt |
| Audio | Base locale indépendante `ek-voice-live`, export `app: PikeoVoice`, `schema: 1` | Importer les fichiers et métadonnées vers `user://memos/` ; exclure le répertoire des sauvegardes cloud Android et du transfert automatique (`allowBackup`/règles d’extraction) |
| Horaires | `Europe/Paris`, six transitions, préavis fixe de huit minutes, jours ISO JS 0–6 (dimanche 0), paramètres et acquittements propres au téléphone | Planificateur Android indépendant de la scène Godot |

Les données web appartiennent au navigateur : l’APK n’y aura pas accès directement. Prévoir avant la bascule deux exports explicites : sauvegarde générale et sauvegarde des mémos. Exporter aussi les horaires locaux (`ek-work-schedule-live`) et la décision de maturité au moment du transfert. Ne jamais supposer qu’installer l’APK transfère IndexedDB. Conserver la version web et les exports jusqu’à vérification des données restaurées. Comparer les ID d’événements et les empreintes binaires des audios, pas seulement leurs noms.

## Alarmes Android à réaliser lors de la migration

Le navigateur ne constitue pas un service d’alarmes : ses minuteries et vibrations sont suspendues en arrière-plan. La version 1.8 affiche une alerte et relance la vibration tant que la page est visible, conserve l’acquittement et propose des notifications système si elles sont autorisées. Elle ne promet pas d’alerte à écran verrouillé ou application fermée.

Pour Godot 4.2+, prévoir un plugin Android v2 en Kotlin/Java avec Gradle. Interface proposée :

```text
capabilities() -> notificationsGranted, exactAlarmsGranted, vibratorAvailable
replaceSchedule(scheduleJson) -> scheduledOccurrenceIds
cancelSchedule() -> void
acknowledge(occurrenceIds) -> void
exportLocalAudio(memoId) -> Android share sheet
```

Programmer les occurrences avec `AlarmManager`/`PendingIntent` vers un `BroadcastReceiver`, plutôt qu’un Timer Godot, pour survivre à la fermeture de l’interface et au sommeil du téléphone. Vérifier l’autorisation Android de notifications et celle d’alarmes exactes quand applicable ; ne pas annoncer une précision de huit minutes si le système les refuse. Calculer et reprogrammer les prochaines occurrences en heure de Paris après redémarrage, changement d’heure/fuseau, modification des jours, changement d’autorisation et mise à jour.

L’alarme doit disposer d’un état durable, d’une notification avec action « Arrêter », et d’un mécanisme Android de vibration répétée explicitement annulable. Évaluer les restrictions de service au premier plan et les permissions correspondant au SDK retenu. Arrêt depuis la notification et depuis Godot : annuler la vibration, fermer la notification, acquitter la même occurrence, ne pas désactiver la journée entière. Tester aussi l’économie de batterie, le mode silencieux/ne pas déranger et un redémarrage. Ne pas affirmer pouvoir contourner les choix système. Revalider ces exigences dans la documentation Android à la date de migration.

## Ordre de bascule après accord

1. Geler et valider les parcours terminés avec Étienne ; établir les tests d’acceptation sur son téléphone.
2. Créer le projet Godot et les adaptateurs Android, sans réécrire simultanément les règles métier.
3. Restaurer un jeu de données exporté, comparer les événements et audios, tester hors ligne puis la même base Google.
4. Valider les six alarmes, l’arrêt persistant et les scénarios de fermeture/redémarrage sur Android physique.
5. Livrer un APK test ; conserver un retour à la version web et aux copies exportées.

Références officielles à revalider :
- https://docs.godotengine.org/en/stable/tutorials/platform/android/android_plugin.html
- https://developer.android.com/develop/background-work/services/alarms
- https://www.w3.org/TR/vibration/
