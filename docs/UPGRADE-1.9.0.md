# Passage à la version 1.9.0 — EAN-13 + QR anti-perte

## Ce qui change

- Chaque exemplaire matériel reçoit un EAN-13 valide, généré dans la plage interne 20–29. Il s'agit d'un identifiant privé de parc, pas d'un code commercial GS1.
- Les identifiants EAN-13 et références publiques courtes sont conservés dans les unités IndexedDB et suivent les synchronisations de l'état de l'application.
- Les anciennes valeurs `unit.barcode`, anciens tags et UUID ne sont pas supprimés : le scanner continue à les reconnaître.
- L'impression d'une paire envoie l'EAN-13 puis le QR anti-perte à la FICHERO D11s.

## Migration Supabase (une fois)

1. Ouvre Supabase → SQL Editor.
2. Exécute le fichier `docs/ETIQUETTES-QR.sql` fourni avec la 1.9.0. Il ajoute les colonnes `public_code` et `ean13` et leurs index uniques sans supprimer les lignes existantes.
3. Ne supprime pas la table `caverne_public_labels` et ne réinitialise pas IndexedDB.

## Configurer les QR courts (nécessaire pour le rouleau 30 × 14 mm)

Une étiquette de 30 × 14 mm ne peut pas contenir un QR lisible si celui-ci encode l'ancienne URL longue avec l'URL Supabase et la clé publique dans chaque code. La 1.9.0 utilise donc une URL courte `contact.html?i=XXXXXXXX` quand la configuration publique statique est renseignée.

1. Dans Supabase → Project Settings → API, récupère l'URL du projet et la clé **anon/publicable** (jamais la clé `service_role`).
2. Ouvre `src/public-config.js` et remplace les deux chaînes vides :

```js
window.CAVERNE_PUBLIC_CONFIG = {
  supabaseUrl: 'https://TON-PROJET.supabase.co',
  supabaseAnonKey: 'TA_CLE_ANON_OU_PUBLISHABLE'
};
```

3. Publie le dépôt sur GitHub (branche `main`) et attends la fin de l'action GitHub Pages.
4. Dans l'application, vérifie que l'adresse du portail GitHub Pages est renseignée dans « Portail clients & collègues » et que Supabase est configuré / connecté.
5. Ouvre « Étiquettes », sélectionne les exemplaires et lance « Imprimer les 2 directement ».

La clé anon/publishable est destinée à être utilisée côté navigateur. La table reste protégée par les politiques RLS ; seules les coordonnées dont les cases d'autorisation sont cochées sont publiées. N'inscris jamais une clé `service_role` dans ce fichier.

Si `public-config.js` n'est pas configuré, l'application conserve un lien QR historique long. L'impression thermique le refuse si sa densité dépasse la limite physique de la tête 96 × 240 points : elle ne réduit pas les modules au point de rendre le code illisible. Les anciennes étiquettes restent fonctionnelles.

## Données et mise à jour du nom

La page publique résout le code court dans Supabase et affiche `item_name`, qui provient du champ **Nom du matériel** (et non de la marque). Lorsqu'une fiche est modifiée, l'application tente de republier les données publiques si la session Supabase est active et que le propriétaire est associé. Si l'appareil est hors ligne ou déconnecté, reconnecte-toi et réimprime / republie les étiquettes pour actualiser la fiche publique.

## Limites de validation matérielle

Le rendu FICHERO utilise le raster natif 96 × 240 pixels à 203 dpi, sans redimensionnement interpolé. La lecture réelle dépend néanmoins du contraste du papier, de l'état de la tête thermique, de la qualité du rouleau et du lecteur. Aucun test physique sur une D11s ni test caméra sur iPhone n'a été réalisé dans le cadre de cette livraison.
