"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardCheck,
  Download,
  ExternalLink,
  Plus,
  Search,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CURRENT_DATA_YEAR,
  EXTRACTION_DATE,
  KPI_LABELS,
  RELIABILITY_META,
  YEARS,
} from "@/lib/constants";
import { fmtDate, fmtInt } from "@/lib/format";
import type { Fiabilite, Hotel, KpiYear, Task } from "@/lib/types";
import { Badge, CategoryBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, SectionTitle, StatTile } from "@/components/ui/misc";
import { Select, SearchInput } from "@/components/ui/field";
import { TableShell, Td, Th } from "@/components/ui/table";
import { ReliabilityBadge } from "@/components/reliability";
import { TaskDialog } from "@/components/quality/task-dialog";
import { cn } from "@/lib/utils";

/**
 * Qualité des données : taux de remplissage, distribution de fiabilité,
 * ancienneté des exercices et file de complétion assignable.
 */

const EXTRACTION_YEAR = Number(EXTRACTION_DATE.slice(0, 4));
const TODAY = new Date().toISOString().slice(0, 10);

interface QualityField {
  group: "Identité" | "Capacité & surfaces" | "Équipements" | "Indicateurs";
  label: string;
  filled: (hotel: Hotel, kpi: KpiYear | undefined) => boolean;
}

const QUALITY_FIELDS: QualityField[] = [
  { group: "Identité", label: "Adresse postale", filled: (hotel) => Boolean(hotel.adresse) },
  { group: "Identité", label: "Code postal", filled: (hotel) => Boolean(hotel.codePostal) },
  { group: "Identité", label: "Département", filled: (hotel) => Boolean(hotel.departement) },
  { group: "Identité", label: "Région", filled: (hotel) => Boolean(hotel.region) && hotel.region !== "Non renseignée" },
  { group: "Identité", label: "Groupe / propriétaire", filled: (hotel) => Boolean(hotel.groupe) },
  { group: "Identité", label: "Enseigne", filled: (hotel) => Boolean(hotel.enseigne) },
  { group: "Identité", label: "Propriétaire", filled: (hotel) => Boolean(hotel.proprietaire) },
  { group: "Identité", label: "Exploitant", filled: (hotel) => Boolean(hotel.exploitant) },
  { group: "Identité", label: "Année d’ouverture", filled: (hotel) => hotel.anneeOuverture != null },
  { group: "Identité", label: "Année de rénovation", filled: (hotel) => hotel.anneeRenovation != null },
  { group: "Identité", label: "Site internet", filled: (hotel) => Boolean(hotel.siteUrl) },

  { group: "Capacité & surfaces", label: "Nombre de clés", filled: (hotel) => hotel.cles > 0 },
  { group: "Capacité & surfaces", label: "Suites", filled: (hotel) => hotel.suites != null },
  { group: "Capacité & surfaces", label: "Surface totale", filled: (hotel) => hotel.surfaceTotale != null },
  { group: "Capacité & surfaces", label: "Surface hébergement", filled: (hotel) => hotel.surfaceHebergement != null },
  { group: "Capacité & surfaces", label: "Surface F&B", filled: (hotel) => hotel.surfaceFnb != null },
  { group: "Capacité & surfaces", label: "Surface MICE", filled: (hotel) => (hotel.equipements.mice ? hotel.surfaceMice != null : true) },
  { group: "Capacité & surfaces", label: "Salles de séminaire", filled: (hotel) => (hotel.equipements.mice ? hotel.nbSallesSeminaire != null : true) },
  { group: "Capacité & surfaces", label: "Capacité MICE max.", filled: (hotel) => (hotel.equipements.mice ? hotel.capaciteMiceMax != null : true) },

  { group: "Équipements", label: "Surface du spa", filled: (hotel) => (hotel.equipements.spa ? hotel.equipements.spaSurface != null : true) },
  { group: "Équipements", label: "Cabines de soin", filled: (hotel) => (hotel.equipements.spa ? hotel.equipements.spaCabines != null : true) },
  { group: "Équipements", label: "Places de parking", filled: (hotel) => (hotel.equipements.parking ? hotel.equipements.parkingPlaces != null : true) },
  { group: "Équipements", label: "Couverts intérieurs", filled: (hotel) => (hotel.equipements.restaurantGastro || hotel.equipements.brasserie ? hotel.equipements.couvertsInterieur != null : true) },
  { group: "Équipements", label: "Couverts extérieurs", filled: (hotel) => (hotel.equipements.restaurantGastro || hotel.equipements.brasserie ? hotel.equipements.couvertsExterieur != null : true) },
  { group: "Équipements", label: "Ticket moyen F&B", filled: (hotel) => (hotel.equipements.restaurantGastro || hotel.equipements.brasserie ? hotel.equipements.ticketMoyen != null : true) },

  { group: "Indicateurs", label: "CA total", filled: (_hotel, kpi) => kpi?.caTotal != null },
  { group: "Indicateurs", label: "CA hébergement", filled: (_hotel, kpi) => kpi?.caHebergement != null },
  { group: "Indicateurs", label: "CA F&B", filled: (_hotel, kpi) => kpi?.caFnb != null },
  { group: "Indicateurs", label: "Taux d’occupation", filled: (_hotel, kpi) => kpi?.to != null },
  { group: "Indicateurs", label: "ADR", filled: (_hotel, kpi) => kpi?.adr != null },
  { group: "Indicateurs", label: "RevPAR", filled: (_hotel, kpi) => kpi?.revpar != null },
  { group: "Indicateurs", label: "Marge EBITDA", filled: (_hotel, kpi) => kpi?.ebitdaPct != null },
  { group: "Indicateurs", label: "Effectif ETP", filled: (_hotel, kpi) => kpi?.effectif != null },
  { group: "Indicateurs", label: "Note client", filled: (_hotel, kpi) => kpi?.note != null },
];

const GROUPS = ["Identité", "Capacité & surfaces", "Équipements", "Indicateurs"] as const;

const DISTRIBUTION_KEYS = [
  "caTotal",
  "caHebergement",
  "caFnb",
  "to",
  "adr",
  "revpar",
  "ebitdaPct",
  "note",
] as const;

type Dimension = "region" | "categorie";

interface QualityColumn {
  key: string;
  label: string;
  hotels: Hotel[];
}

function percent(rate: number): string {
  return `${Math.round(rate)} %`;
}

function yearsSince(dateSource: string): number | null {
  const date = new Date(dateSource);
  if (Number.isNaN(date.getTime())) return null;
  return (new Date(EXTRACTION_DATE).getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

export default function QualitePage() {
  const { state, updateTask } = useStore();
  const { toast } = useToast();
  const [annee, setAnnee] = useState(CURRENT_DATA_YEAR);
  const [dimension, setDimension] = useState<Dimension>("region");
  const [taskStatut, setTaskStatut] = useState("À faire");
  const [taskAssignee, setTaskAssignee] = useState("Tous");
  const [taskQuery, setTaskQuery] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskHotelId, setTaskHotelId] = useState<string | undefined>(undefined);

  const kpiByHotel = new Map(
    state.kpis.filter((kpi) => kpi.annee === annee).map((kpi) => [kpi.hotelId, kpi]),
  );

  const columns: QualityColumn[] =
    dimension === "region"
      ? Array.from(new Set(state.hotels.map((hotel) => hotel.region)))
          .sort((a, b) => a.localeCompare(b, "fr"))
          .map((region) => ({
            key: region,
            label: region,
            hotels: state.hotels.filter((hotel) => hotel.region === region),
          }))
      : CATEGORIES.map((categorie) => ({
          key: String(categorie),
          label: CATEGORY_LABEL[String(categorie)],
          hotels: state.hotels.filter((hotel) => hotel.categorie === categorie),
        })).filter((column) => column.hotels.length > 0);

  const cells = QUALITY_FIELDS.map((field) =>
    columns.map((column) => {
      const filled = column.hotels.filter((hotel) => field.filled(hotel, kpiByHotel.get(hotel.id))).length;
      return {
        filled,
        total: column.hotels.length,
        rate: column.hotels.length ? (filled / column.hotels.length) * 100 : 0,
      };
    }),
  );

  const filledCells = cells.reduce(
    (total, row) => total + row.reduce((sum, cell) => sum + cell.filled, 0),
    0,
  );
  const totalCells = QUALITY_FIELDS.length * state.hotels.length;
  const completion = totalCells ? (filledCells / totalCells) * 100 : 0;
  const hotelsWithKpi = state.hotels.filter((hotel) => {
    const kpi = kpiByHotel.get(hotel.id);
    return Boolean(kpi && (kpi.caTotal != null || kpi.revpar != null));
  }).length;

  const distribution = DISTRIBUTION_KEYS.map((key) => {
    const counts: Record<Fiabilite, number> = { N1: 0, N2: 0, N3: 0 };
    let total = 0;
    for (const kpi of state.kpis) {
      if (kpi.annee !== annee) continue;
      if ((kpi[key] as number | null) == null) continue;
      counts[kpi.source.fiabilite] += 1;
      total += 1;
    }
    return { key, counts, total };
  });
  const distributionTotal = distribution.reduce((sum, row) => sum + row.total, 0);
  const n1Total = distribution.reduce((sum, row) => sum + row.counts.N1, 0);

  const stale = state.hotels
    .map((hotel) => {
      const latest = state.kpis
        .filter((kpi) => kpi.hotelId === hotel.id)
        .sort((a, b) => b.annee - a.annee)[0];
      const sourceAge = latest ? yearsSince(latest.source.dateSource) : null;
      const staleByExercise = !latest || latest.annee < EXTRACTION_YEAR - 2;
      const staleBySource = sourceAge != null && sourceAge > 2;
      return { hotel, latest, sourceAge, stale: staleByExercise || staleBySource, staleBySource };
    })
    .filter((item) => item.stale)
    .sort((a, b) => (a.latest?.annee ?? 0) - (b.latest?.annee ?? 0));

  const openTasks = state.tasks.filter((task) => task.statut !== "Fait");
  const overdueTasks = openTasks.filter((task) => task.echeance < TODAY);

  const assignedName = (id: string | null) =>
    id ? state.users.find((user) => user.id === id)?.nom ?? "Inconnu" : "Non assignée";

  const filteredTasks = state.tasks
    .filter((task) => {
      if (taskStatut !== "Tous" && task.statut !== taskStatut) return false;
      if (taskAssignee !== "Tous" && (task.assigneeId ?? "") !== taskAssignee) return false;
      if (taskQuery.trim()) {
        const haystack = `${task.hotelNom} ${task.champ} ${task.region}`.toLowerCase();
        if (!haystack.includes(taskQuery.trim().toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const order: Record<Task["statut"], number> = { "À faire": 0, "En cours": 1, Fait: 2 };
      if (order[a.statut] !== order[b.statut]) return order[a.statut] - order[b.statut];
      return a.echeance.localeCompare(b.echeance);
    });

  function handleExport() {
    const workbook = XLSX.utils.book_new();

    const heatmapRows = QUALITY_FIELDS.map((field, index) => ({
      Groupe: field.group,
      Champ: field.label,
      ...Object.fromEntries(
        columns.map((column, columnIndex) => [
          column.label,
          percent(cells[index][columnIndex].rate),
        ]),
      ),
      Ensemble: percent(
        (cells[index].reduce((sum, cell) => sum + cell.filled, 0) /
          Math.max(1, state.hotels.length)) *
          100,
      ),
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(heatmapRows), "Remplissage");

    const reliabilityRows = distribution.map((row) => ({
      Indicateur: KPI_LABELS[row.key].label,
      "Valeurs renseignées": row.total,
      N1: row.counts.N1,
      N2: row.counts.N2,
      N3: row.counts.N3,
      "Part N1": row.total ? row.counts.N1 / row.total : null,
      "Part N3": row.total ? row.counts.N3 / row.total : null,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reliabilityRows), "Fiabilité");

    const staleRows = stale.map((item) => ({
      Hôtel: item.hotel.nom,
      Ville: item.hotel.ville,
      Région: item.hotel.region,
      Catégorie: CATEGORY_LABEL[String(item.hotel.categorie)],
      "Dernier exercice": item.latest?.annee ?? null,
      "Date de source": item.latest ? fmtDate(item.latest.source.dateSource) : null,
      Fiabilité: item.latest?.source.fiabilite ?? null,
      "Ancienneté (ans)": item.latest ? EXTRACTION_YEAR - item.latest.annee : null,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(staleRows), "Ancienneté");

    const taskRows = state.tasks.map((task) => ({
      Hôtel: task.hotelNom,
      Région: task.region,
      Champ: task.champ,
      Priorité: task.priorite,
      Statut: task.statut,
      Assignée: assignedName(task.assigneeId),
      Échéance: fmtDate(task.echeance),
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(taskRows), "Tâches");

    const methodRows = [
      ["Observatoire hôtelier NOVA — rapport qualité"],
      ["Exercice KPI", String(annee)],
      ["Dimension du remplissage", dimension === "region" ? "Régions" : "Catégories"],
      ["Date d'extraction", fmtDate(EXTRACTION_DATE)],
      ["Auteur", state.users.find((user) => user.id === state.currentUserId)?.nom ?? ""],
      ["Complétude", percent(completion)],
      [],
      ["Lecture des champs conditionnels"],
      ["Les surfaces de spa, places de parking et couverts ne sont exigés que si l'équipement existe."],
      ["Les indicateurs sont appréciés sur l'exercice sélectionné, pas sur la dernière valeur connue."],
      [],
      ["Environnement de démonstration"],
      ["Les hôtels sont fictifs et signalés comme données DÉMO. Aucune valeur n'est extrapolée."],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(methodRows), "Méthodologie");

    XLSX.writeFile(workbook, `Nova_Qualite_${dimension}_${annee}.xlsx`);
    toast({ title: "Rapport qualité exporté", tone: "success" });
  }

  function openTask(hotel: Hotel) {
    setTaskHotelId(hotel.id);
    setTaskOpen(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Données"
        title="Qualité des données"
        description="Complétude par champ, traçabilité des indicateurs et file de complétion. Les taux portent uniquement sur les fiches présentes dans l’observatoire."
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="size-3.5" />
            Exporter le rapport
          </Button>
        }
      />

      <Card className="flex flex-wrap items-end gap-4">
        <label className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted">
          Exercice
          <Select
            value={String(annee)}
            onChange={(value) => setAnnee(Number(value))}
            options={[...YEARS].reverse().map((year) => ({ value: String(year), label: String(year) }))}
            className="mt-1 w-[110px]"
          />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted">
          Lecture du remplissage
          <div className="mt-1 flex rounded-[3px] border border-line bg-paper/70 p-0.5">
            {(["region", "categorie"] as Dimension[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDimension(item)}
                className={cn(
                  "rounded-[2px] px-3 py-1.5 text-[11px] transition-colors",
                  dimension === item ? "bg-navy text-white" : "text-muted hover:text-ink",
                )}
              >
                {item === "region" ? "Par région" : "Par catégorie"}
              </button>
            ))}
          </div>
        </label>
        <p className="ml-auto text-[10.5px] text-muted">
          Extraction du {fmtDate(EXTRACTION_DATE)} · {fmtInt(state.hotels.length)} hôtels
        </p>
      </Card>

      <Card className="grid grid-cols-2 divide-line xl:grid-cols-4" padded={false}>
        <StatTile
          label="Complétude moyenne"
          value={percent(completion)}
          sub={`${fmtInt(filledCells)} valeurs sur ${fmtInt(totalCells)}`}
        />
        <StatTile
          label={`Fiches avec KPI ${annee}`}
          value={`${hotelsWithKpi} / ${state.hotels.length}`}
          sub={`${percent(state.hotels.length ? (hotelsWithKpi / state.hotels.length) * 100 : 0)} du périmètre`}
        />
        <StatTile
          label="Données anciennes"
          value={fmtInt(stale.length)}
          sub="Exercice ou source de plus de 2 ans"
          accent={stale.length > 0}
        />
        <StatTile
          label="Tâches ouvertes"
          value={fmtInt(openTasks.length)}
          sub={`${overdueTasks.length} en retard`}
          accent={overdueTasks.length > 0}
        />
      </Card>

      <Card padded={false}>
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-4 py-3">
            <SectionTitle
              hint={`${QUALITY_FIELDS.length} champs · ${dimension === "region" ? "régions" : "catégories"}`}
            >
              Taux de remplissage
            </SectionTitle>
            <p className="text-[10px] text-muted">Survolez une cellule pour le détail des valeurs.</p>
          </div>
          <TableShell className="max-h-[620px] [&>table]:min-w-[860px]">
            <thead>
              <tr>
                <Th className="sticky left-0 z-20 min-w-[190px] bg-[#f7f5ef]">Champ</Th>
                {columns.map((column) => (
                  <Th key={column.key} align="center" className="min-w-[82px]">
                    <span className="block">{column.label}</span>
                    <span className="mt-0.5 block text-[8.5px] font-normal normal-case tracking-normal text-faint">
                      {column.hotels.length} hôtels
                    </span>
                  </Th>
                ))}
                <Th align="center" className="min-w-[76px] bg-[#f7f5ef]">
                  Ensemble
                </Th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) => {
                const groupIndexes = QUALITY_FIELDS.map((field, index) => ({ field, index })).filter(
                  (item) => item.field.group === group,
                );
                return (
                  <Fragment key={group}>
                    <tr>
                      <td
                        colSpan={columns.length + 2}
                        className="border-b border-line bg-[#faf8f3] px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted"
                      >
                        {group}
                      </td>
                    </tr>
                    {groupIndexes.map(({ field, index }) => {
                      const totalFilled = cells[index].reduce((sum, cell) => sum + cell.filled, 0);
                      const totalRate = state.hotels.length
                        ? (totalFilled / state.hotels.length) * 100
                        : 0;
                      return (
                        <tr key={field.label} className="group">
                          <Td className="sticky left-0 z-10 bg-surface group-hover:bg-[#faf8f3]">
                            {field.label}
                          </Td>
                          {columns.map((column, columnIndex) => {
                            const cell = cells[index][columnIndex];
                            const alpha = 0.05 + (cell.rate / 100) * 0.62;
                            return (
                              <Td
                                key={column.key}
                                align="center"
                                title={`${cell.filled} / ${cell.total} fiches renseignées`}
                                style={{
                                  backgroundColor: `rgba(23, 73, 101, ${alpha.toFixed(3)})`,
                                  color: cell.rate >= 55 ? "#ffffff" : "#172029",
                                }}
                                className="border-x border-white/40 font-medium"
                              >
                                {cell.total ? percent(cell.rate) : "—"}
                              </Td>
                            );
                          })}
                          <Td align="center" className="bg-[#faf8f3] font-semibold text-ink">
                            {percent(totalRate)}
                          </Td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </TableShell>
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-[9.5px] text-muted">
            <span>Faible couverture</span>
            <div className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-[#eef1f2] via-[#9eb3c0] to-[#174965]" />
            <span>Couverture complète</span>
          </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <SectionTitle hint={`${fmtInt(distributionTotal)} valeurs · exercice ${annee}`}>
            Fiabilité des indicateurs
          </SectionTitle>
          <p className="text-[10px] text-muted">
            Chaque barre représente la répartition N1 / N2 / N3 des valeurs renseignées.
          </p>
        </div>
        <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {distribution.map((row) => {
              const label = KPI_LABELS[row.key].label;
              const share = row.total ? (row.counts.N1 / row.total) * 100 : 0;
              return (
                <div key={row.key}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-ink-soft">{label}</span>
                    <span className="text-[10px] tabular text-muted">
                      {fmtInt(row.total)} val. · N1 {Math.round(share)} %
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-[#eeebe4]">
                    {(["N1", "N2", "N3"] as Fiabilite[]).map((fiabilite) => {
                      const width = row.total ? (row.counts[fiabilite] / row.total) * 100 : 0;
                      if (!width) return null;
                      return (
                        <div
                          key={fiabilite}
                          title={`${fiabilite} : ${row.counts[fiabilite]} valeurs`}
                          style={{
                            width: `${width}%`,
                            backgroundColor: RELIABILITY_META[fiabilite].color,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2.5">
            {(["N1", "N2", "N3"] as Fiabilite[]).map((fiabilite) => (
              <span key={fiabilite} className="inline-flex items-center gap-1.5 text-[10px] text-muted">
                <span
                  className="size-2 rounded-[1px]"
                  style={{ backgroundColor: RELIABILITY_META[fiabilite].color }}
                />
                {RELIABILITY_META[fiabilite].label} — {RELIABILITY_META[fiabilite].description}
              </span>
            ))}
          </div>
          <div className="rounded-[3px] border border-line bg-paper/60 px-3 py-2 text-[10.5px] leading-relaxed text-muted">
            La part N1 globale sur les indicateurs s’élève à{" "}
            <strong className="font-semibold text-ink">
              {percent(distributionTotal ? (n1Total / distributionTotal) * 100 : 0)}
            </strong>
            . Les valeurs estimées restent identifiées en N3 dans toutes les vues et tous les exports.
        </div>
      </Card>

      <Card padded={false}>
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-4 py-3">
          <SectionTitle hint="Exercice antérieur à 2024 ou source datée de plus de deux ans">
            Données à rafraîchir
          </SectionTitle>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted">
            <AlertTriangle className="size-3.5 text-amber" />
            {stale.length} fiche{stale.length > 1 ? "s" : ""} concernée{stale.length > 1 ? "s" : ""}
          </span>
        </div>
        {stale.length === 0 ? (
          <EmptyState
            title="Aucune donnée ancienne"
            description="Toutes les fiches disposent d’un exercice récent et d’une source de moins de deux ans."
          />
        ) : (
          <TableShell className="max-h-[420px]">
            <thead>
              <tr>
                <Th>Hôtel</Th>
                <Th>Zone</Th>
                <Th align="center">Catégorie</Th>
                <Th align="right">Dernier exercice</Th>
                <Th>Source</Th>
                <Th align="center">Fiabilité</Th>
                <Th>Motif</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {stale.map(({ hotel, latest, sourceAge, staleBySource }) => (
                <tr key={hotel.id} className="hover:bg-[#faf8f3]">
                  <Td>
                    <Link href={`/hotels/${hotel.id}`} className="font-medium text-ink hover:text-accent">
                      {hotel.nom}
                    </Link>
                  </Td>
                  <Td>
                    {hotel.ville}
                    <span className="block text-[10px] text-muted">{hotel.region}</span>
                  </Td>
                  <Td align="center">
                    <CategoryBadge categorie={hotel.categorie} />
                  </Td>
                  <Td align="right">{latest ? latest.annee : "Aucun"}</Td>
                  <Td className="max-w-[180px]">
                    {latest ? (
                      <>
                        <span className="block truncate">{latest.source.source}</span>
                        <span className="block text-[10px] text-muted">{fmtDate(latest.source.dateSource)}</span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td align="center">{latest ? <ReliabilityBadge source={latest.source} /> : <Badge tone="grey">—</Badge>}</Td>
                  <Td>
                    <span className="text-[10.5px] text-muted">
                      {!latest
                        ? "Aucun indicateur"
                        : staleBySource && sourceAge != null
                          ? `Source de ${Math.floor(sourceAge)} ans`
                          : `Exercice ${latest.annee}`}
                    </span>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openTask(hotel)}>
                        <ClipboardCheck className="size-3" />
                        Tâche
                      </Button>
                      <Link
                        href={`/hotels/${hotel.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "iconSm" }))}
                        aria-label={`Ouvrir ${hotel.nom}`}
                      >
                        <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Card padded={false}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
          <SectionTitle hint={`${filteredTasks.length} tâche${filteredTasks.length > 1 ? "s" : ""} affichée${filteredTasks.length > 1 ? "s" : ""}`}>
            File de complétion
          </SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={taskQuery}
              onChange={setTaskQuery}
              placeholder="Hôtel, champ, région…"
              className="w-[190px]"
            />
            <Select
              value={taskStatut}
              onChange={setTaskStatut}
              options={["Tous", "À faire", "En cours", "Fait"].map((item) => ({ value: item, label: item }))}
              className="w-[112px]"
            />
            <Select
              value={taskAssignee}
              onChange={setTaskAssignee}
              options={[
                { value: "Tous", label: "Tous" },
                ...state.users
                  .filter((user) => user.actif)
                  .map((user) => ({ value: user.id, label: user.nom })),
              ]}
              className="w-[150px]"
            />
            <Button variant="accent" size="sm" onClick={() => { setTaskHotelId(undefined); setTaskOpen(true); }}>
              <Plus className="size-3.5" />
              Nouvelle tâche
            </Button>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <EmptyState
            title="Aucune tâche dans ce filtre"
            description="Ajustez le statut, l’assignation ou créez une nouvelle tâche de complétion."
          />
        ) : (
          <TableShell className="max-h-[440px]">
            <thead>
              <tr>
                <Th>Hôtel</Th>
                <Th>Champ à compléter</Th>
                <Th align="center">Priorité</Th>
                <Th>Assignée à</Th>
                <Th align="center">Statut</Th>
                <Th align="right">Échéance</Th>
                <Th align="right" />
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const overdue = task.echeance < TODAY && task.statut !== "Fait";
                return (
                  <tr key={task.id} className="hover:bg-[#faf8f3]">
                    <Td>
                      <Link href={`/hotels/${task.hotelId}`} className="font-medium text-ink hover:text-accent">
                        {task.hotelNom}
                      </Link>
                      <span className="block text-[10px] text-muted">{task.region}</span>
                    </Td>
                    <Td className="max-w-[240px]">{task.champ}</Td>
                    <Td align="center">
                      <Badge tone={task.priorite === "Haute" ? "danger" : task.priorite === "Moyenne" ? "amber" : "neutral"}>
                        {task.priorite}
                      </Badge>
                    </Td>
                    <Td>
                      <Select
                        value={task.assigneeId ?? ""}
                        onChange={(value) => updateTask(task.id, { assigneeId: value || null })}
                        options={[
                          { value: "", label: "Non assignée" },
                          ...state.users.map((user) => ({
                            value: user.id,
                            label: user.actif ? user.nom : `${user.nom} (inactif)`,
                          })),
                        ]}
                        className="w-[150px] [&_select]:h-6 [&_select]:py-0 [&_select]:text-[10.5px]"
                      />
                    </Td>
                    <Td align="center">
                      <Select
                        value={task.statut}
                        onChange={(value) => updateTask(task.id, { statut: value as Task["statut"] })}
                        options={["À faire", "En cours", "Fait"].map((item) => ({ value: item, label: item }))}
                        className="w-[104px] [&_select]:h-6 [&_select]:py-0 [&_select]:text-[10.5px]"
                      />
                    </Td>
                    <Td align="right" className={cn(overdue && "font-medium text-danger")}>
                      {fmtDate(task.echeance)}
                      {overdue && <span className="block text-[9px] uppercase tracking-wide">En retard</span>}
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/hotels/${task.hotelId}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "iconSm" }))}
                        aria-label={`Ouvrir ${task.hotelNom}`}
                      >
                        <ArrowUpRight className="size-3" />
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-[10px] text-muted">
          <span>
            {fmtInt(openTasks.length)} tâche{openTasks.length > 1 ? "s" : ""} ouverte{openTasks.length > 1 ? "s" : ""} ·{" "}
            {fmtInt(overdueTasks.length)} en retard
          </span>
          <span className="inline-flex items-center gap-1">
            <Search className="size-3" />
            Chaque changement de statut est journalisé.
          </span>
        </div>
      </Card>

      {taskOpen && (
        <TaskDialog
          open={taskOpen}
          onOpenChange={(next) => setTaskOpen(next)}
          initialHotelId={taskHotelId}
        />
      )}
    </div>
  );
}
