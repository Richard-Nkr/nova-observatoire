"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  FileText,
  Layers3,
  Plus,
  Target,
  Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader, StatTile } from "@/components/ui/misc";
import { BenchmarkDialog } from "@/components/benchmark/benchmark-dialog";
import { benchmarkHotels, benchmarkOverview } from "@/lib/benchmark";
import { fmtDate, fmtEuro, fmtInt } from "@/lib/format";
import { DEMO_LABEL } from "@/lib/constants";

export default function BenchmarksPage() {
  const { state } = useStore();
  const [creating, setCreating] = React.useState(false);
  const benchmarks = React.useMemo(
    () => [...state.benchmarks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state.benchmarks],
  );
  const uniqueHotels = new Set(benchmarks.flatMap((benchmark) => benchmark.hotelIds)).size;
  const clients = new Set(benchmarks.map((benchmark) => benchmark.client)).size;
  const latest = benchmarks[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Analyser"
        title="Benchmarks"
        description="Des panels versionnés, sectorisés et rattachés à une mission. Chaque benchmark est réexploitable et exportable en présentation."
        actions={
          <Button variant="accent" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            Nouveau benchmark
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Benchmarks" value={fmtInt(benchmarks.length)} sub={`${clients} client${clients > 1 ? "s" : ""}`} />
        <StatTile label="Hôtels couverts" value={fmtInt(uniqueHotels)} sub="toutes missions confondues" />
        <StatTile label="Secteurs" value={fmtInt(benchmarks.reduce((total, item) => total + item.secteurs.length, 0))} sub="mailles d’analyse" />
        <StatTile
          label="Dernière mise à jour"
          value={latest ? fmtDate(latest.updatedAt) : "—"}
          sub={latest ? `v${latest.version} · ${latest.nom}` : "aucun benchmark"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_290px]">
        <div className="space-y-3">
          {benchmarks.length === 0 ? (
            <Card className="p-0">
              <EmptyState
                icon={<Layers3 className="size-5" />}
                title="Aucun benchmark"
                description="Composez un panel dans le comparateur ou une sélection sur la carte, puis créez votre premier benchmark de mission."
                action={<Button variant="accent" onClick={() => setCreating(true)}><Plus className="size-3.5" />Créer un benchmark</Button>}
              />
            </Card>
          ) : (
            benchmarks.map((benchmark) => {
              const panel = benchmarkHotels(benchmark, state.hotels);
              const overview = benchmarkOverview(benchmark, state.hotels, state.kpis, benchmark.annee);
              const reference = panel.find((hotel) => hotel.id === benchmark.referenceId);
              return (
                <Link
                  key={benchmark.id}
                  href={`/benchmarks/${benchmark.id}`}
                  className="group block rounded-[3px] border border-line bg-surface transition-colors hover:border-line-strong"
                >
                  <div className="flex items-start gap-4 p-4">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[2px] border border-line bg-paper text-accent">
                      <Layers3 className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="text-[18px] font-semibold leading-tight tracking-[-0.02em] text-ink">{benchmark.nom}</h2>
                        <Badge tone="navy">v{benchmark.version}</Badge>
                        <Badge tone="outline">{benchmark.annee}</Badge>
                        {benchmark.version > 1 && <Badge tone="accent">versionné</Badge>}
                      </div>
                      <p className="mt-1 text-[11.5px] text-muted">
                        {benchmark.client} · {benchmark.mission}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px] text-faint">
                        <span className="inline-flex items-center gap-1"><Building2 className="size-3" />{overview.count} hôtels</span>
                        <span className="inline-flex items-center gap-1"><Layers3 className="size-3" />{benchmark.secteurs.length} secteurs</span>
                        <span className="inline-flex items-center gap-1"><Target className="size-3" />{reference?.nom ?? "référence non définie"}</span>
                        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{fmtDate(benchmark.date)}</span>
                        <span className="inline-flex items-center gap-1"><Users className="size-3" />{benchmark.consultant}</span>
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-faint">CA cumulé</p>
                      <p className="mt-1 tabular text-[19px] font-semibold tracking-[-0.02em] text-ink">{overview.caTotal != null ? fmtEuro(overview.caTotal, true) : "—"}</p>
                      <p className="mt-0.5 text-[9.5px] text-faint">{overview.cles > 0 ? `${fmtInt(overview.cles)} clés` : "clés non renseignées"}</p>
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                        Ouvrir <ArrowUpRight className="size-3" />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 border-t border-line bg-paper/35 px-4 py-2 text-[10px] text-faint">
                    <span>CA cumulé <strong className="ml-1 tabular font-medium text-ink-soft">{overview.caTotal != null ? fmtEuro(overview.caTotal, true) : "—"}</strong></span>
                    <span>CA cumulé <strong className="ml-1 tabular font-medium text-ink-soft">{overview.caTotal != null ? fmtEuro(overview.caTotal, true) : "—"}</strong></span>
                    <span>CA / clé <strong className="ml-1 tabular font-medium text-ink-soft">{overview.caTotal != null && overview.cles ? fmtEuro(overview.caTotal / overview.cles) : "—"}</strong></span>
                    <span className="ml-auto hidden sm:inline">Mis à jour le {fmtDate(benchmark.updatedAt)}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <aside className="space-y-3">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="size-3.5 text-accent" />
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Méthode</h2>
            </div>
            <ol className="space-y-2.5">
              {[
                "Composer le panel depuis le panier ou une sélection enregistrée.",
                "Choisir une référence et les indicateurs de la mission.",
                "Sectoriser par ville, catégorie ou gamme.",
                "Contrôler les sources, puis exporter la présentation.",
              ].map((item, index) => (
                <li key={item} className="flex gap-2 text-[11px] leading-relaxed text-ink-soft">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-line text-[8.5px] tabular text-muted">{index + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </Card>
          <Card className="border-accent/25 bg-accent-soft/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">Traçabilité</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              Chaque benchmark fige un exercice, un panel et une version. Les valeurs manquantes restent vides ; les estimations N3 sont signalées comme hypothèses.
            </p>
          </Card>
          <p className="px-1 text-[9.5px] leading-relaxed text-faint">{DEMO_LABEL} · source BDD transactions hôtelières compilée.</p>
        </aside>
      </div>

      {creating && (
        <BenchmarkDialog
          open={creating}
          onOpenChange={setCreating}
        />
      )}
    </div>
  );
}
