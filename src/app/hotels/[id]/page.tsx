"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BedDouble,
  Building2,
  CalendarClock,
  Check,
  ExternalLink,
  GitCompareArrows,
  History,
  MapPin,
  PencilLine,
  X,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  CURRENT_DATA_YEAR,
  KPI_LABELS,
  RELIABILITY_META,
  YEARS,
} from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtInitials, fmtInt, fmtNum } from "@/lib/format";
import {
  categoryFamily,
  EQUIPMENT_ROWS,
  nearbyHotels,
} from "@/lib/hotel-utils";
import { kpiFor, latestKpi, metricValue, rankIn } from "@/lib/stats";
import { useStore } from "@/lib/store";
import type { Fiabilite, KpiYear } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CategoryBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/field";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Card, DefinitionList, EmptyState, SectionTitle } from "@/components/ui/misc";
import { TableShell, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  DemoStamp,
  ReliabilityBadge,
  SourceInline,
} from "@/components/reliability";
import { ChartFrame, ChartTip, CHART_COLORS } from "@/components/charts";
import { NovaMap } from "@/components/map/nova-map";

export default function HotelDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { state, currentUser, toggleBasket, setBasket, setReference, upsertKpi, addAudit } =
    useStore();
  const { toast } = useToast();
  const hotel = state.hotels.find((item) => item.id === params.id);
  const [editOpen, setEditOpen] = React.useState(false);
  const [chartTab, setChartTab] = React.useState<"ca" | "prix">("ca");

  if (!hotel) {
    return (
      <EmptyState
        icon={<Building2 className="size-8" />}
        title="Fiche introuvable"
        description="Cet établissement n’existe pas ou a été supprimé de la base de démonstration."
        action={
          <Button variant="outline" size="sm" onClick={() => router.push("/hotels")}>
            <ArrowLeft className="size-3.5" />
            Retour au répertoire
          </Button>
        }
      />
    );
  }

  const kpiYears = state.kpis
    .filter((kpi) => kpi.hotelId === hotel.id)
    .sort((a, b) => a.annee - b.annee);
  const currentKpi =
    kpiFor(hotel.id, state.kpis, CURRENT_DATA_YEAR) ?? latestKpi(hotel.id, state.kpis);
  const annee = currentKpi?.annee ?? CURRENT_DATA_YEAR;
  const inBasket = state.basket.includes(hotel.id);
  const confidential = currentUser.accesConfidentiel;
  const transactions = state.transactions.filter(
    (transaction) =>
      transaction.hotelId === hotel.id &&
      (confidential || !transaction.confidentielClient),
  );
  const maskedTransactions = state.transactions.filter(
    (transaction) =>
      transaction.hotelId === hotel.id && transaction.confidentielClient && !confidential,
  ).length;

  const radius15 = nearbyHotels(hotel, state.hotels, 15);
  const nearby = radius15.length >= 3 ? radius15 : nearbyHotels(hotel, state.hotels, 30);

  const rankings = (["revpar", "adr", "to", "caParCle", "note"] as const)
    .map((key) => {
      const value = metricValue(hotel, state.kpis, key, annee);
      const values = [hotel, ...nearby]
        .map((item) => metricValue(item, state.kpis, key, annee))
        .filter((item): item is number => item != null);
      const rank = rankIn(value, values, 1);
      return { key, value, rank };
    })
    .filter((item) => item.value != null && item.rank);

  const chartData = kpiYears.map((kpi) => ({
    annee: kpi.annee,
    ca: kpi.caTotal ? Math.round(kpi.caTotal / 1_000_000 * 10) / 10 : null,
    revpar: kpi.revpar,
    adr: kpi.adr,
    to: kpi.to != null ? Math.round(kpi.to * 1000) / 10 : null,
  }));

  const journal = state.audit
    .filter((entry) => entry.target.toLowerCase().includes(hotel.nom.toLowerCase()))
    .slice(0, 7);

  const comparablePanel = [hotel.id, ...nearby.slice(0, 14).map((item) => item.id)];
  const compareZone = () => {
    setBasket(comparablePanel);
    setReference(hotel.id);
    addAudit({
      action: "Comparaison de zone depuis la fiche",
      target: hotel.nom,
      details: `${comparablePanel.length} hôtels de catégorie ${categoryFamily(hotel.categorie)}★`,
    });
    router.push("/comparateur");
  };

  const previousYear = kpiYears.find((kpi) => kpi.annee === annee - 1);
  const deltas = {
    adr: delta(currentKpi?.adr, previousYear?.adr),
    revpar: delta(currentKpi?.revpar, previousYear?.revpar),
    to:
      currentKpi?.to != null && previousYear?.to != null
        ? (currentKpi.to - previousYear.to) * 100
        : null,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/hotels"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          Fiches hôtels
        </Link>
        <span className="text-[10px] text-faint">
          Dernière mise à jour {fmtDate(hotel.updatedAt)} · exercice {annee}
        </span>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div
          className="h-[3px] w-full"
          style={{ background: CATEGORY_COLOR[String(hotel.categorie)] }}
        />
        <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge categorie={hotel.categorie} />
                  <span className="text-[10.5px] text-muted">{hotel.gamme}</span>
                  <span className="text-[10.5px] text-faint">·</span>
                  <span className="text-[10.5px] text-muted">{hotel.type}</span>
                  <span className="text-[10.5px] text-faint">·</span>
                  <span className="text-[10.5px] text-muted">{hotel.exploitation}</span>
                  {hotel.demo && <DemoStamp />}
                </div>
                <h1 className="mt-1.5 font-serif text-[32px] leading-tight tracking-[-0.02em] text-ink">
                  {hotel.nom}
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                  <MapPin className="size-3.5 text-faint" />
                  {hotel.adresse}, {hotel.codePostal} {hotel.ville}
                  <span className="text-faint">·</span>
                  {hotel.departement}, {hotel.region}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                  <span>{hotel.groupe}</span>
                  <span>Enseigne : {hotel.enseigne}</span>
                  <span className="inline-flex items-center gap-1">
                    <BedDouble className="size-3.5 text-faint" />
                    {fmtInt(hotel.cles)} clés
                    {hotel.suites ? ` · ${hotel.suites} suites` : ""}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5 text-faint" />
                    Ouverture {hotel.anneeOuverture ?? "—"} · rénovation {hotel.anneeRenovation ?? "—"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {hotel.siteUrl && (
                  <a
                    href={hotel.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-line-strong bg-surface px-2.5 text-[11px] font-medium text-ink hover:bg-paper"
                  >
                    <ExternalLink className="size-3.5" />
                    Site
                  </a>
                )}
                <Button variant="outline" size="sm" onClick={() => toggleBasket(hotel.id)}>
                  <GitCompareArrows className="size-3.5" />
                  {inBasket ? "Retirer du comparateur" : "Ajouter au comparateur"}
                </Button>
                <Button variant="accent" size="sm" onClick={compareZone}>
                  Comparer la zone
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
              <MetricCell
                label="CA total"
                value={currentKpi?.caTotal ?? null}
                format={(value) => `${fmtNum(value / 1_000_000, 1)} M€`}
                source={currentKpi?.source}
                delta={delta(currentKpi?.caTotal, previousYear?.caTotal)}
              />
              <MetricCell
                label="ADR"
                value={currentKpi?.adr ?? null}
                format={(value) => `${fmtNum(value, 0)} €`}
                source={currentKpi?.source}
                delta={deltas.adr}
              />
              <MetricCell
                label="TO"
                value={currentKpi?.to != null ? currentKpi.to * 100 : null}
                format={(value) => `${fmtNum(value, 1)} %`}
                source={currentKpi?.source}
                delta={deltas.to}
                deltaUnit="pts"
              />
              <MetricCell
                label="RevPAR"
                value={currentKpi?.revpar ?? null}
                format={(value) => `${fmtNum(value, 0)} €`}
                source={currentKpi?.source}
                delta={deltas.revpar}
              />
              <MetricCell
                label="EBITDA"
                value={currentKpi?.ebitdaPct != null ? currentKpi.ebitdaPct * 100 : null}
                format={(value) => `${fmtNum(value, 1)} %`}
                source={currentKpi?.source}
                delta={
                  currentKpi?.ebitdaPct != null && previousYear?.ebitdaPct != null
                    ? (currentKpi.ebitdaPct - previousYear.ebitdaPct) * 100
                    : null
                }
                deltaUnit="pts"
              />
              <MetricCell
                label="Note"
                value={currentKpi?.note ?? null}
                format={(value) => `${fmtNum(value, 1)} / 10`}
                source={currentKpi?.source}
                delta={
                  currentKpi?.note != null && previousYear?.note != null
                    ? currentKpi.note - previousYear.note
                    : null
                }
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-faint">
              <span>
                Variantes calculées : CA/clé{" "}
                {currentKpi?.caTotal && hotel.cles
                  ? `${fmtNum(currentKpi.caTotal / hotel.cles, 0)} €`
                  : "—"}{" "}
                · part F&amp;B{" "}
                {currentKpi?.caFnb && currentKpi?.caTotal
                  ? `${fmtNum((currentKpi.caFnb / currentKpi.caTotal) * 100, 1)} %`
                  : "—"}{" "}
                · m²/clé{" "}
                {hotel.surfaceTotale && hotel.cles
                  ? `${fmtNum(hotel.surfaceTotale / hotel.cles, 1)} m²`
                  : "—"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditOpen(true)}
                disabled={currentUser.role === "Lecteur"}
                title={currentUser.role === "Lecteur" ? "Droits contributeur requis" : undefined}
              >
                <PencilLine className="size-3.5" />
                Compléter un indicateur
              </Button>
            </div>
          </div>
          <div className="relative min-h-[210px] border-t border-line lg:border-l lg:border-t-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hotel.photoUrl}
              alt={`Illustration de ${hotel.nom}`}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/65 via-navy/5 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/60">
                Illustration non contractuelle
              </p>
              <p className="mt-0.5 text-[10.5px] text-white/85">
                {hotel.proprietaire} · exploité par {hotel.exploitant}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <SectionTitle hint="Capacité et surfaces déclarées">Capacité</SectionTitle>
              <DefinitionList
                columns={2}
                items={[
                  { label: "Clés", value: fmtInt(hotel.cles) },
                  { label: "Suites", value: hotel.suites ? fmtInt(hotel.suites) : "—" },
                  { label: "Surface totale", value: hotel.surfaceTotale ? `${fmtInt(hotel.surfaceTotale)} m²` : "—" },
                  { label: "Hébergement", value: hotel.surfaceHebergement ? `${fmtInt(hotel.surfaceHebergement)} m²` : "—" },
                  { label: "F&B", value: hotel.surfaceFnb ? `${fmtInt(hotel.surfaceFnb)} m²` : "—" },
                  { label: "MICE", value: hotel.surfaceMice ? `${fmtInt(hotel.surfaceMice)} m²` : "—" },
                  { label: "Salles séminaire", value: hotel.nbSallesSeminaire ?? "—" },
                  { label: "Capacité MICE", value: hotel.capaciteMiceMax ? `${fmtInt(hotel.capaciteMiceMax)} pers.` : "—" },
                  { label: "Couverts int.", value: hotel.equipements.couvertsInterieur ?? "—" },
                  { label: "Couverts ext.", value: hotel.equipements.couvertsExterieur ?? "—" },
                  { label: "Parking", value: hotel.equipements.parkingPlaces ? `${fmtInt(hotel.equipements.parkingPlaces)} places` : "—" },
                  { label: "Ticket moyen F&B", value: hotel.equipements.ticketMoyen ? `${fmtNum(hotel.equipements.ticketMoyen, 0)} €` : "—" },
                ]}
              />
            </Card>
            <Card>
              <SectionTitle hint="Équipements et services">Équipements</SectionTitle>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {EQUIPMENT_ROWS.map((row) => {
                  const enabled = Boolean(hotel.equipements[row.key]);
                  return (
                    <span
                      key={row.key}
                      className={cn(
                        "flex items-center gap-1.5 text-[11px]",
                        enabled ? "text-ink" : "text-faint",
                      )}
                    >
                      {enabled ? (
                        <Check className="size-3 text-green" />
                      ) : (
                        <X className="size-3 text-line-strong" />
                      )}
                      {row.label}
                    </span>
                  );
                })}
              </div>
              {hotel.equipements.spa && (
                <p className="mt-2 border-t border-line pt-2 text-[10px] text-muted">
                  Spa : {hotel.equipements.spaSurface ? `${fmtInt(hotel.equipements.spaSurface)} m²` : "surface n.c."}
                  {hotel.equipements.spaCabines ? ` · ${hotel.equipements.spaCabines} cabines` : ""}
                </p>
              )}
              <div className="mt-3 border-t border-line pt-2">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Source fiche
                </p>
                <div className="flex items-center gap-1.5">
                  <ReliabilityBadge source={hotel.source} showText />
                  <SourceInline source={hotel.source} />
                </div>
                {hotel.source.hypothese && (
                  <p className="mt-1 text-[10px] italic text-grey">{hotel.source.hypothese}</p>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle hint="Historique 2021–2025, trous conservés" className="mb-0">
                Trajectoire
              </SectionTitle>
              <div className="flex items-center rounded-[2px] border border-line-strong bg-surface p-[2px]">
                <button
                  type="button"
                  onClick={() => setChartTab("ca")}
                  className={cn(
                    "rounded-[1px] px-2 py-[3px] text-[10.5px]",
                    chartTab === "ca" ? "bg-navy text-white" : "text-ink-soft",
                  )}
                >
                  CA &amp; RevPAR
                </button>
                <button
                  type="button"
                  onClick={() => setChartTab("prix")}
                  className={cn(
                    "rounded-[1px] px-2 py-[3px] text-[10.5px]",
                    chartTab === "prix" ? "bg-navy text-white" : "text-ink-soft",
                  )}
                >
                  ADR &amp; TO
                </button>
              </div>
            </div>
            <ChartFrame height={250} empty={!kpiYears.length} className="mt-3">
              {chartTab === "ca" ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_COLORS.line} vertical={false} />
                    <XAxis dataKey="annee" tick={{ fontSize: 10, fill: "#6b747b" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="ca" tick={{ fontSize: 9, fill: "#949b9f" }} axisLine={false} tickLine={false} width={44} />
                    <YAxis yAxisId="revpar" orientation="right" tick={{ fontSize: 9, fill: "#949b9f" }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip content={<ChartTip formatter={(value, name) => name === "CA (M€)" ? `${value} M€` : `${Math.round(value)} €`} />} />
                    <Bar yAxisId="ca" dataKey="ca" name="CA (M€)" fill={CHART_COLORS.navy} barSize={26} radius={[1, 1, 0, 0]} />
                    <Line yAxisId="revpar" dataKey="revpar" name="RevPAR (€)" stroke={CHART_COLORS.copper} strokeWidth={1.6} dot={{ r: 2.5, fill: CHART_COLORS.copper }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <LineChart data={chartData} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.line} vertical={false} />
                  <XAxis dataKey="annee" tick={{ fontSize: 10, fill: "#6b747b" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="adr" tick={{ fontSize: 9, fill: "#949b9f" }} axisLine={false} tickLine={false} width={40} />
                  <YAxis yAxisId="to" orientation="right" tick={{ fontSize: 9, fill: "#949b9f" }} axisLine={false} tickLine={false} width={34} />
                  <Tooltip content={<ChartTip formatter={(value, name) => name === "TO (%)" ? `${value} %` : `${Math.round(value)} €`} />} />
                  <Line yAxisId="adr" dataKey="adr" name="ADR (€)" stroke={CHART_COLORS.navy} strokeWidth={1.6} dot={{ r: 2.5, fill: CHART_COLORS.navy }} connectNulls />
                  <Line yAxisId="to" dataKey="to" name="TO (%)" stroke={CHART_COLORS.copper} strokeWidth={1.6} dot={{ r: 2.5, fill: CHART_COLORS.copper }} connectNulls />
                </LineChart>
              )}
            </ChartFrame>

            <TableShell className="mt-3">
              <thead>
                <tr>
                  <Th>Exercice</Th>
                  <Th align="right">CA total</Th>
                  <Th align="right">CA/clé</Th>
                  <Th align="right">ADR</Th>
                  <Th align="right">TO</Th>
                  <Th align="right">RevPAR</Th>
                  <Th align="right">EBITDA %</Th>
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody>
                {[...kpiYears].reverse().map((kpi) => (
                  <tr key={kpi.id}>
                    <Td className="font-medium text-ink">{kpi.annee}</Td>
                    <Td align="right">{kpi.caTotal != null ? `${fmtNum(kpi.caTotal / 1_000_000, 2)} M€` : "—"}</Td>
                    <Td align="right">{kpi.caTotal && hotel.cles ? `${fmtNum(kpi.caTotal / hotel.cles, 0)} €` : "—"}</Td>
                    <Td align="right">{kpi.adr != null ? `${fmtNum(kpi.adr, 0)} €` : "—"}</Td>
                    <Td align="right">{kpi.to != null ? `${fmtNum(kpi.to * 100, 1)} %` : "—"}</Td>
                    <Td align="right">{kpi.revpar != null ? `${fmtNum(kpi.revpar, 0)} €` : "—"}</Td>
                    <Td align="right">{kpi.ebitdaPct != null ? `${fmtNum(kpi.ebitdaPct * 100, 1)} %` : "—"}</Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <ReliabilityBadge source={kpi.source} />
                        <SourceInline source={kpi.source} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </Card>

          <Card>
            <SectionTitle hint={confidential ? "Toutes les opérations" : "Les opérations confidentielles sont masquées"}>
              Transactions
            </SectionTitle>
            {transactions.length ? (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Acquéreur</Th>
                    <Th>Cédant</Th>
                    <Th align="right">Prix</Th>
                    <Th align="right">Prix/clé</Th>
                    <Th>Nature</Th>
                    <Th>Source</Th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <Td>{fmtDate(transaction.date)}</Td>
                      <Td>{transaction.acheteur}</Td>
                      <Td>{transaction.vendeur}</Td>
                      <Td align="right">{fmtNum(transaction.prix / 1_000_000, 1)} M€</Td>
                      <Td align="right">{fmtNum(transaction.prixParCle, 0)} €</Td>
                      <Td>
                        {transaction.type}
                        {transaction.confidentielClient && (
                          <span className="ml-1 rounded-[2px] bg-accent-soft px-1 text-[8.5px] font-semibold uppercase tracking-wide text-accent">
                            client
                          </span>
                        )}
                      </Td>
                      <Td><ReliabilityBadge source={transaction.source} /></Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            ) : (
              <p className="text-[11.5px] text-muted">
                Aucune transaction accessible. {maskedTransactions > 0 && `${maskedTransactions} opération(s) confidentielle(s) masquée(s).`}
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card padded={false} className="overflow-hidden">
            <div className="h-[228px]">
              <NovaMap
                className="h-full w-full"
                hotels={[hotel]}
                kpis={state.kpis}
                annee={annee}
                metric="hotels"
                scope={{ level: "city", city: hotel.ville, region: hotel.region }}
                geo={null}
                selectedHotelId={hotel.id}
                drawing={false}
                drawingPoints={[]}
                onRegionSelect={() => undefined}
                onCitySelect={() => undefined}
                onHotelSelect={() => undefined}
                onMapPoint={() => undefined}
                onMapReady={() => undefined}
              />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Localisation
                </p>
                <p className="text-[11px] text-ink">
                  {hotel.latitude.toFixed(4)}, {hotel.longitude.toFixed(4)}
                </p>
              </div>
              <a
                href={`https://www.openstreetmap.org/?mlat=${hotel.latitude}&mlon=${hotel.longitude}#map=15/${hotel.latitude}/${hotel.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10.5px] text-accent hover:underline"
              >
                OpenStreetMap
                <ExternalLink className="size-3" />
              </a>
            </div>
          </Card>

          <Card>
            <SectionTitle hint={`${nearby.length + 1} hôtels · rayon 15–30 km`}>
              Positionnement dans la zone
            </SectionTitle>
            <div className="space-y-2">
              {rankings.map((ranking) => {
                const meta = KPI_LABELS[ranking.key];
                return (
                  <div key={ranking.key} className="flex items-center gap-2.5">
                    <div className="w-[92px] shrink-0">
                      <p className="text-[10.5px] text-muted">{meta.short}</p>
                      <p className="text-[10px] tabular text-ink">
                        {ranking.value != null
                          ? meta.unit === "%" || meta.unit === "pts"
                            ? `${fmtNum(ranking.value * 100, 1)} %`
                            : `${fmtNum(ranking.value, meta.unit === "/10" ? 1 : 0)} ${meta.unit === "€" ? "€" : meta.unit}`
                          : "—"}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="h-[5px] overflow-hidden rounded-full bg-black/[0.06]">
                        <div
                          className="h-full rounded-full bg-navy"
                          style={{
                            width: `${Math.max(8, 100 - ((ranking.rank!.rank - 1) / Math.max(1, ranking.rank!.total)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-[54px] shrink-0 text-right text-[10px] tabular text-muted">
                      {ordinal(ranking.rank!.rank)} / {ranking.rank!.total}
                    </span>
                  </div>
                );
              })}
              {!rankings.length && (
                <p className="text-[11.5px] text-muted">Pas assez de comparables dans la zone.</p>
              )}
            </div>
            <p className="mt-2.5 border-t border-line pt-2 text-[9.5px] leading-relaxed text-faint">
              Rangs calculés sur les hôtels de catégorie {CATEGORY_LABEL[String(hotel.categorie)]} dans un
              rayon de 15 à 30 km. Les valeurs manquantes sont exclues du calcul.
            </p>
          </Card>

          <Card>
            <SectionTitle hint={`Mise à jour ${fmtDate(hotel.updatedAt)}`}>Fiabilité &amp; sources</SectionTitle>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted">Fiche établissement</span>
                <ReliabilityBadge source={hotel.source} showText />
              </div>
              <p className="text-[11px] text-ink">{hotel.source.source}</p>
              <p className="text-[10px] text-faint">
                {fmtDate(hotel.source.dateSource)} · {hotel.source.auteur}
              </p>
              {currentKpi && (
                <>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
                    <span className="text-[11px] text-muted">Indicateurs {annee}</span>
                    <ReliabilityBadge source={currentKpi.source} showText />
                  </div>
                  <p className="text-[11px] text-ink">{currentKpi.source.source}</p>
                  <p className="text-[10px] text-faint">
                    {fmtDate(currentKpi.source.dateSource)} · {currentKpi.source.auteur}
                  </p>
                  {currentKpi.source.hypothese && (
                    <p className="text-[10px] italic text-grey">{currentKpi.source.hypothese}</p>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card>
            <SectionTitle hint="Dernières opérations sur la fiche">Journal</SectionTitle>
            <div className="space-y-2.5">
              {journal.map((entry) => {
                const user = state.users.find((item) => item.id === entry.userId);
                return (
                  <div key={entry.id} className="flex gap-2">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[8.5px] font-semibold text-ink-soft">
                      {fmtInitials(user?.nom ?? "NA")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] text-ink">{entry.action}</p>
                      <p className="text-[9.5px] text-faint">
                        {fmtDateTime(entry.date)} · {user?.nom ?? "Système"}
                      </p>
                      {entry.details && (
                        <p className="text-[9.5px] text-muted">{entry.details}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {!journal.length && (
                <p className="text-[11px] text-muted">Aucune modification enregistrée.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {editOpen && (
        <KpiDialog
          hotelId={hotel.id}
          hotelNom={hotel.nom}
          years={kpiYears}
          defaultYear={annee}
          onClose={() => setEditOpen(false)}
          onSubmit={(payload) => {
            const result = upsertKpi(payload);
            toast({
              title: result.ok ? "Indicateur enregistré" : "Enregistrement bloqué",
              description: result.message,
              tone: result.ok ? "success" : "error",
            });
            if (result.ok) setEditOpen(false);
          }}
        />
      )}

      <div className="flex items-center gap-2 border-t border-line pt-3 text-[10px] text-faint">
        <History className="size-3.5" />
        Les versions antérieures d’un indicateur restent conservées dans l’historique de la base.
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  format,
  source,
  delta: deltaValue,
  deltaUnit = "%",
}: {
  label: string;
  value: number | null;
  format: (value: number) => string;
  source?: KpiYear["source"];
  delta?: number | null;
  deltaUnit?: "%" | "pts";
}) {
  return (
    <div className="bg-surface px-2.5 py-2">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
        {source && <ReliabilityBadge source={source} />}
      </div>
      <p
        className={cn(
          "mt-0.5 font-serif text-[19px] leading-tight tabular text-ink",
          source?.fiabilite === "N3" && "italic font-normal text-grey",
        )}
      >
        {value != null ? format(value) : "—"}
      </p>
      {deltaValue != null && (
        <p
          className={cn(
            "text-[9px] tabular",
            deltaValue >= 0 ? "text-green" : "text-danger",
          )}
        >
          {deltaValue >= 0 ? "+" : ""}
          {fmtNum(deltaValue, 1)} {deltaUnit} vs n−1
        </p>
      )}
    </div>
  );
}

function delta(current?: number | null, previous?: number | null) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function ordinal(value: number) {
  return value === 1 ? "1er" : `${value}e`;
}

function KpiDialog({
  hotelId,
  hotelNom,
  years,
  defaultYear,
  onClose,
  onSubmit,
}: {
  hotelId: string;
  hotelNom: string;
  years: KpiYear[];
  defaultYear: number;
  onClose: () => void;
  onSubmit: (payload: {
    hotelId: string;
    annee: number;
    values: Partial<Omit<KpiYear, "id" | "hotelId" | "annee" | "source">>;
    source: KpiYear["source"];
  }) => void;
}) {
  const options = YEARS.map((year) => ({
    value: String(year),
    label: `${year}${years.some((kpi) => kpi.annee === year) ? " · existe" : " · à créer"}`,
  }));
  const [annee, setAnnee] = React.useState(String(defaultYear));
  const existing = years.find((kpi) => String(kpi.annee) === annee);
  const [values, setValues] = React.useState({
    caTotal: existing?.caTotal ?? "",
    caHebergement: existing?.caHebergement ?? "",
    caFnb: existing?.caFnb ?? "",
    caAutres: existing?.caAutres ?? "",
    adr: existing?.adr ?? "",
    to: existing?.to != null ? (existing.to * 100).toFixed(1) : "",
    revpar: existing?.revpar ?? "",
    ebitdaPct: existing?.ebitdaPct != null ? (existing.ebitdaPct * 100).toFixed(1) : "",
    effectif: existing?.effectif ?? "",
    note: existing?.note ?? "",
  });
  const [source, setSource] = React.useState(existing?.source.source ?? "");
  const [dateSource, setDateSource] = React.useState(
    existing?.source.dateSource ?? new Date().toISOString().slice(0, 10),
  );
  const [fiabilite, setFiabilite] = React.useState<Fiabilite>(existing?.source.fiabilite ?? "N2");
  const [hypothese, setHypothese] = React.useState(existing?.source.hypothese ?? "");

  const changeYear = (value: string) => {
    setAnnee(value);
    const kpi = years.find((item) => String(item.annee) === value);
    setValues({
      caTotal: kpi?.caTotal ?? "",
      caHebergement: kpi?.caHebergement ?? "",
      caFnb: kpi?.caFnb ?? "",
      caAutres: kpi?.caAutres ?? "",
      adr: kpi?.adr ?? "",
      to: kpi?.to != null ? (kpi.to * 100).toFixed(1) : "",
      revpar: kpi?.revpar ?? "",
      ebitdaPct: kpi?.ebitdaPct != null ? (kpi.ebitdaPct * 100).toFixed(1) : "",
      effectif: kpi?.effectif ?? "",
      note: kpi?.note ?? "",
    });
    setSource(kpi?.source.source ?? "");
    setFiabilite(kpi?.source.fiabilite ?? "N2");
    setHypothese(kpi?.source.hypothese ?? "");
  };

  const update = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const numberOrNull = (value: string | number | null) =>
    value === "" || value === null ? null : Number(value);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      hotelId,
      annee: Number(annee),
      values: {
        caTotal: numberOrNull(values.caTotal),
        caHebergement: numberOrNull(values.caHebergement),
        caFnb: numberOrNull(values.caFnb),
        caAutres: numberOrNull(values.caAutres),
        adr: numberOrNull(values.adr),
        to: values.to === "" ? null : Number(values.to) / 100,
        revpar: numberOrNull(values.revpar),
        ebitdaPct: values.ebitdaPct === "" ? null : Number(values.ebitdaPct) / 100,
        effectif: numberOrNull(values.effectif),
        note: numberOrNull(values.note),
      },
      source: {
        source,
        dateSource,
        auteur: "Consultant Nova",
        fiabilite,
        hypothese: hypothese || undefined,
      },
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader
            title={`Compléter les indicateurs — ${hotelNom}`}
            description="Une source et une fiabilité sont obligatoires. Une valeur N1 ne peut jamais être remplacée par une estimation N2 ou N3."
          />
          <DialogBody>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Exercice" required>
                <Select value={annee} onChange={changeYear} options={options} />
              </Field>
              <Field label="ADR (€)" hint="prix moyen">
                <Input value={values.adr} onChange={(event) => update("adr", event.target.value)} type="number" step="0.01" />
              </Field>
              <Field label="TO (%)">
                <Input value={values.to} onChange={(event) => update("to", event.target.value)} type="number" step="0.1" />
              </Field>
              <Field label="RevPAR (€)">
                <Input value={values.revpar} onChange={(event) => update("revpar", event.target.value)} type="number" step="0.01" />
              </Field>
              <Field label="CA total (€)">
                <Input value={values.caTotal} onChange={(event) => update("caTotal", event.target.value)} type="number" />
              </Field>
              <Field label="CA hébergement (€)">
                <Input value={values.caHebergement} onChange={(event) => update("caHebergement", event.target.value)} type="number" />
              </Field>
              <Field label="CA F&B (€)">
                <Input value={values.caFnb} onChange={(event) => update("caFnb", event.target.value)} type="number" />
              </Field>
              <Field label="CA autres (€)">
                <Input value={values.caAutres} onChange={(event) => update("caAutres", event.target.value)} type="number" />
              </Field>
              <Field label="Marge EBITDA (%)">
                <Input value={values.ebitdaPct} onChange={(event) => update("ebitdaPct", event.target.value)} type="number" step="0.1" />
              </Field>
              <Field label="Effectif (ETP)">
                <Input value={values.effectif} onChange={(event) => update("effectif", event.target.value)} type="number" />
              </Field>
              <Field label="Note en ligne (/10)">
                <Input value={values.note} onChange={(event) => update("note", event.target.value)} type="number" step="0.1" />
              </Field>
            </div>
            <div className="mt-4 rounded-[2px] border border-line bg-paper/50 p-3">
              <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                Traçabilité de la valeur
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Source" required className="sm:col-span-2">
                  <Input
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    placeholder="Rapport annuel, Infogreffe, site hôtel…"
                    required
                  />
                </Field>
                <Field label="Date de la source" required>
                  <Input value={dateSource} onChange={(event) => setDateSource(event.target.value)} type="date" required />
                </Field>
                <Field label="Fiabilité" required>
                  <Select
                    value={fiabilite}
                    onChange={(value) => setFiabilite(value as Fiabilite)}
                    options={(Object.keys(RELIABILITY_META) as Fiabilite[]).map((key) => ({
                      value: key,
                      label: `${key} · ${RELIABILITY_META[key].description}`,
                    }))}
                  />
                </Field>
                <Field label="Auteur">
                  <Input value="Consultant Nova" readOnly className="text-muted" />
                </Field>
                <Field label="Hypothèse (N3)" className="sm:col-span-3">
                  <Textarea
                    value={hypothese}
                    onChange={(event) => setHypothese(event.target.value)}
                    placeholder="Méthode de calcul ou hypothèse retenue…"
                  />
                </Field>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
