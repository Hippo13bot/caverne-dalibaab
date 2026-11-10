## 1.9.0 — QR objet + QR anti-perte

- Mise en page des étiquettes : QR à gauche, texte à droite. Étiquette 1 = gros QR + nom de l'objet, plus le hashtag de l'exemplaire seulement s'il y a plusieurs quantités. Étiquette 2 = QR anti-perte (correction d'erreur L, moins dense) + nom, référence et bandeau « SCANNEZ SI PERDU ». Taille de police ajustée automatiquement. L'impression via fenêtre utilise exactement le même rendu que l'imprimante.
- QR anti-perte plus facile à lire : adresse courte `c.html?CODE` (nouvelle page `src/c.html`, redirige vers `contact.html`), correction d'erreur L, et modules de 3 points au lieu de 2 quand l'URL fait 53 caractères ou moins (QR ≈ 32 % plus grand). Les anciens liens `contact.html?i=` et `?id=` continuent de fonctionner.
- Bouton « Copier public-config.js » dans la fenêtre Étiquettes ; message explicite si les QR courts ne sont pas encore activés.
- Plus de code-barres : l'étiquette 1 est un seul gros QR noir sur fond blanc, sans texte, qui encode une référence courte `CA-XXXXXXXX` (11 caractères → QR version 1, 21 × 21 modules, module de 4 points sur la tête native 96 points).
- Étiquette 2 inchangée dans son principe : QR anti-perte vers la page publique commune `contact.html?i=XXXXXXXX`, nom de l'objet (jamais la marque), référence courte et « SCANNEZ SI PERDU ».
- Impression directe FICHERO en paire : QR objet puis QR anti-perte, en une seule action, raster natif 96 × 240 points sans interpolation. Un QR trop dense est refusé plutôt qu'imprimé illisible.
- Scanner : lit `CA-XXXXXXXX`, les QR anti-perte, les anciens QR et, pour compatibilité, EAN-13 et Code 128. Zone de lecture caméra désormais carrée.
- Migration additive : aucune donnée supprimée. Les EAN-13 déjà attribués (`unit.ean13`), les Code 128 (`unit.barcode`), les anciens tags, UUID et liens `contact.html?id=...` restent reconnus. Aucun nouvel EAN-13 n'est généré.
- Nouveau fichier `src/label-codes.js` ; `src/ean13.js` retiré (plus utilisé). Nouveau test `tests/object-qr.test.js`.
- Migration Supabase additive : `docs/ETIQUETTES-QR.sql` (la colonne `ean13` reste facultative).

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
