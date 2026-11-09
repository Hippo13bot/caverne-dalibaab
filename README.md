# La caverne d'Alibaab

Inventaire de matériel audiovisuel, photo, son, informatique et accessoires. Un seul code pour l'application Mac/Windows et la PWA iPhone/iPad.

## Fonctionnalités
- Étiquettes d’exemplaires : gros QR d’identification (CA-XXXXXXXX) et QR anti-perte à référence courte ; impression en paire sur FICHERO D11s.
- Scanner caméra compatible QR, avec lecture conservée des EAN-13 et Code 128 historiques. Les anciens codes et liens publics restent reconnus.
- Inventaire avec fiches, photos, catégories, numéros de série, quantités, statuts, garanties, emplacement et notes.
- Sacs et kits avec code-barres Code 128 dédié, contrôle détaillé ligne par ligne, quantités par équipement et fiche PDF par contenant.
- Scanner avec confirmation sonore (après activation par le bouton caméra), vibration si le navigateur et le téléphone la prennent en charge, anti-double-scan et compteur par unité.
- Références publiques courtes uniques par exemplaire ; Code 128 conservés pour les kits/scénarios et compatibilité avec les anciennes étiquettes.
- Scanners caméra ou lecteur USB/Bluetooth en mode clavier, avec trois modes : **SCAN**, **DÉPART** et **RETOUR**. Les QR fabricant / garantie peuvent être associés aux fiches et réutilisés.
- Départs validés par scan, changement d'état des équipements, historique des mouvements et bordereau PDF avec coordonnées du bénéficiaire et dates.
- Locations avec client, prénom, contact, dates, matériel sélectionné, quantités sorties et retours partiels suivis.
- Scénarios de tournage avec besoins associés à l’inventaire, quantités et action de préparation directe.
- OCR de plaque signalétique pour proposer marque, modèle et numéro de série (connexion internet requise ; vérification humaine nécessaire).
- Export CSV, sauvegarde/restauration JSON, fiches PDF individuelles et inventaire.
- Propriétaires multiples avec association à chaque exemplaire physique ; références courtes distinctes pour chaque unité, même lorsque plusieurs objets partagent la même référence.
- Impression locale de planches A4 Code 128 à la sélection, en formats 35 × 18 mm, 45 × 22 mm et 55 × 25 mm ; aucun compte ou appel Supabase requis pour imprimer.
- Les références courtes sont stockées dans les données de chaque exemplaire. La table publique nécessite la migration additive `docs/ETIQUETTES-QR.sql` pour les références QR courtes ; les anciennes fiches QR restent compatibles.
- Stockage local IndexedDB pour rester utilisable hors ligne.
- Synchronisation périodique Mac ↔ iPhone via Supabase, avec compte utilisateur et règles RLS.
- Portail web public de demandes de prêt pour clients et collègues : dépôt sans compte avec lien privé de suivi, ou création de compte et historique personnel.
- Validation manuelle dans l’application : accepter (création d’un prêt), refuser ou proposer des modifications. Le portail ne peut jamais confirmer seul une réservation ni modifier l’inventaire.
- Catalogue public limité aux noms, catégories, modèles, quantités disponibles et compositions des kits ; aucune donnée privée de l’inventaire n’est exposée.
- Configuration du portail : exécuter `docs/PORTAIL-DEMANDES.sql` après `docs/SUPABASE.sql`, publier le catalogue depuis l’onglet « Demandes en ligne », puis renseigner l’URL GitHub Pages et partager le lien généré.

## Attribution
- This product includes software developed by Tyler C. Sarna (Code 128 symbol-pattern table).

## Identité
- Mascotte GIF animée dans l'application.
- Icônes fixes adaptées à l'écran d'accueil et au Dock.

## Publier la version iPhone (GitHub Pages)
1. Pousse le dépôt sur la branche `main`.
2. Dans GitHub, **Settings ▸ Pages**, choisis **GitHub Actions**.
3. Le workflow `.github/workflows/pages.yml` publie le dossier `src/`.
4. Sur iPhone, ouvre l'adresse publiée dans Safari puis **Partager ▸ Sur l'écran d'accueil**.
5. Autorise l'accès à la caméra pour utiliser les scanners.

## Compiler Mac et Windows avec GitHub Actions
1. Pousse le dépôt sur GitHub.
2. Dans **Actions**, lance « Compiler l'app Mac et Windows » ou crée un tag de version :
   ```bash
   git tag v1.6.0
   git push origin v1.6.0
   ```
3. Télécharge les installateurs dans les artefacts du workflow ou dans la Release.

Fichiers produits : DMG Mac (Apple Silicon et Intel) et installateur Windows.

## Avertissements au premier lancement
- **Mac** : clic droit ▸ Ouvrir. Si macOS déclare l'application endommagée : `xattr -cr "/Applications/La caverne d'Alibaab.app"` dans Terminal.
- **Windows** : SmartScreen peut afficher un avertissement pour une application non signée.

## Développer en local
Prérequis : Node.js 20+.
```bash
npm install
npm start
```

Pour tester la PWA localement :
```bash
cd src && python3 -m http.server 8000
```
Puis ouvre `http://localhost:8000`. La caméra et le service worker nécessitent un contexte sécurisé (HTTPS ou localhost).

## Limites et précautions
- La synchronisation nécessite un projet Supabase, un compte commun aux appareils et la configuration initiale. Elle se fait à l'ouverture/reprise et environ toutes les minutes, pas instantanément.
- En cas de modifications simultanées hors ligne, la dernière version horodatée remplace l'autre. Effectue des sauvegardes JSON régulières.
- Ne mets jamais la clé `service_role` dans l'application ; utilise uniquement la clé publique. Les données synchronisées contiennent potentiellement des coordonnées de clients : protège l'accès à ton compte.
- L'OCR lit les inscriptions d'une plaque, mais ne garantit pas l'identification visuelle automatique d'un appareil.


### Version 1.9.0 — QR objet + QR anti-perte
- Étiquette 1 : gros QR d’identification `CA-XXXXXXXX` (version 1) ; plus de code-barres. Migration additive.
- QR public compact résolu par une page commune ; configuration Supabase dans `src/public-config.js`.
- Impression native en raster FICHERO 96 × 240 points et contrôle de densité QR.
- Voir `docs/UPGRADE-1.9.0.md` avant le premier déploiement.

### Version 1.6.0 — étiquettes Code 128 et scanner mixte
- Codes-barres Code 128 générés localement pour chaque exemplaire et chaque kit.
- Planches A4 compactes sans connexion Supabase ni publication de données personnelles.
- Scanner compatible Code 128 + anciens QR ; les données existantes et les anciennes étiquettes restent compatibles.

### Version 1.5.2 — correction du scanner des étiquettes publiques
- Le scanner intégré reconnaît maintenant les QR publics `contact.html` et retrouve automatiquement l’exemplaire correspondant. Le même QR sert à la gestion interne et à la fiche publique de contact.

### Nouveauté 1.5.0 — étiquettes QR propriétaires

- Propriétaires multiples et coordonnées publiques au choix.
- Hashtag et QR uniques pour chaque exemplaire physique. Le même QR public est reconnu par le scanner intégré pour la gestion des entrées, sorties et retours ; scanné avec l’appareil photo d’un téléphone, il ouvre la fiche publique de contact.
- Sélection des unités et planches A4 en trois formats (25 × 25, 35 × 25 et 45 × 30 mm).
- Page publique de contact accessible au scan.
- Configuration SQL complémentaire : `docs/ETIQUETTES-QR.sql`.


## Impression directe FICHERO D11s (v1.8.0)

La version de bureau Mac/Windows intègre un pilote Bluetooth BLE pour les modèles FICHERO D11s / AiYin D11s. Allume l’imprimante, ouvre **Étiquettes**, sélectionne les exemplaires, puis utilise **Connecter FICHERO** ou **Imprimer directement**. Le premier accès demande l’autorisation Bluetooth du système. Ferme l’application mobile FICHERO avant la connexion. L’impression système reste disponible en secours.

Le pilote cible les appareils Bluetooth dont le nom commence par `FICHERO` ou `D11s`. La compatibilité et le calibrage doivent être validés avec un premier exemplaire physique ; le protocole BLE et le raster 96 × 240 sont basés sur la documentation publique du modèle D11s. La version web/PWA n’offre pas cette intégration dans Safari ; utiliser l’application de bureau ou un navigateur compatible Web Bluetooth.
