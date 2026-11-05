# Feuille de route — La caverne d'Alibaab

## Inclus dans cette version
- Inventaire local IndexedDB avec migration des anciennes clés de stockage.
- Fiches équipement éditables, photos, état, garanties et identifiants QR externes.
- Scanner caméra corrigé avec modes SCAN, DÉPART et RETOUR.
- Association des QR de garantie / fabricant aux fiches matériel.
- Liste de départ scannée, validation du mouvement, changement de statut et bordereau PDF.
- Retour scanné avec remise en stock et historique.
- Création et modification des scénarios de tournage et de leurs besoins.
- Création et modification des locations, sélection de matériel de l'inventaire, quantités et bordereau PDF.
- Gestion des sacs / kits et fiches par sac.
- Synchronisation Supabase authentifiée, RLS, synchronisation périodique et fonctionnement local hors ligne.
- OCR de plaque signalétique avec propositions de champs à confirmer.

## À prévoir / limites connues
- La synchronisation Supabase nécessite que l'utilisateur crée son projet et configure ses identifiants dans l'application.
- La synchronisation est une synchronisation périodique (environ une minute et à la reprise), pas du temps réel instantané.
- En cas de modifications concurrentes hors ligne, la version la plus récente remplace l'autre version ; exporter une sauvegarde avant les grosses opérations multi-appareils.
- L'OCR lit les caractères d'une plaque. Une vraie reconnaissance visuelle du matériel par IA nécessitera un service de vision et une clé API configurée par l'utilisateur.
- La signature électronique des contrats et les inventaires multi-unités avec suivi individuel par numéro de série pourront faire l'objet d'une évolution dédiée.
