import type {
  Categorie,
  Hotel,
  KpiKey,
  KpiYear,
  ManualReference,
  SourceRef,
} from "./types";
import { COMPARATOR_KPIS, KPI_LABELS } from "./constants";
import { maxOf, mean, median, metricValue, minOf } from "./stats";

/**
 * Colonnes du comparateur : un hôtel de la base ou un actif client saisi
 * manuellement. Les valeurs sont recalculées à chaque exercice, jamais stockées
 * en double. L'actif de référence est toujours placé en première colonne.
 */
export interface ComparisonColumn {
  id: string;
  hotelId: string | null;
  nom: string;
  ville: string;
  groupe: string;
  categorie: Categorie;
  cles: number;
  source: SourceRef;
  values: Partial<Record<KpiKey, number | null>>;
  isReference: boolean;
  isManual: boolean;
  hotel: Hotel | null;
}

const ALL_KEYS: KpiKey[] = [
  "caTotal",
  "caHebergement",
  "caFnb",
  "caAutres",
  "to",
  "adr",
  "revpar",
  "ebitdaPct",
  "effectif",
  "note",
  "cles",
  "surfaceTotale",
  "caParCle",
  "partFnb",
  "m2ParCle",
];

function hotelColumn(
  hotel: Hotel,
  kpis: KpiYear[],
  annee: number,
  isReference: boolean,
): ComparisonColumn {
  const values: Partial<Record<KpiKey, number | null>> = {};
  for (const key of ALL_KEYS) values[key] = metricValue(hotel, kpis, key, annee);
  return {
    id: hotel.id,
    hotelId: hotel.id,
    nom: hotel.nom,
    ville: hotel.ville,
    groupe: hotel.groupe,
    categorie: hotel.categorie,
    cles: hotel.cles,
    source: hotel.source,
    values,
    isReference,
    isManual: false,
    hotel,
  };
}

/** Actif client fictif : seuls les indicateurs saisis sont disponibles. */
export function manualColumn(reference: ManualReference): ComparisonColumn {
  const revpar =
    reference.revpar ??
    (reference.adr != null && reference.to != null
      ? reference.adr * reference.to
      : null);
  const values: Partial<Record<KpiKey, number | null>> = {};
  for (const key of ALL_KEYS) values[key] = null;
  values.caTotal = reference.caTotal;
  values.adr = reference.adr;
  values.to = reference.to;
  values.revpar = revpar;
  values.ebitdaPct = reference.ebitdaPct;
  values.note = reference.note;
  values.cles = reference.cles;
  values.caParCle =
    reference.caTotal != null && reference.cles > 0
      ? reference.caTotal / reference.cles
      : null;
  return {
    id: "manual-reference",
    hotelId: null,
    nom: reference.nom,
    ville: reference.ville,
    groupe: "Actif client",
    categorie: reference.categorie,
    cles: reference.cles,
    source: reference.source,
    values,
    isReference: true,
    isManual: true,
    hotel: null,
  };
}

export function buildComparisonColumns({
  hotels,
  kpis,
  annee,
  referenceId,
  manualReference,
}: {
  hotels: Hotel[];
  kpis: KpiYear[];
  annee: number;
  referenceId: string | null;
  manualReference: ManualReference | null;
}): ComparisonColumn[] {
  if (manualReference) {
    return [
      manualColumn(manualReference),
      ...hotels.map((hotel) => hotelColumn(hotel, kpis, annee, false)),
    ];
  }
  const reference =
    hotels.find((hotel) => hotel.id === referenceId) ?? hotels[0] ?? null;
  if (!reference) return [];
  return [
    hotelColumn(reference, kpis, annee, true),
    ...hotels
      .filter((hotel) => hotel.id !== reference.id)
      .map((hotel) => hotelColumn(hotel, kpis, annee, false)),
  ];
}

export function comparisonValues(
  columns: ComparisonColumn[],
  key: KpiKey,
): number[] {
  return columns
    .map((column) => column.values[key])
    .filter((value): value is number => value != null && Number.isFinite(value));
}

export interface ComparisonStats {
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

export function comparisonStats(
  columns: ComparisonColumn[],
  key: KpiKey,
): ComparisonStats {
  const values = comparisonValues(columns, key);
  return {
    mean: mean(values),
    median: median(values),
    min: minOf(values),
    max: maxOf(values),
    count: values.length,
  };
}

/** Meilleure et moins bonne valeur du panel, selon le sens de l'indicateur. */
export function bestWorst(
  columns: ComparisonColumn[],
  key: KpiKey,
): { best: number; worst: number } | null {
  const direction = KPI_LABELS[key].direction;
  if (direction === 0) return null;
  const values = comparisonValues(columns, key);
  if (values.length < 2) return null;
  const best = direction === 1 ? Math.max(...values) : Math.min(...values);
  const worst = direction === 1 ? Math.min(...values) : Math.max(...values);
  if (best === worst) return null;
  return { best, worst };
}

export interface GapResult {
  text: string;
  favorable: boolean | null;
}

function signed(value: number, digits = 1): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toLocaleString("fr-FR", {
    maximumFractionDigits: digits,
  })}`;
}

/** Écart à la référence, en points pour les taux, en % pour les autres. */
export function gapToReference(
  key: KpiKey,
  value: number | null | undefined,
  reference: number | null | undefined,
): GapResult | null {
  if (value == null || reference == null || !Number.isFinite(value) || !Number.isFinite(reference)) {
    return null;
  }
  const direction = KPI_LABELS[key].direction;
  if (["to", "ebitdaPct", "partFnb"].includes(key)) {
    const points = (value - reference) * 100;
    if (Math.abs(points) < 0.05) return { text: "= réf.", favorable: null };
    return {
      text: `${signed(points)} pts`,
      favorable: direction === 0 ? null : points > 0,
    };
  }
  if (key === "note") {
    const points = value - reference;
    if (Math.abs(points) < 0.05) return { text: "= réf.", favorable: null };
    return {
      text: `${signed(points, 2)} pt`,
      favorable: direction === 0 ? null : points > 0,
    };
  }
  if (reference === 0) return null;
  const pct = ((value - reference) / Math.abs(reference)) * 100;
  if (Math.abs(pct) < 0.05) return { text: "= réf.", favorable: null };
  return {
    text: `${signed(pct)} %`,
    favorable: direction === 0 ? null : pct > 0,
  };
}

export function comparatorKeys(): KpiKey[] {
  return COMPARATOR_KPIS;
}
