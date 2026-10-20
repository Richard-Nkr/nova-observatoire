/**
 * Générateur du jeu de démonstration Observatoire Hôtelier.
 * 200 établissements fictifs — 5 régions — exercices 2021 à 2025.
 * Aucune donnée réelle : les noms, groupes, adresses et performances sont inventés.
 */
import fs from "node:fs";
import path from "node:path";

let seed = 20261019;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);
const int = (a, b) => Math.round(between(a, b));
const chance = (p) => rand() < p;
const round = (n, step = 1) => Math.round(n / step) * step;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const AUTHORS = [
  "Camille Laurent",
  "Hugo Mercier",
  "Inès Barthe",
  "Louis Vasseur",
  "Sofia Renard",
];

const N1_SOURCES = [
  { source: "Comptes publiés — Infogreffe", dateSource: "2026-06-30" },
  { source: "Rapport annuel groupe 2025", dateSource: "2026-04-15" },
  { source: "Relevé d'exploitation — direction de l'hôtel", dateSource: "2026-03-12" },
  { source: "Base interne Nova — données observées", dateSource: "2026-02-20" },
];
const N2_SOURCES = [
  { source: "Base interne Nova — campagne annuelle", dateSource: "2026-05-18" },
  { source: "Presse spécialisée — l'hôtellerie économique", dateSource: "2026-01-22" },
  { source: "Mission client — benchmark 2025", dateSource: "2025-11-30" },
  { source: "Site officiel de l'hôtel — tarifs publics", dateSource: "2026-09-02" },
];
const N3_HYPOTHESES = [
  "Estimation par ratio : RevPAR médian de la zone appliqué au nombre de clés.",
  "Estimation par proxy : performances moyennes des 4* comparables à moins de 10 km.",
  "Estimation à partir des tarifs publics observés et d'un TO moyen de zone de 71 %.",
];
const N3_SOURCES = [
  { source: "Estimation Nova — modèle de zone", dateSource: "2026-07-08" },
  { source: "Estimation Nova — proxy concurrentiel", dateSource: "2026-06-12" },
];

function makeSource(level, year) {
  if (level === "N3") {
    const base = pick(N3_SOURCES);
    return {
      ...base,
      dateSource: `${year === 2025 ? 2026 : year + 1}-${String(int(2, 9)).padStart(2, "0")}-${String(int(5, 27)).padStart(2, "0")}`,
      auteur: pick(AUTHORS),
      fiabilite: "N3",
      hypothese: pick(N3_HYPOTHESES),
    };
  }
  if (level === "N2") {
    const base = pick(N2_SOURCES);
    return {
      ...base,
      dateSource: `${year === 2025 ? 2026 : year + 1}-${String(int(1, 9)).padStart(2, "0")}-${String(int(5, 27)).padStart(2, "0")}`,
      auteur: pick(AUTHORS),
      fiabilite: "N2",
    };
  }
  const base = pick(N1_SOURCES);
  return {
    ...base,
    dateSource: `${year === 2025 ? 2026 : year + 1}-${String(int(1, 6)).padStart(2, "0")}-${String(int(5, 27)).padStart(2, "0")}`,
    auteur: pick(AUTHORS),
    fiabilite: "N1",
  };
}

const PHOTOS = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1559599238-308793637427?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1587985064135-0366536eab42?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1600&q=80",
];

const REGIONS = [
  {
    nom: "Île-de-France",
    code: "11",
    cities: [
      ["Paris", "75", "Paris", 48.8566, 2.3522, 1.38, 16, "8e"],
      ["Courbevoie", "92", "Hauts-de-Seine", 48.8973, 2.2528, 1.16, 3, "La Défense"],
      ["Neuilly-sur-Seine", "92", "Hauts-de-Seine", 48.884, 2.2686, 1.2, 2, "Sablon"],
      ["Levallois-Perret", "92", "Hauts-de-Seine", 48.8932, 2.2879, 1.12, 2, "Front de Seine"],
      ["Boulogne-Billancourt", "92", "Hauts-de-Seine", 48.8352, 2.2409, 1.08, 2, "Rives de Seine"],
      ["Versailles", "78", "Yvelines", 48.8014, 2.1301, 1.05, 3, "Château"],
      ["Saint-Germain-en-Laye", "78", "Yvelines", 48.897, 2.0905, 1.02, 2, "Centre"],
      ["Roissy-en-France", "95", "Val-d'Oise", 49.0044, 2.5181, 0.94, 3, "CDG"],
      ["Marne-la-Vallée", "77", "Seine-et-Marne", 48.859, 2.598, 0.95, 3, "Val d'Europe"],
      ["Fontainebleau", "77", "Seine-et-Marne", 48.4047, 2.7016, 1.02, 2, "Forêt"],
      ["Rueil-Malmaison", "92", "Hauts-de-Seine", 48.877, 2.188, 1.05, 2, "Centre"],
    ],
  },
  {
    nom: "Auvergne-Rhône-Alpes",
    code: "84",
    cities: [
      ["Lyon", "69", "Rhône", 45.764, 4.8357, 1.08, 12, "Presqu'île"],
      ["Annecy", "74", "Haute-Savoie", 45.8992, 6.1294, 1.05, 5, "Lac"],
      ["Chamonix-Mont-Blanc", "74", "Haute-Savoie", 45.9237, 6.8694, 1.18, 5, "Vallée"],
      ["Grenoble", "38", "Isère", 45.1885, 5.7245, 0.95, 4, "Centre"],
      ["Aix-les-Bains", "73", "Savoie", 45.6885, 5.9152, 1.0, 3, "Lac"],
      ["Évian-les-Bains", "74", "Haute-Savoie", 46.401, 6.588, 1.12, 3, "Rives du lac"],
      ["Megève", "74", "Haute-Savoie", 45.857, 6.617, 1.3, 3, "Mont d'Arbois"],
      ["Courchevel", "73", "Savoie", 45.4154, 6.6349, 1.55, 2, "1850"],
      ["Val-d'Isère", "73", "Savoie", 45.4482, 6.9801, 1.42, 1, "Centre"],
      ["Clermont-Ferrand", "63", "Puy-de-Dôme", 45.7772, 3.087, 0.9, 2, "Centre"],
    ],
  },
  {
    nom: "Provence-Alpes-Côte d'Azur",
    code: "93",
    cities: [
      ["Nice", "06", "Alpes-Maritimes", 43.7102, 7.262, 1.12, 10, "Promenade"],
      ["Cannes", "06", "Alpes-Maritimes", 43.5528, 7.0174, 1.32, 7, "Croisette"],
      ["Marseille", "13", "Bouches-du-Rhône", 43.2965, 5.3698, 0.98, 7, "Vieux-Port"],
      ["Aix-en-Provence", "13", "Bouches-du-Rhône", 43.5297, 5.4474, 1.04, 5, "Cours Mirabeau"],
      ["Saint-Tropez", "83", "Var", 43.2672, 6.6407, 1.45, 4, "Port"],
      ["Antibes", "06", "Alpes-Maritimes", 43.5808, 7.1251, 1.14, 3, "Cap d'Antibes"],
      ["Avignon", "84", "Vaucluse", 43.9493, 4.8055, 0.94, 2, "Remparts"],
      ["Cassis", "13", "Bouches-du-Rhône", 43.2148, 5.5386, 1.06, 1, "Calanques"],
      ["Menton", "06", "Alpes-Maritimes", 43.7745, 7.4975, 1.02, 1, "Vieille ville"],
    ],
  },
  {
    nom: "Occitanie",
    code: "76",
    cities: [
      ["Toulouse", "31", "Haute-Garonne", 43.6047, 1.4442, 1.0, 11, "Capitole"],
      ["Montpellier", "34", "Hérault", 43.6108, 3.8767, 1.0, 9, "Écusson"],
      ["Nîmes", "30", "Gard", 43.8367, 4.3601, 0.92, 5, "Arènes"],
      ["Perpignan", "66", "Pyrénées-Orientales", 42.6887, 2.8948, 0.88, 4, "Centre"],
      ["Carcassonne", "11", "Aude", 43.213, 2.349, 0.9, 4, "Cité"],
      ["Sète", "34", "Hérault", 43.4, 3.683, 0.92, 3, "Port"],
      ["Collioure", "66", "Pyrénées-Orientales", 42.526, 3.085, 1.04, 2, "Anse"],
      ["Lourdes", "65", "Hautes-Pyrénées", 43.095, -0.046, 0.78, 2, "Sanctuaire"],
    ],
  },
  {
    nom: "Nouvelle-Aquitaine",
    code: "75",
    cities: [
      ["Bordeaux", "33", "Gironde", 44.8378, -0.5792, 1.06, 11, "Chartrons"],
      ["Biarritz", "64", "Pyrénées-Atlantiques", 43.4832, -1.5586, 1.22, 6, "Grande Plage"],
      ["La Rochelle", "17", "Charente-Maritime", 46.1603, -1.1511, 0.98, 5, "Vieux-Port"],
      ["Arcachon", "33", "Gironde", 44.652, -1.178, 1.1, 4, "Ville d'Hiver"],
      ["Saint-Jean-de-Luz", "64", "Pyrénées-Atlantiques", 43.387, -1.663, 1.08, 4, "Baie"],
      ["Bayonne", "64", "Pyrénées-Atlantiques", 43.493, -1.475, 0.92, 3, "Grand Bayonne"],
      ["Poitiers", "86", "Vienne", 46.58, 0.34, 0.86, 2, "Centre"],
      ["Limoges", "87", "Haute-Vienne", 45.833, 1.261, 0.84, 2, "Centre"],
      ["Royan", "17", "Charente-Maritime", 45.628, -1.028, 0.96, 2, "Front de mer"],
      ["Périgueux", "24", "Dordogne", 45.184, 0.721, 0.88, 1, "Centre"],
    ],
  },
];

const NAME_ROOTS = [
  "Aveline", "des Cèdres", "Belvédère", "Lumière", "Alba", "du Parc",
  "Clos Fleuri", "des Arts", "Montaigne", "Cèdre Blanc", "Rive Gauche",
  "Atelier", "Petit Palais", "des Voyageurs", "Sillage", "Horizon",
  "de la Tour", "des Remparts", "du Théâtre", "des Oliviers", "Ambre",
  "Orangerie", "Pavillon", "Grand Large", "Carré d'Or", "des Dunes",
  "Rotonde", "Perspective", "Riviera", "des Alpes", "du Lac", "Canal",
  "Saint-Louis", "des Chartreux", "Beau Rivage", "Céleste", "Alcôve",
  "Mistral", "Tramontane", "Marée", "Fleur de Sel", "des Pins",
  "Échiquier", "Conti", "Sévigné", "Vendôme", "Chambord", "Turenne",
  "Mansart", "Colbert", "Sully", "Richelieu", "Marigny", "Saxe",
  "Bellechasse", "Vauban", "Trianon", "Marly", "Rambouillet", "Bréhat",
  "des Embruns", "du Cap", "Sainte-Claire", "des Basques", "des Lices",
  "de la Comédie", "des Beaux-Arts", "Saint-Marc", "des Jacobins",
  "du Palais", "des Carmes", "de la Paix", "Moderne", "République",
  "Joffre", "Carnot", "Victor-Hugo", "des Fleurs", "du Marché",
  "Saint-Antoine", "des Templiers", "de l'Horloge", "du Château",
  "des Vignes", "de la Plage", "des Roches", "du Golf", "Impérial",
  "Royal", "Majestic", "Continental", "Métropole", "Astoria", "Bristol",
];
const PREFIXES = ["Hôtel", "Maison", "Villa", "Domaine", "Résidence"];

/** Évite les constructions fautives du type « La des Embruns » ou « L' de la Tour ». */
function combineName(prefix, root) {
  if (prefix === "L'") {
    return /^(de |des |du |d')/.test(root) ? `Hôtel ${root}` : `L'${root}`;
  }
  if (["Le", "La"].includes(prefix) && /^(de |des |du |d')/.test(root)) {
    return `Hôtel ${root}`;
  }
  return `${prefix} ${root}`;
}

const GROUPS = [
  { groupe: "Groupe Aurore", enseignes: ["Aurore Hôtels", "Aurore Collection"], weight: 24 },
  { groupe: "Collection Mansart", enseignes: ["Mansart Maison", "Mansart"], weight: 17 },
  { groupe: "Groupe Solstice", enseignes: ["Solstice", "Solstice Resort"], weight: 17 },
  { groupe: "Nordis Hospitality", enseignes: ["Nordis", "Nordis Sélection"], weight: 12 },
  { groupe: "Hôtels Albatros", enseignes: ["Albatros"], weight: 11 },
  { groupe: "Maison Néra", enseignes: ["Néra", "Néra Maison"], weight: 7 },
  { groupe: "Indépendant", enseignes: ["—"], weight: 32 },
];

const OWNERS = [
  "Foncière Méridien", "SCI Beaupré", "Family Office Duval", "Famille Marchand",
  "Foncière des Rives", "Institutionnel — fonds paneuropéen", "Propriétaire privé",
  "SCI du Parc", "Groupe hôtelier familial",
];

const STREETS = [
  "rue de la Paix", "avenue des Champs", "boulevard Saint-Germain", "rue du Faubourg",
  "place de la République", "quai des Célestins", "rue des Archives", "avenue du Lac",
  "chemin des Vignes", "rue de la Plage", "cours Mirabeau", "rue Nationale",
  "allée des Cèdres", "rue du Port", "avenue de la Gare", "place du Marché",
  "rue des Remparts", "boulevard de la Mer", "rue de la Fontaine", "impasse du Moulin",
];

const REVIEWN = ["8e", "Centre", "Vieux-Port", "Lac", "Croisette"];

function categoryFor(cityName, cityFactor) {
  const premium = ["Paris", "Cannes", "Saint-Tropez", "Courchevel", "Megève", "Chamonix-Mont-Blanc", "Biarritz", "Val-d'Isère"].includes(cityName);
  const r = rand();
  if (premium) {
    if (r < 0.05) return 3;
    if (r < 0.42) return 4;
    if (r < 0.88) return 5;
    return "Palace";
  }
  if (cityFactor > 1.1) {
    if (r < 0.12) return 3;
    if (r < 0.6) return 4;
    if (r < 0.94) return 5;
    return "Palace";
  }
  if (r < 0.08) return 2;
  if (r < 0.48) return 3;
  if (r < 0.88) return 4;
  if (r < 0.99) return 5;
  return "Palace";
}

function gammeFor(cat) {
  if (cat === 1 || cat === 2) return "Économique";
  if (cat === 3) return "Milieu de gamme";
  if (cat === 4) return "Upscale";
  return "Luxe";
}

function keysFor(cat) {
  if (cat === 2) return int(18, 44);
  if (cat === 3) return int(32, 92);
  if (cat === 4) return int(55, 168);
  if (cat === 5) return int(68, 220);
  return int(90, 260);
}

function typeFor(cat, cityName) {
  const resortCities = ["Cannes", "Saint-Tropez", "Courchevel", "Megève", "Chamonix-Mont-Blanc", "Val-d'Isère", "Biarritz", "La Rochelle", "Arcachon", "Saint-Jean-de-Luz", "Royan", "Collioure", "Sète", "Annecy", "Évian-les-Bains", "Aix-les-Bains", "Nice"];
  if (resortCities.includes(cityName)) {
    if (cat === 5 || cat === "Palace") return chance(0.55) ? "Resort" : chance(0.45) ? "Loisirs" : "Boutique";
    return chance(0.55) ? "Loisirs" : "Business";
  }
  if (cat === 5 || cat === "Palace") return chance(0.5) ? "Boutique" : chance(0.25) ? "Patrimonial" : "Business";
  if (cat === 4) return chance(0.18) ? "Boutique" : chance(0.08) ? "Patrimonial" : chance(0.15) ? "Loisirs" : "Business";
  return chance(0.1) ? "Loisirs" : "Business";
}

function makeName(cat, idx, usedNames, quartier) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const root = NAME_ROOTS[(idx * 7 + attempt * 11 + int(0, 5)) % NAME_ROOTS.length];
    const prefix = PREFIXES[(idx + attempt + int(0, 2)) % PREFIXES.length];
    let name = combineName(prefix, root);
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  const fallback = `Hôtel ${NAME_ROOTS[idx % NAME_ROOTS.length]} — ${quartier}`;
  usedNames.add(fallback);
  return fallback;
}

const hotels = [];
const kpis = [];
const usedNames = new Set();
let hotelIndex = 0;

REGIONS.forEach((region) => {
  region.cities.forEach(([ville, departement, depName, lat, lng, factor, count, quartier]) => {
    for (let i = 0; i < count; i++) {
      hotelIndex++;
      const id = `demo-h-${String(hotelIndex).padStart(3, "0")}`;
      const categorie = categoryFor(ville, factor);
      const gamme = gammeFor(categorie);
      const catRank = categorie === "Palace" ? 6 : categorie;
      const group = (() => {
        let r = rand() * 100;
        for (const g of GROUPS) {
          if (r < g.weight) return g;
          r -= g.weight;
        }
        return GROUPS[GROUPS.length - 1];
      })();
      let exploitation;
      if (group.groupe === "Indépendant") exploitation = "Indépendant";
      else {
        const r = rand();
        exploitation = r < 0.38 ? "Franchise" : r < 0.72 ? "Contrat de gestion" : "Intégré";
      }
      const enseigne = group.enseignes[0] === "—" ? "Indépendant" : pick(group.enseignes);
      const nom = makeName(categorie, hotelIndex, usedNames, quartier);
      const cles = keysFor(categorie);
      const suites = int(2, Math.max(3, Math.round(cles * 0.06)));
      const hasRestaurant = chance(catRank >= 4 ? 0.88 : 0.55);
      const hasGastro = hasRestaurant && catRank >= 4 && chance(0.62);
      const hasBrasserie = hasRestaurant && chance(0.55);
      const spa = chance(catRank >= 5 ? 0.8 : catRank === 4 ? 0.55 : 0.14);
      const ticketMoyen = hasRestaurant ? round(between(38, 70) + catRank * 12, 5) : null;
      const couvertsInterieur = hasRestaurant ? Math.round(cles * between(0.55, 1.05)) : null;
      const couvertsExterieur = hasRestaurant && chance(0.55) ? Math.round((couvertsInterieur || 40) * between(0.2, 0.55)) : null;
      const surfaceHebergement = chance(0.1) ? null : Math.round(cles * between(30, 44));
      const surfaceFnb = hasRestaurant
        ? chance(0.12)
          ? null
          : Math.round((couvertsInterieur || 0) * between(2.2, 3.1) + (couvertsExterieur || 0) * 2)
        : null;
      const mice = chance(catRank >= 4 ? 0.62 : 0.22);
      const surfaceMice = mice ? Math.round(between(150, 1400) + cles * 2.2) : null;
      const nbSalles = mice ? int(2, 12) : null;
      const capaciteMice = mice ? int(40, 700) : null;
      const surfaceTotale = surfaceHebergement
        ? surfaceHebergement + (surfaceFnb || 0) + (surfaceMice || 0) + Math.round(cles * between(6, 14))
        : chance(0.5)
          ? null
          : Math.round(cles * between(40, 65));
      const equipements = {
        restaurantGastro: hasGastro,
        brasserie: hasBrasserie,
        bar: chance(catRank >= 4 ? 0.9 : 0.52),
        rooftop: chance(catRank >= 5 ? 0.38 : catRank === 4 ? 0.14 : 0.04),
        roomService: chance(catRank >= 5 ? 0.92 : catRank === 4 ? 0.64 : 0.24),
        spa,
        spaSurface: spa ? Math.round(between(120, 900) + cles * 1.3) : null,
        spaCabines: spa ? int(2, 12) : null,
        piscineInterieure: spa ? chance(0.55) : chance(0.06),
        piscineExterieure: chance(catRank >= 5 ? 0.58 : catRank === 4 ? 0.3 : 0.08),
        fitness: chance(catRank >= 4 ? 0.78 : 0.32),
        parking: chance(catRank >= 4 ? 0.72 : 0.45),
        parkingPlaces: chance(0.7) ? int(8, 90) : null,
        mice,
        couvertsInterieur,
        couvertsExterieur,
        ticketMoyen,
      };
      const cityLabel = ville === "Paris" ? `Paris ${quartier}` : ville;
      const anneeOuverture = int(1908, 2019);
      const anneeRenovation = chance(0.68) ? int(Math.max(anneeOuverture + 5, 1998), 2024) : null;
      const identitySource = {
        source: chance(0.5) ? "Base de démonstration Nova" : "Site officiel de l'hôtel (démo)",
        dateSource: `2026-${String(int(1, 9)).padStart(2, "0")}-${String(int(3, 27)).padStart(2, "0")}`,
        auteur: pick(AUTHORS),
        fiabilite: chance(0.55) ? "N1" : "N2",
      };
      const hotel = {
        id,
        nom,
        groupe: group.groupe,
        enseigne,
        adresse: `${int(2, 189)} ${pick(STREETS)}`,
        codePostal: `${departement}${String(int(0, 990)).padStart(3, "0")}`,
        ville,
        departement: depName,
        region: region.nom,
        latitude: Number((lat + between(-0.014, 0.014)).toFixed(6)),
        longitude: Number((lng + between(-0.018, 0.018)).toFixed(6)),
        categorie,
        gamme,
        type: typeFor(categorie, ville),
        exploitation,
        proprietaire: pick(OWNERS),
        exploitant: exploitation === "Indépendant" ? "Direction indépendante" : group.groupe,
        anneeOuverture,
        anneeRenovation,
        cles,
        suites,
        surfaceTotale,
        surfaceHebergement,
        surfaceFnb,
        surfaceMice,
        nbSallesSeminaire: nbSalles,
        capaciteMiceMax: capaciteMice,
        equipements,
        photoUrl: PHOTOS[hotelIndex % PHOTOS.length],
        siteUrl: chance(0.7) ? `https://hotel-demo-${hotelIndex}.example` : null,
        source: identitySource,
        demo: true,
        createdAt: "2026-01-10T09:00:00.000Z",
        updatedAt: `2026-${String(int(2, 9)).padStart(2, "0")}-${String(int(1, 27)).padStart(2, "0")}T${String(int(9, 17)).padStart(2, "0")}:${String(int(10, 55)).padStart(2, "0")}:00.000Z`,
      };
      hotels.push(hotel);

      // Certains établissements n'ont pas encore remonté 2024 et 2025 (file qualité).
      const lastYear = hotelIndex % 23 === 0 ? 2022 : hotelIndex % 17 === 0 ? 2023 : hotelIndex % 31 === 0 ? 2024 : 2025;
      const baseAdr = (categorie === "Palace" ? 690 : categorie === 5 ? 330 : categorie === 4 ? 168 : categorie === 3 ? 98 : 64) * factor * between(0.86, 1.18);
      const baseTo = (categorie === "Palace" ? 0.76 : categorie === 5 ? 0.73 : categorie === 4 ? 0.71 : 0.67) * between(0.92, 1.06);
      const yearAdrIndex = { 2021: 0.8, 2022: 0.9, 2023: 0.99, 2024: 1.05, 2025: 1.1 };
      const yearToFactor = { 2021: 0.62, 2022: 0.86, 2023: 0.98, 2024: 1.01, 2025: 1.02 };
      for (let year = 2021; year <= lastYear; year++) {
        const adrBase = baseAdr * yearAdrIndex[year] * between(0.96, 1.04);
        const to = clamp(baseTo * yearToFactor[year] * between(0.96, 1.04), 0.28, 0.92);
        const revpar = adrBase * to;
        const caHebergement = revpar * 365 * cles;
        const caFnb = hasRestaurant ? cles * between(3200, 9200) * (1 + (year - 2021) * 0.04) * (categorie === "Palace" ? 1.5 : categorie === 5 ? 1.2 : 1) : null;
        const caAutres = (spa || mice) ? cles * between(900, 3800) * (1 + (year - 2021) * 0.05) : null;
        const caTotal = caHebergement + (caFnb || 0) + (caAutres || 0);
        const ebitdaPct = clamp((categorie === "Palace" ? 0.33 : categorie === 5 ? 0.3 : categorie === 4 ? 0.26 : 0.21) * between(0.85, 1.15), 0.12, 0.42);
        const ebitda = caTotal * ebitdaPct;
        const gop = ebitda * between(1.05, 1.16);
        const effectif = Math.round(cles / between(1.25, 2.1));
        const note = Number(clamp(7.2 + (catRank - 3) * 0.35 + between(-0.5, 0.6), 6.4, 9.7).toFixed(1));
        const nbAvis = Math.round(cles * between(3, 22) + between(60, 300));
        const reliabilityRoll = rand();
        const level = reliabilityRoll < 0.4 ? "N1" : reliabilityRoll < 0.78 ? "N2" : "N3";
        const source = makeSource(level, year);
        const nullify = (v, p = 0.07) => (chance(p) ? null : v);
        const toValue = nullify(Number(to.toFixed(3)), 0.06);
        const adrValue = nullify(round(adrBase, 5));
        const revparValue =
          toValue != null && adrValue != null
            ? Math.round(toValue * adrValue)
            : null;
        kpis.push({
          id: `kpi-${id}-${year}`,
          hotelId: id,
          annee: year,
          caTotal: nullify(round(caTotal, 1000)),
          caHebergement: nullify(round(caHebergement, 1000)),
          caFnb: caFnb === null ? null : nullify(round(caFnb, 1000)),
          caAutres: caAutres === null ? null : nullify(round(caAutres, 1000)),
          to: toValue,
          adr: adrValue,
          revpar: revparValue,
          ebitda: nullify(round(ebitda, 1000)),
          ebitdaPct: nullify(Number(ebitdaPct.toFixed(3)), 0.09),
          gop: nullify(round(gop, 1000)),
          effectif: nullify(effectif, 0.08),
          note: nullify(note, 0.09),
          nbAvis: nullify(nbAvis, 0.09),
          source,
        });
      }
    }
  });
});

// Quelques 5* emblématiques passent Palace pour enrichir la démonstration.
const premiumNames = ["Paris", "Cannes", "Courchevel", "Saint-Tropez", "Megève", "Chamonix-Mont-Blanc"];
hotels
  .filter((h) => premiumNames.includes(h.ville) && h.categorie === 5)
  .filter((_, i) => i % 3 === 0)
  .slice(0, 6)
  .forEach((h) => {
    h.categorie = "Palace";
    h.gamme = "Luxe";
  });

// Transactions fictives : 54 opérations, dont quelques dossiers confidentiels.
const BUYERS = [
  "Foncière Méridien", "Ardent Capital", "Family Office Duval", "Groupe Solstice",
  "Collection Mansart", "Fonds Alizé", "Prima Invest", "SCI Beaupré", "Aurore Hôtels",
  "Private investor — family office", "Nordis Hospitality", "Foncière des Rives",
];
const SELLERS = [
  "Famille Marchand", "SCI du Parc", "Foncière historique", "Groupe hôtelier familial",
  "Fonds paneuropéen", "Propriétaire privé", "Hôtels Albatros", "SCI Belles Rives",
];
const transactions = [];
const tHotels = hotels.filter((_, i) => i % 4 === 0 || (i % 7 === 1 && i % 3 === 0)).slice(0, 62);
tHotels.forEach((h, i) => {
  if (i % 9 === 5) return;
  const catRank = h.categorie === "Palace" ? 6 : h.categorie;
  const pricePerKeyBase = [60000, 80000, 110000, 160000, 260000, 520000][Math.max(0, catRank - 1)];
  const factor = h.region === "Île-de-France" ? 1.25 : h.region === "Provence-Alpes-Côte d'Azur" ? 1.15 : h.region === "Auvergne-Rhône-Alpes" ? 1.05 : 0.92;
  const prixParCle = round(pricePerKeyBase * factor * between(0.82, 1.3), 5000);
  const type = pick(["Murs", "Murs + fonds", "Fonds", "Murs + fonds"]);
  const year = int(2019, 2026);
  const month = String(int(1, 12)).padStart(2, "0");
  const day = String(int(1, 27)).padStart(2, "0");
  const caRef = kpis.find((k) => k.hotelId === h.id && k.annee === 2024)?.caTotal ?? h.cles * between(90000, 160000);
  const level = pick(["N1", "N2", "N2", "N3"]);
  transactions.push({
    id: `tx-${String(i + 1).padStart(3, "0")}`,
    hotelId: h.id,
    date: `${year}-${month}-${day}`,
    acheteur: pick(BUYERS),
    vendeur: pick(SELLERS),
    prix: prixParCle * h.cles,
    prixParCle,
    type,
    caAvant: chance(0.6) ? round(caRef * between(0.86, 0.98), 1000) : null,
    caApres: chance(0.55) ? round(caRef * between(1.02, 1.24), 1000) : null,
    source:
      level === "N3"
        ? {
            source: "Estimation Nova — valeur de marché",
            dateSource: `${year + 1}-02-15`,
            auteur: pick(AUTHORS),
            fiabilite: "N3",
            hypothese: "Prix reconstitué à partir du prix par clé médian de la zone et de la catégorie.",
          }
        : {
            source: level === "N1" ? "Actes notariés — base interne" : "Presse spécialisée — transactions hôtelières",
            dateSource: `${year + 1}-01-20`,
            auteur: pick(AUTHORS),
            fiabilite: level,
          },
    confidentielClient: i % 13 === 4,
  });
});

// Pipeline fictif
const pipeline = [];
for (let i = 0; i < 28; i++) {
  const h = pick(hotels);
  pipeline.push({
    id: `pipe-${String(i + 1).padStart(3, "0")}`,
    nom: combineName(pick(["Hôtel", "Maison", "Villa"]), pick(NAME_ROOTS)),
    ville: h.ville,
    region: h.region,
    categorie: pick([4, 4, 5, 5, "Palace", 3]),
    cles: int(40, 220),
    ouverture: int(2026, 2029),
    statut: pick(["En construction", "Permis accordé", "Annoncé", "Rénovation"]),
    promoteur: pick(BUYERS),
  });
}
pipeline.sort((a, b) => a.ouverture - b.ouverture);

const users = [
  { id: "u-1", nom: "Camille Laurent", initiales: "CL", email: "camille.laurent@nova-conseil.fr", role: "Admin", accesConfidentiel: true, actif: true },
  { id: "u-2", nom: "Hugo Mercier", initiales: "HM", email: "hugo.mercier@nova-conseil.fr", role: "Contributeur", accesConfidentiel: true, actif: true },
  { id: "u-3", nom: "Inès Barthe", initiales: "IB", email: "ines.barthe@nova-conseil.fr", role: "Contributeur", accesConfidentiel: false, actif: true },
  { id: "u-4", nom: "Louis Vasseur", initiales: "LV", email: "louis.vasseur@nova-conseil.fr", role: "Lecteur", accesConfidentiel: false, actif: true },
  { id: "u-5", nom: "Sofia Renard", initiales: "SR", email: "sofia.renard@nova-conseil.fr", role: "Contributeur", accesConfidentiel: true, actif: true },
  { id: "u-6", nom: "Antoine Rey", initiales: "AR", email: "antoine.rey@nova-conseil.fr", role: "Lecteur", accesConfidentiel: false, actif: false },
];

const audit = [
  { id: "a-1", date: "2026-10-19T16:42:00.000Z", userId: "u-1", action: "Export Excel", target: "Sélection Courbevoie · 4-5* avec spa", details: "12 hôtels · 1 964 clés · export externe" },
  { id: "a-2", date: "2026-10-19T11:20:00.000Z", userId: "u-2", action: "Mise à jour KPI", target: "Hôtel des Cèdres Paris 8e", details: "ADR 2025 : 428 € · source N1" },
  { id: "a-3", date: "2026-10-18T15:05:00.000Z", userId: "u-5", action: "Import de données", target: "Mission Côte d'Azur — été 2026", details: "34 lignes · 12 créées · 19 fusionnées" },
  { id: "a-4", date: "2026-10-18T09:31:00.000Z", userId: "u-1", action: "Création de benchmark", target: "Benchmark Courbevoie — repositionnement 4*", details: "Version 2 · 12 hôtels" },
  { id: "a-5", date: "2026-10-17T17:12:00.000Z", userId: "u-3", action: "Export PowerPoint", target: "Benchmark Côte d'Azur — Palace & 5*", details: "4 slides · données N1-N3" },
  { id: "a-6", date: "2026-10-16T14:48:00.000Z", userId: "u-2", action: "Consultation confidentielle", target: "Transaction — Hôtel Lumière Cannes", details: "Accès dossier client autorisé" },
  { id: "a-7", date: "2026-10-15T10:26:00.000Z", userId: "u-5", action: "Mise à jour KPI", target: "Maison Aveline Bordeaux", details: "TO 2024 : 74,1 % · source N2" },
  { id: "a-8", date: "2026-10-14T16:03:00.000Z", userId: "u-1", action: "Attribution de tâche", target: "Complétude — 18 fiches à enrichir", details: "Attribué à Inès Barthe" },
  { id: "a-9", date: "2026-10-13T12:55:00.000Z", userId: "u-3", action: "Export CSV", target: "Sélection Lyon · upscale", details: "9 hôtels · export externe" },
  { id: "a-10", date: "2026-10-12T09:14:00.000Z", userId: "u-2", action: "Création de sélection", target: "Côte d'Azur · luxe", details: "Partagée avec l'équipe" },
  { id: "a-11", date: "2026-10-10T17:33:00.000Z", userId: "u-1", action: "Modification utilisateur", target: "Inès Barthe", details: "Rôle contributeur · accès confidentiel désactivé" },
  { id: "a-12", date: "2026-10-09T11:08:00.000Z", userId: "u-5", action: "Import de données", target: "Enrichissement spa — Alpes", details: "18 lignes · 7 fusionnées · 2 ignorées" },
];

const taskChamps = ["Surface F&B", "Nombre de cabines spa", "Ticket moyen F&B", "Effectif ETP 2025", "Note et nombre d'avis", "Surface MICE", "ADR 2025", "CA F&B 2025", "Année de rénovation"];
const tasks = [];
const staleHotels = hotels.filter((h) => !kpis.some((k) => k.hotelId === h.id && k.annee === 2025)).slice(0, 12);
staleHotels.forEach((h, i) => {
  tasks.push({
    id: `task-${String(i + 1).padStart(3, "0")}`,
    hotelId: h.id,
    hotelNom: h.nom,
    champ: taskChamps[i % taskChamps.length],
    region: h.region,
    assigneeId: i % 3 === 0 ? "u-3" : i % 3 === 1 ? "u-5" : null,
    priorite: i < 4 ? "Haute" : i < 9 ? "Moyenne" : "Basse",
    statut: i < 2 ? "En cours" : "À faire",
    echeance: `2026-11-${String(4 + i).padStart(2, "0")}`,
  });
});
for (let i = 0; i < 4; i++) {
  const h = pick(hotels);
  tasks.push({
    id: `task-1${String(i + 1).padStart(2, "0")}`,
    hotelId: h.id,
    hotelNom: h.nom,
    champ: pick(taskChamps),
    region: h.region,
    assigneeId: pick(["u-2", "u-3", "u-5"]),
    priorite: pick(["Moyenne", "Basse"]),
    statut: pick(["À faire", "En cours", "Fait"]),
    echeance: `2026-11-${String(12 + i).padStart(2, "0")}`,
  });
}

const emptyFilters = {
  search: "",
  annee: 2025,
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
  caMin: null,
  anneeOuvertureMin: null,
  renovationMin: null,
  geo: null,
};

const complete2025 = new Set(kpis.filter((k) => k.annee === 2025).map((k) => k.hotelId));
const nearbyLux = hotels.filter((h) => h.region === "Île-de-France" && ["Courbevoie", "Neuilly-sur-Seine", "Levallois-Perret", "Rueil-Malmaison"].includes(h.ville) && (h.categorie === 4 || h.categorie === 5 || h.categorie === "Palace") && complete2025.has(h.id));
const idfSpa = hotels.filter((h) => h.region === "Île-de-France" && ["Courbevoie", "Neuilly-sur-Seine", "Levallois-Perret", "Rueil-Malmaison"].includes(h.ville) && (h.categorie === 4 || h.categorie === 5 || h.categorie === "Palace") && h.equipements.spa && complete2025.has(h.id)).slice(0, 14);
const azurLux = hotels.filter((h) => h.region === "Provence-Alpes-Côte d'Azur" && (h.categorie === 5 || h.categorie === "Palace")).slice(0, 18);
const alpesSki = hotels.filter((h) => ["Chamonix-Mont-Blanc", "Courchevel", "Megève", "Val-d'Isère", "Annecy"].includes(h.ville) && (h.categorie === 4 || h.categorie === 5 || h.categorie === "Palace")).slice(0, 12);

const savedSelections = [
  {
    id: "sel-1",
    nom: "Courbevoie · 4-5* avec spa",
    description: "Concurrents directs autour de La Défense, rayon 15 km, avec spa.",
    filters: {
      ...emptyFilters,
      categories: [4, 5, "Palace"],
      equipements: ["spa"],
      geo: { type: "circle", center: { lat: 48.897, lng: 2.253 }, radiusKm: 15, label: "Courbevoie" },
    },
    hotelIds: idfSpa.map((h) => h.id),
    auteur: "Camille Laurent",
    createdAt: "2026-09-22T09:30:00.000Z",
    partage: true,
  },
  {
    id: "sel-2",
    nom: "Côte d'Azur · 5* et Palace",
    description: "Panel luxe de Nice à Saint-Tropez pour une étude de repositionnement.",
    filters: {
      ...emptyFilters,
      categories: [5, "Palace"],
      regions: ["Provence-Alpes-Côte d'Azur"],
      villes: ["Nice", "Cannes", "Antibes", "Saint-Tropez"],
    },
    hotelIds: azurLux.map((h) => h.id),
    auteur: "Camille Laurent",
    createdAt: "2026-10-12T14:05:00.000Z",
    partage: true,
  },
  {
    id: "sel-3",
    nom: "Alpes · ski 4-5*",
    description: "Hôtels de montagne avec spa et équipements MICE.",
    filters: {
      ...emptyFilters,
      categories: [4, 5, "Palace"],
      regions: ["Auvergne-Rhône-Alpes"],
      equipements: ["spa"],
      villes: ["Chamonix-Mont-Blanc", "Courchevel", "Megève", "Val-d'Isère"],
    },
    hotelIds: alpesSki.map((h) => h.id),
    auteur: "Sofia Renard",
    createdAt: "2026-08-30T10:12:00.000Z",
    partage: false,
  },
];

const idfBenchHotels = hotels.filter((h) => ["Courbevoie", "Neuilly-sur-Seine", "Levallois-Perret", "Rueil-Malmaison"].includes(h.ville) && (h.categorie === 4 || h.categorie === 5 || h.categorie === "Palace") && complete2025.has(h.id)).slice(0, 12);
const azurBenchHotels = hotels.filter((h) => ["Nice", "Cannes", "Antibes", "Saint-Tropez", "Marseille"].includes(h.ville) && (h.categorie === 5 || h.categorie === "Palace")).slice(0, 16);

const benchmarks = [
  {
    id: "bm-1",
    nom: "Benchmark Courbevoie — repositionnement 4*",
    client: "Foncière Beaupré",
    mission: "Repositionnement d'actif",
    date: "2026-09-18",
    consultant: "Camille Laurent",
    hotelIds: idfBenchHotels.map((h) => h.id),
    referenceId: idfBenchHotels[0]?.id ?? null,
    kpis: ["adr", "to", "revpar", "caTotal", "ebitdaPct", "note"],
    secteurs: [
      { nom: "La Défense / Courbevoie", hotelIds: idfBenchHotels.filter((h) => h.ville === "Courbevoie").map((h) => h.id) },
      { nom: "Neuilly / Levallois", hotelIds: idfBenchHotels.filter((h) => ["Neuilly-sur-Seine", "Levallois-Perret"].includes(h.ville)).map((h) => h.id) },
      { nom: "Rueil / ouest 92", hotelIds: idfBenchHotels.filter((h) => h.ville === "Rueil-Malmaison").map((h) => h.id) },
    ],
    annee: 2025,
    version: 2,
    createdAt: "2026-09-18T08:30:00.000Z",
    updatedAt: "2026-10-18T09:31:00.000Z",
    notes: "Scénario de repositionnement : montée en gamme 4* supérieure, ajout d'un spa de 400 m² et repositionnement tarifaire de +18 %.",
  },
  {
    id: "bm-2",
    nom: "Benchmark Côte d'Azur — Palace & 5*",
    client: "Family Office Duval",
    mission: "Due diligence acquisition",
    date: "2026-06-05",
    consultant: "Hugo Mercier",
    hotelIds: azurBenchHotels.map((h) => h.id),
    referenceId: azurBenchHotels[0]?.id ?? null,
    kpis: ["adr", "to", "revpar", "caTotal", "ebitdaPct", "note"],
    secteurs: [
      { nom: "Cannes / Croisette", hotelIds: azurBenchHotels.filter((h) => h.ville === "Cannes").map((h) => h.id) },
      { nom: "Nice / Promenade", hotelIds: azurBenchHotels.filter((h) => h.ville === "Nice").map((h) => h.id) },
      { nom: "Antibes / Saint-Tropez", hotelIds: azurBenchHotels.filter((h) => ["Antibes", "Saint-Tropez", "Marseille"].includes(h.ville)).map((h) => h.id) },
    ],
    annee: 2025,
    version: 1,
    createdAt: "2026-06-05T14:10:00.000Z",
    updatedAt: "2026-06-05T14:10:00.000Z",
    notes: "Panel de référence pour l'évaluation d'un actif 5* sur la Croisette.",
  },
  {
    id: "bm-3",
    nom: "Lyon — comparaison upscale",
    client: "Groupe Aurore",
    mission: "Étude de marché",
    date: "2026-03-12",
    consultant: "Sofia Renard",
    hotelIds: hotels.filter((h) => h.ville === "Lyon" && (h.categorie === 4 || h.categorie === 5)).slice(0, 10).map((h) => h.id),
    referenceId: hotels.find((h) => h.ville === "Lyon" && h.categorie === 4)?.id ?? null,
    kpis: ["adr", "to", "revpar", "effectif"],
    secteurs: [{ nom: "Lyon centre", hotelIds: hotels.filter((h) => h.ville === "Lyon" && (h.categorie === 4 || h.categorie === 5)).slice(0, 10).map((h) => h.id) }],
    annee: 2024,
    version: 1,
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z",
    notes: "Première approche, à rafraîchir avec les données 2025.",
  },
];

const imports = [
  { id: "imp-1", fichier: "mission-cote-azur-2026.xlsx", date: "2026-10-18T15:05:00.000Z", auteur: "Sofia Renard", lignes: 34, crees: 12, fusionnes: 19, ignores: 3, statut: "Terminé" },
  { id: "imp-2", fichier: "spa-alpes-enrichissement.csv", date: "2026-10-09T11:08:00.000Z", auteur: "Sofia Renard", lignes: 18, crees: 0, fusionnes: 16, ignores: 2, statut: "Terminé" },
  { id: "imp-3", fichier: "ouest-parisien-2026.csv", date: "2026-09-26T09:42:00.000Z", auteur: "Hugo Mercier", lignes: 47, crees: 21, fusionnes: 23, ignores: 3, statut: "Terminé" },
  { id: "imp-4", fichier: "bordeaux-lac-2026.xlsx", date: "2026-09-04T16:18:00.000Z", auteur: "Inès Barthe", lignes: 22, crees: 8, fusionnes: 11, ignores: 3, statut: "Terminé" },
];

const data = {
  generatedAt: "2026-10-19T08:00:00.000Z",
  hotels,
  kpis,
  transactions,
  pipeline,
  users,
  audit,
  tasks,
  savedSelections,
  benchmarks,
  imports,
  initialState: {
    basket: nearbyLux.slice(0, 6).map((h) => h.id),
    referenceId: nearbyLux[0]?.id ?? null,
    currentUserId: "u-1",
  },
};

const out = path.resolve("src/data/demo.json");
fs.writeFileSync(out, JSON.stringify(data));
console.log("OK", hotels.length, "hôtels,", kpis.length, "lignes KPI,", transactions.length, "transactions");
console.log("Fichier:", out, (fs.statSync(out).size / 1024).toFixed(0) + " Ko");
