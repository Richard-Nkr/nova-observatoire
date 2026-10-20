"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Layers3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { COMPARATOR_KPIS, KPI_LABELS, MISSIONS, YEARS } from "@/lib/constants";
import { buildSectors, type SectorizationMode } from "@/lib/benchmark";
import type { Benchmark, KpiKey } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

const DEFAULT_KPIS: KpiKey[] = ["caTotal", "caParCle", "cles"];

export function BenchmarkDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Benchmark | null;
}) {
  const router = useRouter();
  const { state, currentUser, saveBenchmark } = useStore();
  const { toast } = useToast();
  const [nom, setNom] = React.useState(initial?.nom ?? "");
  const [client, setClient] = React.useState(initial?.client ?? "");
  const [mission, setMission] = React.useState(initial?.mission ?? MISSIONS[1] ?? "");
  const [date, setDate] = React.useState(initial?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [annee, setAnnee] = React.useState(initial?.annee ?? 2025);
  const [source, setSource] = React.useState(
    initial ? "initial" : state.basket.length >= 2 ? "basket" : state.savedSelections[0] ? `sel:${state.savedSelections[0].id}` : "basket",
  );
  const [panelIds, setPanelIds] = React.useState<string[]>(
    initial ? initial.hotelIds : state.basket.length >= 2 ? state.basket : state.savedSelections[0]?.hotelIds ?? [],
  );
  const [referenceId, setReferenceId] = React.useState(initial?.referenceId ?? panelIds[0] ?? null);
  const [kpis, setKpis] = React.useState<KpiKey[]>(initial?.kpis ?? DEFAULT_KPIS);
  const [mode, setMode] = React.useState<SectorizationMode>("ville");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");

  const hotelMap = React.useMemo(
    () => new Map(state.hotels.map((hotel) => [hotel.id, hotel])),
    [state.hotels],
  );
  const panelHotels = panelIds
    .map((id) => hotelMap.get(id))
    .filter((hotel): hotel is NonNullable<typeof hotel> => Boolean(hotel));
  const sectors = buildSectors(panelHotels, mode);
  const referenceHotels = panelHotels.map((hotel) => ({ value: hotel.id, label: `${hotel.nom} — ${hotel.ville}` }));

  const sourceOptions = [
    ...(initial ? [{ value: "initial", label: `Panel enregistré · ${initial.hotelIds.length} hôtels` }] : []),
    { value: "basket", label: `Panier actuel · ${state.basket.length} hôtel(s)` },
    ...state.savedSelections.map((selection) => ({
      value: `sel:${selection.id}`,
      label: `${selection.nom} · ${selection.hotelIds.length} hôtels`,
    })),
  ];

  const changeSource = (value: string) => {
    setSource(value);
    const ids =
      value === "initial"
        ? initial?.hotelIds ?? []
        : value === "basket"
          ? state.basket
          : state.savedSelections.find((selection) => `sel:${selection.id}` === value)?.hotelIds ?? [];
    setPanelIds(ids);
    setReferenceId((current) => (current && ids.includes(current) ? current : ids[0] ?? null));
  };

  const toggleKpi = (key: KpiKey) => {
    setKpis((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const submit = () => {
    if (!nom.trim() || !client.trim()) {
      toast({ title: "Champs manquants", description: "Le nom du benchmark et le client sont obligatoires.", tone: "error" });
      return;
    }
    if (panelHotels.length < 2) {
      toast({ title: "Panel insuffisant", description: "Sélectionnez au moins deux hôtels.", tone: "error" });
      return;
    }
    if (!referenceId || !panelIds.includes(referenceId)) {
      toast({ title: "Référence absente", description: "Choisissez un actif de référence dans le panel.", tone: "error" });
      return;
    }
    if (!kpis.length) {
      toast({ title: "Indicateurs absents", description: "Sélectionnez au moins un indicateur.", tone: "error" });
      return;
    }
    const created = saveBenchmark({
      nom: nom.trim(),
      client: client.trim(),
      mission,
      date,
      consultant: currentUser.nom,
      hotelIds: panelHotels.map((hotel) => hotel.id),
      referenceId,
      kpis,
      secteurs: buildSectors(panelHotels, mode),
      annee,
      notes: notes.trim(),
    });
    toast({
      title: initial ? "Nouvelle version enregistrée" : "Benchmark créé",
      description: `${created.nom} · version ${created.version}.`,
      tone: "success",
    });
    onOpenChange(false);
    router.push(`/benchmarks/${created.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader
          title={initial ? "Nouvelle version du benchmark" : "Créer un benchmark"}
          description="Un panel daté, des secteurs explicites, des indicateurs traçables. Le benchmark est versionné et réutilisable."
        />
        <DialogBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom du benchmark" required className="sm:col-span-2">
              <Input value={nom} onChange={(event) => setNom(event.target.value)} placeholder="Benchmark Courbevoie — repositionnement 4*" />
            </Field>
            <Field label="Client" required>
              <Input value={client} onChange={(event) => setClient(event.target.value)} placeholder="Foncière Beaupré" />
            </Field>
            <Field label="Mission">
              <Select value={mission} onChange={setMission} options={MISSIONS.map((item) => ({ value: item, label: item }))} />
            </Field>
            <Field label="Date de la mission" required>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Exercice de référence">
              <Select value={String(annee)} onChange={(value) => setAnnee(Number(value))} options={YEARS.map((year) => ({ value: String(year), label: String(year) }))} />
            </Field>
            <Field label="Consultant">
              <Input value={currentUser.nom} readOnly />
            </Field>
            <Field label="Panel source" hint="Panier ou sélection enregistrée">
              <Select value={source} onChange={changeSource} options={sourceOptions} />
            </Field>
            <Field label="Actif de référence" required>
              <Select
                value={referenceId ?? ""}
                onChange={setReferenceId}
                options={referenceHotels}
                placeholder="Aucun hôtel dans le panel"
              />
            </Field>
          </div>

          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Panel & sectorisation</h3>
                <p className="mt-0.5 text-[11px] text-faint">{fmtInt(panelHotels.length)} hôtels · {fmtInt(panelHotels.reduce((total, hotel) => total + hotel.cles, 0))} clés</p>
              </div>
              <Select
                value={mode}
                onChange={(value) => setMode(value as SectorizationMode)}
                options={[
                  { value: "ville", label: "Par ville" },
                  { value: "categorie", label: "Par catégorie" },
                  { value: "gamme", label: "Par gamme" },
                  { value: "aucune", label: "Secteur unique" },
                ]}
                className="w-[170px]"
                aria-label="Mode de sectorisation"
              />
            </div>
            <div className="rounded-[3px] border border-line bg-paper/50 p-2.5">
              <div className="flex flex-wrap gap-1.5">
                {sectors.map((sector) => (
                  <span key={sector.nom} className="inline-flex items-center gap-1 rounded-[2px] border border-line bg-surface px-2 py-1 text-[10.5px] text-ink-soft">
                    <Layers3 className="size-3 text-accent" />
                    {sector.nom}
                    <span className="tabular text-faint">{sector.hotelIds.length}</span>
                  </span>
                ))}
                {!sectors.length && <span className="text-[11px] text-faint">Ajoutez des hôtels au panier pour composer le panel.</span>}
              </div>
            </div>
          </section>

          <section className="mt-5">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Indicateurs du benchmark</h3>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {COMPARATOR_KPIS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleKpi(key)}
                  className={cn(
                    "flex items-center gap-2 rounded-[2px] border px-2 py-1.5 text-left text-[11px] transition-colors",
                    kpis.includes(key)
                      ? "border-navy/30 bg-navy/[0.045] text-ink"
                      : "border-line bg-surface text-muted hover:border-line-strong",
                  )}
                >
                  <span className={cn("flex size-4 items-center justify-center rounded-[2px] border", kpis.includes(key) ? "border-navy bg-navy text-white" : "border-line-strong bg-surface")}>
                    {kpis.includes(key) && <Check className="size-3" />}
                  </span>
                  {KPI_LABELS[key].short}
                </button>
              ))}
            </div>
          </section>

          <Field label="Notes de méthode" className="mt-5">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Hypothèses, périmètre, points de vigilance…" />
          </Field>

          <p className="mt-4 border-t border-line pt-3 text-[10px] leading-relaxed text-faint">
            Enregistrer avec un nom et un client existants crée une nouvelle version. Les valeurs manquantes restent vides ; aucune estimation n’est ajoutée automatiquement.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="accent" onClick={submit} disabled={panelHotels.length < 2}>
            {initial ? "Enregistrer la version" : "Créer le benchmark"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
