import type { Hotel, KpiKey, KpiYear } from "./types";
import { KPI_LABELS } from "./constants";

/** Séries statistiques utilisées dans les synthèses et exports. */
export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values: number[]): number | null {
  return values.length ? sum(values) / values.length : null;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function minOf(values: number[]): number | null {
  return values.length ? Math.min(...values) : null;
}

export function maxOf(values: number[]): number | null {
  return values.length ? Math.max(...values) : null;
}

export function percentile(values: number[], ratio: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * ratio;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

export function kpiFor(
  hotelId: string,
  kpis: KpiYear[],
  annee: number,
): KpiYear | undefined {
  return kpis.find((kpi) => kpi.hotelId === hotelId && kpi.annee === annee);
}

export function latestKpi(
  hotelId: string,
  kpis: KpiYear[],
): KpiYear | undefined {
  return [...kpis]
    .filter((kpi) => kpi.hotelId === hotelId)
    .sort((a, b) => b.annee - a.annee)[0];
}

/**
 * Valeur d'un indicateur, y compris les ratios calculés.
 * Ces ratios ne sont jamais stockés : ils dérivent toujours des champs saisis.
 */
export function metricValue(
  hotel: Hotel,
  kpis: KpiYear[],
  key: KpiKey,
  annee: number,
): number | null {
  if (key === "cles") return hotel.cles ?? null;
  if (key === "surfaceTotale") return hotel.surfaceTotale ?? null;
  const kpi = kpiFor(hotel.id, kpis, annee);
  if (!kpi) return null;

  switch (key) {
    case "caTotal":
      return kpi.caTotal;
    case "caHebergement":
      return kpi.caHebergement;
    case "caFnb":
      return kpi.caFnb;
    case "caAutres":
      return kpi.caAutres;
    case "to":
      return kpi.to;
    case "adr":
      return kpi.adr;
    case "revpar":
      return kpi.revpar;
    case "ebitdaPct":
      return kpi.ebitdaPct;
    case "effectif":
      return kpi.effectif;
    case "note":
      return kpi.note;
    case "caParCle":
      return kpi.caTotal && hotel.cles ? kpi.caTotal / hotel.cles : null;
    case "partFnb":
      return kpi.caFnb && kpi.caTotal ? kpi.caFnb / kpi.caTotal : null;
    case "m2ParCle":
      return hotel.surfaceTotale && hotel.cles
        ? hotel.surfaceTotale / hotel.cles
        : null;
    default:
      return null;
  }
}

export function metricValues(
  hotels: Hotel[],
  kpis: KpiYear[],
  key: KpiKey,
  annee: number,
): number[] {
  return hotels
    .map((hotel) => metricValue(hotel, kpis, key, annee))
    .filter((value): value is number => value !== null && Number.isFinite(value));
}

export function formatMetric(
  key: KpiKey,
  value: number | null | undefined,
  compact = false,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const meta = KPI_LABELS[key];
  switch (true) {
    case meta.unit.startsWith("€"):
      if (compact) {
        if (Math.abs(value) >= 1_000_000_000)
          return `${(value / 1_000_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md€`;
        if (Math.abs(value) >= 1_000_000)
          return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
        if (Math.abs(value) >= 1_000)
          return `${(value / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k€`;
        return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
      }
      return `${Math.round(value).toLocaleString("fr-FR")} €`;
    case meta.unit === "%":
      return `${(value * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
    case meta.unit === "pts":
      return `${(value * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`;
    case meta.unit.includes("10"):
      return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
    case meta.unit === "m²":
      return `${Math.round(value).toLocaleString("fr-FR")} m²`;
    default:
      return value.toLocaleString("fr-FR", {
        maximumFractionDigits: meta.unit === "ETP" ? 0 : 1,
      });
  }
}

/** Position d'une valeur dans un panel (1 = meilleure selon le sens de l'indicateur). */
export function rankIn(
  value: number | null,
  values: number[],
  direction: 1 | 0 | -1,
): { rank: number; total: number } | null {
  if (value === null || !values.length) return null;
  const sorted = [...values].sort((a, b) =>
    direction === -1 ? a - b : b - a,
  );
  const rank = sorted.findIndex((v) => v === value) + 1;
  return { rank: rank || sorted.length, total: sorted.length };
}
