# NOVA OBSERVATOIRE

Base de données hôtelière et poste de travail pour le conseil en stratégie hôtelière en France métropolitaine. L’application réunit une cartographie fine, des fiches traçables, un comparateur concurrentiel, des benchmarks versionnés, un suivi du marché et des transactions, un import enrichi et des outils de qualité de données.

> **Base compilée.** L’application est alimentée par le classeur **« BDD transactions hôtelières - vcompilée.xlsx »** : 245 actifs, 231 exercices de CA, 245 transactions documentées. Les valeurs absentes ne sont ni inventées ni extrapolées ; elles restent vides et sont signalées « non documenté ». Les coordonnées sont des centroïdes communaux BAN, pas des adresses exactes.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Démarrage rapide](#démarrage-rapide)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Modèle de données](#modèle-de-données)
- [Traçabilité et fiabilité](#traçabilité-et-fiabilité)
- [Exports](#exports)
- [Import et enrichissement](#import-et-enrichissement)
- [Mode local et persistance](#mode-local-et-persistance)
- [Passage en production Supabase / PostGIS](#passage-en-production-supabase--postgis)
- [Déploiement Vercel](#déploiement-vercel)
- [Limites connues](#limites-connues)
- [Contrôles qualité](#contrôles-qualité)

## Fonctionnalités

| Écran | Contenu |
| --- | --- |
| **Carte & recherche** | Carte MapLibre, choroplèthe des 13 régions, bulles par ville, marqueurs hôtels, recherche BAN, rayon 1–100 km, dessin de polygone, filtres cumulatifs, liste synchronisée, panier de comparaison, exports XLSX / CSV / PNG / PowerPoint, sélections enregistrées. |
| **Fiches hôtels** | Identité, capacité, surfaces, équipements, KPI 5 ans, graphiques CA/RevPAR et ADR/TO, transactions, sources et fiabilité, positionnement dans la zone, journal, complétion d’indicateur. |
| **Comparateur** | 2 à 30 hôtels, actif de référence réel ou saisi manuellement, écarts, meilleur/pire, moyennes/médianes/min/max, matrice d’équipements, scatter prix × occupation, barres classées, radar normalisé, carte concurrentielle, exports Excel et PowerPoint. |
| **Benchmarks** | Création rattachée à une mission, panel issu du panier ou d’une sélection, sectorisation par ville/catégorie/gamme, synthèse sectorielle, positionnement prix × qualité, annexe de sources, versionnement, export PowerPoint. |
| **Marché & transactions** | Offre par catégorie, ouvertures documentées, performance par catégorie, pipeline, transactions filtrables, prix par clé et volumes, prix par région, export Excel. Les fermetures ne sont pas extrapolées. |
| **Import & enrichissement** | CSV/XLSX, mapping mémorisé, aperçu, détection de doublons, fusion/création/ignorance, géocodage BAN, saisie manuelle, estimateur N3 avec hypothèse explicite, historique des lots. |
| **Qualité des données** | Heatmap de complétude par région ou catégorie, distribution N1/N2/N3, données de plus de deux ans, file de tâches assignables, export Excel. |
| **Administration** | Utilisateurs et rôles, accès aux données confidentielles, matrice des droits, journal d’audit filtrable, export CSV, réinitialisation de la base. |

## Démarrage rapide

Prérequis : Node.js 20 ou supérieur, npm.

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Aucune variable d’environnement n’est nécessaire pour le mode local. Les données sont chargées depuis `src/data/nova-base.json` puis persistées dans le `localStorage` du navigateur.

Pour repartir de la base compilée initiale : menu utilisateur en bas de la barre latérale → **Réinitialiser la base** (ou Administration → Zone de réinitialisation).

## Scripts

```bash
npm run dev         # serveur de développement
npm run build       # build de production
npm run start       # serveur de production
npm run lint        # ESLint
npm run typecheck   # vérification TypeScript
node scripts/build-nova-base.mjs  # régénère src/data/nova-base.json depuis le classeur source
```

Le script de conversion lit la feuille `BDD Stagiaires compilée` (en-têtes ligne 11), normalise les régions, géocode les villes via l’API BAN (cache `src/data/ville-coords.json`) et produit 245 hôtels, 231 lignes d’exploitation, 245 transactions et 245 observations d’identité. Les dimensions absentes du fichier (EBITDA, prix/nuit, MICE annuel, valorisations) restent vides.

## Architecture

```text
src/
  app/                     pages App Router (toutes clientes pour le mode local)
    page.tsx               carte & recherche
    hotels/                annuaire et fiche hôtel
    comparateur/           comparateur
    benchmarks/            liste et détail
    marche/                marché & transactions
    import/                import et saisie manuelle
    qualite/               qualité des données
    admin/                 administration
  components/
    map/                   carte, filtres, résultats, sélections
    comparator/            tableaux, graphiques, dialogues
    benchmark/             création et positionnement
    import/                assistant d’import, formulaire manuel
    quality/               dialogue de tâche
    ui/                    primitives Radix/shadcn maison
  lib/
    types.ts               modèle TypeScript
    constants.ts           libellés, couleurs, KPI, zones
    store.tsx              état applicatif + persistance locale + règles de conflit
    filters.ts             filtrage cumulatif et tri
    stats.ts               agrégats, KPI dérivés, classements
    comparison.ts          colonnes et écarts du comparateur
    benchmark.ts           secteurs, synthèses, sources
    market.ts              indicateurs de marché
    import.ts              mapping, normalisation, doublons, géocodage
    exports.ts             Excel, CSV, PNG, PowerPoint
    market-export.ts       export Excel du marché
    geo.ts                 haversine, polygones, centroïdes
  data/nova-base.json      base compilée depuis le classeur source
  data/ville-coords.json   cache de géocodage BAN
public/
  geo/                     régions et départements GeoJSON
  maplibre/                worker MapLibre auto-hébergé
  modeles/                 modèle CSV d’import
supabase/migrations/       schéma PostgreSQL/PostGIS + RLS
```

Stack : Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, MapLibre GL, Recharts, SheetJS, pptxgenjs, html-to-image, Radix UI.

## Modèle de données

Le schéma cible est organisé en **7 bases** reliées à l’hôtel :

| Base | Contenu | Source |
| --- | --- | --- |
| **Hôtel** | Nom, pays, région, ville, localisation, coordonnées BAN | Atout France + missions |
| **Identité** | Chambres, suites, surfaces, équipements, restauration | Atout France + missions |
| **Exploitation** | Une ligne par exercice : CA, EBITDA | Missions / comptes |
| **Transaction** | Date de deal, gammes et clés avant/après, CA avant/après, analyste | CFNEWS |
| **Prix / nuit** | Une ligne par prix observé | Missions — vide dans le fichier fourni |
| **MICE** | Salles, surfaces MICE | Missions — vide dans le fichier fourni |
| **Valorisations NOVA** | Valorisation par exercice | Missions — vide dans le fichier fourni |

- **`hotels`** : identité et localisation, catégorie, gamme, clés, suites, surfaces, équipements, source et fiabilité. Les champs non documentés valent `null` ou « Non renseigné ».
- **`hotel_kpis` / `exploitations`** : CA total par exercice (seule valeur disponible dans la base fournie). ADR, TO, RevPAR, EBITDA, effectif et note restent nullables et ne sont jamais estimés.
- **`transactions`** : date, CA avant/après et exercices, gammes et clés avant/après, analyste, localisation, sources par bloc. Prix, prix/clé, acheteur et vendeur sont vides car absents du fichier.
- **`identities`**, **`priceObservations`**, **`miceObservations`**, **`valuations`** : tables prêtes pour les connecteurs MISSIONS V2.
- **`pipeline_projects`** : projet, ville, catégorie, clés, ouverture prévue, statut, promoteur.
- **`saved_selections`** : nom, filtres, hôtels, auteur, partage.
- **`benchmarks`** : client, mission, panel, référence, exercice, KPI, secteurs, notes, version.
- **`import_batches`** : fichier, lignes, créations, fusions, ignorés, statut.
- **`tasks`** : hôtel, champ à compléter, priorité, statut, assignation, échéance.
- **`audit_log`** : action, objet, détail, auteur, date, indicateur confidentiel.

Les ratios (`TO`, marge EBITDA, part F&B) sont stockés en **ratio** (0,725 = 72,5 %) et formatés à l’affichage. Les surfaces sont en m², les montants en euros.

### KPI dérivés

Ils ne sont jamais saisis : CA par clé, CA par m², part F&B, m² par clé, RevPAR face à la moyenne de zone, prix par clé, rangs dans la zone.

## Traçabilité et fiabilité

Chaque valeur affichée ou exportée est reliée à une source :

- **N1 — observable / vérifiée** : document public, rapport annuel, Infogreffe, site officiel.
- **N2 — recherche approfondie** : presse, base interne, recoupement.
- **N3 — estimation** : valeur calculée, affichée en italique gris, avec hypothèse obligatoire.

Règles appliquées dans le store et dans la migration SQL :

1. une valeur **N1 ne peut jamais être remplacée par N2 ou N3** ;
2. à niveau égal, la valeur la plus récente remplace l’ancienne ;
3. l’ancienne valeur KPI est conservée dans l’historique et un journal d’audit est créé ;
4. aucune valeur manquante n’est inventée : elle reste nulle ou explicitement estimée.

Les exports Excel comportent une feuille **Méthodologie** avec le périmètre, les filtres, la date, l’auteur et la légende de fiabilité. Les slides PowerPoint rappellent la source et le périmètre documentaire.

## Exports

- **XLSX** : hôtels, comparateur, marché, qualité.
- **CSV** : données brutes, journal d’audit.
- **PNG** : carte ou carte concurrentielle avec en-tête et légende.
- **PowerPoint** : carte, comparateur et benchmarks versionnés (format 16:9).

Les noms de fichiers sont normalisés et horodatés par exercice. Les exports de données confidentielles sont réservés aux utilisateurs habilités et tracés dans le journal.

## Import et enrichissement

1. déposer un fichier CSV ou XLSX (8 Mo maximum, 1 000 lignes) ;
2. vérifier le mapping proposé (mémorisé localement) ;
3. renseigner la source, la date, l’auteur et la fiabilité ;
4. arbitrer les doublons : fusionner, créer ou ignorer ;
5. lancer l’import, puis consulter le résumé et l’historique.

Un doublon est proposé lorsque le nom normalisé est identique et qu’un critère géographique ou d’adresse concorde (distance < 100 m, adresse, code postal ou ville). Le géocodage d’appoint utilise l’API BAN.

L’estimateur de saisie manuelle applique des hypothèses explicites :

- surface F&B ≈ 2,75 m² par couvert intérieur + 2 m² par couvert extérieur ;
- CA estimé = clés × RevPAR médian de la zone × 365.

Toute estimation crée une valeur **N3** avec son hypothèse, jamais une valeur présentée comme observée.

## Mode local et persistance

- Les données initiales sont dans `src/data/nova-base.json` (base compilée).
- L’état est conservé dans `localStorage` sous `nova-observatoire-v2`.
- Les créations, modifications, imports, tâches et audits sont locaux au navigateur.
- Le menu utilisateur permet de changer de rôle pour tester les droits (lecteur, contributeur, admin).
- Le bouton **Réinitialiser la base** restaure la base compilée initiale.
- Aucune donnée n’est envoyée à un serveur en mode local.

## Passage en production Supabase / PostGIS

La migration `supabase/migrations/202610200001_init.sql` prépare la base cible :

- PostGIS, géographie `location`, index GIST ;
- profils liés à `auth.users`, rôles et habilitations ;
- RLS sur l’ensemble des tables ;
- contrainte N3 → hypothèse obligatoire ;
- trigger de protection de la fiabilité des KPI et historique ;
- journal d’audit en ajout seul.

Procédure indicative :

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Puis :

1. créer les utilisateurs dans Supabase Auth (invitation ou mot de passe) ;
2. renseigner les variables de `.env.example` dans `.env.local` et dans Vercel ;
3. remplacer le fournisseur local par des dépôts Supabase (lecture des hôtels/KPI, mutations protégées par RLS) ;
4. brancher l’authentification sur `profiles` et les rôles ;
5. vérifier les politiques RLS avec un compte lecteur, un contributeur et un admin.

Le code local et la migration partagent le même modèle conceptuel, mais **l’application livrée n’est pas encore connectée à Supabase** : aucune clé n’a été fournie. Le mode local est autonome et ne nécessite pas la base.

## Déploiement Vercel

Le projet est prêt pour un déploiement statique/SSR standard.

```bash
npx vercel
npx vercel --prod
```

Ou import du dépôt GitHub dans Vercel. Aucune variable n’est requise pour le mode local. Pour la production, ajouter les variables Supabase et l’URL publique.

## Limites connues

- Base compilée de mission : les champs absents du classeur source ne sont pas documentés. Les coordonnées sont des centroïdes communaux BAN.
- Persistance locale uniquement ; plusieurs navigateurs ne partagent pas les mêmes données.
- Connecteurs SIRENE et Atout France annoncés V2, non branchés.
- Les fermetures, prix de cession, EBITDA, prix/nuit, MICE annuel et valorisations ne sont pas documentés dans le fichier fourni et ne sont donc pas extrapolés.
- La carte utilise un fond CARTO Positron et des GeoJSON administratifs simplifiés.
- Certains actifs n’ont pas de CA pour l’exercice sélectionné : ils apparaissent dans la file qualité, ce qui est intentionnel.
- Le module d’import mémorise le mapping dans le navigateur ; le mapping n’est pas partagé entre postes en mode local.

## Contrôles qualité

```bash
npm run typecheck
npm run lint
npm run build
```

Les écrans ont été vérifiés avec Playwright en mode headless (MapLibre/WebGL via SwiftShader) : carte, drill-down, filtres, exports réels, fiches, comparateur, benchmarks, marché, import, qualité et administration. Les captures de contrôle ne sont pas versionnées.

## Licence et usage

Projet interne. Les données sont issues de la compilation de transactions hôtelières fournie par le client ; elles ne doivent pas être diffusées hors du périmètre autorisé.
