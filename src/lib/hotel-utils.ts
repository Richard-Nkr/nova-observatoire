import type {
  Categorie,
  Equipements,
  Hotel,
  KpiYear,
  SourceRef,
} from "./types";
import { CITY_COORDS, haversineKm } from "./geo";
import { latestKpi } from "./stats";

/** Les Palace sont comparés avec les 5★ dans les raisonnements concurrentiels. */
export function categoryFamily(category: Categorie | string | number): string {
  return category === "Palace" ? "5" : String(category);
}

export function categoryRank(category: Categorie): number {
  return category === "Palace" ? 6 : Number(category);
}

/** Équipements affichés dans la fiche, le filtre et la matrice comparative. */
export const EQUIPMENT_ROWS: { key: keyof Equipements; label: string }[] = [
  { key: "restaurantGastro", label: "Restaurant gastronomique" },
  { key: "brasserie", label: "Brasserie" },
  { key: "bar", label: "Bar" },
  { key: "rooftop", label: "Rooftop" },
  { key: "roomService", label: "Room service" },
  { key: "spa", label: "Spa" },
  { key: "piscineInterieure", label: "Piscine intérieure" },
  { key: "piscineExterieure", label: "Piscine extérieure" },
  { key: "fitness", label: "Fitness" },
  { key: "parking", label: "Parking" },
  { key: "mice", label: "MICE / séminaires" },
];

export function equipmentLabel(key: string): string {
  return EQUIPMENT_ROWS.find((row) => row.key === key)?.label ?? key;
}

/** Hôtels de la même famille de catégorie dans un rayon donné. */
export function nearbyHotels(
  hotel: Hotel,
  hotels: Hotel[],
  radiusKm = 15,
): Hotel[] {
  return hotels
    .filter(
      (candidate) =>
        candidate.id !== hotel.id &&
        categoryFamily(candidate.categorie) === categoryFamily(hotel.categorie),
    )
    .map((candidate) => ({
      hotel: candidate,
      distance: haversineKm(
        { lat: hotel.latitude, lng: hotel.longitude },
        { lat: candidate.latitude, lng: candidate.longitude },
      ),
    }))
    .filter((item) => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.hotel);
}

/** Coordonnées de repli par ville, puis centre de la France. */
export function fallbackCoords(ville: string): { lat: number; lng: number } {
  return CITY_COORDS[ville] ?? { lat: 46.6, lng: 2.4 };
}

export function emptyEquipements(): Equipements {
  return {
    restaurantGastro: false,
    brasserie: false,
    bar: false,
    rooftop: false,
    roomService: false,
    spa: false,
    spaSurface: null,
    spaCabines: null,
    piscineInterieure: false,
    piscineExterieure: false,
    fitness: false,
    parking: false,
    parkingPlaces: null,
    mice: false,
    couvertsInterieur: null,
    couvertsExterieur: null,
    ticketMoyen: null,
  };
}

export function gammeForCategory(category: Categorie): Hotel["gamme"] {
  if (category === "Palace" || category === 5) return "Luxe";
  if (category === 4) return "Upscale";
  if (category === 3) return "Milieu de gamme";
  return "Économique";
}

/** Fiche minimale construite à partir d'un formulaire ou d'un import. */
export function buildHotelInput(
  overrides: Partial<Hotel> & {
    nom: string;
    ville: string;
    source: SourceRef;
  },
): Omit<Hotel, "id" | "createdAt" | "updatedAt" | "demo"> {
  const coords =
    overrides.latitude != null && overrides.longitude != null
      ? { lat: overrides.latitude, lng: overrides.longitude }
      : fallbackCoords(overrides.ville);
  const category = overrides.categorie ?? 4;
  return {
    nom: overrides.nom,
    groupe: overrides.groupe ?? "Indépendant",
    enseigne: overrides.enseigne ?? overrides.nom,
    adresse: overrides.adresse ?? "",
    codePostal: overrides.codePostal ?? "",
    ville: overrides.ville,
    departement: overrides.departement ?? "",
    region: overrides.region ?? "Île-de-France",
    latitude: coords.lat,
    longitude: coords.lng,
    categorie: category,
    gamme: overrides.gamme ?? gammeForCategory(category),
    type: overrides.type ?? "Business",
    exploitation: overrides.exploitation ?? "Indépendant",
    proprietaire: overrides.proprietaire ?? "Non renseigné",
    exploitant: overrides.exploitant ?? overrides.groupe ?? "Indépendant",
    anneeOuverture: overrides.anneeOuverture ?? null,
    anneeRenovation: overrides.anneeRenovation ?? null,
    cles: overrides.cles ?? 0,
    suites: overrides.suites ?? null,
    surfaceTotale: overrides.surfaceTotale ?? null,
    surfaceHebergement: overrides.surfaceHebergement ?? null,
    surfaceFnb: overrides.surfaceFnb ?? null,
    surfaceMice: overrides.surfaceMice ?? null,
    nbSallesSeminaire: overrides.nbSallesSeminaire ?? null,
    capaciteMiceMax: overrides.capaciteMiceMax ?? null,
    equipements: { ...emptyEquipements(), ...(overrides.equipements ?? {}) },
    photoUrl:
      overrides.photoUrl ??
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    siteUrl: overrides.siteUrl ?? null,
    source: overrides.source,
  };
}

/** Médiane de RevPAR de la zone et de l'année, utilisée par l'estimateur. */
export function zoneRevparMedian(
  hotels: Hotel[],
  kpis: KpiYear[],
  region: string,
  annee: number,
): number | null {
  const values = hotels
    .filter((hotel) => hotel.region === region)
    .map(
      (hotel) =>
        kpis.find((kpi) => kpi.hotelId === hotel.id && kpi.annee === annee)
          ?.revpar ?? null,
    )
    .filter((value): value is number => value != null && value > 0)
    .sort((a, b) => a - b);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2
    ? values[middle]
    : (values[middle - 1] + values[middle]) / 2;
}

export function latestSourceFor(hotel: Hotel, kpis: KpiYear[]): SourceRef {
  return latestKpi(hotel.id, kpis)?.source ?? hotel.source;
}
