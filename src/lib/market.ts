import type { Categorie, Hotel, KpiYear, PipelineProject, Transaction } from "./types";
import { CATEGORIES } from "./constants";
import { kpiFor, mean, median, sum } from "./stats";

/**
 * Agrégats du marché : offre, performance, pipeline et transactions.
 * Les valeurs sont calculées à la volée depuis les données de l'observatoire ;
 * aucune statistique n'est extrapolée en l'absence de données.
 */

export const ALL_ZONES = "France métropolitaine";

export interface ZoneKpis {
  count: number;
  cles: number;
  caTotal: number | null;
  adr: number | null;
  to: number | null;
  revpar: number | null;
  ebitdaPct: number | null;
  note: number | null;
}

export interface CategorySupply {
  categorie: Categorie;
  hotels: number;
  cles: number;
  hotelShare: number;
  keyShare: number;
}

export interface CategoryPerformance {
  categorie: Categorie;
  hotels: number;
  cles: number;
  caTotal: number | null;
  adr: number | null;
  to: number | null;
  revpar: number | null;
  ebitdaPct: number | null;
  note: number | null;
}

export interface YearlyOpenings {
  annee: number;
  ouvertures: number;
  cles: number;
}

export interface EnrichedTransaction {
  transaction: Transaction;
  hotel: Hotel | null;
}

export interface PriceKeyPoint {
  label: string;
  median: number | null;
  mean: number | null;
  count: number;
  volume: number;
}

export function hotelInZone(hotel: Hotel, zone: string): boolean {
  return zone === ALL_ZONES || hotel.region === zone;
}

export function hotelsInZone(hotels: Hotel[], zone: string): Hotel[] {
  return hotels.filter((hotel) => hotelInZone(hotel, zone));
}

export function pipelineInZone(pipeline: PipelineProject[], zone: string): PipelineProject[] {
  return pipeline.filter((project) => zone === ALL_ZONES || project.region === zone);
}

export function zoneKpis(hotels: Hotel[], kpis: KpiYear[], annee: number): ZoneKpis {
  const rows = hotels
    .map((hotel) => kpiFor(hotel.id, kpis, annee))
    .filter((row): row is KpiYear => Boolean(row));
  const adrValues = rows.map((row) => row.adr).filter((value): value is number => value !== null);
  const toValues = rows.map((row) => row.to).filter((value): value is number => value !== null);
  const revparValues = rows
    .map((row) => row.revpar)
    .filter((value): value is number => value !== null);
  const ebitdaValues = rows
    .map((row) => row.ebitdaPct)
    .filter((value): value is number => value !== null);
  const noteValues = rows.map((row) => row.note).filter((value): value is number => value !== null);
  return {
    count: hotels.length,
    cles: sum(hotels.map((hotel) => hotel.cles)),
    caTotal: caTotal(rows),
    adr: mean(adrValues),
    to: mean(toValues),
    revpar: mean(revparValues),
    ebitdaPct: mean(ebitdaValues),
    note: mean(noteValues),
  };
}

function caTotal(rows: KpiYear[]): number | null {
  const values = rows.map((row) => row.caTotal).filter((value): value is number => value !== null);
  return values.length ? sum(values) : null;
}

export function supplyByCategory(hotels: Hotel[]): CategorySupply[] {
  const totalHotels = hotels.length;
  const totalKeys = sum(hotels.map((hotel) => hotel.cles));
  return CATEGORIES.map((categorie) => {
    const panel = hotels.filter((hotel) => hotel.categorie === categorie);
    const cles = sum(panel.map((hotel) => hotel.cles));
    return {
      categorie,
      hotels: panel.length,
      cles,
      hotelShare: totalHotels ? panel.length / totalHotels : 0,
      keyShare: totalKeys ? cles / totalKeys : 0,
    };
  }).filter((row) => row.hotels > 0);
}

export function performanceByCategory(
  hotels: Hotel[],
  kpis: KpiYear[],
  annee: number,
): CategoryPerformance[] {
  return CATEGORIES.map((categorie) => {
    const panel = hotels.filter((hotel) => hotel.categorie === categorie);
    const rows = panel
      .map((hotel) => kpiFor(hotel.id, kpis, annee))
      .filter((row): row is KpiYear => Boolean(row));
    const adrValues = rows.map((row) => row.adr).filter((value): value is number => value !== null);
    const toValues = rows.map((row) => row.to).filter((value): value is number => value !== null);
    const revparValues = rows
      .map((row) => row.revpar)
      .filter((value): value is number => value !== null);
    const ebitdaValues = rows
      .map((row) => row.ebitdaPct)
      .filter((value): value is number => value !== null);
    const noteValues = rows
      .map((row) => row.note)
      .filter((value): value is number => value !== null);
    return {
      categorie,
      hotels: panel.length,
      cles: sum(panel.map((hotel) => hotel.cles)),
      caTotal: caTotal(rows),
      adr: mean(adrValues),
      to: mean(toValues),
      revpar: mean(revparValues),
      ebitdaPct: mean(ebitdaValues),
      note: mean(noteValues),
    };
  }).filter((row) => row.hotels > 0);
}

export function openingsByYear(hotels: Hotel[], from = 2017, to = 2026): YearlyOpenings[] {
  const years: YearlyOpenings[] = [];
  for (let annee = from; annee <= to; annee += 1) {
    const opened = hotels.filter((hotel) => hotel.anneeOuverture === annee);
    years.push({
      annee,
      ouvertures: opened.length,
      cles: sum(opened.map((hotel) => hotel.cles)),
    });
  }
  return years;
}

export function enrichTransactions(
  transactions: Transaction[],
  hotels: Hotel[],
): EnrichedTransaction[] {
  const index = new Map(hotels.map((hotel) => [hotel.id, hotel]));
  return transactions.map((transaction) => ({
    transaction,
    hotel: index.get(transaction.hotelId) ?? null,
  }));
}

export function transactionsInZone(
  rows: EnrichedTransaction[],
  zone: string,
): EnrichedTransaction[] {
  return rows.filter(({ hotel }) => (hotel ? hotelInZone(hotel, zone) : zone === ALL_ZONES));
}

export function priceKeyByYear(rows: EnrichedTransaction[]): PriceKeyPoint[] {
  if (!rows.length) return [];
  const years = rows
    .map(({ transaction }) => Number(transaction.date.slice(0, 4)))
    .filter((value) => Number.isFinite(value));
  const min = Math.min(...years);
  const max = Math.max(...years);
  const points: PriceKeyPoint[] = [];
  for (let annee = min; annee <= max; annee += 1) {
    const subset = rows.filter(({ transaction }) => transaction.date.startsWith(String(annee)));
    points.push({
      label: String(annee),
      median: median(subset.map(({ transaction }) => transaction.prixParCle)),
      mean: mean(subset.map(({ transaction }) => transaction.prixParCle)),
      count: subset.length,
      volume: sum(subset.map(({ transaction }) => transaction.prix)),
    });
  }
  return points;
}

export function priceKeyByRegion(rows: EnrichedTransaction[]): PriceKeyPoint[] {
  const groups = new Map<string, EnrichedTransaction[]>();
  for (const row of rows) {
    const region = row.hotel?.region ?? "Zone non renseignée";
    groups.set(region, [...(groups.get(region) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([label, subset]) => ({
      label,
      median: median(subset.map(({ transaction }) => transaction.prixParCle)),
      mean: mean(subset.map(({ transaction }) => transaction.prixParCle)),
      count: subset.length,
      volume: sum(subset.map(({ transaction }) => transaction.prix)),
    }))
    .sort((a, b) => (b.median ?? 0) - (a.median ?? 0));
}

export function volume(rows: EnrichedTransaction[]): number {
  return sum(rows.map(({ transaction }) => transaction.prix));
}
