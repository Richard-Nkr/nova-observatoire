"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Download,
  GitBranch,
  Layers3,
  MapPin,
  Star,
  Target,
  UserRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, DefinitionList, EmptyState, PageHeader, SectionTitle, StatTile } from "@/components/ui/misc";
import { TableShell, Td, Th } from "@/components/ui/table";
import { CompetitiveMap } from "@/components/competitive-map";
import { PositioningChart, SECTOR_COLORS, type PositioningRow } from "@/components/benchmark/positioning-chart";
import { BenchmarkDialog } from "@/components/benchmark/benchmark-dialog";
import {
  benchmarkHotels,
  benchmarkOverview,
  benchmarkSectors,
  benchmarkSectorStats,
  benchmarkSourceRows,
  orderedBenchmarkHotels,
} from "@/lib/benchmark";
import { exportBenchmarkPptx } from "@/lib/exports";
import { kpiFor } from "@/lib/stats";
import { CATEGORY_LABEL, DEMO_LABEL } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtEuro, fmtInt, fmtNum, fmtTo } from "@/lib/format";
import { ReliabilityBadge } from "@/components/reliability";

export default function BenchmarkDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { state, setBasket, setReference, addAudit } = useStore();
  const { toast } = useToast();
  const [exporting, setExporting] = React.useState(false);
  const [versionOpen, setVersionOpen] = React.useState(false);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);

  const benchmark = state.benchmarks.find((item) => item.id === params.id);
  const panel = React.useMemo(
    () => (benchmark ? benchmarkHotels(benchmark, state.hotels) : []),
    [benchmark, state.hotels],
  );
  const ordered = React.useMemo(
    () =>
      benchmark
        ? orderedBenchmarkHotels(benchmark, state.hotels, state.kpis, benchmark.annee)
        : [],
    [benchmark, state.hotels, state.kpis],
  );
  const overview = React.useMemo(
    () => (benchmark ? benchmarkOverview(benchmark, state.hotels, state.kpis, benchmark.annee) : null),
    [benchmark, state.hotels, state.kpis],
  );
  const sectors = React.useMemo(
    () => (benchmark ? benchmarkSectors(benchmark, state.hotels) : []),
    [benchmark, state.hotels],
  );
  const sectorStats = React.useMemo(
    () =>
      benchmark
        ? sectors.map((sector) => benchmarkSectorStats(sector, state.hotels, state.kpis, benchmark.annee))
        : [],
    [benchmark, sectors, state.hotels, state.kpis],
  );
  const sources = React.useMemo(
    () => (benchmark ? benchmarkSourceRows(benchmark, state.hotels, state.kpis) : []),
    [benchmark, state.hotels, state.kpis],
  );
  const positioningRows = React.useMemo<PositioningRow[]>(() => {
    if (!benchmark) return [];
    return ordered
      .map((hotel, index) => {
        const kpi = kpiFor(hotel.id, state.kpis, benchmark.annee);
        if (!kpi || kpi.adr == null || kpi.note == null) return null;
        const secteur = sectors.find((sector) => sector.hotelIds.includes(hotel.id))?.nom ?? "Panel";
        return {
          hotel,
          index: index + 1,
          adr: kpi.adr,
          note: kpi.note,
          revpar: kpi.revpar,
          keys: hotel.cles,
          secteur,
        } satisfies PositioningRow;
      })
      .filter((row): row is PositioningRow => Boolean(row));
  }, [benchmark, ordered, sectors, state.kpis]);

  const reference = panel.find((hotel) => hotel.id === benchmark?.referenceId);

  if (!benchmark || !overview) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={<Layers3 className="size-5" />}
          title="Benchmark introuvable"
          description="Ce benchmark a peut-être été supprimé ou remplacé par une autre version."
          action={<Link href="/benchmarks"><Button variant="outline"><ArrowLeft className="size-3.5" />Retour aux benchmarks</Button></Link>}
        />
      </Card>
    );
  }

  const openInComparator = () => {
    setBasket(ordered.map((hotel) => hotel.id));
    setReference(benchmark.referenceId);
    addAudit({
      action: "Ouverture d’un benchmark dans le comparateur",
      target: benchmark.nom,
      details: `${ordered.length} hôtels · exercice ${benchmark.annee}`,
    });
    toast({ title: "Panel chargé", description: `${ordered.length} hôtels dans le comparateur.`, tone: "success" });
    router.push("/comparateur");
  };

  const capture = async (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return null;
    return toPng(ref.current, {
      pixelRatio: 2,
      backgroundColor: "#fffefa",
      cacheBust: true,
      style: { margin: "0" },
    });
  };

  const exportDeck = async () => {
    setExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const [mapDataUrl, positioningDataUrl] = await Promise.all([
        capture(mapRef),
        capture(chartRef),
      ]);
      await exportBenchmarkPptx({
        benchmark,
        hotels: state.hotels,
        kpis: state.kpis,
        mapDataUrl,
        positioningDataUrl,
      });
      addAudit({
        action: "Export PowerPoint d’un benchmark",
        target: benchmark.nom,
        details: `Version ${benchmark.version} · ${ordered.length} hôtels`,
      });
      toast({ title: "Présentation générée", description: `${benchmark.nom} · version ${benchmark.version}.`, tone: "success" });
    } catch (error) {
      toast({
        title: "Export impossible",
        description: error instanceof Error ? error.message : "Erreur inattendue pendant la génération.",
        tone: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={
          <Link href="/benchmarks" className="mb-1.5 inline-flex items-center gap-1 text-[10.5px] font-medium text-muted transition-colors hover:text-ink">
            <ArrowLeft className="size-3" /> Benchmarks
          </Link>
        }
        eyebrow="Benchmark de mission"
        title={benchmark.nom}
        description={`${benchmark.client} · ${benchmark.mission}`}
        actions={
          <>
            <Button variant="outline" onClick={openInComparator}>
              <ArrowUpRight className="size-3.5" />
              Ouvrir dans le comparateur
            </Button>
            <Button variant="outline" onClick={() => setVersionOpen(true)}>
              <GitBranch className="size-3.5" />
              Nouvelle version
            </Button>
            <Button variant="accent" onClick={exportDeck} disabled={exporting}>
              <Download className="size-3.5" />
              {exporting ? "Génération…" : "Exporter PowerPoint"}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[3px] border border-line bg-surface px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted"><UserRound className="size-3" />{benchmark.consultant}</span>
        <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted"><CalendarDays className="size-3" />{fmtDate(benchmark.date)}</span>
        <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted"><Layers3 className="size-3" />{sectors.length} secteur{sectors.length > 1 ? "s" : ""}</span>
        <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted"><Target className="size-3" />Référence : {reference?.nom ?? "non définie"}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Badge tone="navy">v{benchmark.version}</Badge>
          <Badge tone="outline">Exercice {benchmark.annee}</Badge>
          <Badge tone="accent">Données démo</Badge>
        </span>
        <span className="text-[9.5px] text-faint">Mis à jour le {fmtDateTime(benchmark.updatedAt)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        <StatTile label="Acteurs" value={fmtInt(overview.count)} sub={`${sectors.length} secteurs`} />
        <StatTile label="Clés" value={fmtInt(overview.cles)} sub="panel cumulé" />
        <StatTile label="CA cumulé" value={overview.caTotal != null ? fmtEuro(overview.caTotal, true) : "—"} sub="valeur déclarée" />
        <StatTile label="ADR moyen" value={overview.adr != null ? fmtEuro(overview.adr) : "—"} sub="non pondéré" />
        <StatTile label="RevPAR moyen" value={overview.revpar != null ? fmtEuro(overview.revpar) : "—"} sub="non pondéré" />
        <StatTile label="Note moyenne" value={overview.note != null ? `${fmtNum(overview.note, 1)}/10` : "—"} sub={overview.ebitdaPct != null ? `EBITDA ${fmtTo(overview.ebitdaPct)}` : "EBITDA non renseigné"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <SectionTitle hint={`${ordered.length} acteurs numérotés · repères de catégorie`} className="mb-0">Carte du panel</SectionTitle>
            <Badge tone="outline"><MapPin className="mr-1 size-3" />France métropolitaine</Badge>
          </div>
          <div ref={mapRef} className="p-3">
            <CompetitiveMap
              hotels={ordered}
              kpis={state.kpis}
              annee={benchmark.annee}
              title={benchmark.nom}
              contextHotels={state.hotels}
              className="rounded-[2px] border border-line"
            />
          </div>
          <div className="border-t border-line px-4 py-2 text-[9.5px] text-faint">
            Numérotation commune à la carte, au tableau du panel et à la présentation exportée.
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <SectionTitle hint="Périmètre figé de la mission">Cadrage</SectionTitle>
            <DefinitionList
              columns={1}
              items={[
                { label: "Client", value: benchmark.client },
                { label: "Mission", value: benchmark.mission },
                { label: "Actif de référence", value: reference ? reference.nom : "Non défini" },
                { label: "Créé le", value: fmtDate(benchmark.createdAt) },
                { label: "Version", value: `v${benchmark.version} — ${fmtDate(benchmark.updatedAt)}` },
              ]}
            />
          </Card>
          <Card className="p-4">
            <SectionTitle hint="Maille d’analyse">Secteurs</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {sectors.map((sector, index) => (
                <span key={sector.nom} className="inline-flex items-center gap-1.5 rounded-[2px] border border-line bg-paper/60 px-2 py-1 text-[10.5px] text-ink-soft">
                  <span className="size-1.5 rounded-full" style={{ background: SECTOR_COLORS[index % SECTOR_COLORS.length] }} />
                  {sector.nom}
                  <span className="tabular text-faint">{sector.hotelIds.length}</span>
                </span>
              ))}
            </div>
            {benchmark.notes && (
              <p className="mt-3 border-t border-line pt-2.5 text-[10.5px] leading-relaxed text-muted">{benchmark.notes}</p>
            )}
          </Card>
        </div>
      </div>

      <Card className="p-0">
        <div className="border-b border-line px-4 py-3">
          <SectionTitle hint="Moyennes non pondérées · valeurs absentes exclues" className="mb-0">Synthèse sectorielle</SectionTitle>
        </div>
        <TableShell>
          <thead>
            <tr>
              <Th>Secteur</Th>
              <Th align="right">Hôtels</Th>
              <Th align="right">Clés</Th>
              <Th align="right">CA cumulé</Th>
              <Th align="right">ADR moyen</Th>
              <Th align="right">TO moyen</Th>
              <Th align="right">RevPAR moyen</Th>
              <Th align="right">Note</Th>
              <Th>Leader RevPAR</Th>
            </tr>
          </thead>
          <tbody>
            {sectorStats.map((stat, index) => (
              <tr key={stat.nom} className="border-t border-line/80">
                <Td>
                  <span className="inline-flex items-center gap-2 font-medium text-ink">
                    <span className="size-2 rounded-full" style={{ background: SECTOR_COLORS[index % SECTOR_COLORS.length] }} />
                    {stat.nom}
                  </span>
                </Td>
                <Td align="right">{stat.count}</Td>
                <Td align="right">{fmtInt(stat.cles)}</Td>
                <Td align="right">{stat.caTotal != null ? fmtEuro(stat.caTotal, true) : "—"}</Td>
                <Td align="right">{stat.adr != null ? fmtEuro(stat.adr) : "—"}</Td>
                <Td align="right">{stat.to != null ? fmtTo(stat.to) : "—"}</Td>
                <Td align="right" className="font-medium text-ink">{stat.revpar != null ? fmtEuro(stat.revpar) : "—"}</Td>
                <Td align="right">{stat.note != null ? `${fmtNum(stat.note, 1)}/10` : "—"}</Td>
                <Td>
                  {stat.lead ? (
                    <span className="text-[10.5px] text-ink-soft">
                      {stat.lead.hotel.nom} <span className="tabular text-faint">· {fmtEuro(stat.lead.revpar)}</span>
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </Td>
              </tr>
            ))}
            <tr className="border-t border-line-strong bg-paper/50">
              <Td className="font-medium text-ink">Panel complet</Td>
              <Td align="right" className="font-medium text-ink">{overview.count}</Td>
              <Td align="right" className="font-medium text-ink">{fmtInt(overview.cles)}</Td>
              <Td align="right" className="font-medium text-ink">{overview.caTotal != null ? fmtEuro(overview.caTotal, true) : "—"}</Td>
              <Td align="right" className="font-medium text-ink">{overview.adr != null ? fmtEuro(overview.adr) : "—"}</Td>
              <Td align="right" className="font-medium text-ink">{overview.to != null ? fmtTo(overview.to) : "—"}</Td>
              <Td align="right" className="font-medium text-ink">{overview.revpar != null ? fmtEuro(overview.revpar) : "—"}</Td>
              <Td align="right" className="font-medium text-ink">{overview.note != null ? `${fmtNum(overview.note, 1)}/10` : "—"}</Td>
              <Td />
            </tr>
          </tbody>
        </TableShell>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-4">
          <SectionTitle hint={`${positioningRows.length} acteurs avec ADR et note renseignés`}>Positionnement prix × qualité</SectionTitle>
          <div ref={chartRef}>
            <PositioningChart
              rows={positioningRows}
              sectors={sectors.map((sector) => sector.nom)}
              meanAdr={overview.adr}
              meanNote={overview.note}
            />
          </div>
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <SectionTitle hint="Ordre et numérotation de la carte" className="mb-0">Panel détaillé</SectionTitle>
            <span className="text-[9.5px] text-faint">Exercice {benchmark.annee}</span>
          </div>
          <TableShell className="max-h-[430px]">
            <thead>
              <tr>
                <Th className="w-8">#</Th>
                <Th>Hôtel</Th>
                <Th>Ville</Th>
                <Th>Cat.</Th>
                <Th align="right">Clés</Th>
                <Th align="right">ADR</Th>
                <Th align="right">RevPAR</Th>
                <Th align="right">Note</Th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((hotel, index) => {
                const kpi = kpiFor(hotel.id, state.kpis, benchmark.annee);
                return (
                  <tr key={hotel.id} className="border-t border-line/80 hover:bg-paper/45">
                    <Td className="tabular text-faint">{index + 1}</Td>
                    <Td>
                      <Link href={`/hotels/${hotel.id}`} className="group inline-flex items-center gap-1.5 font-medium text-ink hover:text-accent">
                        {hotel.id === benchmark.referenceId && <Star className="size-3 fill-accent text-accent" />}
                        {hotel.nom}
                        <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                      <p className="text-[9.5px] text-faint">{sectors.find((sector) => sector.hotelIds.includes(hotel.id))?.nom}</p>
                    </Td>
                    <Td>{hotel.ville}</Td>
                    <Td><Badge tone="outline">{CATEGORY_LABEL[hotel.categorie]}</Badge></Td>
                    <Td align="right">{fmtInt(hotel.cles)}</Td>
                    <Td align="right">{kpi?.adr != null ? fmtEuro(kpi.adr) : "—"}</Td>
                    <Td align="right" className="font-medium text-ink">{kpi?.revpar != null ? fmtEuro(kpi.revpar) : "—"}</Td>
                    <Td align="right">{kpi?.note != null ? fmtNum(kpi.note, 1) : "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        </Card>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <SectionTitle hint="Fiche et indicateur annuel · aucune valeur orpheline" className="mb-0">Annexe de sources</SectionTitle>
          <span className="text-[9.5px] text-faint">N1 vérifié · N2 recherche · N3 hypothèse</span>
        </div>
        <TableShell>
          <thead>
            <tr>
              <Th>Hôtel</Th>
              <Th>Source fiche</Th>
              <Th>Fiab. fiche</Th>
              <Th>Source KPI</Th>
              <Th>Fiab. KPI</Th>
              <Th>Date</Th>
              <Th>Auteur</Th>
              <Th>Hypothèse</Th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={`${source.nom}-${source.kpi}`} className="border-t border-line/80">
                <Td>
                  <span className="font-medium text-ink">{source.nom}</span>
                  <p className="text-[9.5px] text-faint">{source.ville} · {source.categorie}</p>
                </Td>
                <Td className="max-w-[220px] whitespace-normal text-[10.5px]">{source.fiche}</Td>
                <Td><ReliabilityBadge source={{ source: source.fiche, fiabilite: source.ficheFiabilite as "N1" | "N2" | "N3", dateSource: source.ficheDate, auteur: source.ficheAuteur }} /></Td>
                <Td className="max-w-[220px] whitespace-normal text-[10.5px]">{source.kpi}</Td>
                <Td><ReliabilityBadge source={{ source: source.kpi, fiabilite: source.kpiFiabilite as "N1" | "N2" | "N3", dateSource: source.kpiDate, auteur: source.kpiAuteur }} /></Td>
                <Td>{fmtDate(source.kpiDate)}</Td>
                <Td>{source.kpiAuteur}</Td>
                <Td className="max-w-[260px] whitespace-normal text-[10px] italic text-muted">{source.hypothese || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[9.5px] text-faint">
        <span>{DEMO_LABEL} · benchmark fictif à usage de démonstration · {ordered.length} acteurs · exercice {benchmark.annee}</span>
        <span>Méthode : panel du {fmtDate(benchmark.date)} · sources et fiabilité conservées dans chaque fiche.</span>
      </div>

      {versionOpen && (
        <BenchmarkDialog
          open={versionOpen}
          onOpenChange={setVersionOpen}
          initial={benchmark}
        />
      )}
    </div>
  );
}
