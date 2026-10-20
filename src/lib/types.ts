export type Categorie = 1 | 2 | 3 | 4 | 5 | "Palace";
export type Gamme = "Économique" | "Milieu de gamme" | "Upscale" | "Luxe";
export type HotelType =
  | "Business"
  | "Loisirs"
  | "Resort"
  | "Boutique"
  | "Patrimonial";
export type Exploitation =
  | "Indépendant"
  | "Franchise"
  | "Contrat de gestion"
  | "Intégré";
export type Fiabilite = "N1" | "N2" | "N3";
export type Role = "Lecteur" | "Contributeur" | "Admin";

export interface SourceRef {
  source: string;
  dateSource: string;
  auteur: string;
  fiabilite: Fiabilite;
  hypothese?: string;
  url?: string;
}

export interface Equipements {
  restaurantGastro: boolean;
  brasserie: boolean;
  bar: boolean;
  rooftop: boolean;
  roomService: boolean;
  spa: boolean;
  spaSurface?: number | null;
  spaCabines?: number | null;
  piscineInterieure: boolean;
  piscineExterieure: boolean;
  fitness: boolean;
  parking: boolean;
  parkingPlaces?: number | null;
  mice: boolean;
  couvertsInterieur?: number | null;
  couvertsExterieur?: number | null;
  ticketMoyen?: number | null;
}

export interface Hotel {
  id: string;
  nom: string;
  groupe: string;
  enseigne: string;
  adresse: string;
  codePostal: string;
  ville: string;
  departement: string;
  region: string;
  latitude: number;
  longitude: number;
  categorie: Categorie;
  gamme: Gamme;
  type: HotelType;
  exploitation: Exploitation;
  proprietaire: string;
  exploitant: string;
  anneeOuverture: number | null;
  anneeRenovation: number | null;
  cles: number;
  suites: number | null;
  surfaceTotale: number | null;
  surfaceHebergement: number | null;
  surfaceFnb: number | null;
  surfaceMice: number | null;
  nbSallesSeminaire: number | null;
  capaciteMiceMax: number | null;
  equipements: Equipements;
  photoUrl: string;
  siteUrl: string | null;
  source: SourceRef;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManualReference {
  nom: string;
  ville: string;
  categorie: Categorie;
  cles: number;
  caTotal: number | null;
  adr: number | null;
  to: number | null;
  revpar: number | null;
  ebitdaPct: number | null;
  note: number | null;
  source: SourceRef;
}

export interface KpiYear {
  id: string;
  hotelId: string;
  annee: number;
  caTotal: number | null;
  caHebergement: number | null;
  caFnb: number | null;
  caAutres: number | null;
  to: number | null;
  adr: number | null;
  revpar: number | null;
  ebitda: number | null;
  ebitdaPct: number | null;
  gop: number | null;
  effectif: number | null;
  note: number | null;
  nbAvis: number | null;
  source: SourceRef;
}

export type TransactionType = "Murs" | "Fonds" | "Murs + fonds";

export interface Transaction {
  id: string;
  hotelId: string;
  date: string;
  acheteur: string;
  vendeur: string;
  prix: number;
  prixParCle: number;
  type: TransactionType;
  caAvant: number | null;
  caApres: number | null;
  source: SourceRef;
  confidentielClient: boolean;
}

export interface PipelineProject {
  id: string;
  nom: string;
  ville: string;
  region: string;
  categorie: Categorie;
  cles: number;
  ouverture: number;
  statut: "En construction" | "Permis accordé" | "Annoncé" | "Rénovation";
  promoteur: string;
}

export interface User {
  id: string;
  nom: string;
  initiales: string;
  email: string;
  role: Role;
  accesConfidentiel: boolean;
  actif: boolean;
}

export interface AuditEntry {
  id: string;
  date: string;
  userId: string;
  action: string;
  target: string;
  details: string;
  confidential?: boolean;
}

export interface Task {
  id: string;
  hotelId: string;
  hotelNom: string;
  champ: string;
  region: string;
  assigneeId: string | null;
  priorite: "Haute" | "Moyenne" | "Basse";
  statut: "À faire" | "En cours" | "Fait";
  echeance: string;
}

export type EquipmentFilter =
  | "spa"
  | "piscine"
  | "restaurantGastro"
  | "brasserie"
  | "bar"
  | "mice"
  | "parking"
  | "rooftop";

export interface GeoCircleFilter {
  type: "circle";
  center: { lat: number; lng: number };
  radiusKm: number;
  label: string;
}

export interface GeoPolygonFilter {
  type: "polygon";
  points: { lat: number; lng: number }[];
  label: string;
}

export type GeoFilter = GeoCircleFilter | GeoPolygonFilter;

export interface Filters {
  search: string;
  annee: number;
  categories: Categorie[];
  gammes: Gamme[];
  types: HotelType[];
  exploitations: Exploitation[];
  groupes: string[];
  equipements: EquipmentFilter[];
  fiabiliteMin: "all" | Fiabilite;
  regions: string[];
  departements: string[];
  villes: string[];
  clesMin: number | null;
  clesMax: number | null;
  adrMin: number | null;
  adrMax: number | null;
  revparMin: number | null;
  revparMax: number | null;
  toMin: number | null;
  toMax: number | null;
  caMin: number | null;
  caMax: number | null;
  anneeOuvertureMin: number | null;
  renovationMin: number | null;
  geo: GeoFilter | null;
}

export interface SavedSelection {
  id: string;
  nom: string;
  description: string;
  filters: Filters;
  hotelIds: string[];
  auteur: string;
  createdAt: string;
  partage: boolean;
}

export interface BenchmarkSecteur {
  nom: string;
  hotelIds: string[];
}

export interface Benchmark {
  id: string;
  nom: string;
  client: string;
  mission: string;
  date: string;
  consultant: string;
  hotelIds: string[];
  referenceId: string | null;
  kpis: KpiKey[];
  secteurs: BenchmarkSecteur[];
  annee: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  notes: string;
}

export interface ImportBatch {
  id: string;
  fichier: string;
  date: string;
  auteur: string;
  lignes: number;
  crees: number;
  fusionnes: number;
  ignores: number;
  statut: "Terminé" | "En revue";
}

export interface AppState {
  hotels: Hotel[];
  kpis: KpiYear[];
  kpiHistory: KpiYear[];
  transactions: Transaction[];
  pipeline: PipelineProject[];
  users: User[];
  currentUserId: string;
  audit: AuditEntry[];
  tasks: Task[];
  savedSelections: SavedSelection[];
  benchmarks: Benchmark[];
  imports: ImportBatch[];
  basket: string[];
  referenceId: string | null;
}

export type KpiKey =
  | "caTotal"
  | "caHebergement"
  | "caFnb"
  | "caAutres"
  | "to"
  | "adr"
  | "revpar"
  | "ebitdaPct"
  | "effectif"
  | "note"
  | "cles"
  | "surfaceTotale"
  | "caParCle"
  | "partFnb"
  | "m2ParCle";

export const RELIABILITY_RANK: Record<Fiabilite, number> = {
  N1: 1,
  N2: 2,
  N3: 3,
};

export function reliabilityAtLeast(
  value: Fiabilite,
  minimum: Fiabilite,
): boolean {
  return RELIABILITY_RANK[value] <= RELIABILITY_RANK[minimum];
}
