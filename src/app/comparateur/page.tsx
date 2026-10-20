"use client";

import * as React from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { toPng } from "html-to-image";
import {
  ArrowRight,
  Building2,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Image as ImageIcon,
  Layers3,
  Pencil,
  Plus,
  Presentation,
  Trash2,
  Users,
} from "lucide-react";
import { PageHeader, Card, StatTile, EmptyState, Tabs, SectionTitle } from "@/components/ui/misc";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, CategoryBadge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { CURRENT_DATA_YEAR, DEMO_LABEL, KPI_LABELS, YEARS } from "@/lib/constants";
import { fmtEuro, fmtInt } from "@/lib/format";
import { mean, sum } from "@/lib/stats";
import {
  buildComparisonColumns,
  comparisonValues,
} from "@/lib/comparison";
import {
  downloadImageDataUrl,
  exportComparatorPptx,
  exportComparatorXlsx,
} from "@/lib/exports";
import { CompareTable, ComparisonStatsTable } from "@/components/comparator/compare-table";
import { AddHotelDialog } from "@/components/comparator/add-hotel-dialog";
import { PanelPickerDialog } from "@/components/comparator/panel-picker-dialog";
import { ManualReferenceDialog } from "@/components/comparator/manual-reference-dialog";
import {
  NormalizedRadar,
  PriceOccupancyScatter,
  RankedBars,
  ReferenceGapLine,
} from "@/components/comparator/comparison-charts";
import { EquipmentMatrix } from "@/components/comparator/equipment-matrix";
import { CompetitiveMap } from "@/components/competitive-map";
import { ReliabilityBadge } from "@/components/reliability";
import type { ManualReference } from "@/lib/types";

const TABS = [
  { value: "synthese", label: "Synthèse comparative" },
  { value: "graphiques", label: "Graphiques & carte" },
  { value: "equipements", label: "Équipements" },
];

function ExportMenu({
  onExcel,
  onPowerPoint,
  onPng,
  busy,
}: {
  onExcel: () => void;
  onPowerPoint: () => void;
  onPng: () => void;
  busy: string | null;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="outline" disabled={Boolean(busy)}>
          <Download className="size-3.5" />
          {busy ?? "Exporter"}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[250px] rounded-[3px] border border-line-strong bg-surface p-1 shadow-[0_12px_40px_rgba(15,36,51,0.18)]"
        >
          <Popover.Close asChild>
            <button
              type="button"
              onClick={onExcel}
              className="flex w-full items-start gap-2 rounded-[2px] px-2 py-2 text-left hover:bg-black/[0.04]"
            >
              <FileSpreadsheet className="mt-0.5 size-3.5 text-green" />
              <span>
                <span className="block text-[11.5px] font-medium text-ink">Classeur Excel</span>
                <span className="block text-[9.5px] text-faint">Valeurs, écarts, équipements, sources</span>
              </span>
            </button>
          </Popover.Close>
          <Popover.Close asChild>
            <button
              type="button"
              onClick={onPowerPoint}
              className="flex w-full items-start gap-2 rounded-[2px] px-2 py-2 text-left hover:bg-black/[0.04]"
            >
              <Presentation className="mt-0.5 size-3.5 text-accent" />
              <span>
                <span className="block text-[11.5px] font-medium text-ink">Présentation PowerPoint</span>
                <span className="block text-[9.5px] text-faint">Synthèse, positionnement, carte, sources</span>
              </span>
            </button>
          </Popover.Close>
          <Popover.Close asChild>
            <button
              type="button"
              onClick={onPng}
              className="flex w-full items-start gap-2 rounded-[2px] px-2 py-2 text-left hover:bg-black/[0.04]"
            >
              <ImageIcon className="mt-0.5 size-3.5 text-navy" />
              <span>
                <span className="block text-[11.5px] font-medium text-ink">Carte concurrentielle PNG</span>
                <span className="block text-[9.5px] text-faint">Image haute définition de la carte</span>
              </span>
            </button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default function ComparateurPage() {
  const { state, currentUser, setBasket, setReference, toggleBasket, addAudit } = useStore();
  const { toast } = useToast();
  const [annee, setAnnee] = React.useState(CURRENT_DATA_YEAR);
  const [tab, setTab] = React.useState("synthese");
  const [manualReference, setManualReference] = React.useState<ManualReference | null>(null);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [panelsOpen, setPanelsOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const mapRef = React.useRef<HTMLDivElement>(null);

  const hotelMap = React.useMemo(
    () => new Map(state.hotels.map((hotel) => [hotel.id, hotel])),
    [state.hotels],
  );
  const panelHotels = state.basket
    .map((id) => hotelMap.get(id))
    .filter((hotel): hotel is NonNullable<typeof hotel> => Boolean(hotel));
  const referenceId =
    state.referenceId && panelHotels.some((hotel) => hotel.id === state.referenceId)
      ? state.referenceId
      : panelHotels[0]?.id ?? null;

  const columns = buildComparisonColumns({
    hotels: panelHotels,
    kpis: state.kpis,
    annee,
    referenceId,
    manualReference,
  });
  const reference = columns[0] ?? null;
  const totalKeys = sum(columns.map((column) => column.cles));
  const totalCa = sum(
    columns
      .map((column) => column.values.caTotal)
      .filter((value): value is number => value != null),
  );
  const caParCleAverage = mean(comparisonValues(columns, "caParCle"));
  const documentedCa = columns.filter((column) => column.values.caTotal != null).length;
  const ready = columns.length >= 2;

  const chooseReference = (id: string) => {
    setManualReference(null);
    setReference(id);
  };

  const removeHotel = (hotelId: string) => {
    const next = panelHotels.filter((hotel) => hotel.id !== hotelId);
    toggleBasket(hotelId);
    if (referenceId === hotelId) setReference(next[0]?.id ?? null);
  };

  const clearPanel = () => {
    if (!panelHotels.length) return;
    if (!window.confirm("Vider le panel du comparateur ?")) return;
    setBasket([]);
    setReference(null);
    setManualReference(null);
  };

  const meta = {
    titre: `Comparatif ${reference?.nom ?? "concurrentiel"}`,
    perimetre: ready
      ? `${columns.length} acteurs · exercice ${annee} · ${[...new Set(columns.map((column) => column.ville))].length} ville(s)`
      : `Exercice ${annee}`,
    auteur: currentUser.nom,
  };

  const ensureMapCapture = async (): Promise<string | null> => {
    if (!mapRef.current) {
      setTab("graphiques");
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    if (!mapRef.current) return null;
    try {
      return await toPng(mapRef.current, {
        pixelRatio: 2,
        backgroundColor: "#fffefa",
        cacheBust: true,
      });
    } catch {
      return null;
    }
  };

  const runExport = async (kind: "excel" | "ppt" | "png") => {
    if (!ready) return;
    setBusy(kind === "excel" ? "Préparation…" : "Génération…");
    try {
      if (kind === "excel") {
        exportComparatorXlsx({
          columns,
          hotels: panelHotels,
          kpis: state.kpis,
          annee,
          meta,
        });
        toast({ title: "Classeur Excel généré", description: `${columns.length} acteurs comparés.`, tone: "success" });
      } else {
        const dataUrl = await ensureMapCapture();
        if (kind === "ppt") {
          await exportComparatorPptx({ columns, annee, meta, mapDataUrl: dataUrl });
          toast({ title: "PowerPoint généré", description: "Synthèse, tableaux et carte.", tone: "success" });
        } else if (dataUrl) {
          downloadImageDataUrl(dataUrl, `Nova_Carte_concurrentielle_${annee}`);
          toast({ title: "Carte PNG générée", description: "Image haute définition téléchargée.", tone: "success" });
        } else {
          toast({ title: "Carte indisponible", description: "La carte n'a pas pu être capturée.", tone: "error" });
        }
      }
    } catch (error) {
      toast({
        title: "Export impossible",
        description: error instanceof Error ? error.message : "Erreur inattendue.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1580px] px-4 py-5 sm:px-6 xl:px-8">
      <PageHeader
        eyebrow="Analyse concurrentielle"
        title="Comparateur"
        description="Un actif de référence, jusqu'à 30 concurrents, des écarts calculés et tracés. Chaque valeur manquante reste vide : aucune estimation implicite."
        actions={
          <>
            <Select
              value={String(annee)}
              onChange={(value) => setAnnee(Number(value))}
              options={YEARS.map((year) => ({ value: String(year), label: `Exercice ${year}` }))}
              className="w-[138px]"
              aria-label="Exercice"
            />
            <ExportMenu
              busy={busy}
              onExcel={() => void runExport("excel")}
              onPowerPoint={() => void runExport("ppt")}
              onPng={() => void runExport("png")}
            />
            <Button variant="accent" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" />
              Ajouter un hôtel
            </Button>
          </>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-line py-2">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">Référence</span>
        {manualReference ? (
          <>
            <Badge tone="accent" dot>{manualReference.nom}</Badge>
            <span className="text-[10.5px] text-muted">actif client saisi manuellement</span>
            <ReliabilityBadge source={manualReference.source} showText />
            <Button variant="ghost" size="sm" onClick={() => setManualOpen(true)}>
              <Pencil className="size-3" /> Modifier
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setManualReference(null); if (panelHotels[0]) setReference(panelHotels[0].id); }}>
              Revenir au panel
            </Button>
          </>
        ) : (
          <>
            <Select
              value={referenceId ?? ""}
              onChange={chooseReference}
              options={panelHotels.map((hotel) => ({
                value: hotel.id,
                label: `${hotel.nom} — ${hotel.ville}`,
              }))}
              placeholder={panelHotels.length ? undefined : "Panel vide"}
              disabled={!panelHotels.length}
              className="w-[280px]"
              aria-label="Hôtel de référence"
            />
            <Button variant="ghost" size="sm" onClick={() => setManualOpen(true)}>
              <Pencil className="size-3" /> Saisir un actif client
            </Button>
          </>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10.5px] tabular text-muted">{columns.length} / 30 acteurs</span>
          <Button variant="outline" size="sm" onClick={() => setPanelsOpen(true)}>
            <FolderOpen className="size-3" /> Panels enregistrés
          </Button>
          <Button variant="ghost" size="sm" onClick={clearPanel} disabled={!panelHotels.length}>
            <Trash2 className="size-3" /> Vider
          </Button>
        </div>
      </div>

      {ready && (
        <Card className="mt-4 grid grid-cols-2 divide-x divide-line p-0 sm:grid-cols-3 lg:grid-cols-7">
          <StatTile label="Acteurs comparés" value={columns.length} sub={`${panelHotels.length} hôtels + référence`} accent />
          <StatTile label="Clés du panel" value={fmtInt(totalKeys)} sub={`${fmtInt(mean(columns.map((column) => column.cles)) ?? 0)} clés en moyenne`} />
          <StatTile label="CA cumulé" value={fmtEuro(totalCa, true)} sub={`exercice ${annee}`} />
          <StatTile label="CA moyen" value={totalCa && columns.length ? fmtEuro(totalCa / columns.length, true) : "—"} sub={`${documentedCa} fiche(s) documentée(s)`} />
          <StatTile label="CA / clé moyen" value={caParCleAverage != null ? fmtEuro(caParCleAverage) : "—"} sub="panel documenté" />
          <StatTile label="Fiches documentées" value={`${documentedCa} / ${columns.length}`} sub="CA renseigné" />
          <StatTile label="Référence" value={reference?.nom ?? "—"} sub={reference ? `${reference.ville} · ${fmtInt(reference.cles)} clés` : undefined} />
        </Card>
      )}

      {!ready ? (
        <Card className="mt-4">
          <EmptyState
            icon={<Users className="size-7" />}
            title="Constituez votre panel de comparaison"
            description="Ajoutez au moins deux acteurs ou rechargez un panel enregistré. Le premier hôtel devient la référence, modifiable à tout moment."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="accent" onClick={() => setAddOpen(true)}>
                  <Plus className="size-3.5" /> Ajouter un hôtel
                </Button>
                <Button variant="outline" onClick={() => setPanelsOpen(true)}>
                  <Layers3 className="size-3.5" /> Charger un panel
                </Button>
                <Link href="/" className={buttonVariants({ variant: "ghost" })}>
                  <ArrowRight className="size-3.5" /> Ouvrir la carte
                </Link>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mt-5">
            <Tabs tabs={TABS} value={tab} onChange={setTab} />
          </div>

          {tab === "synthese" && (
            <div className="mt-3 space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-[1px] bg-green-soft ring-1 ring-green/25" /> meilleure valeur du panel
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-[1px] bg-danger-soft ring-1 ring-danger/20" /> moins bonne valeur
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-[1px] border border-line-strong bg-surface" /> N3 en italique = estimation
                </span>
                <span className="ml-auto">Écart sous chaque valeur : vs référence ({reference?.nom ?? "—"})</span>
              </div>
              <CompareTable columns={columns} onRemoveHotel={removeHotel} onSetReference={chooseReference} />
              <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
                <div>
                  <SectionTitle hint="Calculées uniquement sur les valeurs renseignées, jamais sur des estimations implicites.">
                    Statistiques du panel
                  </SectionTitle>
                  <ComparisonStatsTable columns={columns} />
                </div>
                <Card>
                  <SectionTitle>Lecture de la référence</SectionTitle>
                  {reference && (
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <CategoryBadge categorie={reference.categorie} />
                        <span className="text-[12px] font-medium text-ink">{reference.nom}</span>
                        <ReliabilityBadge source={reference.source} />
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-muted">
                        {reference.isManual
                          ? "Actif client saisi manuellement pour cette analyse. Il n'est pas enregistré dans la base : seuls les écarts et exports le reprennent."
                          : `Hôtel de l'observatoire, ${reference.groupe}, ${reference.ville}.`}
                      </p>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-2.5 text-[11px]">
                        {(["caTotal", "caParCle", "cles", "surfaceTotale"] as const).map((key) => (
                          <div key={key}>
                            <dt className="text-[9px] uppercase tracking-[0.06em] text-faint">{KPI_LABELS[key].short}</dt>
                            <dd className="tabular text-ink">
                              {key === "caTotal" ? fmtEuro(reference.values[key] ?? null, true) : null}
                              {key === "caParCle" || key === "surfaceTotale" ? fmtEuro(reference.values[key] ?? null) : null}
                              {key === "cles" ? fmtInt(reference.values[key] ?? null) : null}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="border-t border-line pt-2 text-[9.5px] italic text-faint">
                        Source : {reference.source.source} · {reference.source.fiabilite} · {reference.source.auteur}
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {tab === "graphiques" && (
            <div className="mt-3 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <PriceOccupancyScatter columns={columns} />
                <RankedBars columns={columns} />
                <NormalizedRadar columns={columns} />
                <ReferenceGapLine columns={columns} />
              </div>
              <div>
                <SectionTitle hint="Marqueurs numérotés de 1 à n, couleur par catégorie. Prête pour l'export PowerPoint.">
                  Carte concurrentielle
                </SectionTitle>
                <CompetitiveMap
                  hotels={panelHotels}
                  kpis={state.kpis}
                  annee={annee}
                  title={meta.titre}
                  mapRef={mapRef}
                />
                {manualReference && (
                  <p className="mt-1 text-[10px] italic text-faint">
                    L’actif client manuel n’est pas cartographié : ses coordonnées ne sont pas documentées.
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === "equipements" && (
            <div className="mt-3">
              <SectionTitle hint="Oui / Non reflète la fiche documentée. n.r. signale une absence d’information, pas une absence d’équipement.">
                Matrice des équipements
              </SectionTitle>
              <EquipmentMatrix columns={columns} />
            </div>
          )}
        </>
      )}

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[10px] text-faint">
        <span>
          {DEMO_LABEL} · Les écarts sont recalculés à chaque changement de panel ou d’exercice.
        </span>
        <span className="inline-flex items-center gap-1">
          <Building2 className="size-3" />
          Sources et fiabilités détaillées dans chaque export.
        </span>
      </footer>

      <AddHotelDialog open={addOpen} onOpenChange={setAddOpen} />
      <PanelPickerDialog open={panelsOpen} onOpenChange={setPanelsOpen} />
      <ManualReferenceDialog
        key={manualReference ? `${manualReference.nom}-${manualReference.source.dateSource}` : "new"}
        open={manualOpen}
        onOpenChange={setManualOpen}
        initial={manualReference}
        onSave={(referenceValue) => {
          setManualReference(referenceValue);
          addAudit({
            action: "Définition d'un actif de référence",
            target: referenceValue.nom,
            details: `Actif client manuel — ${referenceValue.source.fiabilite} : ${referenceValue.source.source}`,
          });
        }}
        onClear={() => {
          setManualReference(null);
          if (panelHotels[0]) setReference(panelHotels[0].id);
        }}
      />
    </div>
  );
}
