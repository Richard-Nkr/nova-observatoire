import * as XLSX from "xlsx";
import type { Hotel, KpiYear, PipelineProject, Transaction } from "./types";
import { CATEGORY_LABEL, EXTRACTION_DATE } from "./constants";
import { fmtDate } from "./format";
import {
  enrichTransactions,
  hotelsInZone,
  openingsByYear,
  performanceByCategory,
  pipelineInZone,
  supplyByCategory,
  transactionsInZone,
  zoneKpis,
} from "./market";
import { sum } from "./stats";

/**
 * Export Excel du marché : offre, performance, ouvertures, pipeline et transactions.
 * Les transactions confidentielles ne sont incluses que si l'utilisateur y a accès.
 */
export function exportMarketXlsx({
  zone,
  annee,
  hotels,
  kpis,
  transactions,
  pipeline,
  includeConfidential,
  auteur,
  filters,
  hiddenConfidential = 0,
}: {
  zone: string;
  annee: number;
  hotels: Hotel[];
  kpis: KpiYear[];
  transactions: Transaction[];
  pipeline: PipelineProject[];
  includeConfidential: boolean;
  auteur: string;
  filters: string[];
  hiddenConfidential?: number;
}): void {
  const zoneHotels = hotelsInZone(hotels, zone);
  const zonePipeline = pipelineInZone(pipeline, zone);
  const allTransactions = transactionsInZone(enrichTransactions(transactions, hotels), zone);
  const visibleTransactions = includeConfidential
    ? allTransactions
    : allTransactions.filter(({ transaction }) => !transaction.confidentielClient);
  const overview = zoneKpis(zoneHotels, kpis, annee);
  const supply = supplyByCategory(zoneHotels);
  const performance = performanceByCategory(zoneHotels, kpis, annee);
  const openings = openingsByYear(zoneHotels);
  const documentedTransactions = visibleTransactions.filter(
    ({ transaction }) => transaction.caAvant != null || transaction.caApres != null,
  );
  const caAvantTotal = sum(
    visibleTransactions
      .map(({ transaction }) => transaction.caAvant)
      .filter((value): value is number => value != null),
  );
  const caApresTotal = sum(
    visibleTransactions
      .map(({ transaction }) => transaction.caApres)
      .filter((value): value is number => value != null),
  );

  const workbook = XLSX.utils.book_new();

  const summary: (string | number)[][] = [
    ["NOVA OBSERVATOIRE — MARCHÉ HÔTELIER"],
    [],
    ["Zone", zone],
    ["Exercice", annee],
    ["Date d'extraction", fmtDate(EXTRACTION_DATE)],
    ["Auteur", auteur],
    ["Périmètre", filters.join(" · ") || "Aucun filtre complémentaire"],
    [],
    ["Indicateur", "Valeur"],
    ["Hôtels", overview.count],
    ["Clés", overview.cles],
    ["CA total de l'exercice (€)", overview.caTotal ?? ""],
    [],
    ["Transactions retenues", visibleTransactions.length],
    ["Transactions avec CA documenté", documentedTransactions.length],
    ["CA avant cession cumulé (€)", caAvantTotal || ""],
    ["CA après cession cumulé (€)", caApresTotal || ""],
    [],
    ["ADR, TO, RevPAR, EBITDA, prix/nuit", "Non documentés dans la base fournie"],
    ["Prix de cession et prix par clé", "Non documentés dans la base fournie"],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!cols"] = [{ wch: 34 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Synthèse");

  const supplyRows: (string | number)[][] = [
    ["Catégorie", "Hôtels", "Clés", "Part des hôtels (%)", "Part des clés (%)"],
    ...supply.map((row) => [
      CATEGORY_LABEL[String(row.categorie)] ?? String(row.categorie),
      row.hotels,
      row.cles,
      Number((row.hotelShare * 100).toFixed(1)),
      Number((row.keyShare * 100).toFixed(1)),
    ]),
  ];
  const supplySheet = XLSX.utils.aoa_to_sheet(supplyRows);
  supplySheet["!cols"] = [{ wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, supplySheet, "Offre");

  const performanceRows: (string | number)[][] = [
    ["Catégorie", "Hôtels", "Clés", "CA total (€)", "ADR (€)", "TO (%)", "RevPAR (€)", "EBITDA (%)", "Note /10"],
    ...performance.map((row) => [
      CATEGORY_LABEL[String(row.categorie)] ?? String(row.categorie),
      row.hotels,
      row.cles,
      row.caTotal ?? "",
      row.adr ?? "",
      row.to === null ? "" : Number((row.to * 100).toFixed(1)),
      row.revpar ?? "",
      row.ebitdaPct === null ? "" : Number((row.ebitdaPct * 100).toFixed(1)),
      row.note ?? "",
    ]),
  ];
  const performanceSheet = XLSX.utils.aoa_to_sheet(performanceRows);
  performanceSheet["!cols"] = [
    { wch: 16 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(workbook, performanceSheet, "Performance");

  const openingRows: (string | number)[][] = [
    ["Année", "Ouvertures recensées", "Clés ouvertes"],
    ...openings.map((row) => [row.annee, row.ouvertures, row.cles]),
  ];
  const openingSheet = XLSX.utils.aoa_to_sheet(openingRows);
  openingSheet["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, openingSheet, "Ouvertures");

  const pipelineRows: (string | number)[][] = [
    ["Projet", "Ville", "Région", "Catégorie", "Clés", "Ouverture", "Statut", "Promoteur"],
    ...zonePipeline
      .sort((a, b) => a.ouverture - b.ouverture)
      .map((project) => [
        project.nom,
        project.ville,
        project.region,
        CATEGORY_LABEL[String(project.categorie)] ?? String(project.categorie),
        project.cles,
        project.ouverture,
        project.statut,
        project.promoteur,
      ]),
  ];
  const pipelineSheet = XLSX.utils.aoa_to_sheet(pipelineRows);
  pipelineSheet["!cols"] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 24 },
    { wch: 12 },
    { wch: 8 },
    { wch: 10 },
    { wch: 16 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(workbook, pipelineSheet, "Pipeline");

  const transactionRows: (string | number)[][] = [
    [
      "Date",
      "Hôtel",
      "Ville",
      "Région",
      "Catégorie",
      "Clés avant",
      "Clés après",
      "CA avant (€)",
      "Exercice CA avant",
      "CA après (€)",
      "Exercice CA après",
      "Analyste",
      "Localisation",
      "Source avant",
      "Source après",
      "Source",
      "Fiabilité",
      "Date source",
      "Auteur",
      "Confidentiel",
    ],
    ...visibleTransactions
      .sort((a, b) => b.transaction.date.localeCompare(a.transaction.date))
      .map(({ transaction, hotel }) => [
        fmtDate(transaction.date),
        hotel?.nom ?? "Hôtel non identifié",
        hotel?.ville ?? "",
        hotel?.region ?? "",
        hotel ? CATEGORY_LABEL[String(hotel.categorie)] : "",
        transaction.clesAvant ?? "",
        transaction.clesApres ?? "",
        transaction.caAvant ?? "",
        transaction.exerciceCaAvant ?? "",
        transaction.caApres ?? "",
        transaction.exerciceCaApres ?? "",
        transaction.analyste ?? "",
        transaction.localisation ?? "",
        transaction.sourceAvant?.source ?? "",
        transaction.sourceApres?.source ?? "",
        transaction.source.source,
        transaction.source.fiabilite,
        fmtDate(transaction.source.dateSource),
        transaction.source.auteur,
        transaction.confidentielClient ? "Oui" : "Non",
      ]),
  ];
  const transactionSheet = XLSX.utils.aoa_to_sheet(transactionRows);
  transactionSheet["!cols"] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 16 },
    { wch: 24 },
    { wch: 10 },
    { wch: 28 },
    { wch: 28 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 34 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, transactionSheet, "Transactions");

  const hiddenCount = hiddenConfidential || allTransactions.length - visibleTransactions.length;
  const methodology: (string | number)[][] = [
    ["Méthodologie"],
    [],
    ["Source des données", "BDD transactions hôtelières - vcompilée.xlsx — compilation de mission"],
    ["Date d'extraction", fmtDate(EXTRACTION_DATE)],
    ["Exercice analysé", annee],
    ["Zone", zone],
    ["Auteur de l'export", auteur],
    [],
    ["Calcul des agrégats", "Moyennes simples des valeurs renseignées, hors valeurs nulles."],
    ["Prix par clé", "Non documenté dans la base fournie : aucune estimation n'est produite."],
    ["Transactions exclues", `${hiddenCount} transaction(s) confidentielle(s) non incluse(s).`],
    ["Fermetures", "Non documentées dans la base fournie ; aucun chiffre n'est extrapolé."],
    [],
    ["Fiabilité N1", "Donnée observable et vérifiée (rapport annuel, acte, base interne)."],
    ["Fiabilité N2", "Recherche approfondie, à confirmer."],
    ["Fiabilité N3", "Estimation, hypothèse explicitée — ne pas présenter comme vérifiée."],
    [],
    ["Avertissement", "Les indicateurs absents du classeur source sont laissés vides et signalés comme non documentés."],
  ];
  const methodologySheet = XLSX.utils.aoa_to_sheet(methodology);
  methodologySheet["!cols"] = [{ wch: 30 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(workbook, methodologySheet, "Méthodologie");

  XLSX.writeFile(workbook, `Nova_Marche_${slug(zone)}_${annee}.xlsx`, { compression: true });
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

