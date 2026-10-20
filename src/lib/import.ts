import type { Categorie, Hotel, SourceRef } from "./types";
import { haversineKm } from "./geo";

/**
 * Outils d'import : mapping des colonnes, normalisation des valeurs,
 * détection de doublons et géocodage BAN. Aucune valeur absente n'est inventée :
 * les champs non mappés restent nuls ou vides.
 */

export type ImportFieldKey =
  | "nom"
  | "adresse"
  | "codePostal"
  | "ville"
  | "departement"
  | "region"
  | "categorie"
  | "gamme"
  | "groupe"
  | "enseigne"
  | "cles"
  | "anneeOuverture"
  | "anneeRenovation"
  | "latitude"
  | "longitude"
  | "adr"
  | "to"
  | "revpar"
  | "caTotal";

export interface ImportField {
  key: ImportFieldKey;
  label: string;
  group: "Hôtel" | "Indicateur";
  required?: boolean;
}

export const IMPORT_FIELDS: ImportField[] = [
  { key: "nom", label: "Nom de l’hôtel", group: "Hôtel", required: true },
  { key: "adresse", label: "Adresse", group: "Hôtel" },
  { key: "codePostal", label: "Code postal", group: "Hôtel" },
  { key: "ville", label: "Ville", group: "Hôtel", required: true },
  { key: "departement", label: "Département", group: "Hôtel" },
  { key: "region", label: "Région", group: "Hôtel" },
  { key: "categorie", label: "Catégorie (1 à 5 ou Palace)", group: "Hôtel", required: true },
  { key: "gamme", label: "Gamme", group: "Hôtel" },
  { key: "groupe", label: "Groupe", group: "Hôtel" },
  { key: "enseigne", label: "Enseigne", group: "Hôtel" },
  { key: "cles", label: "Nombre de clés", group: "Hôtel", required: true },
  { key: "anneeOuverture", label: "Année d’ouverture", group: "Hôtel" },
  { key: "anneeRenovation", label: "Année de rénovation", group: "Hôtel" },
  { key: "latitude", label: "Latitude", group: "Hôtel" },
  { key: "longitude", label: "Longitude", group: "Hôtel" },
  { key: "caTotal", label: "CA total de l’exercice (€)", group: "Indicateur" },
  { key: "adr", label: "ADR (€)", group: "Indicateur" },
  { key: "to", label: "Taux d’occupation (%)", group: "Indicateur" },
  { key: "revpar", label: "RevPAR (€)", group: "Indicateur" },
];

const ALIASES: Record<string, ImportFieldKey> = {
  nom: "nom",
  name: "nom",
  hotel: "nom",
  hotelnom: "nom",
  etablissement: "nom",
  adresse: "adresse",
  address: "adresse",
  adressepostale: "adresse",
  codepostal: "codePostal",
  cp: "codePostal",
  postal: "codePostal",
  zip: "codePostal",
  ville: "ville",
  city: "ville",
  commune: "ville",
  departement: "departement",
  department: "departement",
  dept: "departement",
  region: "region",
  categorie: "categorie",
  category: "categorie",
  etoiles: "categorie",
  classement: "categorie",
  gamme: "gamme",
  segment: "gamme",
  groupe: "groupe",
  group: "groupe",
  enseigne: "enseigne",
  marque: "enseigne",
  cles: "cles",
  chambres: "cles",
  rooms: "cles",
  keys: "cles",
  nbcles: "cles",
  anneeouverture: "anneeOuverture",
  ouverture: "anneeOuverture",
  openingyear: "anneeOuverture",
  anneerenovation: "anneeRenovation",
  renovation: "anneeRenovation",
  latitude: "latitude",
  lat: "latitude",
  longitude: "longitude",
  lng: "longitude",
  lon: "longitude",
  long: "longitude",
  ca: "caTotal",
  catotal: "caTotal",
  chiffreaffaires: "caTotal",
  revenue: "caTotal",
  adr: "adr",
  prixmoyen: "adr",
  to: "to",
  tauxoccupation: "to",
  occupancy: "to",
  revpar: "revpar",
};

export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^hotel\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Propose un mapping cible → colonne source à partir des en-têtes du fichier. */
export function suggestMapping(headers: string[]): Partial<Record<ImportFieldKey, string>> {
  const mapping: Partial<Record<ImportFieldKey, string>> = {};
  for (const header of headers) {
    const key = ALIASES[normalizeHeader(header)];
    if (key && !mapping[key]) mapping[key] = header;
  }
  return mapping;
}

export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/\s/g, "")
    .replace(/[€$£]/g, "")
    .replace(/%/g, "")
    .replace(",", ".");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRatio(value: unknown): number | null {
  const number = parseNumber(value);
  if (number === null) return null;
  if (number > 1.5) return number / 100;
  return number;
}

export function parseCategory(value: unknown): Categorie {
  if (value === null || value === undefined) return 4;
  const text = String(value).toLowerCase();
  if (text.includes("palace")) return "Palace";
  const number = Number(text.replace(/[^0-9]/g, ""));
  if ([1, 2, 3, 4, 5].includes(number)) return number as Categorie;
  return 4;
}

export interface ParsedImportRow {
  index: number;
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  departement: string;
  region: string;
  categorie: Categorie;
  categorieValide: boolean;
  gamme: string | null;
  groupe: string | null;
  enseigne: string | null;
  cles: number | null;
  anneeOuverture: number | null;
  anneeRenovation: number | null;
  latitude: number | null;
  longitude: number | null;
  adr: number | null;
  to: number | null;
  revpar: number | null;
  caTotal: number | null;
  raw: Record<string, string>;
}

function read(
  mapping: Partial<Record<ImportFieldKey, string>>,
  row: Record<string, string>,
  key: ImportFieldKey,
): string {
  const column = mapping[key];
  if (!column) return "";
  return String(row[column] ?? "").trim();
}

export function mapImportRow(
  row: Record<string, string>,
  mapping: Partial<Record<ImportFieldKey, string>>,
  index: number,
): ParsedImportRow {
  const categorieRaw = read(mapping, row, "categorie");
  const categorieDigits = Number(categorieRaw.replace(/[^0-9]/g, ""));
  return {
    index,
    nom: read(mapping, row, "nom"),
    adresse: read(mapping, row, "adresse"),
    codePostal: read(mapping, row, "codePostal"),
    ville: read(mapping, row, "ville"),
    departement: read(mapping, row, "departement"),
    region: read(mapping, row, "region"),
    categorie: parseCategory(categorieRaw),
    categorieValide:
      categorieRaw.toLowerCase().includes("palace") ||
      (categorieDigits >= 1 && categorieDigits <= 5),
    gamme: read(mapping, row, "gamme") || null,
    groupe: read(mapping, row, "groupe") || null,
    enseigne: read(mapping, row, "enseigne") || null,
    cles: parseNumber(read(mapping, row, "cles")),
    anneeOuverture: parseNumber(read(mapping, row, "anneeOuverture")),
    anneeRenovation: parseNumber(read(mapping, row, "anneeRenovation")),
    latitude: parseNumber(read(mapping, row, "latitude")),
    longitude: parseNumber(read(mapping, row, "longitude")),
    adr: parseNumber(read(mapping, row, "adr")),
    to: parseRatio(read(mapping, row, "to")),
    revpar: parseNumber(read(mapping, row, "revpar")),
    caTotal: parseNumber(read(mapping, row, "caTotal")),
    raw: row,
  };
}

/** Doublon si nom identique + adresse, code postal, ville ou distance < 100 m. */
export function findDuplicate(hotel: ParsedImportRow, hotels: Hotel[]): Hotel | null {
  const name = normalizeText(hotel.nom);
  if (!name) return null;
  return (
    hotels.find((candidate) => {
      if (normalizeText(candidate.nom) !== name) return false;
      if (
        hotel.latitude !== null &&
        hotel.longitude !== null &&
        Number.isFinite(hotel.latitude) &&
        Number.isFinite(hotel.longitude)
      ) {
        const distance = haversineKm(
          { lat: hotel.latitude, lng: hotel.longitude },
          { lat: candidate.latitude, lng: candidate.longitude },
        );
        if (distance <= 0.1) return true;
      }
      const address =
        hotel.adresse && candidate.adresse && normalizeText(hotel.adresse) === normalizeText(candidate.adresse);
      const postal =
        hotel.codePostal && candidate.codePostal && hotel.codePostal.replace(/\s/g, "") === candidate.codePostal.replace(/\s/g, "");
      const city =
        (!hotel.adresse || !candidate.adresse) &&
        hotel.ville &&
        candidate.ville &&
        normalizeText(hotel.ville) === normalizeText(candidate.ville);
      return Boolean(address || postal || city);
    }) ?? null
  );
}

export interface BANResult {
  latitude: number;
  longitude: number;
  label: string;
}

/** Géocodage BAN d'une adresse ou, à défaut, de la ville. */
export async function geocodeAddress(
  adresse: string,
  codePostal: string,
  ville: string,
): Promise<BANResult | null> {
  const query = [adresse, codePostal, ville].filter(Boolean).join(" ").trim();
  if (!query) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4500);
  try {
    const url = new URL("https://api-adresse.data.gouv.fr/search/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "1");
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      features?: { geometry?: { coordinates?: [number, number] }; properties?: { label?: string } }[];
    };
    const feature = data.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (!coordinates) return null;
    return {
      longitude: coordinates[0],
      latitude: coordinates[1],
      label: feature.properties?.label ?? query,
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function hotelOverridesFromImport(
  row: ParsedImportRow,
  source: SourceRef,
  coordinates?: { latitude: number; longitude: number } | null,
): {
  nom: string;
  ville: string;
  source: SourceRef;
  adresse?: string;
  codePostal?: string;
  departement?: string;
  region?: string;
  categorie?: Categorie;
  gamme?: Hotel["gamme"];
  groupe?: string;
  enseigne?: string;
  cles?: number;
  anneeOuverture?: number | null;
  anneeRenovation?: number | null;
  latitude?: number;
  longitude?: number;
} {
  return {
    nom: row.nom,
    ville: row.ville || "Ville non renseignée",
    source,
    adresse: row.adresse || undefined,
    codePostal: row.codePostal || undefined,
    departement: row.departement || undefined,
    region: row.region || "Non renseignée",
    categorie: row.categorie,
    gamme: (row.gamme as Hotel["gamme"] | null) ?? undefined,
    groupe: row.groupe ?? undefined,
    enseigne: row.enseigne ?? row.nom,
    cles: row.cles ?? undefined,
    anneeOuverture: row.anneeOuverture ?? undefined,
    anneeRenovation: row.anneeRenovation ?? undefined,
    latitude: coordinates?.latitude ?? row.latitude ?? undefined,
    longitude: coordinates?.longitude ?? row.longitude ?? undefined,
  };
}
