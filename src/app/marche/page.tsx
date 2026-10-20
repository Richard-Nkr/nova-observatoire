"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  Download,
  Hammer,
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
  Cell,
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
  enrichTransactions,
  hotelsInZone,
  openingsByYear,
  performanceByCategory,
  pipelineInZone,
  priceKeyByRegion,
  priceKeyByYear,
  supplyByCategory,
  transactionsInZone,
  volume,
  zoneKpis,
} from "@/lib/market";
import { exportMarketXlsx } from "@/lib/market-export";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  EXTRACTION_DATE,
  MARKET_ZONES,
  YEARS,
} from "@/lib/constants";
import { fmtDate, fmtEuro, fmtInt, fmtNum, fmtTo } from "@/lib/format";
import { median } from "@/lib/stats";
import { categoryRank } from "@/lib/hotel-utils";
import type { Categorie } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge, CategoryBadge } from "@/components/ui/badge";
import { Select, SearchInput } from "@/components/ui/field";
import { Card, EmptyState, PageHeader, ProgressBar, SectionTitle, StatTile, Tabs } from "@/components/ui/misc";
import { TableShell, Td, Th } from "@/components/ui/table";
import { ChartFrame, ChartTip, CHART_COLORS } from "@/components/charts";
import { ReliabilityBadge } from "@/components/reliability";

type MarketTab = "marche" | "pipeline" | "transactions";
type TxPeriod = "all" | "2024-2026" | "2021-2023" | "2019-2020";
type TxSortKey = "date" | "nom" | "ville" | "categorie" | "prix" | "prixParCle";
type TxCategory = Categorie | "Toutes";

const PERIODS: { value: TxPeriod; label: string }[] = [
  { value: "all", label: "Toutes périodes" },
  { value: "2024-2026", label: "2024 – 2026" },
  { value: "2021-2023", label: "2021 – 2023" },
  { value: "2019-2020", label: "2019 – 2020" },
];

const STATUS_TONE: Record<string, "green" | "amber" | "navy" | "grey"> = {
  "En construction": "green",
  "Permis accordé": "navy",
  Annoncé: "amber",
  Rénovation: "grey",
};

function inPeriod(iso: string, period: TxPeriod): boolean {
  if (period === "all") return true;
  if (period === "2024-2026") return iso >= "2024-01-01";
  if (period === "2021-2023") return iso >= "2021-01-01" && iso < "2024-01-01";
  return iso < "2021-01-01";
}

export default function MarketPage() {
  const { state, currentUser } = useStore();
  const [zone, setZone] = React.useState(ALL_ZONES);
  const [annee, setAnnee] = React.useState(2025);
  const [tab, setTab] = React.useState<MarketTab>("marche");
  const [txCategory, setTxCategory] = React.useState<TxCategory>("Toutes");
  const [txPeriod, setTxPeriod] = React.useState<TxPeriod>("all");
  const [txSearch, setTxSearch] = React.useState("");
  const [sort, setSort] = React.useState<{ key: TxSortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "desc",
  });

  const zoneHotels = React.useMemo(
    () => hotelsInZone(state.hotels, zone),
    [state.hotels, zone],
  );
  const overview = React.useMemo(
    () => zoneKpis(zoneHotels, state.kpis, annee),
    [zoneHotels, state.kpis, annee],
  );
  const supply = React.useMemo(() => supplyByCategory(zoneHotels), [zoneHotels]);
  const performance = React.useMemo(
    () => performanceByCategory(zoneHotels, state.kpis, annee),
    [zoneHotels, state.kpis, annee],
  );
  const openings = React.useMemo(() => openingsByYear(zoneHotels), [zoneHotels]);
  const zonePipeline = React.useMemo(
    () => pipelineInZone(state.pipeline, zone).sort((a, b) => a.ouverture - b.ouverture),
    [state.pipeline, zone],
  );

  const zoneTransactions = React.useMemo(
    () => transactionsInZone(enrichTransactions(state.transactions, state.hotels), zone),
    [state.transactions, state.hotels, zone],
  );
  const confidentialCount = zoneTransactions.filter(
    ({ transaction }) => transaction.confidentielClient,
  ).length;
  const visibleTransactions = React.useMemo(
    () =>
      currentUser.accesConfidentiel
        ? zoneTransactions
        : zoneTransactions.filter(({ transaction }) => !transaction.confidentielClient),
    [zoneTransactions, currentUser.accesConfidentiel],
  );

  const filteredTransactions = React.useMemo(() => {
    const query = txSearch.trim().toLowerCase();
    return visibleTransactions.filter(({ transaction, hotel }) => {
      if (txCategory !== "Toutes" && hotel?.categorie !== txCategory) return false;
      if (!inPeriod(transaction.date, txPeriod)) return false;
      if (!query) return true;
      return [hotel?.nom, hotel?.ville, transaction.acheteur, transaction.vendeur, transaction.type]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [visibleTransactions, txCategory, txPeriod, txSearch]);

  const sortedTransactions = React.useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filteredTransactions].sort((a, b) => {
      if (sort.key === "date") return factor * a.transaction.date.localeCompare(b.transaction.date);
      if (sort.key === "prix") return factor * (a.transaction.prix - b.transaction.prix);
      if (sort.key === "prixParCle")
        return factor * (a.transaction.prixParCle - b.transaction.prixParCle);
      if (sort.key === "categorie")
        return factor * (categoryRank(a.hotel?.categorie ?? 1) - categoryRank(b.hotel?.categorie ?? 1));
      if (sort.key === "nom")
        return factor * (a.hotel?.nom ?? "").localeCompare(b.hotel?.nom ?? "", "fr");
      return factor * (a.hotel?.ville ?? "").localeCompare(b.hotel?.ville ?? "", "fr");
    });
  }, [filteredTransactions, sort]);

  const priceByYear = React.useMemo(
    () => priceKeyByYear(filteredTransactions),
    [filteredTransactions],
  );
  const priceByRegion = React.useMemo(
    () => priceKeyByRegion(filteredTransactions),
    [filteredTransactions],
  );
  const txVolume = React.useMemo(() => volume(filteredTransactions), [filteredTransactions]);
  const txMedian = React.useMemo(
    () => median(filteredTransactions.map(({ transaction }) => transaction.prixParCle)),
    [filteredTransactions],
  );

  const pipelineKeys = zonePipeline.reduce((total, project) => total + project.cles, 0);
  const nextOpening = zonePipeline[0]?.ouverture ?? null;
  const performanceData = performance.map((row) => ({
    ...row,
    label: CATEGORY_LABEL[String(row.categorie)] ?? String(row.categorie),
  }));

  function toggleSort(key: TxSortKey) {
    setSort((previous) =>
      previous.key === key
        ? { key, dir: previous.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "date" || key === "prix" || key === "prixParCle" ? "desc" : "asc" },
    );
  }

  function handleExport() {
    const filterLines = [
      `Zone : ${zone}`,
      `Exercice : ${annee}`,
      `Catégorie : ${txCategory}`,
      `Période : ${PERIODS.find((item) => item.value === txPeriod)?.label ?? txPeriod}`,
      ...(txSearch.trim() ? [`Recherche : ${txSearch.trim()}`] : []),
    ];
    exportMarketXlsx({
      zone,
      annee,
      hotels: state.hotels,
      kpis: state.kpis,
      transactions: filteredTransactions.map(({ transaction }) => transaction),
      pipeline: state.pipeline,
      includeConfidential: currentUser.accesConfidentiel,
      auteur: currentUser.nom,
      filters: filterLines,
      hiddenConfidential: currentUser.accesConfidentiel ? 0 : confidentialCount,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Analyser"
        title="Marché & transactions"
        description="Lecture de l’offre, des performances et du pipeline sur le périmètre retenu, complétée par les transactions hôtelières documentées. Chaque ligne reste reliée à sa source."
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="size-3.5" />
            Exporter Excel
          </Button>
        }
      />

      <Card className="flex flex-wrap items-end gap-4" padded>
        <label className="min-w-[220px]">
          <span className="mb-1 flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            <MapPin className="size-3" /> Zone d’analyse
          </span>
          <Select
            value={zone}
            onChange={setZone}
            options={MARKET_ZONES.map((item) => ({ value: item, label: item }))}
          />
        </label>
        <label className="min-w-[130px]">
          <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            Exercice
          </span>
          <Select
            value={String(annee)}
            onChange={(value) => setAnnee(Number(value))}
            options={[...YEARS].reverse().map((year) => ({ value: String(year), label: String(year) }))}
          />
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-3 pb-0.5">
          <Badge tone={zone === ALL_ZONES ? "neutral" : "navy"} dot>
            {zoneHotels.length} hôtels · {fmtInt(overview.cles)} clés
          </Badge>
          <span className="text-[10.5px] text-faint">Extraction du {fmtDate(EXTRACTION_DATE)}</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 border border-line bg-surface lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Hôtels" value={fmtInt(overview.count)} sub={zone} />
        <StatTile label="Clés" value={fmtInt(overview.cles)} sub={`${supply.length} catégories`} />
        <StatTile label="ADR moyen" value={fmtEuro(overview.adr)} sub={`TO moyen ${fmtTo(overview.to)}`} />
        <StatTile
          label="RevPAR moyen"
          value={fmtEuro(overview.revpar)}
          sub={`EBITDA ${fmtTo(overview.ebitdaPct)}`}
        />
        <StatTile label="CA cumulé" value={fmtEuro(overview.caTotal, true)} sub={`exercice ${annee}`} />
        <StatTile
          label="Transactions"
          value={fmtInt(filteredTransactions.length)}
          sub={`${fmtEuro(txVolume, true)} cumulés`}
        />
      </div>

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as MarketTab)}
        tabs={[
          { value: "marche", label: "Vue du marché" },
          { value: "pipeline", label: "Pipeline", count: zonePipeline.length },
          { value: "transactions", label: "Transactions", count: filteredTransactions.length },
        ]}
      />

      {tab === "marche" && (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <SectionTitle hint={`${zoneHotels.length} hôtels · ${fmtInt(overview.cles)} clés`}>
                Offre par catégorie
              </SectionTitle>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Catégorie</Th>
                    <Th align="right">Hôtels</Th>
                    <Th align="right">Clés</Th>
                    <Th>Part des clés</Th>
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
                      <Td>
                        <div className="flex items-center gap-2">
                          <ProgressBar value={row.keyShare * 100} className="max-w-[120px]" />
                          <span className="w-10 text-right text-[10.5px] tabular text-muted">
                            {fmtTo(row.keyShare)}
                          </span>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
              <p className="mt-3 border-t border-line pt-2.5 text-[10.5px] leading-relaxed text-faint">
                Le poids est calculé à partir des clés renseignées. Les catégories absentes du
                périmètre ne sont pas affichées.
              </p>
            </Card>

            <Card>
              <SectionTitle hint="Hôtels ouverts par année, dans le périmètre">
                Évolution de l’offre
              </SectionTitle>
              <ChartFrame height={244} empty={!openings.some((row) => row.ouvertures > 0)}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={openings} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="annee"
                      tick={{ fontSize: 9.5, fill: "#6b747b" }}
                      axisLine={{ stroke: CHART_COLORS.line }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 9.5, fill: "#6b747b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="ouvertures" name="Ouvertures" barSize={18} radius={[2, 2, 0, 0]}>
                      {openings.map((row) => (
                        <Cell
                          key={row.annee}
                          fill={row.annee >= 2025 ? CHART_COLORS.copper : CHART_COLORS.navy}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
              <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
                Ouvertures recensées d’après l’année d’ouverture des fiches. Les fermetures ne sont
                pas documentées dans cette base démo : aucun chiffre n’est extrapolé.
              </p>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <SectionTitle hint={`Moyennes simples des valeurs disponibles · exercice ${annee}`}>
                Performance par catégorie
              </SectionTitle>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Catégorie</Th>
                    <Th align="right">ADR</Th>
                    <Th align="right">TO</Th>
                    <Th align="right">RevPAR</Th>
                    <Th align="right">EBITDA</Th>
                    <Th align="right">Note</Th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map((row) => (
                    <tr key={String(row.categorie)}>
                      <Td>
                        <CategoryBadge categorie={row.categorie} />
                      </Td>
                      <Td align="right">{fmtEuro(row.adr)}</Td>
                      <Td align="right">{fmtTo(row.to)}</Td>
                      <Td align="right" className="font-medium text-ink">
                        {fmtEuro(row.revpar)}
                      </Td>
                      <Td align="right">{fmtTo(row.ebitdaPct)}</Td>
                      <Td align="right">{row.note === null ? "—" : `${fmtNum(row.note, 1)}/10`}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
              <p className="mt-3 border-t border-line pt-2.5 text-[10.5px] leading-relaxed text-faint">
                Les valeurs nulles sont exclues des moyennes. Aucun redressement ni extrapolation
                n’est appliqué.
              </p>
            </Card>

            <Card>
              <SectionTitle hint="ADR et RevPAR moyens à l’exercice sélectionné">
                Repères de performance
              </SectionTitle>
              <ChartFrame height={244} empty={!performanceData.length}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={performanceData}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 2, bottom: 0 }}
                    barGap={2}
                  >
                    <CartesianGrid stroke={CHART_COLORS.line} strokeDasharray="2 4" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 9.5, fill: "#6b747b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) => `${Math.round(value)} €`}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={52}
                      tick={{ fontSize: 9.5, fill: "#6b747b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={
                        <ChartTip
                          formatter={(value) => fmtEuro(value)}
                        />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} iconSize={7} />
                    <Bar dataKey="adr" name="ADR" fill={CHART_COLORS.navySoft} barSize={9} radius={[0, 2, 2, 0]} />
                    <Bar dataKey="revpar" name="RevPAR" fill={CHART_COLORS.navy} barSize={9} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </Card>
          </div>
        </div>
      )}

      {tab === "pipeline" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 border border-line bg-surface lg:grid-cols-4">
            <StatTile label="Projets identifiés" value={fmtInt(zonePipeline.length)} sub={zone} />
            <StatTile label="Clés annoncées" value={fmtInt(pipelineKeys)} sub="à l’ouverture" />
            <StatTile
              label="Prochaine ouverture"
              value={nextOpening ?? "—"}
              sub={zonePipeline[0]?.nom ?? "Aucun projet daté"}
            />
            <StatTile
              label="En construction"
              value={fmtInt(zonePipeline.filter((project) => project.statut === "En construction").length)}
              sub="statut le plus avancé"
            />
          </div>

          <Card>
            <SectionTitle hint="Projets d’ouverture et de rénovation documentés">
              Pipeline hôtelier
            </SectionTitle>
            {zonePipeline.length ? (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Projet</Th>
                    <Th>Ville</Th>
                    <Th>Catégorie</Th>
                    <Th align="right">Clés</Th>
                    <Th align="right">Ouverture</Th>
                    <Th>Statut</Th>
                    <Th>Promoteur</Th>
                  </tr>
                </thead>
                <tbody>
                  {zonePipeline.map((project) => (
                    <tr key={project.id}>
                      <Td className="font-medium text-ink">{project.nom}</Td>
                      <Td>{project.ville}</Td>
                      <Td>
                        <CategoryBadge categorie={project.categorie} />
                      </Td>
                      <Td align="right">{fmtInt(project.cles)}</Td>
                      <Td align="right">{project.ouverture}</Td>
                      <Td>
                        <Badge tone={STATUS_TONE[project.statut] ?? "neutral"} dot>
                          {project.statut}
                        </Badge>
                      </Td>
                      <Td className="max-w-[230px] truncate text-muted" title={project.promoteur}>
                        {project.promoteur}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            ) : (
              <EmptyState
                title="Aucun projet sur ce périmètre"
                description="Le pipeline de démonstration ne contient pas de projet pour cette zone."
                icon={<Hammer className="size-5" />}
              />
            )}
            <p className="mt-3 border-t border-line pt-2.5 text-[10.5px] leading-relaxed text-faint">
              Pipeline de démonstration. Les statuts sont des informations de veille, non des
              engagements de livraison.
            </p>
          </Card>
        </div>
      )}

      {tab === "transactions" && (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[210px] flex-1">
                <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Recherche
                </span>
                <SearchInput
                  value={txSearch}
                  onChange={setTxSearch}
                  placeholder="Hôtel, ville, acheteur, vendeur…"
                />
              </label>
              <label className="min-w-[120px]">
                <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Catégorie
                </span>
                <Select
                  value={String(txCategory)}
                  onChange={(value) =>
                    setTxCategory(
                      value === "Toutes" ? "Toutes" : (value === "Palace" ? "Palace" : (Number(value) as Categorie)),
                    )
                  }
                  options={[
                    { value: "Toutes", label: "Toutes" },
                    ...CATEGORIES.map((categorie) => ({
                      value: String(categorie),
                      label: CATEGORY_LABEL[String(categorie)],
                    })),
                  ]}
                />
              </label>
              <label className="min-w-[150px]">
                <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Période
                </span>
                <Select
                  value={txPeriod}
                  onChange={(value) => setTxPeriod(value as TxPeriod)}
                  options={PERIODS}
                />
              </label>
              <div className="ml-auto flex items-center gap-3 pb-1">
                <span className="text-[10.5px] text-muted">
                  {fmtInt(filteredTransactions.length)} transaction(s) · {fmtEuro(txVolume, true)}
                </span>
                {(txSearch || txCategory !== "Toutes" || txPeriod !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTxSearch("");
                      setTxCategory("Toutes");
                      setTxPeriod("all");
                    }}
                  >
                    Réinitialiser
                  </Button>
                )}
              </div>
            </div>
            {!currentUser.accesConfidentiel && confidentialCount > 0 && (
              <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 text-[10.5px] text-amber">
                <Lock className="size-3" />
                {confidentialCount} transaction(s) confidentielle(s) masquée(s) sur ce périmètre.
                Un accès nominatif est requis pour les consulter.
              </p>
            )}
            {currentUser.accesConfidentiel && confidentialCount > 0 && (
              <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 text-[10.5px] text-muted">
                <Lock className="size-3" />
                Accès confidentiel accordé : {confidentialCount} transaction(s) sensible(s) incluse(s)
                dans la vue et dans l’export.
              </p>
            )}
          </Card>

          <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
            <Card>
              <SectionTitle hint={`${fmtInt(filteredTransactions.length)} transactions · ${fmtEuro(txVolume, true)}`}>
                Prix par clé et volume
              </SectionTitle>
              <ChartFrame height={248} empty={!priceByYear.length}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={priceByYear} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9.5, fill: "#6b747b" }}
                      axisLine={{ stroke: CHART_COLORS.line }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="prix"
                      tick={{ fontSize: 9.5, fill: "#6b747b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) => `${Math.round(value / 1000)} k€`}
                    />
                    <YAxis
                      yAxisId="volume"
                      orientation="right"
                      tick={{ fontSize: 9.5, fill: "#6b747b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) => `${Math.round(value / 1_000_000)} M€`}
                    />
                    <Tooltip
                      content={
                        <ChartTip
                          formatter={(value, name) =>
                            name === "Volume" ? fmtEuro(value, true) : fmtEuro(value)
                          }
                        />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} iconSize={7} />
                    <Bar
                      yAxisId="volume"
                      dataKey="volume"
                      name="Volume"
                      fill={CHART_COLORS.navySoft}
                      opacity={0.35}
                      barSize={20}
                    />
                    <Line
                      yAxisId="prix"
                      type="monotone"
                      dataKey="median"
                      name="Prix/clé médian"
                      stroke={CHART_COLORS.copper}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CHART_COLORS.copper }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartFrame>
            </Card>

            <Card>
              <SectionTitle hint="Prix par clé médian des transactions retenues">
                Prix par clé par région
              </SectionTitle>
              <ChartFrame height={248} empty={!priceByRegion.length}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={priceByRegion}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid stroke={CHART_COLORS.line} strokeDasharray="2 4" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 9, fill: "#6b747b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) => `${Math.round(value / 1000)} k€`}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={128}
                      tick={{ fontSize: 9, fill: "#6b747b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<ChartTip formatter={(value) => fmtEuro(value)} />}
                    />
                    <Bar dataKey="median" name="Prix/clé médian" barSize={13} radius={[0, 2, 2, 0]}>
                      {priceByRegion.map((row) => (
                        <Cell
                          key={row.label}
                          fill={row.label === zone ? CHART_COLORS.copper : CHART_COLORS.navy}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </Card>
          </div>

          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
              <SectionTitle
                className="mb-0"
                hint={`${fmtInt(filteredTransactions.length)} opérations · prix par clé médian ${fmtEuro(txMedian)}`}
              >
                Transactions documentées
              </SectionTitle>
              <Badge tone="grey">{annee >= 2026 ? "2026" : `Données au ${fmtDate(EXTRACTION_DATE)}`}</Badge>
            </div>
            <div className="px-4 pb-4 pt-3">
              {sortedTransactions.length ? (
                <TableShell className="max-h-[520px]">
                  <thead>
                    <tr>
                      <Th sortable active={sort.key === "date"} direction={sort.dir} onSort={() => toggleSort("date")}>
                        Date
                      </Th>
                      <Th sortable active={sort.key === "nom"} direction={sort.dir} onSort={() => toggleSort("nom")}>
                        Hôtel
                      </Th>
                      <Th sortable active={sort.key === "ville"} direction={sort.dir} onSort={() => toggleSort("ville")}>
                        Ville
                      </Th>
                      <Th
                        sortable
                        active={sort.key === "categorie"}
                        direction={sort.dir}
                        onSort={() => toggleSort("categorie")}
                      >
                        Cat.
                      </Th>
                      <Th>Acheteur</Th>
                      <Th>Vendeur</Th>
                      <Th>Type</Th>
                      <Th align="right" sortable active={sort.key === "prix"} direction={sort.dir} onSort={() => toggleSort("prix")}>
                        Prix
                      </Th>
                      <Th
                        align="right"
                        sortable
                        active={sort.key === "prixParCle"}
                        direction={sort.dir}
                        onSort={() => toggleSort("prixParCle")}
                      >
                        Prix/clé
                      </Th>
                      <Th>Source</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTransactions.map(({ transaction, hotel }) => (
                      <tr key={transaction.id} className="group hover:bg-paper/60">
                        <Td className="whitespace-nowrap">{fmtDate(transaction.date)}</Td>
                        <Td>
                          <div className="flex max-w-[220px] items-center gap-1.5">
                            {hotel ? (
                              <Link
                                href={`/hotels/${hotel.id}`}
                                className="truncate font-medium text-ink hover:text-accent-strong"
                                title={hotel.nom}
                              >
                                {hotel.nom}
                              </Link>
                            ) : (
                              <span className="truncate">Hôtel non identifié</span>
                            )}
                            {transaction.confidentielClient && (
                              <Lock className="size-3 shrink-0 text-amber" aria-label="Transaction confidentielle" />
                            )}
                            {hotel && (
                              <ArrowUpRight className="size-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                            )}
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap text-muted">{hotel?.ville ?? "—"}</Td>
                        <Td>{hotel ? <CategoryBadge categorie={hotel.categorie} /> : "—"}</Td>
                        <Td className="max-w-[180px] truncate text-muted" title={transaction.acheteur}>
                          {transaction.acheteur}
                        </Td>
                        <Td className="max-w-[170px] truncate text-muted" title={transaction.vendeur}>
                          {transaction.vendeur}
                        </Td>
                        <Td>
                          <Badge tone={transaction.type === "Murs + fonds" ? "navy" : "outline"}>
                            {transaction.type}
                          </Badge>
                        </Td>
                        <Td align="right" className="whitespace-nowrap font-medium text-ink">
                          {fmtEuro(transaction.prix, true)}
                        </Td>
                        <Td align="right" className="whitespace-nowrap">
                          {fmtEuro(transaction.prixParCle)}
                        </Td>
                        <Td>
                          <ReliabilityBadge source={transaction.source} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableShell>
              ) : (
                <EmptyState
                  title="Aucune transaction sur ces critères"
                  description="Élargissez la période ou la catégorie, ou vérifiez vos droits d’accès aux données confidentielles."
                  icon={<Search className="size-5" />}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[10.5px] text-faint">
              <span className="flex items-center gap-1.5">
                <Wallet className="size-3" />
                {fmtInt(sortedTransactions.length)} opération(s) affichée(s) · volume {fmtEuro(txVolume, true)}
              </span>
              <span className="flex items-center gap-1.5">
                <TrendingUp className="size-3" />
                Prix par clé médian {fmtEuro(txMedian)}
              </span>
            </div>
          </Card>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="md:col-span-2">
          <SectionTitle hint="Trois lectures complémentaires pour une note de marché">
            Lecture du marché
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <Reading
              icon={<Building2 className="size-4" />}
              title="Offre"
              text={`${fmtInt(overview.count)} hôtels et ${fmtInt(overview.cles)} clés dans la zone, dont ${fmtTo(
                supply.reduce((total, row) => total + row.keyShare * (row.categorie === 4 || row.categorie === 5 || row.categorie === "Palace" ? 1 : 0), 0),
              )} de clés 4★ et plus.`}
            />
            <Reading
              icon={<CalendarClock className="size-4" />}
              title="Pipeline"
              text={`${fmtInt(zonePipeline.length)} projet(s) recensé(s), ${fmtInt(pipelineKeys)} clés annoncées, première échéance ${nextOpening ?? "non datée"}.`}
            />
            <Reading
              icon={<Wallet className="size-4" />}
              title="Transactions"
              text={`${fmtInt(filteredTransactions.length)} opération(s) pour ${fmtEuro(txVolume, true)}, prix par clé médian ${fmtEuro(txMedian)}.`}
            />
          </div>
        </Card>
        <Card>
          <SectionTitle hint="Ce que la base démontre — et ce qu’elle ne démontre pas">
            Traçabilité
          </SectionTitle>
          <ul className="space-y-2 text-[11px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-green" />
              Chaque transaction porte une source, une date et un niveau de fiabilité.
            </li>
            <li className="flex gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber" />
              Les moyennes excluent les valeurs nulles ; elles ne sont pas redressées.
            </li>
            <li className="flex gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-grey" />
              Les fermetures et transactions non documentées ne sont pas inventées.
            </li>
          </ul>
          <p className="mt-3 border-t border-line pt-2.5 text-[10px] leading-relaxed text-faint">
            Données fictives de démonstration · extraction du {fmtDate(EXTRACTION_DATE)}.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Reading({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="border-l border-line pl-3 first:border-l-0 first:pl-0">
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-strong">
        {icon}
        {title}
      </p>
      <p className="text-[11px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}
