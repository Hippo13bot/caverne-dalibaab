# La caverne d'Alibaab

Inventaire de matériel audiovisuel, photo, son, informatique et accessoires. **Un seul code, trois usages** :

| Où | Comment |
|---|---|
| **iPhone / iPad** | App web installable (PWA) : s'ajoute à l'écran d'accueil, fonctionne hors-ligne |
| **Mac / Windows** | Application Electron (installateurs `.dmg` / `.exe`) |
| **N'importe quel navigateur** | Ouvrir `src/index.html` ou la page GitHub Pages |

## Identité
- Le GIF de la mascotte **bouge** dans l'app (logo en haut, bandeau d'accueil).
- L'**icône de l'app** (écran d'accueil iPhone, Dock, onglet) est une **image fixe** tirée de la première image du GIF (`src/icons/`, `assets/icon.png`).
- Si l'iPhone est réglé sur « Réduire les animations », le GIF est remplacé par l'image fixe.

## Fonctionnement
- 100 % local : aucun compte, aucun serveur, aucune connexion requise.
- Fiches avec photo (appareil photo de l'iPhone directement), catégories, série, quantité, statut, emprunteur, dates, emplacement, prix, garantie, notes.
- Sacs et kits, QR code par fiche, export CSV (Notion/Excel), sauvegarde/restauration JSON, impression et fiches PDF.
- Stockage dans **IndexedDB** (beaucoup plus d'espace que localStorage : indispensable pour les photos sur iPhone). Les anciennes données localStorage sont migrées automatiquement.
- **QR code** : sur la version web, il contient un lien `…/index.html#item=ID`. Le scanner avec l'appareil photo de l'iPhone ouvre la fiche dans l'app.

## Mettre la version iPhone en ligne (GitHub Pages)
1. Crée un dépôt GitHub et pousse ce dossier sur la branche `main`.
2. Dans **Settings ▸ Pages**, choisis **Source : GitHub Actions**.
3. Le workflow `.github/workflows/pages.yml` publie le dossier `src/` : l'adresse est du type `https://TON-COMPTE.github.io/NOM-DU-DEPOT/`.
4. Sur l'iPhone, ouvre cette adresse **dans Safari** ▸ **Partager** ▸ **Sur l'écran d'accueil**.

> ⚠️ Les données restent **sur chaque appareil** (iPhone ≠ Mac). Pour les transférer : **Sauvegarder** (sur iPhone, la feuille de partage propose AirDrop, Fichiers, Mail…) puis **Restaurer** sur l'autre appareil. Sur iPhone, fais ta première saisie **après** avoir installé l'app sur l'écran d'accueil : Safari et l'app installée ont chacun leur propre stockage.

## Compiler l'app Mac et Windows avec GitHub Actions
Rien à installer sur ton ordinateur : GitHub compile pour toi.
1. Pousse le dossier sur GitHub (branche `main`).
2. **Test rapide** : onglet **Actions** ▸ « Compiler l'app Mac et Windows » ▸ **Run workflow**. Au bout de quelques minutes, les installateurs sont en bas de la page du run (section *Artifacts*).
3. **Version officielle** : crée un tag, GitHub publie alors une **Release** avec les fichiers à télécharger.
```bash
git tag v1.0.0
git push origin v1.0.0
```
Fichiers produits : `…-Mac-arm64.dmg` (Mac récents M1 à M4), `…-Mac-x64.dmg` (Mac Intel), `…-Windows-Setup.exe`.

**Avertissements au premier lancement** (l'app n'est pas signée, la signature coûte un abonnement Apple/Microsoft) :
- **Mac** : ouvre le `.dmg`, glisse l'app dans Applications, puis **clic droit ▸ Ouvrir ▸ Ouvrir**. Si macOS la déclare « endommagée » : `xattr -cr "/Applications/La caverne d'Alibaab.app"` dans le Terminal.
- **Windows** : SmartScreen affiche « Windows a protégé votre ordinateur » : **Informations complémentaires ▸ Exécuter quand même**.

## Développer en local (facultatif)
Prérequis : Node.js 20+.
```bash
npm install
npm start
```

## Tester la version web en local
```bash
cd src && python3 -m http.server 8000   # puis http://localhost:8000
```
(Le service worker hors-ligne nécessite http(s), pas `file://`.)

## Limites
- Pas de synchronisation automatique entre appareils (voir `docs/ROADMAP.md`).
- Faire des sauvegardes régulières : si l'iPhone vide les données d'un site peu utilisé, la sauvegarde est le filet de sécurité.
