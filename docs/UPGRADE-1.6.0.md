# Mise à jour vers la version 1.6.0

1. Avant de remplacer les fichiers, crée une sauvegarde JSON depuis l'application actuelle.
2. Remplace le contenu du dépôt GitHub par celui de cette archive et conserve les workflows `.github/workflows/`.
3. Envoie les changements sur `main`. GitHub Pages publiera la nouvelle PWA automatiquement si le workflow Pages est activé.
4. Pour l'application Mac/Windows, lance le workflow de compilation ou crée le tag `v1.6.0`.
5. Ouvre l'application mise à jour. La migration ajoute des identifiants Code 128 aux exemplaires, kits et scénarios existants. Elle ne supprime pas les fiches et ne nécessite aucune requête SQL Supabase.
6. Imprime d'abord une petite planche test en taille réelle (100 %) et vérifie la lecture avant de produire toutes les étiquettes.

## Compatibilité
- Les données locales IndexedDB, les sauvegardes JSON et le contenu synchronisé dans `caverne_state` sont conservés.
- Les anciens QR de matériel, kits, scénarios et contacts publics restent reconnus par le scanner intégré.
- Les nouveaux codes-barres sont des identifiants internes. Ils ne déclenchent pas l'ouverture d'une page de contact par l'appareil photo natif.
- La génération et l'impression des nouvelles étiquettes ne nécessitent ni compte Supabase ni modification de schéma SQL.
