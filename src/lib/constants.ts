import type {
  Categorie,
  EquipmentFilter,
  Fiabilite,
  Gamme,
  HotelType,
  Exploitation,
  KpiKey,
} from "./types";

export const APP_NAME = "Observatoire Hôtelier";
export const BRAND = "NOVA OBSERVATOIRE";
export const DEMO_LABEL = "Base compilée · données de mission";
export const CURRENT_DATA_YEAR = 2024;
export const EXTRACTION_DATE = "2026-10-20";

export const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

export const CATEGORIES: Categorie[] = [2, 3, 4, 5, "Palace", "Non classé"];
export const CATEGORY_LABEL: Record<string, string> = {
  "2": "2★",
  "3": "3★",
  "4": "4★",
  "5": "5★",
  Palace: "Palace",
  "Non classé": "Non classé",
};

export const CATEGORY_COLOR: Record<string, string> = {
  "2": "#9AA7AE",
  "3": "#7F98A6",
  "4": "#3E728D",
  "5": "#174965",
  Palace: "#B1844B",
  "Non classé": "#A8A39A",
};

export const GAMMES: Gamme[] = [
  "Économique",
  "Milieu de gamme",
  "Upscale",
  "Luxe",
  "Non renseigné",
];

export const HOTEL_TYPES: HotelType[] = [
  "Business",
  "Loisirs",
  "Resort",
  "Boutique",
  "Patrimonial",
  "Non renseigné",
];

export const EXPLOITATIONS: Exploitation[] = [
  "Indépendant",
  "Franchise",
  "Contrat de gestion",
  "Intégré",
  "Non renseigné",
];

export const GROUPES = ["Non renseigné"];

export const RELIABILITY_META: Record<
  Fiabilite,
  { label: string; description: string; color: string; bg: string; border: string }
> = {
  N1: {
    label: "N1",
    description: "Observable / vérifié",
    color: "#256B4E",
    bg: "#E7F1EB",
    border: "#BED9CA",
  },
  N2: {
    label: "N2",
    description: "Recherche approfondie",
    color: "#9A5D10",
    bg: "#F8EDDB",
    border: "#E8D0A9",
  },
  N3: {
    label: "N3",
    description: "Estimé",
    color: "#6C7074",
    bg: "#F0F0ED",
    border: "#D9D8D2",
  },
};

export const EQUIPMENT_FILTERS: {
  key: EquipmentFilter;
  label: string;
}[] = [
  { key: "spa", label: "Spa" },
  { key: "piscine", label: "Piscine" },
  { key: "restaurantGastro", label: "Restaurant gastro." },
  { key: "brasserie", label: "Brasserie" },
  { key: "bar", label: "Bar" },
  { key: "rooftop", label: "Rooftop" },
  { key: "mice", label: "MICE" },
  { key: "parking", label: "Parking" },
];

export const KPI_LABELS: Record<KpiKey, { label: string; unit: string; short: string; direction: 1 | 0 | -1 }> = {
  caTotal: { label: "Chiffre d'affaires total", unit: "€ HT", short: "CA total", direction: 1 },
  caHebergement: { label: "CA hébergement", unit: "€ HT", short: "CA hébergement", direction: 1 },
  caFnb: { label: "CA F&B", unit: "€ HT", short: "CA F&B", direction: 1 },
  caAutres: { label: "CA autres (spa, MICE)", unit: "€ HT", short: "CA autres", direction: 1 },
  to: { label: "Taux d'occupation", unit: "%", short: "TO", direction: 1 },
  adr: { label: "Prix moyen", unit: "€ HT", short: "ADR", direction: 1 },
  revpar: { label: "RevPAR", unit: "€ HT", short: "RevPAR", direction: 1 },
  ebitdaPct: { label: "Marge EBITDA", unit: "%", short: "EBITDA %", direction: 1 },
  effectif: { label: "Effectif", unit: "ETP", short: "ETP", direction: 0 },
  note: { label: "Note en ligne", unit: "/10", short: "Note", direction: 1 },
  cles: { label: "Nombre de clés", unit: "clés", short: "Clés", direction: 1 },
  surfaceTotale: { label: "Surface totale", unit: "m²", short: "Surface", direction: 1 },
  caParCle: { label: "CA par clé", unit: "€ HT", short: "CA / clé", direction: 1 },
  partFnb: { label: "Part F&B dans le CA", unit: "%", short: "Part F&B", direction: 1 },
  m2ParCle: { label: "Surface par clé", unit: "m²", short: "m² / clé", direction: 1 },
};

export const COMPARATOR_KPIS: KpiKey[] = [
  "caTotal",
  "caParCle",
  "cles",
  "surfaceTotale",
];

export const MARKET_ZONES = [
  "France métropolitaine",
  "Île-de-France",
  "Auvergne-Rhône-Alpes",
  "Provence-Alpes-Côte d'Azur",
  "Occitanie",
  "Nouvelle-Aquitaine",
  "Grand Est",
  "Hauts-de-France",
  "Bretagne",
  "Pays de la Loire",
  "Centre-Val de Loire",
  "Bourgogne-Franche-Comté",
  "Normandie",
  "Corse",
  "Martinique",
];

export const MISSIONS = [
  "Benchmark concurrentiel",
  "Étude de marché",
  "Due diligence",
  "Repositionnement d'actif",
  "Revue de performance",
  "Autre",
];
