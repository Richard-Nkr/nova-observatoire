import * as XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";
import type { Filters, Hotel, KpiKey, KpiYear } from "./types";
import { EXTRACTION_DATE, RELIABILITY_META } from "./constants";
import { describeFilters } from "./filters";
import { fmtDate, fmtEuro, fmtInt, fmtNum, fmtTo } from "./format";
import { kpiFor, mean, median, metricValues, sum } from "./stats";
import { comparisonStats, gapToReference, type ComparisonColumn } from "./comparison";
import { COMPARATOR_KPIS, KPI_LABELS } from "./constants";
import {
  benchmarkHotels,
  benchmarkOverview,
  benchmarkSectors,
  benchmarkSectorStats,
  benchmarkSourceRows,
  orderedBenchmarkHotels,
} from "./benchmark";
import type { Benchmark } from "./types";

/**
 * Exports bureautiques.
 * Chaque ligne de données porte la source et la fiabilité de la fiche,
 * ainsi que celles de l'indicateur annuel : aucune valeur n'est orpheline.
 */

export interface ExportMeta {
  titre: string;
  perimetre: string;
  auteur: string;
  filters?: Filters;
  generatedAt?: string;
}

interface ExportRow {
  [key: string]: string | number;
}

const equipmentLabels: { key: keyof Hotel["equipements"]; label: string }[] = [
  { key: "spa", label: "Spa" },
  { key: "piscineInterieure", label: "Piscine intérieure" },
  { key: "piscineExterieure", label: "Piscine extérieure" },
  { key: "restaurantGastro", label: "Restaurant gastronomique" },
  { key: "brasserie", label: "Brasserie" },
  { key: "bar", label: "Bar" },
  { key: "rooftop", label: "Rooftop" },
  { key: "roomService", label: "Room service" },
  { key: "fitness", label: "Fitness" },
  { key: "parking", label: "Parking" },
  { key: "mice", label: "MICE" },
];

function yesNo(value: boolean): string {
  return value ? "Oui" : "Non";
}

function numberOrBlank(value: number | null | undefined): number | "" {
  return value === null || value === undefined || Number.isNaN(value) ? "" : value;
}

/** Ligne brute, également réutilisée par le CSV. */
export function hotelExportRow(
  hotel: Hotel,
  kpis: KpiYear[],
  annee: number,
): ExportRow {
  const kpi = kpiFor(hotel.id, kpis, annee);
  const row: ExportRow = {
    ID: hotel.id,
    Nom: hotel.nom,
    Enseigne: hotel.enseigne,
    Groupe: hotel.groupe,
    Catégorie: hotel.categorie === "Palace" ? "Palace" : `${hotel.categorie}★`,
    Gamme: hotel.gamme,
    Type: hotel.type,
    Exploitation: hotel.exploitation,
    Adresse: hotel.adresse,
    "Code postal": hotel.codePostal,
    Ville: hotel.ville,
    Département: hotel.departement,
    Région: hotel.region,
    Latitude: hotel.latitude,
    Longitude: hotel.longitude,
    "Année d'ouverture": numberOrBlank(hotel.anneeOuverture),
    "Année de rénovation": numberOrBlank(hotel.anneeRenovation),
    Clés: hotel.cles,
    Suites: numberOrBlank(hotel.suites),
    "Surface totale (m²)": numberOrBlank(hotel.surfaceTotale),
    "Surface hébergement (m²)": numberOrBlank(hotel.surfaceHebergement),
    "Surface F&B (m²)": numberOrBlank(hotel.surfaceFnb),
    "Surface MICE (m²)": numberOrBlank(hotel.surfaceMice),
    "Salles de séminaire": numberOrBlank(hotel.nbSallesSeminaire),
    "Capacité MICE max.": numberOrBlank(hotel.capaciteMiceMax),
    "Places de parking": numberOrBlank(hotel.equipements.parkingPlaces),
    "Couverts intérieurs": numberOrBlank(hotel.equipements.couvertsInterieur),
    "Couverts extérieurs": numberOrBlank(hotel.equipements.couvertsExterieur),
    "Ticket moyen F&B (€)": numberOrBlank(hotel.equipements.ticketMoyen),
    "Surface spa (m²)": numberOrBlank(hotel.equipements.spaSurface),
    "Cabines de soins": numberOrBlank(hotel.equipements.spaCabines),
    Propriétaire: hotel.proprietaire,
    Exploitant: hotel.exploitant,
    "Site web": hotel.siteUrl ?? "",
    "Source fiche": hotel.source.source,
    "Fiabilité fiche": hotel.source.fiabilite,
    "Date source fiche": hotel.source.dateSource,
    "Auteur fiche": hotel.source.auteur,
    "Hypothèse fiche": hotel.source.hypothese ?? "",
  };

  for (const { key, label } of equipmentLabels) {
    row[label] = yesNo(Boolean(hotel.equipements[key]));
  }

  row["Source KPI"] = kpi?.source.source ?? "";
  row["Fiabilité KPI"] = kpi?.source.fiabilite ?? "";
  row["Date source KPI"] = kpi?.source.dateSource ?? "";
  row["Auteur KPI"] = kpi?.source.auteur ?? "";
  row["Hypothèse KPI"] = kpi?.source.hypothese ?? "";
  row[`CA total ${annee} (€)`] = numberOrBlank(kpi?.caTotal);
  row[`CA hébergement ${annee} (€)`] = numberOrBlank(kpi?.caHebergement);
  row[`CA F&B ${annee} (€)`] = numberOrBlank(kpi?.caFnb);
  row[`CA autres ${annee} (€)`] = numberOrBlank(kpi?.caAutres);
  row[`TO ${annee} (%)`] = kpi?.to != null ? Number((kpi.to * 100).toFixed(1)) : "";
  row[`ADR ${annee} (€)`] = numberOrBlank(kpi?.adr);
  row[`RevPAR ${annee} (€)`] = numberOrBlank(kpi?.revpar);
  row[`EBITDA ${annee} (€)`] = numberOrBlank(kpi?.ebitda);
  row[`Marge EBITDA ${annee} (%)`] =
    kpi?.ebitdaPct != null ? Number((kpi.ebitdaPct * 100).toFixed(1)) : "";
  row[`GOP ${annee} (€)`] = numberOrBlank(kpi?.gop);
  row[`Effectif ${annee} (ETP)`] = numberOrBlank(kpi?.effectif);
  row[`Note ${annee} (/10)`] = numberOrBlank(kpi?.note);
  row[`Avis ${annee}`] = numberOrBlank(kpi?.nbAvis);
  row[`CA par clé ${annee} (€)`] =
    kpi?.caTotal && hotel.cles ? Math.round(kpi.caTotal / hotel.cles) : "";
  row["Donnée démo"] = hotel.demo ? "Oui" : "Non";
  return row;
}

function exportRows(
  hotels: Hotel[],
  kpis: KpiYear[],
  annee: number,
): ExportRow[] {
  return hotels.map((hotel) => hotelExportRow(hotel, kpis, annee));
}

function autoColumns(rows: ExportRow[]): XLSX.ColInfo[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map((key) => ({
    wch: Math.min(
      36,
      Math.max(
        key.length + 2,
        ...rows.slice(0, 80).map((row) => String(row[key] ?? "").length + 2),
      ),
    ),
  }));
}

function methodologyRows(meta: ExportMeta): (string | number)[][] {
  const now = meta.generatedAt ?? new Date().toISOString();
  const lines: (string | number)[][] = [
    ["Observatoire Hôtelier — méthodologie de l'extraction"],
    [],
    ["Titre", meta.titre],
    ["Périmètre", meta.perimetre],
    ["Auteur", meta.auteur],
    ["Généré le", fmtDate(now)],
    ["Date d'extraction de référence", fmtDate(EXTRACTION_DATE)],
    [],
    ["Filtres appliqués", ""],
  ];
  if (meta.filters) {
    for (const line of describeFilters(meta.filters)) lines.push(["", line]);
  } else {
    lines.push(["", "Aucun filtre restrictif"]);
  }
  lines.push(
    [],
    ["Niveaux de fiabilité", ""],
    [
      "N1",
      `${RELIABILITY_META.N1.description} — valeur constatée dans une source primaire (rapport annuel, Infogreffe, site officiel, visite).`,
    ],
    [
      "N2",
      `${RELIABILITY_META.N2.description} — recoupement de sources secondaires (presse, bases publiques, données sectorielles).`,
    ],
    [
      "N3",
      `${RELIABILITY_META.N3.description} — hypothèse de travail, jamais présentée comme une donnée vérifiée.`,
    ],
    [],
    [
      "Avertissement",
      "Jeu de démonstration : les 200 hôtels, indicateurs et transactions sont fictifs. Les ratios calculés (CA/clé, part F&B, m²/clé) ne sont jamais stockés.",
    ],
  );
  return lines;
}

function buildSynthesis(
  hotels: Hotel[],
  kpis: KpiYear[],
  annee: number,
): (string | number)[][] {
  const keys = sum(hotels.map((hotel) => hotel.cles));
  const caTotal = sum(
    hotels.map((hotel) => kpiFor(hotel.id, kpis, annee)?.caTotal ?? 0),
  );
  const adrValues = metricValues(hotels, kpis, "adr", annee);
  const revparValues = metricValues(hotels, kpis, "revpar", annee);
  const toValues = metricValues(hotels, kpis, "to", annee);
  const noteValues = metricValues(hotels, kpis, "note", annee);
  const spaCount = hotels.filter((hotel) => hotel.equipements.spa).length;
  const restoCount = hotels.filter(
    (hotel) => hotel.equipements.restaurantGastro || hotel.equipements.brasserie,
  ).length;

  const rows: (string | number)[][] = [
    ["Synthèse du périmètre", ""],
    [],
    ["Indicateur", "Valeur"],
    ["Hôtels", hotels.length],
    ["Clés", keys],
    ["CA total cumulé (€)", Math.round(caTotal)],
    ["ADR moyen (€)", mean(adrValues) != null ? Math.round(mean(adrValues)!) : "—"],
    ["ADR médian (€)", median(adrValues) != null ? Math.round(median(adrValues)!) : "—"],
    [
      "RevPAR moyen (€)",
      mean(revparValues) != null ? Math.round(mean(revparValues)!) : "—",
    ],
    ["TO moyen (%)", mean(toValues) != null ? fmtNum(mean(toValues)! * 100, 1) : "—"],
    ["Note moyenne (/10)", mean(noteValues) != null ? fmtNum(mean(noteValues)!, 2) : "—"],
    ["Part des hôtels avec spa (%)", hotels.length ? fmtNum((spaCount / hotels.length) * 100, 1) : "—"],
    [
      "Part des hôtels avec restauration (%)",
      hotels.length ? fmtNum((restoCount / hotels.length) * 100, 1) : "—",
    ],
    [],
    ["Répartition par catégorie", "Hôtels", "Clés", "CA total (€)", "ADR moyen (€)"],
  ];

  const categories = ["2★", "3★", "4★", "5★", "Palace"];
  for (const category of categories) {
    const panel = hotels.filter(
      (hotel) =>
        (hotel.categorie === "Palace" ? "Palace" : `${hotel.categorie}★`) === category,
    );
    if (!panel.length) continue;
    const panelAdr = mean(metricValues(panel, kpis, "adr", annee));
    rows.push([
      category,
      panel.length,
      sum(panel.map((hotel) => hotel.cles)),
      Math.round(sum(panel.map((hotel) => kpiFor(hotel.id, kpis, annee)?.caTotal ?? 0))),
      panelAdr != null ? Math.round(panelAdr) : "—",
    ]);
  }
  return rows;
}

export function exportHotelsXlsx(
  hotels: Hotel[],
  kpis: KpiYear[],
  annee: number,
  meta: ExportMeta,
): void {
  const rows = exportRows(hotels, kpis, annee);
  const workbook = XLSX.utils.book_new();

  const dataSheet = XLSX.utils.json_to_sheet(rows);
  dataSheet["!cols"] = autoColumns(rows);
  dataSheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(rows.length, 1), c: Math.max(Object.keys(rows[0] ?? {}).length - 1, 0) },
    }),
  };
  dataSheet["!freeze"] = { xSplit: 2, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Données");

  const synthesis = XLSX.utils.aoa_to_sheet(buildSynthesis(hotels, kpis, annee));
  synthesis["!cols"] = [{ wch: 38 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, synthesis, "Synthèse");

  const methodology = XLSX.utils.aoa_to_sheet(methodologyRows(meta));
  methodology["!cols"] = [{ wch: 30 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(workbook, methodology, "Méthodologie");

  XLSX.writeFile(
    workbook,
    `${safeName(meta.titre)}_${annee}.xlsx`,
    { compression: true },
  );
}

function csvEscape(value: string | number): string {
  const text = String(value ?? "");
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function hotelsToCsv(
  hotels: Hotel[],
  kpis: KpiYear[],
  annee: number,
): string {
  const rows = exportRows(hotels, kpis, annee);
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(";"),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(";")),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export function exportHotelsCsv(
  hotels: Hotel[],
  kpis: KpiYear[],
  annee: number,
  meta: ExportMeta,
): void {
  const csv = hotelsToCsv(hotels, kpis, annee);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${safeName(meta.titre)}_${annee}.csv`);
}

export interface MapCapture {
  dataUrl: string;
  width: number;
  height: number;
}

/** Télécharge une capture PNG de la carte, avec bandeau de contexte. */
export async function downloadMapPng(
  capture: MapCapture,
  title: string,
  subtitle: string,
  filename: string,
): Promise<void> {
  const image = await loadImage(capture.dataUrl);
  const canvas = document.createElement("canvas");
  const header = Math.round(capture.width * 0.105);
  canvas.width = capture.width;
  canvas.height = capture.height + header;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#fffefa";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0f2433";
  context.fillRect(0, 0, canvas.width, header);
  context.fillStyle = "#d3a07e";
  context.font = `600 ${Math.round(header * 0.2)}px Inter, sans-serif`;
  context.fillText("NOVA OBSERVATOIRE", Math.round(header * 0.35), Math.round(header * 0.38));
  context.fillStyle = "#ffffff";
  context.font = `500 ${Math.round(header * 0.3)}px Inter, sans-serif`;
  context.fillText(title, Math.round(header * 0.35), Math.round(header * 0.75));
  context.fillStyle = "rgba(255,255,255,0.6)";
  context.font = `400 ${Math.round(header * 0.19)}px Inter, sans-serif`;
  context.fillText(subtitle, Math.round(header * 0.35), Math.round(header * 0.95));
  context.drawImage(image, 0, header, capture.width, capture.height);
  context.fillStyle = "rgba(255,254,250,0.92)";
  context.fillRect(0, canvas.height - Math.round(header * 0.2), canvas.width, Math.round(header * 0.2));
  context.fillStyle = "#6b747b";
  context.font = `400 ${Math.round(header * 0.15)}px Inter, sans-serif`;
  context.fillText(
    `Données démo · ${fmtDate(EXTRACTION_DATE)}`,
    Math.round(header * 0.35),
    canvas.height - Math.round(header * 0.07),
  );
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${safeName(filename)}.png`;
  link.click();
}

export interface MapPptxInput {
  capture: MapCapture;
  hotels: Hotel[];
  kpis: KpiYear[];
  annee: number;
  titre: string;
  sousTitre: string;
  filtersLines: string[];
  filename: string;
}

/** Diapositive PowerPoint : carte, synthèse et liste des hôtels du périmètre. */
export async function exportMapPptx(input: MapPptxInput): Promise<void> {
  const { capture, hotels, kpis, annee, titre, sousTitre, filtersLines } = input;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Nova Observatoire";
  pptx.company = "Nova Observatoire";
  pptx.subject = titre;

  const slide = pptx.addSlide();
  slide.background = { color: "FFFEFA" };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.09,
    fill: { color: "0F2433" },
    line: { color: "0F2433" },
  });
  slide.addText("NOVA OBSERVATOIRE", {
    x: 0.5,
    y: 0.28,
    w: 5,
    h: 0.25,
    fontSize: 8,
    bold: true,
    charSpacing: 3,
    color: "A8653F",
    fontFace: "Arial",
  });
  slide.addText(titre, {
    x: 0.5,
    y: 0.55,
    w: 8.4,
    h: 0.55,
    fontSize: 22,
    color: "172029",
    fontFace: "Georgia",
  });
  slide.addText(sousTitre, {
    x: 0.5,
    y: 1.09,
    w: 8.4,
    h: 0.3,
    fontSize: 9.5,
    color: "6B747B",
    fontFace: "Arial",
  });

  const mapBox = { x: 0.5, y: 1.5, w: 8.5, h: 5.3 };
  const scale = Math.min(
    mapBox.w / capture.width,
    mapBox.h / capture.height,
  );
  const imageW = capture.width * scale;
  const imageH = capture.height * scale;
  slide.addImage({
    data: capture.dataUrl,
    x: mapBox.x + (mapBox.w - imageW) / 2,
    y: mapBox.y + (mapBox.h - imageH) / 2,
    w: imageW,
    h: imageH,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: mapBox.x,
    y: mapBox.y,
    w: mapBox.w,
    h: mapBox.h,
    fill: { color: "FFFFFF", transparency: 100 },
    line: { color: "D3CCBF", width: 0.75 },
  });

  const panelX = 9.3;
  const keys = sum(hotels.map((hotel) => hotel.cles));
  const adr = mean(metricValues(hotels, kpis, "adr", annee));
  const revpar = mean(metricValues(hotels, kpis, "revpar", annee));
  const ca = sum(hotels.map((hotel) => kpiFor(hotel.id, kpis, annee)?.caTotal ?? 0));

  slide.addText("PÉRIMÈTRE", {
    x: panelX,
    y: 1.5,
    w: 3.5,
    h: 0.25,
    fontSize: 7.5,
    bold: true,
    charSpacing: 1.5,
    color: "6B747B",
    fontFace: "Arial",
  });
  const stats: [string, string][] = [
    ["Hôtels", fmtInt(hotels.length)],
    ["Clés", fmtInt(keys)],
    ["CA cumulé", fmtEuro(ca, true)],
    ["ADR moyen", adr != null ? fmtEuro(adr) : "—"],
    ["RevPAR moyen", revpar != null ? fmtEuro(revpar) : "—"],
  ];
  stats.forEach(([label, value], index) => {
    const y = 1.78 + index * 0.38;
    slide.addText(label, {
      x: panelX,
      y,
      w: 1.7,
      h: 0.28,
      fontSize: 8.5,
      color: "6B747B",
      fontFace: "Arial",
    });
    slide.addText(value, {
      x: panelX + 1.65,
      y,
      w: 1.85,
      h: 0.28,
      fontSize: 9.5,
      bold: true,
      align: "right",
      color: "172029",
      fontFace: "Arial",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: panelX,
      y: y + 0.33,
      w: 3.5,
      h: 0,
      line: { color: "E4DFD5", width: 0.5 },
    });
  });

  slide.addText("PRINCIPAUX HÔTELS", {
    x: panelX,
    y: 3.85,
    w: 3.5,
    h: 0.25,
    fontSize: 7.5,
    bold: true,
    charSpacing: 1.5,
    color: "6B747B",
    fontFace: "Arial",
  });
  const topHotels = [...hotels]
    .sort(
      (a, b) =>
        (kpiFor(b.id, kpis, annee)?.revpar ?? 0) -
        (kpiFor(a.id, kpis, annee)?.revpar ?? 0),
    )
    .slice(0, 6);
  topHotels.forEach((hotel, index) => {
    const kpi = kpiFor(hotel.id, kpis, annee);
    slide.addText(
      `${index + 1}. ${hotel.nom} — ${hotel.ville}\n${hotel.categorie === "Palace" ? "Palace" : `${hotel.categorie}★`} · ${fmtInt(hotel.cles)} clés · RevPAR ${kpi?.revpar ? fmtEuro(kpi.revpar) : "—"}`,
      {
        x: panelX,
        y: 4.12 + index * 0.44,
        w: 3.5,
        h: 0.42,
        fontSize: 7.8,
        color: "39444E",
        fontFace: "Arial",
        lineSpacingMultiple: 1.05,
      },
    );
  });

  slide.addText(
    "Sources : chaque valeur est tracée dans le classeur Excel joint (source, date, auteur, fiabilité N1/N2/N3).",
    {
      x: 0.5,
      y: 6.95,
      w: 9,
      h: 0.3,
      fontSize: 7.2,
      italic: true,
      color: "6B747B",
      fontFace: "Arial",
    },
  );
  slide.addText("Données fictives — démonstration", {
    x: panelX,
    y: 6.95,
    w: 3.5,
    h: 0.3,
    fontSize: 7.2,
    bold: true,
    color: "A8653F",
    align: "right",
    fontFace: "Arial",
  });

  // Deuxième diapositive : méthodologie et niveaux de fiabilité.
  const method = pptx.addSlide();
  method.background = { color: "FFFEFA" };
  method.addText("Méthodologie & sources", {
    x: 0.6,
    y: 0.5,
    w: 12,
    h: 0.5,
    fontSize: 20,
    color: "172029",
    fontFace: "Georgia",
  });
  method.addText(
    [
      { text: "Périmètre\n", options: { bold: true, color: "A8653F", fontSize: 9 } },
      ...filtersLines.map((line) => ({
        text: `${line}\n`,
        options: { color: "39444E", fontSize: 9.5 },
      })),
    ],
    {
      x: 0.6,
      y: 1.2,
      w: 5.9,
      h: 4.6,
      fontFace: "Arial",
      lineSpacingMultiple: 1.2,
    },
  );
  method.addText(
    [
      { text: "Niveaux de fiabilité\n\n", options: { bold: true, color: "A8653F", fontSize: 9 } },
      { text: "N1 — ", options: { bold: true, color: "256B4E", fontSize: 10 } },
      { text: "Observable / vérifié : rapport annuel, Infogreffe, site officiel, visite.\n\n", options: { color: "39444E", fontSize: 10 } },
      { text: "N2 — ", options: { bold: true, color: "9A5D10", fontSize: 10 } },
      { text: "Recherche approfondie : recoupement de sources secondaires.\n\n", options: { color: "39444E", fontSize: 10 } },
      { text: "N3 — ", options: { bold: true, color: "6C7074", fontSize: 10 } },
      { text: "Estimation : hypothèse de travail, affichée en italique, jamais présentée comme vérifiée.\n\n", options: { color: "39444E", fontSize: 10 } },
      { text: "Les 200 hôtels de ce jeu sont fictifs. Les ratios (CA/clé, part F&B, m²/clé) sont calculés à la volée et ne sont jamais stockés.", options: { italic: true, color: "6B747B", fontSize: 9 } },
    ],
    {
      x: 6.9,
      y: 1.2,
      w: 5.8,
      h: 4.9,
      fontFace: "Arial",
      lineSpacingMultiple: 1.15,
    },
  );
  method.addText("NOVA OBSERVATOIRE · Données démo", {
    x: 0.6,
    y: 6.9,
    w: 12,
    h: 0.3,
    fontSize: 8,
    color: "949B9F",
    fontFace: "Arial",
  });

  await pptx.writeFile({ fileName: `${safeName(input.filename)}.pptx` });
}


/* ------------------------------------------------------------------ *
 * Comparateur concurrentiel — Excel & PowerPoint
 * ------------------------------------------------------------------ */

function exportNumber(value: number | null | undefined, key: KpiKey): number | string {
  if (value == null || !Number.isFinite(value)) return "";
  if (KPI_LABELS[key].unit === "%") return Number((value * 100).toFixed(1));
  if (KPI_LABELS[key].unit.includes("10")) return Number(value.toFixed(1));
  return Math.round(value);
}

function comparisonHeader(columns: ComparisonColumn[]): string[] {
  return columns.map((column) =>
    column.isReference ? `${column.nom} — RÉFÉRENCE` : column.nom,
  );
}

function comparisonTableRows(columns: ComparisonColumn[]): (string | number)[][] {
  const rows: (string | number)[][] = [
    ["Indicateur", "Unité", ...comparisonHeader(columns)],
    ["Catégorie", "", ...columns.map((column) => (column.categorie === "Palace" ? "Palace" : `${column.categorie}★`))],
    ["Ville", "", ...columns.map((column) => column.ville)],
    ["Groupe", "", ...columns.map((column) => column.groupe)],
  ];
  for (const key of COMPARATOR_KPIS) {
    rows.push([
      KPI_LABELS[key].label,
      KPI_LABELS[key].unit,
      ...columns.map((column) => exportNumber(column.values[key], key)),
    ]);
  }
  return rows;
}

/** Excel du comparateur : valeurs, écarts, équipements, sources et méthodologie. */
export function exportComparatorXlsx({
  columns,
  hotels,
  kpis,
  annee,
  meta,
}: {
  columns: ComparisonColumn[];
  hotels: Hotel[];
  kpis: KpiYear[];
  annee: number;
  meta: ExportMeta;
}): void {
  const workbook = XLSX.utils.book_new();
  const header = comparisonHeader(columns);

  const sheets: { name: string; rows: (string | number)[][]; widths?: number[] }[] = [];

  const statsRows: (string | number)[][] = [
    ["Statistiques du panel", ""],
    [],
    ["Indicateur", "Moyenne", "Médiane", "Minimum", "Maximum", "Valeurs"],
  ];
  for (const key of COMPARATOR_KPIS) {
    const stats = comparisonStats(columns, key);
    statsRows.push([
      KPI_LABELS[key].label,
      exportNumber(stats.mean, key),
      exportNumber(stats.median, key),
      exportNumber(stats.min, key),
      exportNumber(stats.max, key),
      stats.count,
    ]);
  }
  sheets.push({ name: "Synthèse", rows: statsRows, widths: [38, 14, 14, 14, 14, 10] });

  const dataRows = comparisonTableRows(columns);
  sheets.push({ name: "Comparaison", rows: dataRows, widths: [34, 10, ...columns.map(() => 22)] });

  const gapRows: (string | number)[][] = [
    ["Écarts à la référence", ""],
    [],
    ["Indicateur", ...header],
  ];
  for (const key of COMPARATOR_KPIS) {
    gapRows.push([
      KPI_LABELS[key].label,
      ...columns.map((column) => {
        if (column.isReference) return "Référence";
        return gapToReference(key, column.values[key], columns[0]?.values[key])?.text ?? "—";
      }),
    ]);
  }
  sheets.push({ name: "Écarts", rows: gapRows, widths: [34, ...columns.map(() => 18)] });

  const equipmentRows: (string | number)[][] = [
    ["Équipements & capacités", ""],
    [],
    ["Élément", ...header],
  ];
  for (const { key, label } of equipmentLabels) {
    equipmentRows.push([
      label,
      ...columns.map((column) => {
        if (!column.hotel) return "—";
        return column.hotel.equipements[key] ? "Oui" : "Non";
      }),
    ]);
  }
  const detailRows: [
    "spaSurface" | "spaCabines" | "parkingPlaces" | "couvertsInterieur" | "couvertsExterieur" | "ticketMoyen",
    string,
  ][] = [
    ["spaSurface", "Surface spa (m²)"],
    ["spaCabines", "Cabines de soins"],
    ["parkingPlaces", "Places de parking"],
    ["couvertsInterieur", "Couverts intérieurs"],
    ["couvertsExterieur", "Couverts extérieurs"],
    ["ticketMoyen", "Ticket moyen F&B (€)"],
  ];
  for (const [key, label] of detailRows) {
    equipmentRows.push([
      label,
      ...columns.map((column) => column.hotel?.equipements[key] ?? "—"),
    ]);
  }
  sheets.push({ name: "Équipements", rows: equipmentRows, widths: [34, ...columns.map(() => 18)] });

  const sourceRows: (string | number)[][] = [
    ["Sources & fiabilité", ""],
    [],
    [
      "Hôtel",
      "Type",
      "Source fiche",
      "Fiabilité fiche",
      "Source KPI",
      "Fiabilité KPI",
      "Date",
      "Auteur",
      "Hypothèse",
    ],
  ];
  for (const column of columns) {
    if (column.isManual) {
      sourceRows.push([
        column.nom,
        "Actif client (saisie manuelle)",
        column.source.source,
        column.source.fiabilite,
        column.source.source,
        column.source.fiabilite,
        column.source.dateSource,
        column.source.auteur,
        column.source.hypothese ?? "",
      ]);
      continue;
    }
    const hotel = hotels.find((item) => item.id === column.hotelId);
    const kpi = kpiFor(column.hotelId ?? "", kpis, annee);
    sourceRows.push([
      column.nom,
      "Hôtel de l'observatoire",
      hotel?.source.source ?? column.source.source,
      hotel?.source.fiabilite ?? column.source.fiabilite,
      kpi?.source.source ?? "Non renseignée",
      kpi?.source.fiabilite ?? "—",
      kpi?.source.dateSource ?? hotel?.source.dateSource ?? "",
      kpi?.source.auteur ?? hotel?.source.auteur ?? "",
      kpi?.source.hypothese ?? hotel?.source.hypothese ?? "",
    ]);
  }
  sheets.push({ name: "Sources", rows: sourceRows, widths: [28, 26, 34, 12, 34, 12, 14, 18, 40] });

  sheets.push({ name: "Méthodologie", rows: methodologyRows(meta), widths: [30, 110] });

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    if (sheet.widths) worksheet["!cols"] = sheet.widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  XLSX.writeFile(workbook, `${safeName(meta.titre)}_comparatif_${annee}.xlsx`, {
    compression: true,
  });
}

function pptText(value: number | null | undefined, key: KpiKey): string {
  if (value == null) return "—";
  return formatMetricForPpt(key, value);
}

function formatMetricForPpt(key: KpiKey, value: number): string {
  const meta = KPI_LABELS[key];
  if (meta.unit === "%") return `${(value * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
  if (meta.unit.includes("10")) return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  if (meta.unit.startsWith("€")) return fmtEuro(value, true);
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

/** PowerPoint du comparateur : synthèse, tableaux par lots, carte et sources. */
export async function exportComparatorPptx({
  columns,
  annee,
  meta,
  mapDataUrl,
}: {
  columns: ComparisonColumn[];
  annee: number;
  meta: ExportMeta;
  mapDataUrl?: string | null;
}): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Nova Observatoire";
  pptx.company = "Nova Observatoire";
  pptx.subject = meta.titre;

  const reference = columns[0];
  const panel = columns.filter((column) => !column.isReference);
  const footer = (slide: PptxGenJS.Slide, light = false) => {
    slide.addText("NOVA OBSERVATOIRE", {
      x: 0.55,
      y: 7.1,
      w: 4,
      h: 0.22,
      fontSize: 7,
      bold: true,
      charSpacing: 2.5,
      color: light ? "D3A07E" : "A8653F",
      fontFace: "Arial",
    });
    slide.addText(`Données démo · exercice ${annee} · ${fmtDate(EXTRACTION_DATE)}`, {
      x: 8.2,
      y: 7.1,
      w: 4.5,
      h: 0.22,
      fontSize: 7,
      color: light ? "9FB0BC" : "949B9F",
      align: "right",
      fontFace: "Arial",
    });
  };

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "0F2433" };
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.12,
    h: 7.5,
    fill: { color: "A8653F" },
    line: { color: "A8653F" },
  });
  titleSlide.addText("NOVA OBSERVATOIRE", {
    x: 0.8,
    y: 0.7,
    w: 6,
    h: 0.3,
    fontSize: 9,
    bold: true,
    charSpacing: 3,
    color: "D3A07E",
    fontFace: "Arial",
  });
  titleSlide.addText("Comparateur\nconcurrentiel", {
    x: 0.8,
    y: 1.55,
    w: 8.6,
    h: 1.7,
    fontSize: 36,
    color: "FFFEFA",
    fontFace: "Georgia",
    lineSpacingMultiple: 0.95,
  });
  titleSlide.addText(meta.titre, {
    x: 0.8,
    y: 3.55,
    w: 8.6,
    h: 0.45,
    fontSize: 15,
    color: "D8E3EA",
    fontFace: "Arial",
  });
  titleSlide.addText(meta.perimetre, {
    x: 0.8,
    y: 4.05,
    w: 7.6,
    h: 0.8,
    fontSize: 10.5,
    color: "9FB0BC",
    fontFace: "Arial",
    lineSpacingMultiple: 1.2,
  });
  titleSlide.addShape(pptx.ShapeType.line, {
    x: 0.8,
    y: 5.15,
    w: 4.2,
    h: 0,
    line: { color: "446073", width: 0.75 },
  });
  titleSlide.addText(
    `${reference ? `Référence : ${reference.nom}\n` : ""}${panel.length + (reference ? 1 : 0)} acteurs comparés · ${annee}`,
    {
      x: 0.8,
      y: 5.35,
      w: 7,
      h: 0.8,
      fontSize: 10,
      color: "D8E3EA",
      fontFace: "Arial",
      lineSpacingMultiple: 1.3,
    },
  );
  titleSlide.addText("Document de travail — données fictives", {
    x: 0.8,
    y: 6.55,
    w: 6,
    h: 0.3,
    fontSize: 8,
    italic: true,
    color: "D3A07E",
    fontFace: "Arial",
  });
  footer(titleSlide, true);

  if (reference) {
    const synthesis = pptx.addSlide();
    synthesis.background = { color: "FFFEFA" };
    synthesis.addText("Synthèse du panel", {
      x: 0.55,
      y: 0.45,
      w: 9,
      h: 0.45,
      fontSize: 20,
      color: "172029",
      fontFace: "Georgia",
    });
    synthesis.addText(
      `Référence : ${reference.nom} · ${reference.ville} · ${reference.categorie === "Palace" ? "Palace" : `${reference.categorie}★`} · ${fmtInt(reference.cles)} clés`,
      {
        x: 0.55,
        y: 0.95,
        w: 9,
        h: 0.3,
        fontSize: 9.5,
        color: "6B747B",
        fontFace: "Arial",
      },
    );
    const rows: PptxGenJS.TableRow[] = [
      [
        { text: "Indicateur", options: { bold: true, color: "6B747B", fontSize: 8 } },
        { text: "Référence", options: { bold: true, color: "A8653F", fontSize: 8 } },
        { text: "Moyenne", options: { bold: true, color: "6B747B", fontSize: 8 } },
        { text: "Médiane", options: { bold: true, color: "6B747B", fontSize: 8 } },
        { text: "Minimum", options: { bold: true, color: "6B747B", fontSize: 8 } },
        { text: "Maximum", options: { bold: true, color: "6B747B", fontSize: 8 } },
      ],
    ];
    for (const key of ["caTotal", "caParCle", "adr", "to", "revpar", "ebitdaPct", "note"] as KpiKey[]) {
      const stats = comparisonStats(columns, key);
      rows.push([
        { text: KPI_LABELS[key].label, options: { fontSize: 8.5, color: "39444E" } },
        { text: pptText(reference.values[key], key), options: { fontSize: 8.5, bold: true, color: "172029" } },
        { text: pptText(stats.mean, key), options: { fontSize: 8.5, color: "39444E" } },
        { text: pptText(stats.median, key), options: { fontSize: 8.5, color: "39444E" } },
        { text: pptText(stats.min, key), options: { fontSize: 8.5, color: "39444E" } },
        { text: pptText(stats.max, key), options: { fontSize: 8.5, color: "39444E" } },
      ]);
    }
    synthesis.addTable(rows, {
      x: 0.55,
      y: 1.5,
      w: 8.3,
      colW: [2.6, 1.25, 1.1, 1.1, 1.1, 1.15],
      border: { type: "solid", color: "E4DFD5", pt: 0.5 },
      fill: { color: "FFFFFF" },
      rowH: 0.35,
      valign: "middle",
      margin: 0.06,
    });

    synthesis.addText("COMPOSITION DU PANEL", {
      x: 9.3,
      y: 1.5,
      w: 3.4,
      h: 0.25,
      fontSize: 7.5,
      bold: true,
      charSpacing: 1.4,
      color: "6B747B",
      fontFace: "Arial",
    });
    const categories = ["2★", "3★", "4★", "5★", "Palace"];
    categories.forEach((category, index) => {
      const count = columns.filter((column) =>
        (column.categorie === "Palace" ? "Palace" : `${column.categorie}★`) === category,
      ).length;
      synthesis.addText(category, {
        x: 9.3,
        y: 1.85 + index * 0.32,
        w: 1.2,
        h: 0.26,
        fontSize: 9,
        color: "6B747B",
        fontFace: "Arial",
      });
      synthesis.addText(String(count), {
        x: 12.1,
        y: 1.85 + index * 0.32,
        w: 0.6,
        h: 0.26,
        fontSize: 9,
        bold: true,
        align: "right",
        color: "172029",
        fontFace: "Arial",
      });
    });
    synthesis.addText(
      "Les écarts sont calculés par rapport à l'actif de référence. Les valeurs manquantes ne sont jamais estimées dans le tableau : elles restent vides.",
      {
        x: 9.3,
        y: 3.75,
        w: 3.4,
        h: 1.2,
        fontSize: 8,
        italic: true,
        color: "6B747B",
        fontFace: "Arial",
        lineSpacingMultiple: 1.2,
      },
    );
    synthesis.addText("Lecture : vert = meilleure valeur du panel, rouge = moins bonne.", {
      x: 9.3,
      y: 5.05,
      w: 3.4,
      h: 0.6,
      fontSize: 8,
      color: "39444E",
      fontFace: "Arial",
    });
    footer(synthesis);
  }

  // Tableaux de positionnement par lots de cinq concurrents + référence.
  const tableKeys: KpiKey[] = ["caTotal", "caParCle", "adr", "to", "revpar", "ebitdaPct", "note", "cles"];
  const batchSize = 5;
  for (let index = 0; index < panel.length; index += batchSize) {
    const batch = panel.slice(index, index + batchSize);
    const group = [reference, ...batch].filter((column): column is ComparisonColumn => Boolean(column));
    const slide = pptx.addSlide();
    slide.background = { color: "FFFEFA" };
    slide.addText(`Positionnement — ${index + 1} à ${Math.min(index + batchSize, panel.length)}`, {
      x: 0.55,
      y: 0.42,
      w: 10,
      h: 0.42,
      fontSize: 18,
      color: "172029",
      fontFace: "Georgia",
    });
    slide.addText(meta.titre, {
      x: 0.55,
      y: 0.86,
      w: 10,
      h: 0.26,
      fontSize: 8.5,
      color: "6B747B",
      fontFace: "Arial",
    });
    const header: PptxGenJS.TableRow = [
      { text: "Indicateur", options: { bold: true, color: "6B747B", fontSize: 7.5 } },
      ...group.map((column) => ({
        text: `${column.isReference ? "★ " : ""}${column.nom}\n${column.categorie === "Palace" ? "Palace" : `${column.categorie}★`} · ${fmtInt(column.cles)} clés`,
        options: {
          bold: true,
          color: column.isReference ? "8B5030" : "172029",
          fill: { color: column.isReference ? "F4E9DF" : "F7F5EF" },
          fontSize: 7.2,
        },
      })),
    ];
    const rows: PptxGenJS.TableRow[] = [header];
    for (const key of tableKeys) {
      rows.push([
        { text: KPI_LABELS[key].short, options: { fontSize: 7.5, color: "6B747B" } },
        ...group.map((column) => ({
          text: pptText(column.values[key], key),
          options: {
            fontSize: 7.5,
            color: column.isReference ? "8B5030" : "172029",
            bold: column.isReference,
          },
        })),
      ]);
    }
    const available = 12.2;
    const first = 2.1;
    const rest = (available - first) / Math.max(group.length, 1);
    slide.addTable(rows, {
      x: 0.55,
      y: 1.35,
      w: available,
      colW: [first, ...group.map(() => rest)],
      border: { type: "solid", color: "E4DFD5", pt: 0.5 },
      rowH: 0.42,
      valign: "middle",
      margin: 0.06,
    });
    slide.addText(
      "★ actif de référence · Écarts détaillés dans le classeur Excel joint.",
      {
        x: 0.55,
        y: 6.55,
        w: 9,
        h: 0.25,
        fontSize: 7.5,
        italic: true,
        color: "6B747B",
        fontFace: "Arial",
      },
    );
    footer(slide);
  }

  if (mapDataUrl) {
    const mapSlide = pptx.addSlide();
    mapSlide.background = { color: "FFFEFA" };
    mapSlide.addText("Carte du panel", {
      x: 0.55,
      y: 0.45,
      w: 8,
      h: 0.42,
      fontSize: 20,
      color: "172029",
      fontFace: "Georgia",
    });
    mapSlide.addText(meta.perimetre, {
      x: 0.55,
      y: 0.9,
      w: 8,
      h: 0.3,
      fontSize: 9,
      color: "6B747B",
      fontFace: "Arial",
    });
    mapSlide.addImage({
      data: mapDataUrl,
      x: 0.55,
      y: 1.35,
      w: 12.2,
      h: 5.2,
      sizing: { type: "contain", w: 12.2, h: 5.2 },
    });
    footer(mapSlide);
  }

  const sources = pptx.addSlide();
  sources.background = { color: "FFFEFA" };
  sources.addText("Sources & fiabilité", {
    x: 0.55,
    y: 0.45,
    w: 9,
    h: 0.42,
    fontSize: 20,
    color: "172029",
    fontFace: "Georgia",
  });
  sources.addText(
    "Chaque acteur porte la source et le niveau de fiabilité de la fiche utilisée. N3 = hypothèse, jamais présentée comme vérifiée.",
    {
      x: 0.55,
      y: 0.9,
      w: 12,
      h: 0.3,
      fontSize: 8.5,
      color: "6B747B",
      fontFace: "Arial",
    },
  );
  const sourceRows: PptxGenJS.TableRow[] = [
    [
      { text: "Acteur", options: { bold: true, color: "6B747B", fontSize: 7.5 } },
      { text: "Source", options: { bold: true, color: "6B747B", fontSize: 7.5 } },
      { text: "Fiabilité", options: { bold: true, color: "6B747B", fontSize: 7.5 } },
      { text: "Date", options: { bold: true, color: "6B747B", fontSize: 7.5 } },
      { text: "Auteur", options: { bold: true, color: "6B747B", fontSize: 7.5 } },
    ],
  ];
  for (const column of columns.slice(0, 15)) {
    sourceRows.push([
      { text: column.nom, options: { fontSize: 7.2, color: "172029" } },
      { text: column.source.source, options: { fontSize: 7, color: "39444E" } },
      { text: column.source.fiabilite, options: { fontSize: 7, color: column.source.fiabilite === "N1" ? "256B4E" : column.source.fiabilite === "N2" ? "9A5D10" : "6C7074" } },
      { text: fmtDate(column.source.dateSource), options: { fontSize: 7, color: "39444E" } },
      { text: column.source.auteur, options: { fontSize: 7, color: "39444E" } },
    ]);
  }
  sources.addTable(sourceRows, {
    x: 0.55,
    y: 1.35,
    w: 12.2,
    colW: [2.8, 5.2, 1.1, 1.4, 1.7],
    border: { type: "solid", color: "E4DFD5", pt: 0.5 },
    rowH: 0.3,
    valign: "middle",
    margin: 0.06,
  });
  if (columns.length > 15) {
    sources.addText(`+ ${columns.length - 15} acteurs détaillés dans l'annexe Excel « Sources ».`, {
      x: 0.55,
      y: 6.35,
      w: 8,
      h: 0.3,
      fontSize: 8,
      italic: true,
      color: "6B747B",
      fontFace: "Arial",
    });
  }
  footer(sources);

  await pptx.writeFile({ fileName: `${safeName(meta.titre)}_comparatif_${annee}.pptx` });
}


/**
 * PowerPoint de benchmark : page de garde, carte, synthèse sectorielle,
 * positionnement prix × qualité, panel détaillé et annexe de sources.
 */
export async function exportBenchmarkPptx({
  benchmark,
  hotels,
  kpis,
  mapDataUrl,
  positioningDataUrl,
}: {
  benchmark: Benchmark;
  hotels: Hotel[];
  kpis: KpiYear[];
  mapDataUrl?: string | null;
  positioningDataUrl?: string | null;
}): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Nova Observatoire";
  pptx.company = "Nova Observatoire";
  pptx.subject = benchmark.nom;

  const panel = benchmarkHotels(benchmark, hotels);
  const overview = benchmarkOverview(benchmark, hotels, kpis, benchmark.annee);
  const sectors = benchmarkSectors(benchmark, hotels);
  const sectorStats = sectors.map((sector) =>
    benchmarkSectorStats(sector, hotels, kpis, benchmark.annee),
  );
  const ordered = orderedBenchmarkHotels(benchmark, hotels, kpis, benchmark.annee);
  const sources = benchmarkSourceRows(benchmark, hotels, kpis);
  const positioning = ordered
    .map((hotel, index) => {
      const kpi = kpiFor(hotel.id, kpis, benchmark.annee);
      if (!kpi || kpi.adr == null || kpi.note == null) return null;
      const sector = sectors.find((item) => item.hotelIds.includes(hotel.id))?.nom ?? "Panel";
      return {
        hotel,
        index: index + 1,
        adr: kpi.adr,
        note: kpi.note,
        revpar: kpi.revpar,
        keys: hotel.cles,
        secteur: sector,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => b.note - a.note);

  const footer = (slide: PptxGenJS.Slide, light = false) => {
    slide.addText("NOVA OBSERVATOIRE", {
      x: 0.55, y: 7.1, w: 4, h: 0.22, fontSize: 7, bold: true,
      charSpacing: 2.5, color: light ? "D3A07E" : "A8653F", fontFace: "Arial",
    });
    slide.addText(
      `Benchmark v${benchmark.version} · exercice ${benchmark.annee} · données démo · ${fmtDate(EXTRACTION_DATE)}`,
      { x: 7.6, y: 7.1, w: 5.1, h: 0.22, fontSize: 7, color: light ? "9FB0BC" : "949B9F", align: "right", fontFace: "Arial" },
    );
  };

  const heading = (slide: PptxGenJS.Slide, title: string, subtitle: string) => {
    slide.background = { color: "FFFEFA" };
    slide.addText(title, { x: 0.55, y: 0.42, w: 12, h: 0.42, fontSize: 20, color: "172029", fontFace: "Georgia" });
    slide.addText(subtitle, { x: 0.55, y: 0.87, w: 12, h: 0.3, fontSize: 8.5, color: "6B747B", fontFace: "Arial" });
  };

  const title = pptx.addSlide();
  title.background = { color: "0F2433" };
  title.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: "A8653F" }, line: { color: "A8653F" } });
  title.addText("NOVA OBSERVATOIRE", { x: 0.8, y: 0.7, w: 6, h: 0.3, fontSize: 9, bold: true, charSpacing: 3, color: "D3A07E", fontFace: "Arial" });
  title.addText("Benchmark\nconcurrentiel", { x: 0.8, y: 1.55, w: 8.8, h: 1.7, fontSize: 36, color: "FFFEFA", fontFace: "Georgia", lineSpacingMultiple: 0.95 });
  title.addText(benchmark.nom, { x: 0.8, y: 3.5, w: 9.4, h: 0.5, fontSize: 15, color: "D8E3EA", fontFace: "Arial" });
  title.addText(`${benchmark.client} · ${benchmark.mission}`, { x: 0.8, y: 4.02, w: 9, h: 0.35, fontSize: 10.5, color: "9FB0BC", fontFace: "Arial" });
  title.addShape(pptx.ShapeType.line, { x: 0.8, y: 5.05, w: 4.2, h: 0, line: { color: "446073", width: 0.75 } });
  title.addText(
    `${fmtDate(benchmark.date)} · ${benchmark.consultant}\n${overview.count} acteurs · ${sectors.length} secteur${sectors.length > 1 ? "s" : ""} · version ${benchmark.version}`,
    { x: 0.8, y: 5.25, w: 8, h: 0.9, fontSize: 10, color: "D8E3EA", fontFace: "Arial", lineSpacingMultiple: 1.3 },
  );
  title.addText("Document de travail — données fictives, ne pas diffuser", { x: 0.8, y: 6.75, w: 8, h: 0.3, fontSize: 8, italic: true, color: "9FB0BC", fontFace: "Arial" });

  const synthesis = pptx.addSlide();
  heading(synthesis, "Périmètre & synthèse", `${benchmark.nom} · ${benchmark.client} · exercice ${benchmark.annee}`);
  const metrics: [string, string][] = [
    ["Acteurs", fmtInt(overview.count)],
    ["Clés", fmtInt(overview.cles)],
    ["CA cumulé", overview.caTotal != null ? fmtEuro(overview.caTotal, true) : "—"],
    ["ADR moyen", overview.adr != null ? fmtEuro(overview.adr) : "—"],
    ["TO moyen", overview.to != null ? fmtTo(overview.to) : "—"],
    ["RevPAR moyen", overview.revpar != null ? fmtEuro(overview.revpar) : "—"],
    ["EBITDA moyen", overview.ebitdaPct != null ? `${fmtNum(overview.ebitdaPct * 100, 1)} %` : "—"],
    ["Note moyenne", overview.note != null ? `${fmtNum(overview.note, 1)}/10` : "—"],
  ];
  metrics.forEach(([label, value], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    synthesis.addShape(pptx.ShapeType.rect, {
      x: 0.55 + col * 3.1, y: 1.35 + row * 1.02, w: 2.9, h: 0.86,
      fill: { color: "F5F3EE" }, line: { color: "E4DFD5", width: 0.5 },
    });
    synthesis.addText(label.toUpperCase(), { x: 0.7 + col * 3.1, y: 1.46 + row * 1.02, w: 2.6, h: 0.2, fontSize: 7, bold: true, charSpacing: 0.8, color: "6B747B", fontFace: "Arial" });
    synthesis.addText(value, { x: 0.7 + col * 3.1, y: 1.68 + row * 1.02, w: 2.6, h: 0.38, fontSize: 16, color: "172029", fontFace: "Georgia" });
  });
  synthesis.addText("Composition du panel", { x: 0.55, y: 3.65, w: 4, h: 0.28, fontSize: 10, bold: true, color: "39444E", fontFace: "Arial" });
  synthesis.addText(
    sectors.map((sector) => `${sector.nom} (${sector.hotelIds.length})`).join(" · "),
    { x: 0.55, y: 3.98, w: 12.2, h: 0.8, fontSize: 9, color: "39444E", fontFace: "Arial", lineSpacingMultiple: 1.2 },
  );
  synthesis.addText("Repères", { x: 0.55, y: 4.95, w: 4, h: 0.28, fontSize: 10, bold: true, color: "39444E", fontFace: "Arial" });
  synthesis.addText(
    [
      `Référence : ${panel.find((hotel) => hotel.id === benchmark.referenceId)?.nom ?? "non définie"}`,
      `Source : observatoire interne Nova · ${benchmark.hotelIds.length} fiches rattachées`,
      benchmark.notes ? `Note de mission : ${benchmark.notes}` : "Aucune note de méthode complémentaire.",
    ].join("\n"),
    { x: 0.55, y: 5.28, w: 12, h: 1.2, fontSize: 8.5, color: "6B747B", fontFace: "Arial", lineSpacingMultiple: 1.25, bullet: false },
  );
  footer(synthesis);

  if (mapDataUrl) {
    const mapSlide = pptx.addSlide();
    heading(mapSlide, "Carte du panel", `Numérotation alignée sur la synthèse sectorielle · ${benchmark.nom}`);
    mapSlide.addImage({ data: mapDataUrl, x: 0.55, y: 1.3, w: 12.2, h: 5.4, sizing: { type: "contain", w: 12.2, h: 5.4 } });
    footer(mapSlide);
  }

  const sectorSlide = pptx.addSlide();
  heading(sectorSlide, "Synthèse par secteur", "Moyennes non pondérées · les valeurs absentes sont exclues, jamais remplacées par zéro.");
  const sectorRows: PptxGenJS.TableRow[] = [[
    { text: "Secteur", options: { bold: true, color: "6B747B", fontSize: 7.5 } },
    { text: "Hôtels", options: { bold: true, color: "6B747B", fontSize: 7.5, align: "right" } },
    { text: "Clés", options: { bold: true, color: "6B747B", fontSize: 7.5, align: "right" } },
    { text: "CA cumulé", options: { bold: true, color: "6B747B", fontSize: 7.5, align: "right" } },
    { text: "ADR moyen", options: { bold: true, color: "6B747B", fontSize: 7.5, align: "right" } },
    { text: "TO moyen", options: { bold: true, color: "6B747B", fontSize: 7.5, align: "right" } },
    { text: "RevPAR moyen", options: { bold: true, color: "6B747B", fontSize: 7.5, align: "right" } },
    { text: "Note", options: { bold: true, color: "6B747B", fontSize: 7.5, align: "right" } },
    { text: "Leader RevPAR", options: { bold: true, color: "6B747B", fontSize: 7.5 } },
  ]];
  for (const stat of sectorStats.slice(0, 12)) {
    sectorRows.push([
      { text: stat.nom, options: { fontSize: 7.4, color: "172029", bold: true } },
      { text: String(stat.count), options: { fontSize: 7.2, color: "39444E", align: "right" } },
      { text: fmtInt(stat.cles), options: { fontSize: 7.2, color: "39444E", align: "right" } },
      { text: stat.caTotal != null ? fmtEuro(stat.caTotal, true) : "—", options: { fontSize: 7.2, color: "39444E", align: "right" } },
      { text: stat.adr != null ? fmtEuro(stat.adr) : "—", options: { fontSize: 7.2, color: "39444E", align: "right" } },
      { text: stat.to != null ? fmtTo(stat.to) : "—", options: { fontSize: 7.2, color: "39444E", align: "right" } },
      { text: stat.revpar != null ? fmtEuro(stat.revpar) : "—", options: { fontSize: 7.2, color: "39444E", align: "right" } },
      { text: stat.note != null ? fmtNum(stat.note, 1) : "—", options: { fontSize: 7.2, color: "39444E", align: "right" } },
      { text: stat.lead?.hotel.nom ?? "—", options: { fontSize: 7, color: "6B747B" } },
    ]);
  }
  sectorSlide.addTable(sectorRows, {
    x: 0.55, y: 1.35, w: 12.2, colW: [2.0, 0.7, 0.85, 1.35, 1.3, 1.0, 1.45, 0.7, 2.85],
    border: { type: "solid", color: "E4DFD5", pt: 0.5 }, rowH: 0.32, valign: "middle", margin: 0.06,
  });
  footer(sectorSlide);

  const positioningSlide = pptx.addSlide();
  heading(positioningSlide, "Positionnement prix × qualité", "ADR en abscisse, note en ordonnée, taille des marqueurs = nombre de clés.");
  if (positioningDataUrl) {
    positioningSlide.addImage({ data: positioningDataUrl, x: 0.55, y: 1.28, w: 8.35, h: 5.45, sizing: { type: "contain", w: 8.35, h: 5.45 } });
  } else {
    positioningSlide.addText("Capture indisponible — le graphique est visible dans l’application.", { x: 0.55, y: 3.2, w: 8.2, h: 0.6, fontSize: 10, color: "6B747B", fontFace: "Arial" });
  }
  positioningSlide.addText("Lecture rapide", { x: 9.2, y: 1.35, w: 3.6, h: 0.28, fontSize: 10, bold: true, color: "39444E", fontFace: "Arial" });
  const leaders = positioning.slice(0, 5);
  positioningSlide.addText(
    leaders.map((row) => `${row.index}. ${row.hotel.nom} — ${fmtNum(row.note, 1)}/10 · ${fmtEuro(row.adr)}`).join("\n"),
    { x: 9.2, y: 1.7, w: 3.7, h: 2.4, fontSize: 8, color: "6B747B", fontFace: "Arial", lineSpacingMultiple: 1.35 },
  );
  positioningSlide.addText(
    "Les positions hautes à droite signalent un positionnement premium crédible ; les écarts de note et d’ADR doivent être lus avec la fiabilité de chaque source.",
    { x: 9.2, y: 4.35, w: 3.6, h: 1.6, fontSize: 8, italic: true, color: "949B9F", fontFace: "Arial", lineSpacingMultiple: 1.3 },
  );
  footer(positioningSlide);

  for (let start = 0; start < ordered.length; start += 18) {
    const chunk = ordered.slice(start, start + 18);
    const panelSlide = pptx.addSlide();
    heading(panelSlide, "Panel détaillé", "Numérotation identique à la carte · fiabilité et sources en annexe.");
    const rows: PptxGenJS.TableRow[] = [[
      { text: "#", options: { bold: true, color: "6B747B", fontSize: 7 } },
      { text: "Hôtel", options: { bold: true, color: "6B747B", fontSize: 7 } },
      { text: "Ville", options: { bold: true, color: "6B747B", fontSize: 7 } },
      { text: "Cat.", options: { bold: true, color: "6B747B", fontSize: 7 } },
      { text: "Clés", options: { bold: true, color: "6B747B", fontSize: 7, align: "right" } },
      { text: "ADR", options: { bold: true, color: "6B747B", fontSize: 7, align: "right" } },
      { text: "TO", options: { bold: true, color: "6B747B", fontSize: 7, align: "right" } },
      { text: "RevPAR", options: { bold: true, color: "6B747B", fontSize: 7, align: "right" } },
      { text: "Note", options: { bold: true, color: "6B747B", fontSize: 7, align: "right" } },
    ]];
    chunk.forEach((hotel, offset) => {
      const kpi = kpiFor(hotel.id, kpis, benchmark.annee);
      rows.push([
        { text: String(start + offset + 1), options: { fontSize: 7, color: "949B9F" } },
        { text: hotel.nom, options: { fontSize: 7.2, color: "172029", bold: hotel.id === benchmark.referenceId } },
        { text: hotel.ville, options: { fontSize: 7, color: "39444E" } },
        { text: hotel.categorie === "Palace" ? "Palace" : `${hotel.categorie}★`, options: { fontSize: 7, color: "39444E" } },
        { text: fmtInt(hotel.cles), options: { fontSize: 7, color: "39444E", align: "right" } },
        { text: pptText(kpi?.adr, "adr"), options: { fontSize: 7, color: "39444E", align: "right" } },
        { text: pptText(kpi?.to, "to"), options: { fontSize: 7, color: "39444E", align: "right" } },
        { text: pptText(kpi?.revpar, "revpar"), options: { fontSize: 7, color: "39444E", align: "right" } },
        { text: kpi?.note != null ? `${fmtNum(kpi.note, 1)}/10` : "—", options: { fontSize: 7, color: "39444E", align: "right" } },
      ]);
    });
    panelSlide.addTable(rows, {
      x: 0.55, y: 1.3, w: 12.2, colW: [0.4, 3.4, 1.7, 0.8, 0.8, 1.1, 0.9, 1.2, 1.1],
      border: { type: "solid", color: "E4DFD5", pt: 0.5 }, rowH: 0.28, valign: "middle", margin: 0.05,
    });
    footer(panelSlide);
  }

  const sourceSlide = pptx.addSlide();
  heading(sourceSlide, "Sources & fiabilité", "Chaque ligne relie la fiche et l’indicateur annuel à sa source, sa date et son auteur.");
  const sourceTable: PptxGenJS.TableRow[] = [[
    { text: "Hôtel", options: { bold: true, color: "6B747B", fontSize: 7 } },
    { text: "Source fiche", options: { bold: true, color: "6B747B", fontSize: 7 } },
    { text: "Source KPI", options: { bold: true, color: "6B747B", fontSize: 7 } },
    { text: "Fiab.", options: { bold: true, color: "6B747B", fontSize: 7 } },
    { text: "Date", options: { bold: true, color: "6B747B", fontSize: 7 } },
    { text: "Auteur", options: { bold: true, color: "6B747B", fontSize: 7 } },
  ]];
  for (const source of sources.slice(0, 15)) {
    sourceTable.push([
      { text: source.nom, options: { fontSize: 7, color: "172029" } },
      { text: source.fiche, options: { fontSize: 6.8, color: "39444E" } },
      { text: source.kpi, options: { fontSize: 6.8, color: "39444E" } },
      { text: source.kpiFiabilite, options: { fontSize: 7, bold: true, color: source.kpiFiabilite === "N1" ? "256B4E" : source.kpiFiabilite === "N2" ? "9A5D10" : "6C7074" } },
      { text: fmtDate(source.kpiDate), options: { fontSize: 6.8, color: "39444E" } },
      { text: source.kpiAuteur, options: { fontSize: 6.8, color: "39444E" } },
    ]);
  }
  sourceSlide.addTable(sourceTable, {
    x: 0.55, y: 1.3, w: 12.2, colW: [2.4, 2.7, 2.9, 0.9, 1.25, 1.5],
    border: { type: "solid", color: "E4DFD5", pt: 0.5 }, rowH: 0.3, valign: "middle", margin: 0.06,
  });
  sourceSlide.addText("N1 observable vérifié · N2 recherche approfondie · N3 estimation (hypothèse stockée, jamais présentée comme vérifiée).", {
    x: 0.55, y: 6.3, w: 12, h: 0.3, fontSize: 8, italic: true, color: "6B747B", fontFace: "Arial",
  });
  footer(sourceSlide);

  await pptx.writeFile({ fileName: `${safeName(benchmark.nom)}_benchmark_v${benchmark.version}_${benchmark.annee}.pptx` });
}

/** Télécharge une capture (data URL) sans repasser par un canvas. */
export function downloadImageDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${safeName(filename)}.png`;
  link.click();
}

function safeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "nova_export";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

/** Résumé textuel d'une période, réutilisé dans les en-têtes de slides. */
export function periodLabel(annee: number): string {
  return `Exercice ${annee} · extraction ${fmtDate(EXTRACTION_DATE)}`;
}

/** Alias conservé pour les écrans qui affichent un taux d'occupation formaté. */
export const formatOccupation = (value: number | null): string => fmtTo(value);
