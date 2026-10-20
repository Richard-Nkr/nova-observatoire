/**
 * Construit la base applicative à partir du classeur de transactions fourni.
 *
 * Source : « BDD transactions hôtelières - vcompilée.xlsx », feuille
 * « BDD Stagiaires compilée », en-têtes ligne 11, données à partir de la ligne 12.
 *
 * Aucune valeur n'est extrapolée : seules les cellules numériques du classeur
 * deviennent des KPI. Les dimensions absentes (EBITDA, prix/nuit, MICE détaillé,
 * valorisations) restent vides et sont signalées comme non documentées.
 */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = "/Users/richaskip/Downloads/BDD transactions hôtelières - vcompilée.xlsx";
const CACHE = path.join(ROOT, "src/data/ville-coords.json");
const OUTPUT = path.join(ROOT, "src/data/nova-base.json");
const EXTRACTION_DATE = "2026-10-20";
const GENERATED_AT = "2026-10-20T08:00:00.000Z";

const REGIONS = {
  AURA: "Auvergne-Rhône-Alpes",
  "AUVERGNE-RHÔNE-ALPES": "Auvergne-Rhône-Alpes",
  PACA: "Provence-Alpes-Côte d'Azur",
  "PROVENCE-ALPES-CÔTE D'AZUR": "Provence-Alpes-Côte d'Azur",
  IDF: "Île-de-France",
  "ÎLE-DE-FRANCE": "Île-de-France",
  "NOUVELLE AQUITAINE": "Nouvelle-Aquitaine",
  "NOUVELLE-AQUITAINE": "Nouvelle-Aquitaine",
  "GRAND EST": "Grand Est",
  OCCITANIE: "Occitanie",
  BRETAGNE: "Bretagne",
  "HAUTS-DE-FRANCE": "Hauts-de-France",
  "PAYS DE LA LOIRE": "Pays de la Loire",
  "CENTRE-VAL DE LOIRE": "Centre-Val de Loire",
  "BOURGOGNE-FRANCHE-COMTÉ": "Bourgogne-Franche-Comté",
  NORMANDIE: "Normandie",
  CORSE: "Corse",
  MARTINIQUE: "Martinique",
};

const REGION_CENTERS = {
  "Auvergne-Rhône-Alpes": [45.75, 4.85],
  "Provence-Alpes-Côte d'Azur": [43.7, 6.2],
  "Île-de-France": [48.85, 2.35],
  "Nouvelle-Aquitaine": [44.8, -0.6],
  "Grand Est": [48.7, 5.5],
  Occitanie: [43.6, 2.1],
  Bretagne: [48.2, -2.9],
  "Hauts-de-France": [50.3, 2.8],
  "Pays de la Loire": [47.4, -0.7],
  "Centre-Val de Loire": [47.4, 1.6],
  "Bourgogne-Franche-Comté": [47.1, 4.9],
  Normandie: [49.1, 0.2],
  Corse: [42.1, 9.1],
  Martinique: [14.65, -61.0],
};

const clean = (value) => (typeof value === "string" ? value.trim() : value);
const text = (value) => {
  const cleaned = clean(value);
  return cleaned === null || cleaned === undefined || cleaned === "" ? null : String(cleaned);
};
const num = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/\s/g, "").replace("€", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};
const positive = (value) => {
  const parsed = num(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};
const bool = (value) => value === true || String(value).toLowerCase() === "true";
const norm = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

function parseCategory(value) {
  const raw = norm(value);
  if (!raw) return "Non classé";
  if (raw.includes("PALACE")) return "Palace";
  const match = raw.match(/([1-5])\s*\*/);
  if (match) return Number(match[1]);
  if (/^[1-5]$/.test(raw)) return Number(raw);
  return "Non classé";
}

function gammeFromCategory(category) {
  if (category === "Palace" || category === 5) return "Luxe";
  if (category === 4) return "Upscale";
  if (category === 3) return "Milieu de gamme";
  if (category === 1 || category === 2) return "Économique";
  return "Non renseigné";
}

function normalizeRegion(value) {
  const raw = String(value ?? "").trim();
  return REGIONS[norm(raw)] ?? (raw || "Non renseignée");
}

function excelDate(value) {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return `${year}-${String(Number(match[1])).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function yearLabel(value) {
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/(19|20)\d{2}/);
  return match ? match[0] : raw;
}

function fiabiliteFrom(...values) {
  const joined = values.filter(Boolean).join(" ").toLowerCase();
  if (joined.includes("estimation")) return "N3";
  if (joined.includes("pappers") || joined.includes("societe.com") || joined.includes("société.com") || joined.includes("orbis")) {
    return "N1";
  }
  return "N2";
}

function source({ auteur, annee, methodology, url, fiabilite, hypothese, label }) {
  return {
    source: label ?? (url ? `BDD compilée — ${url}` : "BDD transactions hôtelières — compilation analyste"),
    dateSource: EXTRACTION_DATE,
    auteur: auteur ?? "Équipe NOVA",
    fiabilite: fiabilite ?? "N2",
    ...(hypothese ? { hypothese } : {}),
    ...(url ? { url } : {}),
    ...(annee ? { exercice: annee } : {}),
    ...(methodology ? { methodologie: methodology } : {}),
  };
}

async function geocode(city) {
  const attempts = [
    { q: city, type: "municipality" },
    { q: city },
    { q: `${city}, France` },
  ];
  for (const attempt of attempts) {
    const url = new URL("https://api-adresse.data.gouv.fr/search/");
    url.searchParams.set("q", attempt.q);
    if (attempt.type) url.searchParams.set("type", attempt.type);
    url.searchParams.set("limit", "1");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) continue;
      const data = await response.json();
      const feature = data.features?.[0];
      const coordinates = feature?.geometry?.coordinates;
      if (!coordinates) continue;
      const context = feature.properties?.context ?? "";
      const parts = context.split(",").map((part) => part.trim()).filter(Boolean);
      const departement = /^\d{2,3}$/.test(parts[0] ?? "") ? parts[1] ?? "" : parts[0] ?? "";
      return {
        latitude: coordinates[1],
        longitude: coordinates[0],
        departement,
        label: feature.properties?.label ?? city,
      };
    } catch {
      // Tentative suivante.
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

async function main() {
  const workbook = XLSX.readFile(SOURCE);
  const sheet = workbook.Sheets["BDD Stagiaires compilée"];
  if (!sheet) throw new Error("Feuille « BDD Stagiaires compilée » introuvable.");
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headers = rows[10];
  if (headers?.[1] !== "NOM") throw new Error("En-tête NOM introuvable en ligne 11, colonne B.");
  const data = rows.slice(11).filter((row) => text(row[1]));

  // Cache de géocodage : une entrée par ville, conservée entre deux exécutions.
  let cache = {};
  try {
    cache = JSON.parse(await readFile(CACHE, "utf8"));
  } catch {
    cache = {};
  }
  const cities = [...new Set(data.map((row) => text(row[12])).filter(Boolean))];
  const missing = cities.filter((city) => !cache[city] || cache[city].echec);
  console.log(`Géocodage BAN : ${cities.length} villes, ${missing.length} à interroger.`);
  const queue = [...missing];
  const workers = Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const city = queue.shift();
      const result = await geocode(city);
      cache[city] = result ?? { echec: true };
      if (queue.length % 10 === 0) {
        await mkdir(path.dirname(CACHE), { recursive: true });
        await writeFile(CACHE, JSON.stringify(cache, null, 2));
      }
    }
  });
  await Promise.all(workers);
  await writeFile(CACHE, JSON.stringify(cache, null, 2));

  const hotels = [];
  const kpis = [];
  const transactions = [];
  const exploitations = [];
  const identities = [];

  data.forEach((row, index) => {
    const seq = String(index + 1).padStart(3, "0");
    const id = `nova-h-${seq}`;
    const nom = text(row[1]) ?? `Hôtel ${seq}`;
    const analyste = text(row[2]) ?? "Équipe NOVA";
    const dealDate = excelDate(row[3]) ?? EXTRACTION_DATE;
    const gammeBefore = parseCategory(row[4]);
    const gammeAfter = parseCategory(row[5]);
    const categorie = gammeAfter !== "Non classé" ? gammeAfter : gammeBefore;
    const region = normalizeRegion(row[11]);
    const ville = text(row[12]) ?? "Ville non renseignée";
    const localisation = text(row[13]);
    const clesBefore = positive(row[7]);
    const clesAfter = positive(row[8]);
    const cles = clesAfter ?? clesBefore ?? 0;
    const geo = cache[ville];
    const fallback = REGION_CENTERS[region] ?? [46.6, 2.4];
    const latitude = geo && !geo.echec ? geo.latitude : fallback[0];
    const longitude = geo && !geo.echec ? geo.longitude : fallback[1];
    const departement = geo && !geo.echec ? geo.departement : "";
    const hypothesisGeo =
      geo && !geo.echec
        ? "Localisation au centroïde de la commune (BAN), pas à l’adresse exacte de l’hôtel."
        : "Localisation approximative au centre de la région ; adresse non documentée dans la base.";

    const equipements = {
      restaurantGastro: bool(row[15]),
      brasserie: bool(row[17]),
      bar: bool(row[19]),
      rooftop: false,
      roomService: false,
      spa: bool(row[20]),
      spaSurface: null,
      spaCabines: null,
      piscine: bool(row[21]),
      piscineInterieure: false,
      piscineExterieure: false,
      fitness: false,
      parking: false,
      parkingPlaces: null,
      mice: bool(row[22]),
      couvertsInterieur: num(row[41]),
      couvertsExterieur: num(row[42]),
      ticketMoyen: null,
    };

    const sourceFiche = source({
      auteur: analyste,
      methodology: text(row[32]) ?? text(row[25]),
      url: text(row[33]) ?? text(row[26]),
      label: "BDD transactions hôtelières — identité et surfaces",
      hypothese: hypothesisGeo,
    });
    const sourceAvant = source({
      auteur: analyste,
      methodology: text(row[25]),
      url: text(row[26]),
      fiabilite: fiabiliteFrom(row[25], row[26]),
      label: "CA avant cession — BDD compilée",
    });
    const sourceApres = source({
      auteur: analyste,
      methodology: text(row[29]),
      url: text(row[30]),
      fiabilite: fiabiliteFrom(row[29], row[30]),
      label: "CA après cession — BDD compilée",
    });

    const hotel = {
      id,
      nom,
      groupe: "Non renseigné",
      enseigne: "Non renseigné",
      adresse: "",
      codePostal: "",
      ville,
      departement,
      region,
      latitude,
      longitude,
      categorie,
      gamme: gammeFromCategory(categorie),
      type: "Non renseigné",
      exploitation: "Non renseigné",
      proprietaire: "Non renseigné",
      exploitant: "Non renseigné",
      anneeOuverture: null,
      anneeRenovation: null,
      cles,
      suites: num(row[36]),
      surfaceTotale: positive(row[31]),
      surfaceHebergement: positive(row[34]),
      surfaceFnb: positive(row[45]),
      surfaceMice: null,
      nbSallesSeminaire: null,
      capaciteMiceMax: null,
      equipements,
      photoUrl: "",
      siteUrl: null,
      source: sourceFiche,
      demo: false,
      createdAt: GENERATED_AT,
      updatedAt: GENERATED_AT,
      // Métadonnées utiles au schéma en 7 bases.
      localisation,
    };
    hotels.push(hotel);

    // Base Identité : une observation à la date de la transaction.
    const equipementsHorsResto = [
      bool(row[15]) ? "Restaurant gastronomique" : null,
      bool(row[17]) ? "Brasserie" : null,
      bool(row[19]) ? "Bar" : null,
      bool(row[20]) ? "Spa / bien-être" : null,
      bool(row[21]) ? "Piscine" : null,
      bool(row[22]) ? "MICE" : null,
    ].filter(Boolean);
    identities.push({
      id: `id-${seq}`,
      hotelId: id,
      dateObservation: dealDate,
      nom,
      marque: null,
      chambres: cles,
      surfaceTotale: positive(row[31]),
      surfaceHebergement: positive(row[34]),
      equipementsHorsResto,
      source: sourceFiche,
    });

    // Base Exploitation : CA avant/après, uniquement si l'exercice et le montant sont exploitables.
    const caAvant = num(row[24]);
    const caApres = num(row[28]);
    const labelAvant = yearLabel(row[23]);
    const labelApres = yearLabel(row[27]);
    if (caAvant !== null && labelAvant) {
      exploitations.push({
        id: `exp-${seq}-avant`,
        hotelId: id,
        annee: /^(19|20)\d{2}$/.test(labelAvant) ? Number(labelAvant) : null,
        anneeLabel: labelAvant,
        ca: caAvant,
        ebitda: null,
        ebitdaPct: null,
        source: sourceAvant,
        phase: "Avant cession",
      });
    }
    if (caApres !== null && labelApres) {
      exploitations.push({
        id: `exp-${seq}-apres`,
        hotelId: id,
        annee: /^(19|20)\d{2}$/.test(labelApres) ? Number(labelApres) : null,
        anneeLabel: labelApres,
        ca: caApres,
        ebitda: null,
        ebitdaPct: null,
        source: sourceApres,
        phase: "Après cession",
      });
    }

    // Base KPI consolidée : une ligne par exercice numérique, après cession prioritaire.
    const byYear = new Map();
    if (caAvant !== null && /^(19|20)\d{2}$/.test(labelAvant ?? "")) {
      byYear.set(Number(labelAvant), { ca: caAvant, source: sourceAvant });
    }
    if (caApres !== null && /^(19|20)\d{2}$/.test(labelApres ?? "")) {
      byYear.set(Number(labelApres), { ca: caApres, source: sourceApres });
    }
    for (const [annee, value] of byYear) {
      kpis.push({
        id: `kpi-${seq}-${annee}`,
        hotelId: id,
        annee,
        caTotal: value.ca,
        caHebergement: null,
        caFnb: null,
        caAutres: null,
        to: null,
        adr: null,
        revpar: null,
        ebitda: null,
        ebitdaPct: null,
        gop: null,
        effectif: null,
        note: null,
        nbAvis: null,
        source: value.source,
      });
    }

    transactions.push({
      id: `txn-${seq}`,
      hotelId: id,
      date: dealDate,
      acheteur: null,
      vendeur: null,
      prix: null,
      prixParCle: null,
      type: null,
      caAvant,
      caApres,
      exerciceCaAvant: labelAvant,
      exerciceCaApres: labelApres,
      gammeAvant: gammeBefore,
      gammeApres: gammeAfter,
      clesAvant: clesBefore,
      clesApres: clesAfter,
      analyste,
      localisation,
      sourceAvant,
      sourceApres,
      source: source({
        auteur: analyste,
        methodology: "Compilation transactionnelle",
        url: text(row[6]) ?? text(row[9]),
        label: "BDD transactions hôtelières — opération",
        hypothese: "Prix de transaction non documenté dans le fichier fourni.",
      }),
      confidentielClient: false,
    });
  });

  // Exercice de référence : celui qui contient le plus de CA renseignés.
  const yearCounts = new Map();
  for (const kpi of kpis) yearCounts.set(kpi.annee, (yearCounts.get(kpi.annee) ?? 0) + 1);
  const referenceYear = [...yearCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 2025;

  const users = [
    { id: "u-1", nom: "Camille Laurent", initiales: "CL", email: "camille.laurent@nova-conseil.fr", role: "Admin", accesConfidentiel: true, actif: true },
    { id: "u-2", nom: "Hugo Mercier", initiales: "HM", email: "hugo.mercier@nova-conseil.fr", role: "Contributeur", accesConfidentiel: false, actif: true },
    { id: "u-3", nom: "Inès Barthe", initiales: "IB", email: "ines.barthe@nova-conseil.fr", role: "Contributeur", accesConfidentiel: false, actif: true },
    { id: "u-4", nom: "Louis Vasseur", initiales: "LV", email: "louis.vasseur@nova-conseil.fr", role: "Lecteur", accesConfidentiel: false, actif: true },
  ];

  const audit = [
    {
      id: "audit-1",
      date: "2026-10-20T08:00:00.000Z",
      userId: "u-1",
      action: "Chargement de la base compilée",
      target: "BDD transactions hôtelières - vcompilée.xlsx",
      details: `${hotels.length} hôtels, ${transactions.length} transactions, ${kpis.length} exercices de CA.`,
    },
    {
      id: "audit-2",
      date: "2026-10-20T08:05:00.000Z",
      userId: "u-1",
      action: "Contrôle de traçabilité",
      target: "Base NOVA",
      details: "Aucun EBITDA, prix de transaction, prix/nuit, MICE détaillé ni valorisation inventé.",
    },
  ];

  const tasks = [];
  const missingCa = hotels.filter((hotel) => !kpis.some((kpi) => kpi.hotelId === hotel.id));
  const missingSurface = hotels.filter((hotel) => hotel.surfaceTotale === null);
  const pushTask = (hotel, champ, priorite, statut, index) => {
    tasks.push({
      id: `task-${index + 1}`,
      hotelId: hotel.id,
      hotelNom: hotel.nom,
      champ,
      region: hotel.region,
      assigneeId: index % 3 === 0 ? "u-2" : index % 3 === 1 ? "u-3" : "u-1",
      priorite,
      statut,
      echeance: index % 4 === 0 ? "2026-10-15" : "2026-11-30",
    });
  };
  missingCa.slice(0, 8).forEach((hotel, index) => pushTask(hotel, "Compléter le CA", index < 4 ? "Haute" : "Moyenne", index < 5 ? "À faire" : "En cours", index));
  missingSurface.slice(0, 6).forEach((hotel, index) => pushTask(hotel, "Surface totale", "Moyenne", index < 2 ? "À faire" : "Fait", 8 + index));

  const withKpi = hotels.filter((hotel) => kpis.some((kpi) => kpi.hotelId === hotel.id));
  const initialHotels = withKpi.slice(0, 6);

  const savedSelections = [];
  const benchmarks = [];
  if (initialHotels.length >= 2) {
    const baselineFilters = {
      search: "",
      annee: referenceYear,
      categories: [],
      gammes: [],
      types: [],
      exploitations: [],
      groupes: [],
      equipements: [],
      fiabiliteMin: "all",
      regions: [],
      departements: [],
      villes: [],
      clesMin: null,
      clesMax: null,
      adrMin: null,
      adrMax: null,
      revparMin: null,
      revparMax: null,
      toMin: null,
      toMax: null,
      caMin: null,
      caMax: null,
      anneeOuvertureMin: null,
      renovationMin: null,
      geo: null,
    };
    savedSelections.push({
      id: "sel-nova-1",
      nom: "Actifs avec CA renseigné",
      description: "Sélection de travail construite sur les hôtels dont le CA est documenté.",
      filters: { ...baselineFilters, regions: [...new Set(initialHotels.map((hotel) => hotel.region))] },
      hotelIds: initialHotels.map((hotel) => hotel.id),
      auteur: "Camille Laurent",
      createdAt: "2026-10-20T08:10:00.000Z",
      partage: true,
    });
    benchmarks.push({
      id: "bench-nova-1",
      nom: "Benchmark — actifs documentés",
      client: "Client de mission",
      mission: "Revue d’actifs",
      date: "2026-10-20",
      consultant: "Camille Laurent",
      hotelIds: initialHotels.map((hotel) => hotel.id),
      referenceId: initialHotels[0].id,
      kpis: ["caTotal", "caParCle", "cles", "surfaceTotale"],
      secteurs: [{ nom: "Panel", hotelIds: initialHotels.map((hotel) => hotel.id) }],
      annee: referenceYear,
      version: 1,
      createdAt: "2026-10-20T08:15:00.000Z",
      updatedAt: "2026-10-20T08:15:00.000Z",
      notes: "Benchmark initial créé à partir de la base compilée. Les KPI non documentés restent nuls.",
    });
  }

  const payload = {
    generatedAt: GENERATED_AT,
    sourceFile: "BDD transactions hôtelières - vcompilée.xlsx",
    sourceSheet: "BDD Stagiaires compilée",
    referenceYear,
    hotels,
    kpis,
    kpiHistory: [],
    transactions,
    exploitations,
    priceObservations: [],
    miceObservations: [],
    valuations: [],
    identities,
    pipeline: [],
    users,
    audit,
    tasks,
    savedSelections,
    benchmarks,
    imports: [
      {
        id: "import-nova-1",
        fichier: "BDD transactions hôtelières - vcompilée.xlsx",
        date: "2026-10-20T08:00:00.000Z",
        auteur: "Camille Laurent",
        lignes: data.length,
        crees: hotels.length,
        fusionnes: 0,
        ignores: 0,
        statut: "Terminé",
      },
    ],
    initialState: {
      basket: initialHotels.map((hotel) => hotel.id),
      referenceId: initialHotels[0]?.id ?? null,
      currentUserId: "u-1",
    },
  };

  await writeFile(OUTPUT, JSON.stringify(payload, null, 2));
  console.log(
    JSON.stringify(
      {
        hotels: hotels.length,
        kpis: kpis.length,
        transactions: transactions.length,
        exploitations: exploitations.length,
        identities: identities.length,
        referenceYear,
        yearCounts: Object.fromEntries([...yearCounts.entries()].sort((a, b) => a[0] - b[0])),
        regions: [...new Set(hotels.map((hotel) => hotel.region))].length,
        cities: cities.length,
        geoFailures: cities.filter((city) => cache[city]?.echec).length,
        output: OUTPUT,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
