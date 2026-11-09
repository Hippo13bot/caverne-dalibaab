## 1.8.3
- Code-barres raccourci à la référence unique de l’exemplaire, centré et rendu sans étirement.
- Conservation de l’ancien code-barres comme alias de scan pour compatibilité avec les étiquettes déjà imprimées.
- Seconde étiquette simplifiée : nom de l’objet et référence uniquement, sans marque ni modèle.
- QR agrandi autant que possible sur le format 30 × 14 mm.

# Changelog

## 1.7.0 — Scanner renforcé et rouleaux 30 × 14 mm
- Scanner caméra optimisé : cadence augmentée, zone de lecture plus large et autofocus haute résolution demandé au navigateur.
- Retour visuel grand format vert/rouge, bip et vibration lorsque le matériel est reconnu.
- Fenêtre anti-doublon réduite pour accélérer les inventaires en série.
- Compatibilité documentée avec les lecteurs USB, Bluetooth et Wi-Fi qui émulent un clavier HID et envoient Entrée.
- Impression thermique au format personnalisé 30 × 14 mm, une étiquette par page/avance, pour codes-barres Code 128.
- Ajout de l'impression QR anti-perte pour les unités sélectionnées : publication sécurisée dans la table publique existante, coordonnées uniquement si elles sont autorisées dans la fiche propriétaire.
- Conservation des anciens identifiants, QR codes, données locales et synchronisation Supabase.


## 1.6.0 — Identification Code 128
- Remplacement des nouvelles étiquettes matériel par des codes-barres Code 128, un identifiant par exemplaire.
- Ajout de codes-barres dédiés aux sacs/kits et aux scénarios de tournage.
- Impression locale de planches A4 en trois formats, sans publication web ni connexion Supabase.
- Scanner caméra compatible Code 128 et QR historiques.
- Prise en charge des lecteurs USB/Bluetooth en mode clavier avec suffixe Entrée.
- Recherche dans l'inventaire par hashtag ou identifiant Code 128.
- Export CSV enrichi avec les codes-barres et hashtags de chaque exemplaire.
- Migration additive des données existantes ; les QR et les liens de contact historiques restent reconnus.

## 1.5.2
- Correction de la reconnaissance des étiquettes QR publiques.

## 1.8.0 — Impression Bluetooth FICHERO
- Ajout d’un pilote BLE intégré pour les imprimantes FICHERO D11s / AiYin D11s.
- Connexion depuis la fenêtre d’étiquettes et impression directe des codes-barres sans passer par l’application mobile ni la boîte de dialogue système.
- Rendu monochrome natif 96 × 240 pixels et envoi du protocole AiYin documenté.
- Conservation de l’impression système comme solution de secours.
- La compatibilité matérielle doit être confirmée par un premier test sur l’imprimante réelle.


## 1.8.1 — Étiquettes paysage et code-barres agrandi
- Impression Bluetooth FICHERO en orientation paysage 30 × 14 mm (240 × 112 pixels à 203 DPI).
- Code 128 agrandi sur presque toute la surface utile, avec marges de silence et contraste renforcé pour faciliter la lecture au téléphone.
- Impression classique mise au même format paysage.

## 1.8.2
- Correction de l’orientation FICHERO D11s : composition paysage 240 × 96 pivotée vers le raster natif 96 × 240 points.
- Impression enchaînée de deux étiquettes par exemplaire : Code 128, puis QR anti-perte avec nom, modèle et référence.
- Publication Supabase des fiches publiques avant impression des paires.
- Progression d’impression comptée par étiquette physique.
