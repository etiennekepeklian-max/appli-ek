# Musique du téléphone — préparation du 29 octobre 2026

## État réel

Le bouton et son panneau sont codés pour les entrées mobile et bureau de Pikéo.
Le web explique son indisponibilité pour les lecteurs externes. Il ne met pas en
pause YouTube Music, le lecteur natif, Spotify ou YouTube.

Les fichiers de native-preparation/media-control sont un relais Android de référence,
hors du site publié. Ils ne constituent pas une application Android : aucun projet
Android n'est créé, aucune dépendance Capacitor n'est installée, aucun APK n'est
compilé et aucune autorisation du téléphone n'est demandée. Leur compilation et
leur fonctionnement sur un appareil physique restent à vérifier lors de la migration.

YouTube Music et le lecteur natif du téléphone d'Étienne sont les premiers essais
à effectuer. Le mécanisme couvre les applications qui exposent une session et les
actions correspondantes ; il ne garantit pas le contrôle de toutes les sources.
Il ne contourne pas les restrictions d'abonnement ou de lecture en arrière-plan.
Le bouton concerne l'intérieur de Pikéo, pas une bulle au-dessus des autres apps.

## Interface préparée

- Un bouton flottant persiste pendant la navigation et rejoint l'en-tête d'une
  fenêtre ouverte. Le panneau utilise une fenêtre séparée pour préserver le formulaire.
- Une commande native disponible demande un seul appui : Pause ou Lecture selon
  l'état réel. Les trois points permettent de choisir entre plusieurs lecteurs.
- L'absence de permission, l'absence de source et une erreur restent explicites.
- La commande désigne une session précise et son état attendu ; elle ne retombe
  jamais sur un autre lecteur si la source disparaît entre l'affichage et l'appui.
- La confirmation d'envoi ne transforme pas artificiellement l'état de lecture.

## Relais Android préparé

Le cœur Java utilise MediaSessionManager.getActiveSessions avec le composant d'un
NotificationListenerService autorisé, puis MediaController.TransportControls.
Les lecteurs ne sont pas limités à une liste de marques. Les propres sessions de
Pikéo sont exclues pour préserver la séparation des mémos vocaux.

Le service n'analyse pas le contenu des notifications. L'autorisation spéciale
Android reste toutefois plus large que les seules commandes multimédias ; cette
portée doit être expliquée avant l'ouverture volontaire des réglages système.
Ce n'est pas la permission ordinaire d'afficher des notifications. La permission
système MEDIA_CONTENT_CONTROL n'est pas demandée comme une permission utilisateur.

Le cœur conserve seulement en mémoire les sessions, le nom du lecteur, son état
et les commandes disponibles. Il ne lit aucun fichier audio, ne capture pas de son,
ne sauvegarde pas de titre et n'écrit dans aucun stockage métier, Google ou journal.
Un refus d'accès laisse les fonctions logistiques utilisables.

## Contrat version 1

Le pont nommé PikeoMedia fournit :

- getState() : schema = 1, platform = android, supported, permission
  (granted ou required), sessions (id, label, status, canPlay, canPause).
- command({sessionId, action, expectedStatus}) : accepted, sans prétendre que
  le lecteur a déjà changé d'état. action vaut play ou pause.
- openAccessSettings() : opened, qui signifie réglages ouverts, pas accès accordé.
- addListener('stateChanged', callback) : abonnement retirable ; le client relit l'état.

Les identifiants de session sont éphémères. Aucun choix de lecteur n'est synchronisé.
Le web n'utilise pas navigator.mediaSession pour prétendre commander d'autres apps :
cette API décrit et reçoit les commandes des médias du document web lui-même.

## Branchement après l'accord de migration uniquement

1. Revalider les versions stables de Capacitor et du SDK, et le guide Android existant.
   La préparation de l'environnement PC peut être faite avant cet accord.
2. Après l'accord explicite, ajouter le projet Android Capacitor en conservant les
   données web et les exports séparés des mémos. Installer un APK ne transfère pas IndexedDB.
3. Copier les trois fichiers Java vers le package com.pikeo.preparation.media
   du projet Android ; ajouter le service du fragment de manifeste dans application.
4. Enregistrer PikeoMediaPlugin dans MainActivity avec registerPlugin, selon la
   documentation de la version de Capacitor retenue. Vérifier le cycle de vie.
5. Charger le module register-capacitor.js par le bundler avant l'entrée web de Pikéo.
   Il initialise PikeoMediaBridge ; le web reste sans pont. Vérifier que l'enregistrement
   natif est reconnu avant d'initialiser l'interface.
6. Compiler avec le vrai SDK, corriger toute incompatibilité et exécuter les essais
   ci-dessous sur le téléphone. Aucun de ces essais n'est actuellement validé.

Le cœur Java est indépendant de Capacitor. Une décision ultérieure pour Godot
nécessiterait une autre façade ; elle ne découle pas de cette préparation.

## Vérifications physiques indispensables

| Cas | Résultat attendu |
| --- | --- |
| YouTube Music, puis lecteur natif | Pause/reprise et icône conformes à l'état réel |
| Lecteur fermé ou aucune session | Explication, aucune commande à une autre app |
| Deux lecteurs présents | Choix de source, commande ciblée |
| Source changée pendant l'appui | Refus explicite et état actualisé |
| Permission refusée puis retirée | Commandes indisponibles, logistique intacte |
| Retour des réglages Android | Relecture réelle de l'autorisation |
| Appel, casque, écran verrouillé, Bluetooth | Respect des interruptions et restrictions |
| Application sans commande Android | Indisponibilité explicite |
| Mémos vocaux et export Google | Aucun son ni historique musical ajouté |
| Téléphone plié/déplié et clavier affiché | Bouton accessible, champs utilisables |

## Temps et participation d'Étienne

Ordres de grandeur de planification, pas des durées garanties : une demi-journée
à une journée pour un premier APK accompagné si les outils doivent être installés ;
environ trois à sept jours de travail et d'essais pour une version complète avec
musique, alarmes et transfert fiable des données. La qualité des installations,
le téléchargement des SDK et les écarts entre appareils peuvent modifier ces durées.
Il s'agit du chantier total, pas du temps d'Étienne devant l'écran.

Préparer les sources, les contrats, les tests et les contrôles de compatibilité est
automatisable. Avec un contrôle du PC réellement disponible et autorisé, installer
les outils et effectuer les builds peut aussi être pris en charge. Étienne garde
les décisions, les autorisations personnelles sur son téléphone et quelques essais
réels. Ne pas annoncer une installation, une compilation ou une migration non effectuée.

Lors de sa prochaine session PC signalée, proposer d'abord la préparation de
l'environnement. Si sa présence sur PC est inconnue quand cela devient utile, lui
demander simplement. Aucun déclencheur automatique de connexion n'est demandé.

## Références officielles consultées

- https://developer.android.com/reference/android/media/session/MediaSessionManager
- https://developer.android.com/reference/android/media/session/MediaController.TransportControls
- https://developer.android.com/reference/android/media/session/PlaybackState
- https://developer.android.com/reference/android/service/notification/NotificationListenerService
- https://capacitorjs.com/docs/plugins/android
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://www.w3.org/TR/mediasession/
