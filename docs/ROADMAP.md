# Feuille de route — La caverne d'Alibaab

## Version 1.3.0 — améliorations intégrées
- QR dédié à chaque sac/kit et contrôle détaillé des éléments qui le composent.
- Scan unitaire des QR matériels dans un contrôle de kit, avec compteur par ligne et réglage manuel + / −.
- Modes du contrôle de kit : inspection, départ et retour.
- Quantités de stock séparées des quantités sorties, avec prise en charge des anciennes fiches sans migration destructive.
- Départs limités aux quantités disponibles ; retours partiels suivis dans l'inventaire et l'historique.
- Création et modification des kits ; agrégation des références dupliquées.
- Scénarios de tournage reliés directement aux fiches d'inventaire et action de préparation.
- Bouton de création de location visible ; suivi des quantités prévues, sorties et rendues, et repérage des locations en retard.
- Déverrouillage audio au toucher du bouton caméra pour fiabiliser le bip sur les navigateurs mobiles.
- Cache PWA renouvelé pour distribuer la nouvelle version.

## Limites connues
- La vibration dépend de la prise en charge de `navigator.vibrate` par le navigateur et le système. Certains navigateurs iOS ne permettent pas de déclencher la vibration depuis une PWA ; le bip sonore reste indépendant.
- Le contrôle détaillé scanne les QR individuels des équipements : un QR de kit ouvre sa composition, il ne remplace pas les QR des objets contenus.
- La synchronisation Supabase reste périodique et utilise la dernière version horodatée ; sauvegarde JSON recommandée avant les modifications importantes sur plusieurs appareils.
- L'OCR lit les caractères d'une plaque, mais ne garantit pas l'identification visuelle automatique d'un appareil.
- Le suivi individuel de chaque exemplaire par numéro de série, les signatures électroniques et la gestion avancée des états physiques avant/après sont des évolutions distinctes.
