import type { Benchmark, BenchmarkSecteur, Hotel, KpiYear } from "./types";
import { KPI_LABELS, CATEGORY_LABEL } from "./constants";
import { kpiFor, mean, metricValue, sum } from "./stats";
import { fmtInt } from "./format";

/** Périmètre exact d'un benchmark : hôtels existants, dans l'ordre du panel. */
export function benchmarkHotels(benchmark: Benchmark, hotels: Hotel[]): Hotel[] {
  const map = new Map(hotels.map((hotel) => [hotel.id, hotel]));
  return benchmark.hotelIds
    .map((id) => map.get(id))
    .filter((hotel): hotel is Hotel => Boolean(hotel));
}

/**
 * Complète les secteurs en affectant les hôtels orphelins à un secteur de repli.
 * Évite qu'un hôtel du panel disparaisse silencieusement de la synthèse.
 */
export function benchmarkSectors(
  benchmark: Benchmark,
  hotels: Hotel[],
): BenchmarkSecteur[] {
  const panel = benchmarkHotels(benchmark, hotels);
  const used = new Set<string>();
  const sectors = benchmark.secteurs
    .map((sector) => ({
      nom: sector.nom,
      hotelIds: sector.hotelIds.filter((id) => {
        if (used.has(id) || !panel.some((hotel) => hotel.id === id)) return false;
        used.add(id);
        return true;
      }),
    }))
    .filter((sector) => sector.hotelIds.length > 0);
  const orphans = panel.map((hotel) => hotel.id).filter((id) => !used.has(id));
  if (orphans.length) sectors.push({ nom: "Autres hôtels du panel", hotelIds: orphans });
  return sectors;
}

export interface BenchmarkSectorStats {
  nom: string;
  hotelIds: string[];
  count: number;
  cles: number;
  caTotal: number | null;
  adr: number | null;
  to: number | null;
  revpar: number | null;
  ebitdaPct: number | null;
  note: number | null;
  lead: { hotel: Hotel; revpar: number } | null;
}

/** Agrégats par secteur : les valeurs absentes ne sont jamais remplacées par zéro. */
export function benchmarkSectorStats(
  sector: BenchmarkSecteur,
  hotels: Hotel[],
  kpis: KpiYear[],
  annee: number,
): BenchmarkSectorStats {
  const map = new Map(hotels.map((hotel) => [hotel.id, hotel]));
  const sectorHotels = sector.hotelIds
    .map((id) => map.get(id))
    .filter((hotel): hotel is Hotel => Boolean(hotel));
  const values = (key: keyof typeof KPI_LABELS) =>
    sectorHotels
      .map((hotel) => metricValue(hotel, kpis, key, annee))
      .filter((value): value is number => value != null && Number.isFinite(value));

  let lead: BenchmarkSectorStats["lead"] = null;
  for (const hotel of sectorHotels) {
    const revpar = metricValue(hotel, kpis, "revpar", annee);
    if (revpar != null && (!lead || revpar > lead.revpar)) lead = { hotel, revpar };
  }

  return {
    nom: sector.nom,
    hotelIds: sector.hotelIds,
    count: sectorHotels.length,
    cles: sum(sectorHotels.map((hotel) => hotel.cles)),
    caTotal: sum(values("caTotal")),
    adr: mean(values("adr")),
    to: mean(values("to")),
    revpar: mean(values("revpar")),
    ebitdaPct: mean(values("ebitdaPct")),
    note: mean(values("note")),
    lead,
  };
}

/** Ordre d'affichage et de numérotation commun à la carte, aux tableaux et aux slides. */
export function orderedBenchmarkHotels(
  benchmark: Benchmark,
  hotels: Hotel[],
  kpis: KpiYear[],
  annee: number,
): Hotel[] {
  const map = new Map(hotels.map((hotel) => [hotel.id, hotel]));
  return benchmarkSectors(benchmark, hotels).flatMap((sector) =>
    sector.hotelIds
      .map((id) => map.get(id))
      .filter((hotel): hotel is Hotel => Boolean(hotel))
      .sort((a, b) => {
        const ra = metricValue(a, kpis, "revpar", annee) ?? -1;
        const rb = metricValue(b, kpis, "revpar", annee) ?? -1;
        return rb - ra;
      }),
  );
}

export interface BenchmarkOverview {
  count: number;
  cles: number;
  caTotal: number | null;
  adr: number | null;
  to: number | null;
  revpar: number | null;
  ebitdaPct: number | null;
  note: number | null;
}

export function benchmarkOverview(
  benchmark: Benchmark,
  hotels: Hotel[],
  kpis: KpiYear[],
  annee: number,
): BenchmarkOverview {
  const panel = benchmarkHotels(benchmark, hotels);
  const values = (key: keyof typeof KPI_LABELS) =>
    panel
      .map((hotel) => metricValue(hotel, kpis, key, annee))
      .filter((value): value is number => value != null && Number.isFinite(value));
  return {
    count: panel.length,
    cles: sum(panel.map((hotel) => hotel.cles)),
    caTotal: sum(values("caTotal")),
    adr: mean(values("adr")),
    to: mean(values("to")),
    revpar: mean(values("revpar")),
    ebitdaPct: mean(values("ebitdaPct")),
    note: mean(values("note")),
  };
}

export type SectorizationMode = "ville" | "categorie" | "gamme" | "aucune";

/** Sectorisation automatique, volontairement simple et explicite dans la méthode. */
export function buildSectors(hotels: Hotel[], mode: SectorizationMode): BenchmarkSecteur[] {
  if (mode === "aucune" || !hotels.length) {
    return hotels.length ? [{ nom: "Panel", hotelIds: hotels.map((hotel) => hotel.id) }] : [];
  }
  const groups = new Map<string, string[]>();
  for (const hotel of hotels) {
    const key =
      mode === "ville"
        ? hotel.ville
        : mode === "categorie"
          ? CATEGORY_LABEL[hotel.categorie]
          : hotel.gamme;
    const list = groups.get(key) ?? [];
    list.push(hotel.id);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([nom, hotelIds]) => ({ nom, hotelIds }));
}

export interface BenchmarkSourceRow {
  nom: string;
  ville: string;
  categorie: string;
  fiche: string;
  ficheFiabilite: string;
  ficheDate: string;
  ficheAuteur: string;
  kpi: string;
  kpiFiabilite: string;
  kpiDate: string;
  kpiAuteur: string;
  hypothese: string;
}

export function benchmarkSourceRows(
  benchmark: Benchmark,
  hotels: Hotel[],
  kpis: KpiYear[],
): BenchmarkSourceRow[] {
  return orderedBenchmarkHotels(benchmark, hotels, kpis, benchmark.annee).map((hotel) => {
    const kpi = kpiFor(hotel.id, kpis, benchmark.annee);
    return {
      nom: hotel.nom,
      ville: hotel.ville,
      categorie: CATEGORY_LABEL[hotel.categorie],
      fiche: hotel.source.source,
      ficheFiabilite: hotel.source.fiabilite,
      ficheDate: hotel.source.dateSource,
      ficheAuteur: hotel.source.auteur,
      kpi: kpi?.source.source ?? "Non renseignée",
      kpiFiabilite: kpi?.source.fiabilite ?? "—",
      kpiDate: kpi?.source.dateSource ?? hotel.source.dateSource,
      kpiAuteur: kpi?.source.auteur ?? hotel.source.auteur,
      hypothese: kpi?.source.hypothese ?? hotel.source.hypothese ?? "",
    };
  });
}

export function panelSummaryLabel(benchmark: Benchmark, count: number): string {
  return `${count} hôtel${count > 1 ? "s" : ""} · ${benchmark.secteurs.length} secteur${benchmark.secteurs.length > 1 ? "s" : ""} · ${fmtInt(benchmark.hotelIds.length)} acteurs`;
}
