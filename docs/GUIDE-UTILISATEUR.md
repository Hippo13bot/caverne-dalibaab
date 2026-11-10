# Guide utilisateur — La caverne d'Alibaab

## Sur iPhone
1. Ouvre l'adresse publiée de l'application dans Safari.
2. Touche **Partager** ▸ **Sur l'écran d'accueil**.
3. Autorise l'accès à la caméra lorsque tu utilises l'onglet **Scanners**.
4. Pour une expérience fiable, ouvre l'application depuis Safari ou son icône d'écran d'accueil (pas depuis un aperçu intégré à une autre app).

## Sur Mac
Ouvre l'application installée. La caméra doit être autorisée dans Réglages Système ▸ Confidentialité et sécurité ▸ Caméra.

## Inventaire et identification par code-barres
- Ajoute un équipement avec ses photos, marque, modèle, numéro de série, garantie, emplacement et état.
- Le champ **QR / code-barres existant** permet de conserver le contenu du QR fabricant.
- Dans **Scanners ▸ SCAN**, scanne une étiquette existante. Si elle n'est pas encore liée, saisis le nom exact d'une fiche existante pour associer le code, ou crée une nouvelle fiche.
- Les scans suivants ouvrent directement la fiche liée.
- Chaque exemplaire reçoit automatiquement une référence courte unique (8 caractères). Elle sert au QR d’identification (`CA-XXXXXXXX`) et au QR anti-perte ; elle est enregistrée avec l’unité et synchronisée.
- Les anciens QR codes et QR fabricant restent scannables : le scanner accepte les QR codes, ainsi que les anciens EAN-13 et Code 128.

## Départs et retours
- **DÉPART** : scanne chaque équipement. Il apparaît dans une liste de contrôle. Vérifie les quantités et valide le départ pour mettre les fiches en statut **Emprunté / sorti**, renseigner le détenteur et générer le bordereau PDF.
- **RETOUR** : scanne le matériel rendu. Son statut repasse en **En stock**, les informations de détenteur sont effacées et un mouvement de retour est enregistré.
- Les mouvements sont consultables dans **Locations & tournages**.

## Sacs et kits
1. Crée un sac ou un kit et ajoute chaque référence avec sa quantité réelle dans le contenant.
2. Sur sa fiche, utilise **Code-barres du kit** pour générer un Code 128 propre au contenant. Imprime-le et colle-le sur le contenant.
3. En mode **SCAN**, scanne le code-barres du kit : sa composition s’ouvre en contrôle détaillé. Les anciens QR de kits continuent également de fonctionner.
4. Scanne ensuite chaque code-barres matériel du kit : le compteur de la ligne correspondante augmente une unité à la fois. Les boutons + / − permettent aussi un contrôle manuel.
5. En mode **DÉPART**, le contrôle du kit alimente la liste de départ avec les quantités pointées. En mode **RETOUR**, le contrôle permet d’enregistrer les quantités rendues.
6. Utilise **Fiche PDF** pour imprimer le contenu attendu du sac.

Les codes-barres de kits sont ajoutés automatiquement aux kits existants sans changer leur composition. Les anciens QR de kits restent scannables. Les anciens kits restent compatibles : chaque matériel déjà présent dans un ancien kit est considéré comme une unité.

## Tournages
Crée un scénario et ajoute les besoins en choisissant si possible une référence de l’inventaire (ou en saisissant un besoin libre), la quantité et une note. **Préparer** transforme les références reconnues en liste de départ. Les besoins libres ou non associés sont signalés pour éviter de sortir un matériel approximatif. Le code-barres du scénario permet aussi de retrouver sa préparation depuis le scanner.

## Locations
1. Dans le panneau **Locations de tournage**, utilise **Nouvelle location** pour créer un contrat avec le nom du client, prénom, contact et dates de début / fin.
2. Sélectionne les équipements dans l'inventaire et renseigne les quantités.
3. Ouvre **Départ** pour contrôler les éléments et les quantités réellement sorties. Les sorties partielles sont suivies. Le bordereau PDF contient les informations du contrat et les signatures.
4. Au retour, scanne les objets en mode **RETOUR** ou scanne le QR d’un kit en mode **RETOUR** puis contrôle chaque élément. Les retours partiels mettent à jour les quantités et le contrat n’est marqué retourné que lorsque tous les éléments prévus sont revenus.

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

Lors de la création d’un sac ou d’un kit, ajoute chaque référence de matériel puis indique le nombre d’exemplaires réellement présents dans ce contenant. La fiche PDF du kit reprend cette quantité (et non la quantité totale de l’inventaire). Les codes-barres de kits sont ajoutés automatiquement aux kits existants sans changer leur composition. Les anciens QR de kits restent scannables. Les anciens kits restent compatibles : chaque matériel déjà présent dans un ancien kit est considéré comme une unité.

## Scanner (QR, anciens EAN-13 et Code 128)

Au démarrage de la caméra, l’application déverrouille l’audio à partir du toucher sur le bouton. Chaque scan reconnu déclenche ensuite un bip. Les QR des étiquettes publiques (liens `contact.html`) sont également reconnus directement par le scanner intégré : l’application extrait automatiquement le jeton de l’exemplaire et ouvre la fiche matériel correspondante en mode SCAN, ou traite le matériel en mode DÉPART / RETOUR. Une vibration est demandée si le navigateur expose l’API correspondante ; certains navigateurs iOS ne permettent pas la vibration depuis une page web. En mode DÉPART, la quantité scannée est limitée au stock disponible. Les QR fabricant existants restent reconnus lorsqu’ils sont associés à une fiche. Un lecteur USB/Bluetooth en mode clavier est aussi accepté dans l’onglet Scanners : il suffit de scanner le code et de laisser le lecteur envoyer Entrée.


## Portail de demandes de prêt en ligne (v1.4.0)

1. Dans Supabase, ouvre **SQL Editor** et exécute `docs/PORTAIL-DEMANDES.sql` après le SQL de synchronisation déjà installé. Cette opération ajoute le catalogue public et les demandes sans modifier `caverne_state`.
2. Publie la PWA sur GitHub Pages comme d’habitude. Le fichier `demande.html` est publié automatiquement avec le dossier `src/`.
3. Dans La Caverne d’Alibaab, connecte-toi au compte propriétaire puis ouvre **Demandes en ligne**. Clique sur **Publier le catalogue**. Recommence après chaque modification du stock, des quantités ou des kits si tu veux actualiser ce que les demandeurs voient.
4. Renseigne l’adresse de base GitHub Pages (l’adresse du site, avec le chemin du dépôt si nécessaire), puis clique sur **Créer le lien du portail**. Partage ce lien aux clients et collègues.
5. Les demandes apparaissent dans **Demandes en ligne**. Accepter crée un prêt dans « Locations & tournages » ; le matériel n’est pas marqué comme sorti avant le départ réel. Refuser et proposer une modification envoient le statut et le message dans le suivi du demandeur.

Les demandeurs peuvent déposer une demande sans compte : le lien privé affiché après l’envoi est leur justificatif de suivi, à conserver. Avec un compte, ils retrouvent leurs demandes dans « Mes demandes ». Le portail n’envoie pas d’e-mail automatiquement dans cette version : il faut conserver le lien de suivi ou utiliser l’accès par compte.

**Sécurité :** seule la clé publique Supabase (`sb_publishable_…` ou clé anon) est incluse dans le lien. Ne jamais utiliser `service_role`. Les demandes ne sont pas accessibles publiquement : le suivi invité exige un jeton secret, et l’espace de gestion exige le compte propriétaire.

## Étiquettes QR objet + QR anti-perte (version 1.9.0)

1. Avant le premier tirage, exécute la migration `docs/ETIQUETTES-QR.sql` dans Supabase et configure `src/public-config.js` comme indiqué dans `docs/UPGRADE-1.9.0.md`.
2. Dans **Étiquettes**, sélectionne les exemplaires à imprimer. Chaque exemplaire possède une référence courte unique.
3. Utilise **Imprimer les 2 directement** pour envoyer automatiquement à la FICHERO D11s, à la suite : le QR objet puis le QR anti-perte.
4. La première étiquette contient uniquement un gros QR, sans texte. La seconde contient le QR anti-perte, le nom du matériel, sa référence et « SCANNEZ SI PERDU ».
5. Le QR ouvre la page publique commune. Seuls le nom du matériel et les coordonnées explicitement autorisées par le propriétaire y sont affichés.

Le scanner intégré reconnaît les QR objet, les QR anti-perte, les anciens EAN-13, les anciens Code 128 et les QR déjà posés. Les anciens liens QR `contact.html?id=...&project=...&key=...` restent compatibles.


## Synchronisation automatique (Mac, Windows, iPhone)

1. Une seule fois : renseigne `src/public-config.js` (bouton « Copier public-config.js » dans Étiquettes) et déploie. Chaque appareil connaît alors ton projet Supabase.
2. Sur chaque appareil : Exports & impressions → connexion avec le même e-mail et le même mot de passe.
3. Ensuite tout est automatique : le voyant en haut affiche « SYNCHRO ✓ » avec l'heure. Hors ligne, les modifications restent sur l'appareil et partent dès le retour du réseau.
4. Sur iPhone, ouvre l'app depuis l'icône de l'écran d'accueil, pas en navigation privée.
