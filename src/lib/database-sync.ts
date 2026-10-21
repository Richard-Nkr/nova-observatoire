import * as XLSX from "xlsx";
import type {
  Categorie,
  Equipements,
  Hotel,
  ImportBatch,
  KpiYear,
  SourceRef,
} from "@/lib/types";
import { RELIABILITY_RANK } from "@/lib/types";
import {
  CATEGORY_LABEL,
  EXPLOITATIONS,
  GAMMES,
  HOTEL_TYPES,
  YEARS,
} from "@/lib/constants";
import { normalizeHeader, normalizeText, parseNumber } from "@/lib/import";

/**
 * Aller-retour Excel de la base de travail.
 *
 * La feuille « Hôtels » contient une ligne par actif et une colonne ID stable.
 * Une cellule vide signifie « inchangé » ; la valeur NULL efface explicitement
 * un champ nullable. Les KPI sont datés dans les en-têtes (ex. « CA total 2024 »)
 * afin qu’un même classeur puisse couvrir plusieurs exercices.
 */

export const DATABASE_SHEET = "Hôtels";
export const DATABASE_NOTICE_SHEET = "Notice";

type HotelFieldKind =
  | "text"
  | "textNullable"
  | "number"
  | "numberNullable"
  | "intNullable"
  | "category"
  | "gamme"
  | "hotelType"
  | "exploitation";

interface HotelFieldDef {
  key: keyof Hotel;
  label: string;
  kind: HotelFieldKind;
  required?: boolean;
}

const HOTEL_FIELDS: HotelFieldDef[] = [
  { key: "nom", label: "Nom", kind: "text", required: true },
  { key: "groupe", label: "Groupe", kind: "text" },
  { key: "enseigne", label: "Enseigne", kind: "text" },
  { key: "adresse", label: "Adresse", kind: "text" },
  { key: "codePostal", label: "Code postal", kind: "text" },
  { key: "ville", label: "Ville", kind: "text", required: true },
  { key: "departement", label: "Département", kind: "text" },
  { key: "region", label: "Région", kind: "text", required: true },
  { key: "categorie", label: "Catégorie", kind: "category", required: true },
  { key: "gamme", label: "Gamme", kind: "gamme" },
  { key: "type", label: "Type", kind: "hotelType" },
  { key: "exploitation", label: "Exploitation", kind: "exploitation" },
  { key: "proprietaire", label: "Propriétaire", kind: "text" },
  { key: "exploitant", label: "Exploitant", kind: "text" },
  { key: "latitude", label: "Latitude", kind: "number", required: true },
  { key: "longitude", label: "Longitude", kind: "number", required: true },
  { key: "anneeOuverture", label: "Année d’ouverture", kind: "intNullable" },
  { key: "anneeRenovation", label: "Année de rénovation", kind: "intNullable" },
  { key: "cles", label: "Clés", kind: "number", required: true },
  { key: "suites", label: "Suites", kind: "intNullable" },
  { key: "surfaceTotale", label: "Surface totale (m²)", kind: "numberNullable" },
  { key: "surfaceHebergement", label: "Surface hébergement (m²)", kind: "numberNullable" },
  { key: "surfaceFnb", label: "Surface F&B (m²)", kind: "numberNullable" },
  { key: "surfaceMice", label: "Surface MICE (m²)", kind: "numberNullable" },
  { key: "nbSallesSeminaire", label: "Salles de séminaire", kind: "intNullable" },
  { key: "capaciteMiceMax", label: "Capacité MICE max.", kind: "intNullable" },
  { key: "siteUrl", label: "Site web", kind: "textNullable" },
  { key: "localisation", label: "Localisation", kind: "textNullable" },
  { key: "photoUrl", label: "Photo (URL)", kind: "text" },
];

const EQUIPMENT_BOOL_FIELDS: { key: keyof Equipements; label: string }[] = [
  { key: "restaurantGastro", label: "Restaurant gastronomique" },
  { key: "brasserie", label: "Brasserie" },
  { key: "bar", label: "Bar" },
  { key: "rooftop", label: "Rooftop" },
  { key: "roomService", label: "Room service" },
  { key: "spa", label: "Spa" },
  { key: "piscine", label: "Piscine" },
  { key: "piscineInterieure", label: "Piscine intérieure" },
  { key: "piscineExterieure", label: "Piscine extérieure" },
  { key: "fitness", label: "Fitness" },
  { key: "parking", label: "Parking" },
  { key: "mice", label: "MICE" },
];

const EQUIPMENT_NUM_FIELDS: { key: keyof Equipements; label: string }[] = [
  { key: "spaSurface", label: "Surface spa (m²)" },
  { key: "spaCabines", label: "Cabines de soin" },
  { key: "parkingPlaces", label: "Parking (places)" },
  { key: "couvertsInterieur", label: "Couverts intérieurs" },
  { key: "couvertsExterieur", label: "Couverts extérieurs" },
  { key: "ticketMoyen", label: "Ticket moyen restauration (€)" },
];

type KpiImportKey =
  | "caTotal"
  | "caHebergement"
  | "caFnb"
  | "caAutres"
  | "to"
  | "adr"
  | "revpar"
  | "ebitda"
  | "ebitdaPct"
  | "gop"
  | "effectif"
  | "note"
  | "nbAvis";

const KPI_FIELDS: { key: KpiImportKey; label: string; percent?: boolean }[] = [
  { key: "caTotal", label: "CA total" },
  { key: "caHebergement", label: "CA hébergement" },
  { key: "caFnb", label: "CA F&B" },
  { key: "caAutres", label: "CA autres" },
  { key: "to", label: "TO (%)", percent: true },
  { key: "adr", label: "ADR" },
  { key: "revpar", label: "RevPAR" },
  { key: "ebitda", label: "EBITDA" },
  { key: "ebitdaPct", label: "Marge EBITDA (%)", percent: true },
  { key: "gop", label: "GOP" },
  { key: "effectif", label: "Effectif" },
  { key: "note", label: "Note" },
  { key: "nbAvis", label: "Nombre d’avis" },
];

const FIELD_BY_HEADER = new Map(
  HOTEL_FIELDS.map((field) => [normalizeHeader(field.label), field]),
);
const EQUIPMENT_BOOL_BY_HEADER = new Map(
  EQUIPMENT_BOOL_FIELDS.map((field) => [normalizeHeader(field.label), field]),
);
const EQUIPMENT_NUM_BY_HEADER = new Map(
  EQUIPMENT_NUM_FIELDS.map((field) => [normalizeHeader(field.label), field]),
);
const KPI_BY_HEADER = new Map(
  KPI_FIELDS.map((field) => [normalizeHeader(field.label), field]),
);

function kpiHeader(field: { label: string }, annee: number): string {
  return `${field.label} ${annee}`;
}

export function databaseHeaders(annee: number): string[] {
  return [
    "ID",
    ...HOTEL_FIELDS.map((field) => field.label),
    ...EQUIPMENT_BOOL_FIELDS.map((field) => field.label),
    ...EQUIPMENT_NUM_FIELDS.map((field) => field.label),
    ...KPI_FIELDS.map((field) => kpiHeader(field, annee)),
  ];
}

function exportEquipmentValue(value: boolean): string {
  return value ? "Oui" : "Non";
}

/** Construit une ligne éditable à partir d’un hôtel et de son KPI annuel. */
function databaseRow(hotel: Hotel, kpi: KpiYear | undefined, annee: number) {
  const row: Record<string, string | number> = { ID: hotel.id };
  const hotelRecord = hotel as unknown as Record<string, unknown>;
  const equipmentRecord = hotel.equipements as unknown as Record<string, unknown>;

  for (const field of HOTEL_FIELDS) {
    const value = hotelRecord[field.key];
    if (field.kind === "category") {
      row[field.label] = CATEGORY_LABEL[String(value)] ?? String(value ?? "");
    } else if (value === null || value === undefined) {
      row[field.label] = "";
    } else {
      row[field.label] = value as string | number;
    }
  }

  for (const field of EQUIPMENT_BOOL_FIELDS) {
    row[field.label] = exportEquipmentValue(Boolean(equipmentRecord[field.key]));
  }
  for (const field of EQUIPMENT_NUM_FIELDS) {
    const value = equipmentRecord[field.key];
    row[field.label] = value === null || value === undefined ? "" : (value as number);
  }

  for (const field of KPI_FIELDS) {
    const value = kpi?.[field.key] ?? null;
    row[kpiHeader(field, annee)] =
      value === null ? "" : field.percent ? Number((value * 100).toFixed(2)) : value;
  }

  return row;
}

function noticeSheet(annee: number, hotelCount: number) {
  const rows: (string | number)[][] = [
    ["NOVA OBSERVATOIRE — base de travail"],
    [],
    ["Mode d’emploi"],
    ["1", "Modifiez uniquement la feuille « Hôtels ». Ne changez pas la colonne ID."],
    ["2", "Une cellule vide signifie « inchangé ». Saisissez NULL pour effacer une valeur."],
    ["3", `Les KPI sont datés dans les en-têtes. Cet export porte sur l’exercice ${annee}.`],
    ["4", "À la réimportation, renseignez la source, la date, l’auteur et la fiabilité."],
    ["5", "Une valeur N1 ne peut jamais être écrasée par une valeur N2 ou N3."],
    ["6", "Les valeurs absentes doivent rester vides : ne les remplacez pas par 0."],
    ["7", "Catégories acceptées : 1, 2, 3, 4, 5, Palace, Non classé."],
    ["8", "Équipements : Oui ou Non. Les champs numériques acceptent NULL."],
    ["9", "Les taux TO et Marge EBITDA sont exprimés en points de pourcentage (ex. 72,5)."],
    ["10", "Chaque modification est journalisée et l’historique des KPI est conservé."],
    [],
    ["Périmètre", `${hotelCount} hôtels`],
    ["Exercice exporté", annee],
    ["Colonne de rapprochement", "ID (stable). À défaut, le couple Nom + Ville est utilisé."],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 30 }, { wch: 105 }];
  return sheet;
}

/** Génère le classeur Excel d’édition (Notice + Hôtels). */
export function buildDatabaseWorkbook(
  hotels: Hotel[],
  kpis: KpiYear[],
  annee: number,
): XLSX.WorkBook {
  const rows = hotels.map((hotel) =>
    databaseRow(
      hotel,
      kpis.find((kpi) => kpi.hotelId === hotel.id && kpi.annee === annee),
      annee,
    ),
  );
  const headers = databaseHeaders(annee);
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  sheet["!autofilter"] = {
    ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}${rows.length + 1}`,
  };
  sheet["!cols"] = headers.map((header, index) => ({
    wch:
      index === 0
        ? 20
        : header === "Nom"
          ? 34
          : header === "Adresse"
            ? 30
            : header.includes("Surface") || header.includes("CA")
              ? 18
              : 16,
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, noticeSheet(annee, hotels.length), DATABASE_NOTICE_SHEET);
  XLSX.utils.book_append_sheet(workbook, sheet, DATABASE_SHEET);
  return workbook;
}

/** Télécharge le classeur d’édition prêt à être complété puis réimporté. */
export function exportDatabaseWorkbook(
  hotels: Hotel[],
  kpis: KpiYear[],
  annee: number,
): void {
  const workbook = buildDatabaseWorkbook(hotels, kpis, annee);
  XLSX.writeFile(workbook, `Nova_base_hotels_${annee}.xlsx`);
}

/** Lit la feuille « Hôtels » d’un classeur CSV/XLSX. */
export async function readDatabaseRows(
  file: File,
): Promise<{ rows: Record<string, unknown>[]; fichier: string }> {
  const isCsv = /\.csv$/i.test(file.name);
  let workbook: XLSX.WorkBook;
  if (isCsv) {
    const text = await file.text();
    const firstLine = text.split(/\r?\n/)[0] ?? "";
    workbook = XLSX.read(text, {
      type: "string",
      FS: firstLine.includes(";") ? ";" : ",",
    });
  } else {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  }
  const sheetName =
    workbook.SheetNames.find((name) => normalizeHeader(name) === "hotels") ??
    workbook.SheetNames.find((name) => normalizeHeader(name) !== "notice") ??
    workbook.SheetNames[0];
  if (!sheetName) throw new Error("Le classeur ne contient aucune feuille.");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("La feuille Hôtels est illisible.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return { rows, fichier: file.name };
}

function cellText(row: Record<string, unknown>, header: string): string {
  const value = row[header];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isNullToken(value: string): boolean {
  return value.trim().toLowerCase() === "null";
}

function parseCategoryStrict(value: string): Categorie | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (text.includes("palace")) return "Palace";
  const compact = normalizeHeader(text);
  if (compact === "nonclasse" || compact === "nc") return "Non classé";
  const digit = text.match(/[1-5]/)?.[0];
  if (digit) return Number(digit) as Categorie;
  return null;
}

function matchUnion<T extends string>(value: string, allowed: readonly T[]): T | null {
  const target = normalizeHeader(value);
  return allowed.find((item) => normalizeHeader(item) === target) ?? null;
}

function parseBooleanStrict(value: string): boolean | null {
  const text = normalizeHeader(value);
  if (["oui", "yes", "true", "1", "x"].includes(text)) return true;
  if (["non", "no", "false", "0"].includes(text)) return false;
  return null;
}

function numberChanged(current: unknown, next: number | null): boolean {
  if (next === null) return current !== null && current !== undefined;
  return typeof current !== "number" || Math.abs(current - next) > 1e-6;
}

function textChanged(current: unknown, next: string | null): boolean {
  const currentText = current === null || current === undefined ? "" : String(current);
  const nextText = next ?? "";
  return currentText !== nextText;
}

/** Tolérance pour les taux exportés en points de pourcentage à deux décimales. */
function kpiNumberChanged(current: unknown, next: number | null): boolean {
  if (next === null) return current !== null && current !== undefined;
  if (typeof current !== "number") return true;
  return Math.abs(current - next) > 1e-4;
}

interface ParsedKpiYear {
  annee: number;
  values: Partial<Omit<KpiYear, "id" | "hotelId" | "annee" | "source">>;
  labels: string[];
}

export type DatabaseRowStatus =
  | "update"
  | "unchanged"
  | "conflict"
  | "unknown"
  | "invalid";

export interface DatabasePreviewRow {
  index: number;
  hotelId: string | null;
  nom: string;
  ville: string;
  status: DatabaseRowStatus;
  changes: string[];
  kpiChanges: string[];
  errors: string[];
  conflictReason: string | null;
  patch: Partial<Hotel>;
  kpiPatches: ParsedKpiYear[];
}

export interface DatabasePreviewCounts {
  update: number;
  unchanged: number;
  conflict: number;
  unknown: number;
  invalid: number;
  total: number;
}

export interface DatabasePreview {
  fichier: string;
  annee: number;
  source: SourceRef;
  rows: DatabasePreviewRow[];
  counts: DatabasePreviewCounts;
}

interface HeaderIndex {
  idHeader: string | null;
  fields: Map<string, string>;
  equipmentBool: Map<string, string>;
  equipmentNum: Map<string, string>;
  kpis: { key: KpiImportKey; label: string; percent?: boolean; header: string; annee: number }[];
}

function buildHeaderIndex(rows: Record<string, unknown>[], fallbackYear: number): HeaderIndex {
  const headers = Object.keys(rows[0] ?? {});
  const index: HeaderIndex = {
    idHeader: headers.find((header) => normalizeHeader(header) === "id") ?? null,
    fields: new Map(),
    equipmentBool: new Map(),
    equipmentNum: new Map(),
    kpis: [],
  };

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (normalized === "id") continue;

    const field = FIELD_BY_HEADER.get(normalized);
    if (field) {
      index.fields.set(field.label, header);
      continue;
    }
    const boolField = EQUIPMENT_BOOL_BY_HEADER.get(normalized);
    if (boolField) {
      index.equipmentBool.set(boolField.label, header);
      continue;
    }
    const numField = EQUIPMENT_NUM_BY_HEADER.get(normalized);
    if (numField) {
      index.equipmentNum.set(numField.label, header);
      continue;
    }

    const yearMatch = normalized.match(/^(.*?)(20\d{2})$/);
    const base = yearMatch ? yearMatch[1] : normalized;
    const year = yearMatch ? Number(yearMatch[2]) : fallbackYear;
    const kpiField = KPI_BY_HEADER.get(base);
    if (kpiField && YEARS.includes(year)) {
      index.kpis.push({ ...kpiField, header, annee: year });
    }
  }
  return index;
}

function findHotelForRow(
  row: Record<string, unknown>,
  index: HeaderIndex,
  hotels: Hotel[],
): Hotel | null {
  const id = index.idHeader ? cellText(row, index.idHeader) : "";
  if (id) {
    const byId = hotels.find((hotel) => hotel.id === id);
    if (byId) return byId;
  }

  const nomHeader = index.fields.get("Nom");
  const villeHeader = index.fields.get("Ville");
  const nom = nomHeader ? cellText(row, nomHeader) : "";
  const ville = villeHeader ? cellText(row, villeHeader) : "";
  if (!nom) return null;

  const candidates = hotels.filter(
    (hotel) =>
      normalizeText(hotel.nom) === normalizeText(nom) &&
      (!ville || normalizeText(hotel.ville) === normalizeText(ville)),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Analyse un fichier sans écrire dans la base. Le statut de chaque ligne
 * distingue les mises à jour, les lignes inchangées, les conflits de fiabilité
 * et les identifiants inconnus.
 */
export function buildDatabasePreview(
  rows: Record<string, unknown>[],
  hotels: Hotel[],
  kpis: KpiYear[],
  source: SourceRef,
  fichier: string,
  fallbackYear: number,
): DatabasePreview {
  if (!rows.length) throw new Error("La feuille Hôtels est vide.");
  const index = buildHeaderIndex(rows, fallbackYear);
  if (!index.idHeader && !index.fields.has("Nom")) {
    throw new Error("La colonne ID ou la colonne Nom est obligatoire.");
  }

  const previewRows = rows.map((row, rowIndex): DatabasePreviewRow => {
    const hotel = findHotelForRow(row, index, hotels);
    const errors: string[] = [];
    const changes: string[] = [];
    const patch: Record<string, unknown> = {};
    const equipmentPatch: Record<string, unknown> = {};
    const kpiByYear = new Map<number, ParsedKpiYear>();

    const nomHeader = index.fields.get("Nom");
    const villeHeader = index.fields.get("Ville");
    const nom = nomHeader ? cellText(row, nomHeader) || hotel?.nom || "" : hotel?.nom ?? "";
    const ville = villeHeader ? cellText(row, villeHeader) || hotel?.ville || "" : hotel?.ville ?? "";

    if (!hotel) {
      return {
        index: rowIndex + 2,
        hotelId: null,
        nom,
        ville,
        status: "unknown",
        changes,
        kpiChanges: [],
        errors: ["Aucun actif ne correspond à l’ID ou au couple Nom + Ville."],
        conflictReason: null,
        patch: {},
        kpiPatches: [],
      };
    }

    const hotelRecord = hotel as unknown as Record<string, unknown>;
    const equipmentRecord = hotel.equipements as unknown as Record<string, unknown>;

    for (const field of HOTEL_FIELDS) {
      const header = index.fields.get(field.label);
      if (!header) continue;
      const raw = cellText(row, header);
      if (!raw) continue;
      const clearing = isNullToken(raw);
      const current = hotelRecord[field.key];

      if (field.kind === "text" || field.kind === "textNullable") {
        if (clearing) {
          if (field.required) {
            errors.push(`${field.label} ne peut pas être effacé.`);
            continue;
          }
          const next = field.kind === "textNullable" ? null : "";
          if (textChanged(current, next)) {
            patch[field.key] = next;
            changes.push(field.label);
          }
          continue;
        }
        if (textChanged(current, raw)) {
          patch[field.key] = raw;
          changes.push(field.label);
        }
        continue;
      }

      if (field.kind === "category") {
        const next = parseCategoryStrict(raw);
        if (!next) {
          errors.push(`Catégorie invalide : « ${raw} ».`);
          continue;
        }
        if (String(current ?? "") !== String(next)) {
          patch[field.key] = next;
          changes.push(field.label);
        }
        continue;
      }

      if (field.kind === "gamme" || field.kind === "hotelType" || field.kind === "exploitation") {
        const allowed =
          field.kind === "gamme"
            ? GAMMES
            : field.kind === "hotelType"
              ? HOTEL_TYPES
              : EXPLOITATIONS;
        const next = matchUnion(raw, allowed);
        if (!next) {
          errors.push(`${field.label} invalide : « ${raw} ».`);
          continue;
        }
        if (String(current ?? "") !== next) {
          patch[field.key] = next;
          changes.push(field.label);
        }
        continue;
      }

      if (clearing) {
        if (field.required) {
          errors.push(`${field.label} ne peut pas être effacé.`);
          continue;
        }
        if (numberChanged(current, null)) {
          patch[field.key] = null;
          changes.push(field.label);
        }
        continue;
      }

      const parsed = parseNumber(raw);
      if (parsed === null) {
        errors.push(`${field.label} n’est pas un nombre valide : « ${raw} ».`);
        continue;
      }
      const next = parsed;
      if (numberChanged(current, next)) {
        patch[field.key] = next;
        changes.push(field.label);
      }
    }

    for (const field of EQUIPMENT_BOOL_FIELDS) {
      const header = index.equipmentBool.get(field.label);
      if (!header) continue;
      const raw = cellText(row, header);
      if (!raw) continue;
      const next = parseBooleanStrict(raw);
      if (next === null) {
        errors.push(`${field.label} doit valoir Oui ou Non.`);
        continue;
      }
      if (equipmentRecord[field.key] !== next) {
        equipmentPatch[field.key] = next;
        changes.push(field.label);
      }
    }

    for (const field of EQUIPMENT_NUM_FIELDS) {
      const header = index.equipmentNum.get(field.label);
      if (!header) continue;
      const raw = cellText(row, header);
      if (!raw) continue;
      const clearing = isNullToken(raw);
      const current = equipmentRecord[field.key];
      if (clearing) {
        if (numberChanged(current, null)) {
          equipmentPatch[field.key] = null;
          changes.push(field.label);
        }
        continue;
      }
      const parsed = parseNumber(raw);
      if (parsed === null) {
        errors.push(`${field.label} n’est pas un nombre valide : « ${raw} ».`);
        continue;
      }
      if (numberChanged(current, parsed)) {
        equipmentPatch[field.key] = parsed;
        changes.push(field.label);
      }
    }

    if (Object.keys(equipmentPatch).length) {
      patch.equipements = {
        ...hotel.equipements,
        ...equipmentPatch,
      } as Equipements;
    }

    for (const kpiField of index.kpis) {
      const raw = cellText(row, kpiField.header);
      if (!raw) continue;
      const clearing = isNullToken(raw);
      const currentKpi = kpis.find(
        (kpi) => kpi.hotelId === hotel.id && kpi.annee === kpiField.annee,
      );
      const currentValue = currentKpi?.[kpiField.key] ?? null;
      let next: number | null = null;
      if (!clearing) {
        const parsed = parseNumber(raw);
        if (parsed === null) {
          errors.push(`${kpiField.label} ${kpiField.annee} n’est pas un nombre valide.`);
          continue;
        }
        next = kpiField.percent ? parsed / 100 : parsed;
      }
      if (!kpiNumberChanged(currentValue, next)) continue;

      const entry =
        kpiByYear.get(kpiField.annee) ??
        ({ annee: kpiField.annee, values: {}, labels: [] } as ParsedKpiYear);
      entry.values[kpiField.key] = next;
      entry.labels.push(`${kpiField.label} ${kpiField.annee}`);
      kpiByYear.set(kpiField.annee, entry);
    }

    const hotelChanged = Object.keys(patch).length > 0;
    const kpiPatches = [...kpiByYear.values()];
    const kpiChanged = kpiPatches.length > 0;
    const incomingRank = RELIABILITY_RANK[source.fiabilite];

    let conflictReason: string | null = null;
    if (hotelChanged && RELIABILITY_RANK[hotel.source.fiabilite] < incomingRank) {
      conflictReason = `La fiche est en ${hotel.source.fiabilite} ; une mise à jour ${source.fiabilite} ne peut pas l’écraser.`;
    }
    if (!conflictReason) {
      for (const kpiPatch of kpiPatches) {
        const existing = kpis.find(
          (kpi) => kpi.hotelId === hotel.id && kpi.annee === kpiPatch.annee,
        );
        if (existing && RELIABILITY_RANK[existing.source.fiabilite] < incomingRank) {
          conflictReason = `Le KPI ${kpiPatch.annee} est en ${existing.source.fiabilite} ; une mise à jour ${source.fiabilite} est bloquée.`;
          break;
        }
      }
    }

    if (hotelChanged) patch.source = source;

    const status: DatabaseRowStatus = errors.length
      ? "invalid"
      : conflictReason
        ? "conflict"
        : hotelChanged || kpiChanged
          ? "update"
          : "unchanged";

    return {
      index: rowIndex + 2,
      hotelId: hotel.id,
      nom,
      ville,
      status,
      changes,
      kpiChanges: kpiPatches.flatMap((entry) => entry.labels),
      errors,
      conflictReason,
      patch: patch as Partial<Hotel>,
      kpiPatches: status === "update" ? kpiPatches : [],
    };
  });

  const counts: DatabasePreviewCounts = {
    update: 0,
    unchanged: 0,
    conflict: 0,
    unknown: 0,
    invalid: 0,
    total: previewRows.length,
  };
  for (const row of previewRows) counts[row.status] += 1;

  return { fichier, annee: fallbackYear, source, rows: previewRows, counts };
}

export interface DatabaseApplyActions {
  updateHotel: (id: string, patch: Partial<Hotel>) => void;
  upsertKpi: (payload: {
    hotelId: string;
    annee: number;
    values: Partial<Omit<KpiYear, "id" | "hotelId" | "annee" | "source">>;
    source: SourceRef;
  }) => { ok: boolean; message: string };
  addImport: (batch: Omit<ImportBatch, "id" | "date" | "auteur">) => void;
}

export interface DatabaseApplyResult {
  updated: number;
  ignored: number;
  conflicts: number;
}

/** Applique les lignes valides et journalise le lot d’import. */
export function applyDatabaseImport(
  preview: DatabasePreview,
  actions: DatabaseApplyActions,
): DatabaseApplyResult {
  let updated = 0;
  let ignored = 0;
  let conflicts = preview.counts.conflict;

  for (const row of preview.rows) {
    if (row.status !== "update" || !row.hotelId) {
      if (row.status !== "conflict") ignored += 1;
      continue;
    }

    let rowFailed = false;
    if (Object.keys(row.patch).some((key) => key !== "source")) {
      actions.updateHotel(row.hotelId, row.patch);
    }
    for (const kpiPatch of row.kpiPatches) {
      const result = actions.upsertKpi({
        hotelId: row.hotelId,
        annee: kpiPatch.annee,
        values: kpiPatch.values,
        source: preview.source,
      });
      if (!result.ok) {
        rowFailed = true;
        conflicts += 1;
      }
    }
    if (rowFailed) {
      ignored += 1;
    } else {
      updated += 1;
    }
  }

  actions.addImport({
    fichier: preview.fichier,
    lignes: preview.counts.total,
    crees: 0,
    fusionnes: updated,
    ignores: ignored,
    statut: "Terminé",
  });

  return { updated, ignored, conflicts };
}


