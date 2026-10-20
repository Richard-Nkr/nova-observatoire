"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  Download,
  Hammer,
  Info,
  Lock,
  MapPin,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useStore } from "@/lib/store";
import {
  ALL_ZONES,
  caDealsByRegion,
  caDealsByYear,
  enrichTransactions,
  hotelsInZone,
  pipelineInZone,
  supplyByCategory,
  transactionsInZone,
  zoneKpis,
} from "@/lib/market";
import { exportMarketXlsx } from "@/lib/market-export";
import {
  CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  CURRENT_DATA_YEAR,
  EXTRACTION_DATE,
  MARKET_ZONES,
  YEARS,
} from "@/lib/constants";
import { fmtDate, fmtEuro, fmtInt } from "@/lib/format";
import { kpiFor, sum } from "@/lib/stats";
import type { Categorie } from "@/lib/types";
import type { EnrichedTransaction } from "@/lib/market";
import { ChartFrame, ChartTip, CHART_COLORS } from "@/components/charts";
import { CategoryBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput, Select } from "@/components/ui/field";
import { Card, EmptyState, PageHeader, SectionTitle, StatTile, Tabs } from "@/components/ui/misc";
import { TableShell, Td, Th } from "@/components/ui/table";
import { ReliabilityBadge } from "@/components/reliability";

type MarketTab = "vue" | "pipeline" | "transactions";
type TxSortKey = "date" | "nom" | "ville" | "categorie" | "caAvant" | "caApres";
type TxPeriod = "all" | "2024-2026" | "2021-2023" | "avant-2021";

const PERIODS: { value: TxPeriod; label: string }[] = [
  { value: "all", label: "Toutes périodes" },
  { value: "2024-2026", label: "2024 – 2026" },
  { value: "2021-2023", label: "2021 – 2023" },
  { value: "avant-2021", label: "Avant 2021" },
];

const TX_SORT_LABELS: Record<TxSortKey, string> = {
  date: "Date",
  nom: "Hôtel",
  ville: "Ville",
  categorie: "Catégorie",
  caAvant: "CA avant",
  caApres: "CA après",
};

function inPeriod(date: string, period: TxPeriod): boolean {
  if (period === "all") return true;
  const year = Number(date.slice(0, 4));
  if (!Number.isFinite(year)) return false;
  if (period === "2024-2026") return year >= 2024;
  if (period === "2021-2023") return year >= 2021 && year <= 2023;
  return year < 2021;
}

function documentedCa(transactions: EnrichedTransaction[]) {
  return transactions.filter(
    ({ transaction }) => transaction.caAvant != null || transaction.caApres != null,
  ).length;
}

export default function MarchePage() {
  const { state, currentUser } = useStore();
  const [zone, setZone] = React.useState<string>(ALL_ZONES);
  const [annee, setAnnee] = React.useState(CURRENT_DATA_YEAR);
  const [tab, setTab] = React.useState<MarketTab>("vue");
  const [txSearch, setTxSearch] = React.useState("");
  const [txCategory, setTxCategory] = React.useState<"Toutes" | Categorie>("Toutes");
  const [txPeriod, setTxPeriod] = React.useState<TxPeriod>("all");
  const [sortKey, setSortKey] = React.useState<TxSortKey>("date");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");

  const zoneHotels = React.useMemo(() => hotelsInZone(state.hotels, zone), [state.hotels, zone]);
  const zonePipeline = React.useMemo(
    () => pipelineInZone(state.pipeline, zone),
    [state.pipeline, zone],
  );

  const overview = React.useMemo(
    () => zoneKpis(zoneHotels, state.kpis, annee),
    [zoneHotels, state.kpis, annee],
  );
  const supply = React.useMemo(() => supplyByCategory(zoneHotels), [zoneHotels]);

  const allTransactions = React.useMemo(
    () => transactionsInZone(enrichTransactions(state.transactions, state.hotels), zone),
    [state.transactions, state.hotels, zone],
  );
  const canSeeConfidential = currentUser.accesConfidentiel || currentUser.role === "Admin";
  const transactions = React.useMemo(
    () => allTransactions.filter(({ transaction }) => canSeeConfidential || !transaction.confidentielClient),
    [allTransactions, canSeeConfidential],
  );
  const hiddenConfidential = allTransactions.length - transactions.length;

  const caAvantTotal = React.useMemo(
    () =>
      sum(
        transactions
          .map(({ transaction }) => transaction.caAvant)
          .filter((value): value is number => value != null),
      ),
    [transactions],
  );
  const caApresTotal = React.useMemo(
    () =>
      sum(
        transactions
          .map(({ transaction }) => transaction.caApres)
          .filter((value): value is number => value != null),
      ),
    [transactions],
  );
  const documentedCount = React.useMemo(() => documentedCa(transactions), [transactions]);

  const coverage = React.useMemo(
    () =>
      YEARS.map((year) => {
        const rows = zoneHotels.map((hotel) => kpiFor(hotel.id, state.kpis, year));
        const withCa = rows.filter((row) => row?.caTotal != null);
        return {
          annee: String(year),
          fiches: withCa.length,
          ca: sum(withCa.map((row) => row?.caTotal ?? 0)),
        };
      }),
    [zoneHotels, state.kpis],
  );

  const categoryCa = React.useMemo(
    () =>
      CATEGORIES.filter((categorie) => supply.some((row) => row.categorie === categorie)).map(
        (categorie) => {
          const hotels = zoneHotels.filter((hotel) => hotel.categorie === categorie);
          const rows = hotels
            .map((hotel) => kpiFor(hotel.id, state.kpis, annee))
            .filter((row) => row?.caTotal != null);
          const ca = sum(rows.map((row) => row?.caTotal ?? 0));
          const cles = sum(hotels.map((hotel) => hotel.cles));
          return {
            categorie,
            hotels: hotels.length,
            cles,
            fiches: rows.length,
            ca,
            caParCle: cles > 0 ? ca / cles : null,
          };
        },
      ),
    [zoneHotels, state.kpis, annee, supply],
  );

  const filteredTransactions = React.useMemo(() => {
    const term = txSearch.trim().toLowerCase();
    return transactions.filter(({ transaction, hotel }) => {
      if (txCategory !== "Toutes" && hotel?.categorie !== txCategory) return false;
      if (!inPeriod(transaction.date, txPeriod)) return false;
      if (!term) return true;
      return [
        hotel?.nom,
        hotel?.ville,
        transaction.analyste,
        transaction.localisation,
        transaction.analyste,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [transactions, txCategory, txPeriod, txSearch]);

  const sortedTransactions = React.useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filteredTransactions].sort((a, b) => {
      const hotelA = a.hotel;
      const hotelB = b.hotel;
      let left: number | string | null = null;
      let right: number | string | null = null;
      switch (sortKey) {
        case "nom":
          left = hotelA?.nom ?? "";
          right = hotelB?.nom ?? "";
          break;
        case "ville":
          left = hotelA?.ville ?? "";
          right = hotelB?.ville ?? "";
          break;
        case "categorie":
          left = hotelA ? CATEGORY_LABEL[String(hotelA.categorie)] ?? String(hotelA.categorie) : "";
          right = hotelB ? CATEGORY_LABEL[String(hotelB.categorie)] ?? String(hotelB.categorie) : "";
          break;
        case "caAvant":
          left = a.transaction.caAvant;
          right = b.transaction.caAvant;
          break;
        case "caApres":
          left = a.transaction.caApres;
          right = b.transaction.caApres;
          break;
        default:
          left = a.transaction.date;
          right = b.transaction.date;
      }
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
      return String(left).localeCompare(String(right), "fr") * direction;
    });
  }, [filteredTransactions, sortKey, sortDirection]);

  const caByYear = React.useMemo(() => caDealsByYear(transactions), [transactions]);
  const caByRegion = React.useMemo(() => caDealsByRegion(transactions).slice(0, 9), [transactions]);

  const filterLines = React.useMemo(
    () => [
      `Zone : ${zone}`,
      `Exercice : ${annee}`,
      `Transactions : ${filteredTransactions.length}`,
      `Recherche : ${txSearch || "aucune"}`,
      `Catégorie : ${txCategory === "Toutes" ? "toutes" : CATEGORY_LABEL[String(txCategory)]}`,
      `Période : ${PERIODS.find((period) => period.value === txPeriod)?.label ?? "toutes"}`,
      "Base : BDD transactions hôtelières - vcompilée.xlsx",
    ],
    [zone, annee, filteredTransactions.length, txSearch, txCategory, txPeriod],
  );

  function setSorting(key: TxSortKey) {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "date" || key === "nom" || key === "ville" ? "asc" : "desc");
    }
  }

  function downloadExport() {
    exportMarketXlsx({
      zone,
      annee,
      hotels: state.hotels,
      kpis: state.kpis,
      transactions: filteredTransactions.map(({ transaction }) => transaction),
      pipeline: state.pipeline,
      includeConfidential: canSeeConfidential,
      auteur: currentUser.nom,
      filters: filterLines,
      hiddenConfidential,
    });
  }

  const coverageHasData = coverage.some((point) => point.fiches > 0);
  const dealsHaveCa = caByYear.some((point) => point.caAvant != null || point.caApres != null);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Analyser"
        title="Marché & transactions"
        description="Lecture de l’offre, des chiffres d’affaires documentés et des opérations compilées dans la base de mission. Les indicateurs absents du classeur source sont signalés, jamais extrapolés."
        actions={
          <Button variant="outline" onClick={downloadExport}>
            <Download className="size-3.5" /> Exporter Excel
          </Button>
        }
      />

      <Card className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            Zone d’analyse
          </span>
          <Select
            value={zone}
            onChange={setZone}
            options={MARKET_ZONES.map((item) => ({ value: item, label: item }))}
            className="min-w-[230px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            Exercice
          </span>
          <Select
            value={String(annee)}
            onChange={(value) => setAnnee(Number(value))}
            options={[...YEARS].reverse().map((year) => ({ value: String(year), label: String(year) }))}
            className="w-24"
          />
        </label>
        <div className="ml-auto flex items-center gap-2 text-[10px] text-muted">
          <span className="size-1.5 rounded-full bg-green" />
          {fmtInt(zoneHotels.length)} hôtels · {fmtInt(sum(zoneHotels.map((hotel) => hotel.cles)))} clés
          <span className="text-faint">Extraction du {fmtDate(EXTRACTION_DATE)}</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Hôtels" value={fmtInt(overview.count)} sub={zone} />
        <StatTile label="Clés" value={fmtInt(overview.cles)} sub="capacité documentée" />
        <StatTile
          label={`CA ${annee}`}
          value={fmtEuro(overview.caTotal, true)}
          sub="cumul des CA renseignés"
        />
        <StatTile
          label="Transactions"
          value={fmtInt(transactions.length)}
          sub={`${documentedCount} avec CA documenté`}
        />
        <StatTile
          label="CA avant cession"
          value={fmtEuro(caAvantTotal, true)}
          sub="cumul documenté"
        />
        <StatTile
          label="CA après cession"
          value={fmtEuro(caApresTotal, true)}
          sub="cumul documenté"
        />
      </div>

      <Tabs
        tabs={[
          { value: "vue", label: "Vue du marché" },
          { value: "pipeline", label: "Pipeline", count: zonePipeline.length },
          { value: "transactions", label: "Transactions", count: filteredTransactions.length },
        ]}
        value={tab}
        onChange={(value) => setTab(value as MarketTab)}
      />

      {tab === "vue" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card padded={false}>
            <div className="flex items-start justify-between gap-3 p-4 pb-2">
              <SectionTitle hint={`${fmtInt(supply.length)} catégories présentes · ${fmtInt(overview.cles)} clés`}>
                Offre par catégorie
              </SectionTitle>
            </div>
            <div className="px-4 pb-4">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Catégorie</Th>
                    <Th align="right">Hôtels</Th>
                    <Th align="right">Clés</Th>
                    <Th align="right">Part des clés</Th>
                  </tr>
                </thead>
                <tbody>
                  {supply.map((row) => (
                    <tr key={String(row.categorie)}>
                      <Td>
                        <CategoryBadge categorie={row.categorie} />
                      </Td>
                      <Td align="right">{fmtInt(row.hotels)}</Td>
                      <Td align="right">{fmtInt(row.cles)}</Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round(row.keyShare * 100)}%`,
                                backgroundColor: CATEGORY_COLOR[String(row.categorie)] ?? CHART_COLORS.navy,
                              }}
                            />
                          </div>
                          <span className="tabular w-10 text-right">{Math.round(row.keyShare * 100)} %</span>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
              <p className="mt-3 text-[10px] leading-relaxed text-faint">
                Le poids est calculé à partir des clés renseignées. Les catégories absentes du périmètre ne sont pas
                affichées.
              </p>
            </div>
          </Card>

          <Card padded={false}>
            <div className="p-4 pb-2">
              <SectionTitle hint="Fiches dont le CA est documenté, par exercice">
                Couverture des CA
              </SectionTitle>
            </div>
            <div className="px-4 pb-4">
              <ChartFrame height={250} empty={!coverageHasData}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={coverage} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke={CHART_COLORS.line} strokeDasharray="2 3" vertical={false} />
                    <XAxis dataKey="annee" tick={{ fontSize: 10, fill: CHART_COLORS.grey }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10, fill: CHART_COLORS.grey }}
                      allowDecimals={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10, fill: CHART_COLORS.grey }}
                      tickFormatter={(value: number) => fmtEuro(value, true)}
                    />
                    <Tooltip
                      content={
                        <ChartTip
                          formatter={(value, name) =>
                            name === "CA documenté" ? fmtEuro(value) : fmtInt(value)
                          }
                        />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar
                      yAxisId="left"
                      dataKey="fiches"
                      name="Fiches avec CA"
                      fill={CHART_COLORS.navySoft}
                      radius={[1, 1, 0, 0]}
                      maxBarSize={28}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="ca"
                      name="CA documenté"
                      stroke={CHART_COLORS.copper}
                      strokeWidth={1.6}
                      dot={{ r: 2.5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartFrame>
              <p className="mt-3 text-[10px] leading-relaxed text-faint">
                Les CA proviennent des colonnes « CA before / after » du classeur. Les exercices non renseignés ne sont
                pas extrapolés.
              </p>
            </div>
          </Card>

          <Card padded={false}>
            <div className="p-4 pb-2">
              <SectionTitle hint={`Exercice ${annee} · CA documenté uniquement`}>
                CA documenté par catégorie
              </SectionTitle>
            </div>
            <div className="px-4 pb-4">
              <TableShell>
                <thead>
                  <tr>
                    <Th>Catégorie</Th>
                    <Th align="right">Hôtels</Th>
                    <Th align="right">Clés</Th>
                    <Th align="right">Fiches CA</Th>
                    <Th align="right">CA cumulé</Th>
                    <Th align="right">CA / clé</Th>
                  </tr>
                </thead>
                <tbody>
                  {categoryCa.map((row) => (
                    <tr key={String(row.categorie)}>
                      <Td>
                        <CategoryBadge categorie={row.categorie} />
                      </Td>
                      <Td align="right">{fmtInt(row.hotels)}</Td>
                      <Td align="right">{fmtInt(row.cles)}</Td>
                      <Td align="right">{row.fiches}</Td>
                      <Td align="right">{fmtEuro(row.ca, true)}</Td>
                      <Td align="right">{fmtEuro(row.caParCle)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
          </Card>

          <Card>
            <SectionTitle hint="Ce que la base fournie permet — et ne permet pas — de mesurer">
              Périmètre documentaire
            </SectionTitle>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[2px] border border-green/25 bg-green-soft p-3">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-green">
                  Documenté
                </p>
                <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-ink-soft">
                  <li>Localisation, ville, région, gamme et nombre de clés</li>
                  <li>Équipements : restaurant, bar, spa, piscine, MICE</li>
                  <li>CA avant et après cession, exercices associés</li>
                  <li>Surfaces, chambres, suites et couverts partiels</li>
                </ul>
              </div>
              <div className="rounded-[2px] border border-amber/25 bg-amber-soft p-3">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-amber">
                  Non documenté
                </p>
                <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-ink-soft">
                  <li>ADR, TO, RevPAR, EBITDA et prix par nuit</li>
                  <li>Prix de transaction, prix par clé, acheteur et vendeur</li>
                  <li>Surfaces et salles MICE annuelles</li>
                  <li>Valorisations NOVA et pipeline d’ouverture</li>
                </ul>
              </div>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-faint">
              Ces limites sont structurelles : le classeur source ne contient pas ces colonnes. NOVA les affichera
              lorsqu’une mission ou un connecteur les documentera.
            </p>
          </Card>
        </div>
      ) : null}

      {tab === "pipeline" ? (
        <Card>
          {zonePipeline.length === 0 ? (
            <EmptyState
              icon={<Hammer className="size-6" />}
              title="Aucun pipeline documenté"
              description="Le classeur source ne contient pas de projets d’ouverture ou de rénovation datés. Aucun pipeline n’est donc affiché, plutôt que de produire une liste artificielle."
            />
          ) : (
            <div className="space-y-3">
              <SectionTitle hint={`${zonePipeline.length} projet(s) dans la zone`}>
                Pipeline documenté
              </SectionTitle>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Projet</Th>
                    <Th>Ville</Th>
                    <Th>Ouverture</Th>
                    <Th>Statut</Th>
                  </tr>
                </thead>
                <tbody>
                  {zonePipeline.map((project) => (
                    <tr key={project.id}>
                      <Td>{project.nom}</Td>
                      <Td>{project.ville}</Td>
                      <Td>{project.ouverture}</Td>
                      <Td>{project.statut}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
          )}
        </Card>
      ) : null}

      {tab === "transactions" ? (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[230px] flex-1">
                <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Recherche
                </span>
                <SearchInput
                  value={txSearch}
                  onChange={setTxSearch}
                  placeholder="Hôtel, ville, analyste, localisation…"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Catégorie
                </span>
                <Select
                  value={String(txCategory)}
                  onChange={(value) =>
                    setTxCategory(
                      value === "Toutes" ? "Toutes" : (value as Categorie),
                    )
                  }
                  options={[
                    { value: "Toutes", label: "Toutes" },
                    ...CATEGORIES.map((categorie) => ({
                      value: String(categorie),
                      label: CATEGORY_LABEL[String(categorie)],
                    })),
                  ]}
                  className="min-w-[150px]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Période
                </span>
                <Select
                  value={txPeriod}
                  onChange={(value) => setTxPeriod(value as TxPeriod)}
                  options={PERIODS}
                  className="min-w-[150px]"
                />
              </label>
              <div className="ml-auto text-[11px] text-muted">
                {fmtInt(filteredTransactions.length)} transaction(s) · {fmtInt(documentedCount)} avec CA
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[10px] text-muted">
              <Lock className="size-3" />
              {hiddenConfidential > 0
                ? `${hiddenConfidential} transaction(s) confidentielle(s) masquée(s).`
                : "Aucune transaction confidentielle dans la base fournie."}
              <span className="ml-auto inline-flex items-center gap-1 text-faint">
                <Info className="size-3" /> Prix, acquéreur et cédant non documentés dans le classeur.
              </span>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
            <Card padded={false}>
              <div className="p-4 pb-2">
                <SectionTitle hint="Sommes des CA renseignés par année de deal">
                  CA des opérations par année
                </SectionTitle>
              </div>
              <div className="px-4 pb-4">
                <ChartFrame height={250} empty={!dealsHaveCa}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={caByYear} margin={{ top: 8, right: 4, bottom: 0, left: -6 }}>
                      <CartesianGrid stroke={CHART_COLORS.line} strokeDasharray="2 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_COLORS.grey }} />
                      <YAxis
                        tick={{ fontSize: 10, fill: CHART_COLORS.grey }}
                        tickFormatter={(value: number) => fmtEuro(value, true)}
                      />
                      <Tooltip content={<ChartTip formatter={(value) => fmtEuro(value)} />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar
                        dataKey="caAvant"
                        name="CA avant"
                        fill={CHART_COLORS.navySoft}
                        radius={[1, 1, 0, 0]}
                      />
                      <Bar
                        dataKey="caApres"
                        name="CA après"
                        fill={CHART_COLORS.navy}
                        radius={[1, 1, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartFrame>
              </div>
            </Card>

            <Card padded={false}>
              <div className="p-4 pb-2">
                <SectionTitle hint="Top régions par CA après cession documenté">
                  CA par région
                </SectionTitle>
              </div>
              <div className="px-4 pb-4">
                <ChartFrame height={250} empty={!dealsHaveCa}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={caByRegion}
                      layout="vertical"
                      margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
                    >
                      <CartesianGrid stroke={CHART_COLORS.line} strokeDasharray="2 3" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: CHART_COLORS.grey }}
                        tickFormatter={(value: number) => fmtEuro(value, true)}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={150}
                        tick={{ fontSize: 10, fill: CHART_COLORS.grey }}
                      />
                      <Tooltip content={<ChartTip formatter={(value) => fmtEuro(value)} />} />
                      <Bar dataKey="caApres" name="CA après" fill={CHART_COLORS.navy} radius={[0, 1, 1, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartFrame>
              </div>
            </Card>
          </div>

          <Card padded={false}>
            <div className="flex flex-wrap items-center gap-3 p-4 pb-3">
              <SectionTitle
                hint={
                  <>
                    {fmtInt(sortedTransactions.length)} opération(s) · CA avant {fmtEuro(caAvantTotal, true)} · CA après{" "}
                    {fmtEuro(caApresTotal, true)}
                  </>
                }
              >
                Transactions documentées
              </SectionTitle>
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-faint">
                <CalendarClock className="size-3" /> Données au {fmtDate(EXTRACTION_DATE)}
              </span>
            </div>
            <TableShell className="max-h-[620px]">
              <thead>
                <tr>
                  {(["date", "nom", "ville", "categorie", "caAvant", "caApres"] as TxSortKey[]).map((key) => (
                    <Th
                      key={key}
                      sortable
                      active={sortKey === key}
                      direction={sortDirection}
                      onSort={() => setSorting(key)}
                      align={key === "caAvant" || key === "caApres" ? "right" : "left"}
                    >
                      {TX_SORT_LABELS[key]}
                    </Th>
                  ))}
                  <Th>Clés avant → après</Th>
                  <Th>Analyste</Th>
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map(({ transaction, hotel }) => (
                  <tr key={transaction.id} className="group">
                    <Td className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {transaction.confidentielClient ? <Lock className="size-3 text-amber" /> : null}
                        {fmtDate(transaction.date)}
                      </div>
                    </Td>
                    <Td>
                      {hotel ? (
                        <Link
                          href={`/hotels/${hotel.id}`}
                          className="font-medium text-ink hover:text-accent hover:underline"
                        >
                          {hotel.nom}
                        </Link>
                      ) : (
                        <span className="text-muted">Hôtel non identifié</span>
                      )}
                      <div className="mt-0.5 text-[9.5px] text-faint">
                        {transaction.localisation ?? "Localisation non documentée"}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1 text-ink-soft">
                        <MapPin className="size-3 text-faint" />
                        {hotel?.ville ?? "—"}
                      </div>
                    </Td>
                    <Td>
                      {hotel ? (
                        <CategoryBadge categorie={hotel.categorie} />
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <div className="tabular">{fmtEuro(transaction.caAvant)}</div>
                      <div className="text-[9px] text-faint">
                        {transaction.exerciceCaAvant ?? "exercice non renseigné"}
                      </div>
                    </Td>
                    <Td align="right">
                      <div className="tabular">{fmtEuro(transaction.caApres)}</div>
                      <div className="text-[9px] text-faint">
                        {transaction.exerciceCaApres ?? "exercice non renseigné"}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-[10.5px]">
                      {transaction.clesAvant ?? "—"} → {transaction.clesApres ?? "—"}
                    </Td>
                    <Td className="text-[10.5px]">{transaction.analyste ?? "—"}</Td>
                    <Td>
                      <ReliabilityBadge source={transaction.sourceAvant ?? transaction.source} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            {sortedTransactions.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Search className="size-5" />}
                  title="Aucune transaction ne correspond"
                  description="Ajustez la recherche, la catégorie ou la période."
                />
              </div>
            ) : null}
          </Card>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[3px] border border-line bg-surface p-3">
              <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                <Wallet className="size-3.5 text-accent" /> CA documenté
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
                {fmtInt(documentedCount)} opération(s) renseignent un CA avant et/ou après. Les lignes sans montant
                restent visibles mais n’alimentent aucun cumul.
              </p>
            </div>
            <div className="rounded-[3px] border border-line bg-surface p-3">
              <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                <TrendingUp className="size-3.5 text-accent" /> Lecture des prix
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
                Les prix de cession, prix par clé et valorisations ne figurent pas dans le classeur. Ils ne sont donc
                ni calculés ni estimés.
              </p>
            </div>
            <div className="rounded-[3px] border border-line bg-surface p-3">
              <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                <Building2 className="size-3.5 text-accent" /> Fusions
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
                Chaque opération est reliée à une fiche hôtel par son identifiant de compilation. Les CA ne sont pas
                dupliqués entre les exercices.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[9.5px] text-faint">
        <span>
          Base compilée · {fmtInt(zoneHotels.length)} actifs · zone {zone} · exercice {annee}
        </span>
        <span className="inline-flex items-center gap-1">
          <ArrowUpRight className="size-3" /> Les indicateurs absents sont signalés « non documentés ».
        </span>
      </div>
    </div>
  );
}
