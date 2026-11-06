# La caverne d'Alibaab

Inventaire de matériel audiovisuel, photo, son, informatique et accessoires. Un seul code pour l'application Mac/Windows et la PWA iPhone/iPad.

## Fonctionnalités
- Inventaire avec fiches, photos, catégories, numéros de série, quantités, statuts, garanties, emplacement et notes.
- Sacs et kits avec QR dédié, contrôle détaillé ligne par ligne, quantités par équipement et fiche PDF par contenant.
- Scanner avec confirmation sonore (après activation par le bouton caméra), vibration si le navigateur et le téléphone la prennent en charge, anti-double-scan et compteur par unité.
- QR internes plus compacts, plus grands à l’impression et plus faciles à lire.
- Scanners caméra avec trois modes : **SCAN**, **DÉPART** et **RETOUR**. Les QR fabricant / garantie peuvent être associés aux fiches et réutilisés.
- Départs validés par scan, changement d'état des équipements, historique des mouvements et bordereau PDF avec coordonnées du bénéficiaire et dates.
- Locations avec client, prénom, contact, dates, matériel sélectionné, quantités sorties et retours partiels suivis.
- Scénarios de tournage avec besoins associés à l’inventaire, quantités et action de préparation directe.
- OCR de plaque signalétique pour proposer marque, modèle et numéro de série (connexion internet requise ; vérification humaine nécessaire).
- Export CSV, sauvegarde/restauration JSON, fiches PDF individuelles et inventaire.
- Propriétaires multiples avec association à chaque exemplaire physique ; hashtags et QR uniques pour chaque unité, même lorsque plusieurs objets partagent la même référence.
- Impression de planches A4 à la sélection, en formats 25 × 25 mm, 35 × 25 mm et 45 × 30 mm ; page publique de contact après scan avec téléphone/e-mail affichés uniquement sur autorisation.
- Configuration des étiquettes QR : exécuter `docs/ETIQUETTES-QR.sql` une fois dans Supabase ; publier les fiches sélectionnées depuis « Exports & impressions ».
- Stockage local IndexedDB pour rester utilisable hors ligne.
- Synchronisation périodique Mac ↔ iPhone via Supabase, avec compte utilisateur et règles RLS.
- Portail web public de demandes de prêt pour clients et collègues : dépôt sans compte avec lien privé de suivi, ou création de compte et historique personnel.
- Validation manuelle dans l’application : accepter (création d’un prêt), refuser ou proposer des modifications. Le portail ne peut jamais confirmer seul une réservation ni modifier l’inventaire.
- Catalogue public limité aux noms, catégories, modèles, quantités disponibles et compositions des kits ; aucune donnée privée de l’inventaire n’est exposée.
- Configuration du portail : exécuter `docs/PORTAIL-DEMANDES.sql` après `docs/SUPABASE.sql`, publier le catalogue depuis l’onglet « Demandes en ligne », puis renseigner l’URL GitHub Pages et partager le lien généré.

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
   git tag v1.5.0
   git push origin v1.5.0
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


### Nouveauté 1.5.0 — étiquettes QR propriétaires

- Propriétaires multiples et coordonnées publiques au choix.
- Hashtag et QR uniques pour chaque exemplaire physique.
- Sélection des unités et planches A4 en trois formats (25 × 25, 35 × 25 et 45 × 30 mm).
- Page publique de contact accessible au scan.
- Configuration SQL complémentaire : `docs/ETIQUETTES-QR.sql`.
