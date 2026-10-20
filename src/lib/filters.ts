import type { Fiabilite, Filters, Hotel, KpiYear } from "./types";
import { EXTRACTION_DATE, RELIABILITY_META } from "./constants";
import { haversineKm, pointInPolygon } from "./geo";
import { kpiFor, metricValue } from "./stats";

export function defaultFilters(annee: number): Filters {
  return {
    search: "",
    annee,
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
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Complète les sélections sauvegardées avant l'ajout de nouveaux critères. */
export function normalizeFilters(filters: Partial<Filters>, annee: number): Filters {
  return { ...defaultFilters(annee), ...filters };
}

export function matchesEquipment(hotel: Hotel, filters: Filters): boolean {
  return filters.equipements.every((equipment) => {
    switch (equipment) {
      case "piscine":
        return (
          hotel.equipements.piscineInterieure ||
          hotel.equipements.piscineExterieure
        );
      case "spa":
        return hotel.equipements.spa;
      case "restaurantGastro":
        return hotel.equipements.restaurantGastro;
      case "brasserie":
        return hotel.equipements.brasserie;
      case "bar":
        return hotel.equipements.bar;
      case "mice":
        return hotel.equipements.mice;
      case "parking":
        return hotel.equipements.parking;
      case "rooftop":
        return hotel.equipements.rooftop;
      default:
        return true;
    }
  });
}

function hasReliability(
  hotel: Hotel,
  kpis: KpiYear[],
  minimum: "all" | Fiabilite,
  annee: number,
): boolean {
  if (minimum === "all") return true;
  const kpi = kpiFor(hotel.id, kpis, annee);
  const source = kpi?.source ?? hotel.source;
  const rank = { N1: 1, N2: 2, N3: 3 };
  return rank[source.fiabilite] <= rank[minimum];
}

/**
 * Filtrage central. Tous les critères sont cumulatifs.
 * Les indicateurs (ADR, RevPAR, CA...) sont lus sur l'année sélectionnée.
 */
export function filterHotels(
  hotels: Hotel[],
  kpis: KpiYear[],
  filters: Filters,
): Hotel[] {
  const query = normalize(filters.search.trim());

  return hotels.filter((hotel) => {
    if (query) {
      const haystack = normalize(
        [hotel.nom, hotel.ville, hotel.groupe, hotel.enseigne, hotel.codePostal]
          .join(" "),
      );
      if (!haystack.includes(query)) return false;
    }
    if (filters.categories.length && !filters.categories.includes(hotel.categorie))
      return false;
    if (filters.gammes.length && !filters.gammes.includes(hotel.gamme)) return false;
    if (filters.types.length && !filters.types.includes(hotel.type)) return false;
    if (
      filters.exploitations.length &&
      !filters.exploitations.includes(hotel.exploitation)
    )
      return false;
    if (filters.groupes.length && !filters.groupes.includes(hotel.groupe))
      return false;
    if (filters.regions.length && !filters.regions.includes(hotel.region))
      return false;
    if (
      filters.departements.length &&
      !filters.departements.includes(hotel.departement)
    )
      return false;
    if (filters.villes.length && !filters.villes.includes(hotel.ville)) return false;

    if (!hasReliability(hotel, kpis, filters.fiabiliteMin, filters.annee))
      return false;
    if (!matchesEquipment(hotel, filters)) return false;

    if (filters.clesMin !== null && hotel.cles < filters.clesMin) return false;
    if (filters.clesMax !== null && hotel.cles > filters.clesMax) return false;
    if (
      filters.anneeOuvertureMin !== null &&
      (hotel.anneeOuverture ?? 0) < filters.anneeOuvertureMin
    )
      return false;
    if (
      filters.renovationMin !== null &&
      (hotel.anneeRenovation ?? 0) < filters.renovationMin
    )
      return false;

    const kpi = kpiFor(hotel.id, kpis, filters.annee);
    const test = (
      value: number | null | undefined,
      low: number | null,
      high: number | null,
    ) => {
      if (low === null && high === null) return true;
      if (value === null || value === undefined) return false;
      if (low !== null && value < low) return false;
      if (high !== null && value > high) return false;
      return true;
    };

    if (!test(kpi?.adr, filters.adrMin, filters.adrMax)) return false;
    if (!test(kpi?.revpar, filters.revparMin, filters.revparMax)) return false;
    if (!test(kpi?.to, filters.toMin, filters.toMax)) return false;
    if (!test(kpi?.caTotal, filters.caMin, filters.caMax)) return false;

    if (filters.geo) {
      if (filters.geo.type === "circle") {
        if (
          haversineKm(
            { lat: hotel.latitude, lng: hotel.longitude },
            filters.geo.center,
          ) > filters.geo.radiusKm
        )
          return false;
      } else if (
        !pointInPolygon(
          { lat: hotel.latitude, lng: hotel.longitude },
          filters.geo.points,
        )
      ) {
        return false;
      }
    }
    return true;
  });
}

export type SortDirection = "asc" | "desc";

export function sortHotels(
  hotels: Hotel[],
  kpis: KpiYear[],
  key: string,
  direction: SortDirection,
  annee: number,
): Hotel[] {
  const sortable: Record<
    string,
    (hotel: Hotel) => string | number | null
  > = {
    nom: (h) => h.nom,
    ville: (h) => h.ville,
    categorie: (h) => (h.categorie === "Palace" ? 6 : h.categorie),
    groupe: (h) => h.groupe,
    cles: (h) => h.cles,
    adr: (h) => kpiFor(h.id, kpis, annee)?.adr ?? null,
    to: (h) => kpiFor(h.id, kpis, annee)?.to ?? null,
    revpar: (h) => kpiFor(h.id, kpis, annee)?.revpar ?? null,
    caTotal: (h) => kpiFor(h.id, kpis, annee)?.caTotal ?? null,
    caParCle: (h) => metricValue(h, kpis, "caParCle", annee),
    note: (h) => kpiFor(h.id, kpis, annee)?.note ?? null,
    fiabilite: (h) => {
      const rank = { N1: 1, N2: 2, N3: 3 };
      return rank[(kpiFor(h.id, kpis, annee)?.source ?? h.source).fiabilite];
    },
  };
  const getter = sortable[key] ?? sortable.nom;
  return [...hotels].sort((a, b) => {
    const va = getter(a);
    const vb = getter(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    const result =
      typeof va === "string" && typeof vb === "string"
        ? va.localeCompare(vb, "fr")
        : Number(va) - Number(vb);
    return direction === "asc" ? result : -result;
  });
}

export function activeFilterCount(filters: Filters): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  count += filters.categories.length ? 1 : 0;
  count += filters.gammes.length ? 1 : 0;
  count += filters.types.length ? 1 : 0;
  count += filters.exploitations.length ? 1 : 0;
  count += filters.groupes.length ? 1 : 0;
  count += filters.equipements.length ? 1 : 0;
  count += filters.fiabiliteMin !== "all" ? 1 : 0;
  count += filters.regions.length || filters.departements.length || filters.villes.length ? 1 : 0;
  const ranges = [
    filters.clesMin,
    filters.clesMax,
    filters.adrMin,
    filters.adrMax,
    filters.revparMin,
    filters.revparMax,
    filters.toMin,
    filters.toMax,
    filters.caMin,
    filters.caMax,
    filters.anneeOuvertureMin,
    filters.renovationMin,
  ];
  if (ranges.some((value) => value !== null)) count += 1;
  if (filters.geo) count += 1;
  return count;
}

/** Résumé lisible des filtres, repris dans la feuille « Méthodologie » des exports. */
export function describeFilters(filters: Filters): string[] {
  const lines: string[] = [];
  lines.push(`Année de référence : ${filters.annee}`);
  if (filters.search) lines.push(`Recherche : « ${filters.search} »`);
  if (filters.categories.length)
    lines.push(`Catégories : ${filters.categories.join(", ")}`);
  if (filters.gammes.length) lines.push(`Gammes : ${filters.gammes.join(", ")}`);
  if (filters.types.length) lines.push(`Types : ${filters.types.join(", ")}`);
  if (filters.exploitations.length)
    lines.push(`Exploitation : ${filters.exploitations.join(", ")}`);
  if (filters.groupes.length) lines.push(`Groupes : ${filters.groupes.join(", ")}`);
  if (filters.regions.length) lines.push(`Régions : ${filters.regions.join(", ")}`);
  if (filters.departements.length)
    lines.push(`Départements : ${filters.departements.join(", ")}`);
  if (filters.villes.length) lines.push(`Villes : ${filters.villes.join(", ")}`);
  if (filters.equipements.length)
    lines.push(`Équipements requis : ${filters.equipements.join(", ")}`);
  if (filters.fiabiliteMin !== "all")
    lines.push(
      `Fiabilité minimale : ${filters.fiabiliteMin} (${RELIABILITY_META[filters.fiabiliteMin].description})`,
    );
  if (filters.clesMin !== null || filters.clesMax !== null)
    lines.push(`Nombre de clés : ${filters.clesMin ?? "—"} à ${filters.clesMax ?? "—"}`);
  if (filters.adrMin !== null || filters.adrMax !== null)
    lines.push(`ADR : ${filters.adrMin ?? "—"} à ${filters.adrMax ?? "—"} €`);
  if (filters.revparMin !== null || filters.revparMax !== null)
    lines.push(`RevPAR : ${filters.revparMin ?? "—"} à ${filters.revparMax ?? "—"} €`);
  if (filters.toMin !== null || filters.toMax !== null)
    lines.push(
      `Taux d'occupation : ${filters.toMin !== null ? `${(filters.toMin * 100).toFixed(0)} %` : "—"} à ${filters.toMax !== null ? `${(filters.toMax * 100).toFixed(0)} %` : "—"}`,
    );
  if (filters.anneeOuvertureMin !== null)
    lines.push(`Ouverture depuis : ${filters.anneeOuvertureMin}`);
  if (filters.renovationMin !== null)
    lines.push(`Rénovation depuis : ${filters.renovationMin}`);
  if (filters.geo)
    lines.push(
      filters.geo.type === "circle"
        ? `Périmètre : ${filters.geo.radiusKm} km autour de ${filters.geo.label}`
        : `Périmètre dessiné : ${filters.geo.label}`,
    );
  if (!lines.length) lines.push("Aucun filtre restrictif");
  lines.push(`Date d'extraction : ${EXTRACTION_DATE}`);
  return lines;
}
