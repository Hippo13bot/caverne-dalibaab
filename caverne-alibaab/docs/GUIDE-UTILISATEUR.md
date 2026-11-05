# Guide utilisateur — La caverne d'Alibaab

## Sur iPhone
1. Ouvre l'adresse publiée de l'application dans Safari.
2. Touche **Partager** ▸ **Sur l'écran d'accueil**.
3. Autorise l'accès à la caméra lorsque tu utilises l'onglet **Scanners**.
4. Pour une expérience fiable, ouvre l'application depuis Safari ou son icône d'écran d'accueil (pas depuis un aperçu intégré à une autre app).

## Sur Mac
Ouvre l'application installée. La caméra doit être autorisée dans Réglages Système ▸ Confidentialité et sécurité ▸ Caméra.

## Inventaire et QR codes
- Ajoute un équipement avec ses photos, marque, modèle, numéro de série, garantie, emplacement et état.
- Le champ **QR / code-barres existant** permet de conserver le contenu du QR fabricant.
- Dans **Scanners ▸ SCAN**, scanne une étiquette existante. Si elle n'est pas encore liée, saisis le nom exact d'une fiche existante pour associer le code, ou crée une nouvelle fiche.
- Les scans suivants ouvrent directement la fiche liée.
- Le QR généré par l'application contient un identifiant stable de fiche. Les anciens QR fabricant restent utilisables s'ils ont été associés.

## Départs et retours
- **DÉPART** : scanne chaque équipement. Il apparaît dans une liste de contrôle. Vérifie les quantités et valide le départ pour mettre les fiches en statut **Emprunté / sorti**, renseigner le détenteur et générer le bordereau PDF.
- **RETOUR** : scanne le matériel rendu. Son statut repasse en **En stock**, les informations de détenteur sont effacées et un mouvement de retour est enregistré.
- Les mouvements sont consultables dans **Locations & tournages**.

## Sacs et kits
Crée un sac ou un kit, sélectionne les équipements qui le composent et utilise **Fiche par sac** pour imprimer sa liste de contenu.

## Tournages
Crée un scénario et ajoute les besoins (matériel, quantité, commentaire). Les scénarios peuvent être modifiés et réutilisés pour préparer une journée.

## Locations
1. Crée un contrat avec le nom du client, prénom, contact et dates de début / fin.
2. Sélectionne les équipements dans l'inventaire et renseigne les quantités.
3. Ouvre **Départ** pour contrôler les éléments. Le bordereau PDF contient les informations du contrat et les signatures.
4. Au retour, scanne les objets en mode **RETOUR**.

## Synchronisation Mac ↔ iPhone (Supabase)
La synchronisation nécessite une configuration unique et un compte commun aux appareils.

1. Crée un projet sur [Supabase](https://supabase.com/).
2. Dans **SQL Editor**, exécute tout le contenu du fichier `docs/SUPABASE.sql`.
3. Dans **Project Settings ▸ API**, copie l'URL du projet et la clé publique `anon` / `publishable`.
4. Dans l'application, onglet **Exports & impressions**, renseigne l'URL et la clé puis touche **Enregistrer le projet**.
5. Crée un compte avec un e-mail et un mot de passe dans le bloc de synchronisation. Si la confirmation d'e-mail est activée dans Supabase, confirme l'adresse puis connecte-toi.
6. Connecte l'autre appareil avec le même projet et le même compte.
7. Sur le premier appareil, touche **Envoyer vers le cloud** pour initialiser la base. Sur l'autre, touche **Récupérer du cloud** si des données locales doivent être remplacées, ou **Synchroniser** pour la synchronisation automatique.

La synchronisation automatique vérifie le cloud à l'ouverture/reprise de l'application et environ toutes les minutes lorsque l'application est ouverte et connectée. Les données restent disponibles localement hors connexion. En cas de modifications concurrentes sur deux appareils, la version horodatée la plus récente est retenue : fais une sauvegarde avant une grosse session de modifications sur plusieurs appareils.

**Sécurité :** utilise uniquement la clé publique `anon` / `publishable` dans l'application. N'utilise jamais la clé `service_role`. La table utilise l'authentification Supabase et des règles RLS pour que chaque compte ne puisse accéder qu'à sa propre sauvegarde.

## Reconnaissance par photo
Le bouton **Rechercher par photo** utilise l'OCR pour lire les inscriptions d'une plaque signalétique et proposer marque, modèle ou numéro de série. Il ne s'agit pas encore d'une reconnaissance visuelle garantie du modèle : vérifie toujours les propositions avant d'enregistrer. L'OCR nécessite une connexion internet pour charger son moteur.

## Sauvegardes et exports
- **Sauvegarder** crée un fichier JSON complet à conserver.
- **Restaurer** remplace les données locales par une sauvegarde choisie.
- **CSV** exporte les fiches d'inventaire.
- Les fiches PDF sont générées par la fenêtre d'impression : choisis **Enregistrer au format PDF**.


## Quantités dans les sacs et kits

Lors de la création d’un sac ou d’un kit, ajoute chaque référence de matériel puis indique le nombre d’exemplaires réellement présents dans ce contenant. La fiche PDF du kit reprend cette quantité (et non la quantité totale de l’inventaire). Les anciens kits restent compatibles : chaque matériel déjà présent dans un ancien kit est considéré comme une unité.

## Scanner et QR codes

En mode DÉPART, chaque scan reconnu déclenche un bip de confirmation lorsque le navigateur autorise l’audio, et une vibration lorsque le téléphone le permet. Scanner plusieurs fois le même QR augmente la quantité contrôlée jusqu’à la quantité totale déclarée dans la fiche matériel. Les nouveaux QR internes utilisent un identifiant court pour être plus faciles à lire et les QR fabricant existants restent reconnus.
