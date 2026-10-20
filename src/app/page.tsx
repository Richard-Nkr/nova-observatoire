"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  Image as ImageIcon,
  Presentation,
  Plus,
  SlidersHorizontal,
  Table2,
  Users,
} from "lucide-react";
import type { Filters, SavedSelection } from "@/lib/types";
import {
  CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  CURRENT_DATA_YEAR,
  EXTRACTION_DATE,
} from "@/lib/constants";
import {
  defaultFilters,
  describeFilters,
  filterHotels,
  normalizeFilters,
  sortHotels,
  type SortDirection,
} from "@/lib/filters";
import { fmtDate, fmtEuro, fmtInt, fmtNum } from "@/lib/format";
import { haversineKm } from "@/lib/geo";
import { kpiFor, mean, metricValues, sum } from "@/lib/stats";
import { useStore } from "@/lib/store";
import type { Hotel } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  exportHotelsCsv,
  exportHotelsXlsx,
  exportMapPptx,
  downloadMapPng,
  type MapCapture,
} from "@/lib/exports";
import { FilterPanel } from "@/components/map/filter-panel";
import { NovaMap, type MapMetric, type MapScope } from "@/components/map/nova-map";
import {
  ResultsPanel,
  type ResultsPanelProps,
} from "@/components/map/results-panel";
import { SavedSelectionsDialog } from "@/components/map/saved-selections-dialog";
import { ReliabilityBadge, DemoStamp } from "@/components/reliability";
import { Button, buttonVariants } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/field";
import { StatTile } from "@/components/ui/misc";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/toast";

const MAP_METRICS: { value: MapMetric; label: string }[] = [
  { value: "hotels", label: "Hôtels" },
  { value: "cles", label: "Clés" },
  { value: "caTotal", label: "CA total" },
];

function scopeFromFilters(filters: Filters, hotels: Hotel[]): MapScope {
  if (filters.villes.length === 1) {
    const city = filters.villes[0];
    return {
      level: "city",
      city,
      region:
        filters.regions[0] ??
        hotels.find((hotel) => hotel.ville === city)?.region ??
        undefined,
    };
  }
  if (filters.regions.length === 1) {
    return { level: "region", region: filters.regions[0] };
  }
  return { level: "france" };
}

function scopeTitle(scope: MapScope): string {
  if (scope.level === "city" && scope.city) return scope.city;
  if (scope.level === "region" && scope.region) return scope.region;
  return "France métropolitaine";
}

function categoryFamily(category: string | number): string {
  return category === "Palace" ? "5" : String(category);
}

export default function MapPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    state,
    currentUser,
    toggleBasket,
    clearBasket,
    setBasket,
    setReference,
    addAudit,
  } = useStore();

  const [filters, setFilters] = React.useState<Filters>(() =>
    defaultFilters(CURRENT_DATA_YEAR),
  );
  const [scope, setScope] = React.useState<MapScope>({ level: "france" });
  const [metric, setMetric] = React.useState<MapMetric>("cles");
  const [sortKey, setSortKey] = React.useState("caTotal");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [selectedHotelId, setSelectedHotelId] = React.useState<string | null>(null);
  const [drawing, setDrawing] = React.useState(false);
  const [drawingPoints, setDrawingPoints] = React.useState<{ lat: number; lng: number }[]>([]);
  const [mobileFilters, setMobileFilters] = React.useState(false);
  const [mobileResults, setMobileResults] = React.useState(false);
  const [savedOpen, setSavedOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState<string | null>(null);
  const [competitorRadius, setCompetitorRadius] = React.useState(15);
  const [competitorSelection, setCompetitorSelection] = React.useState<string[]>([]);
  const mapRef = React.useRef<MapLibreMap | null>(null);

  const filteredHotels = React.useMemo(
    () => filterHotels(state.hotels, state.kpis, filters),
    [state.hotels, state.kpis, filters],
  );

  const sortedHotels = React.useMemo(
    () => sortHotels(filteredHotels, state.kpis, sortKey, sortDirection, filters.annee),
    [filteredHotels, state.kpis, sortKey, sortDirection, filters.annee],
  );

  const summary = React.useMemo(() => {
    const caValues = filteredHotels
      .map((hotel) => kpiFor(hotel.id, state.kpis, filters.annee)?.caTotal)
      .filter((value): value is number => value != null);
    const caTotal = sum(caValues);
    const caPerKey = metricValues(filteredHotels, state.kpis, "caParCle", filters.annee);
    const keys = sum(filteredHotels.map((hotel) => hotel.cles));
    const spa = filteredHotels.filter((hotel) => hotel.equipements.spa).length;
    const restaurant = filteredHotels.filter(
      (hotel) =>
        hotel.equipements.restaurantGastro || hotel.equipements.brasserie,
    ).length;
    return {
      caTotal,
      caMean: caValues.length ? caTotal / caValues.length : null,
      caPerKeyMean: mean(caPerKey),
      documented: caValues.length,
      keys,
      spaShare: filteredHotels.length ? (spa / filteredHotels.length) * 100 : null,
      restaurantShare: filteredHotels.length
        ? (restaurant / filteredHotels.length) * 100
        : null,
    };
  }, [filteredHotels, state.kpis, filters.annee]);

  const selectedHotel = React.useMemo(
    () => state.hotels.find((hotel) => hotel.id === selectedHotelId) ?? null,
    [state.hotels, selectedHotelId],
  );
  const selectedKpi = selectedHotel
    ? kpiFor(selectedHotel.id, state.kpis, filters.annee)
    : undefined;

  // Concurrents de même catégorie dans le rayon choisi sur la fiche carte.
  const competitors = React.useMemo(() => {
    if (!selectedHotel) return [];
    const family = categoryFamily(selectedHotel.categorie);
    return state.hotels
      .filter(
        (candidate) =>
          candidate.id !== selectedHotel.id &&
          categoryFamily(candidate.categorie) === family,
      )
      .map((candidate) => ({
        hotel: candidate,
        distance: haversineKm(
          { lat: selectedHotel.latitude, lng: selectedHotel.longitude },
          { lat: candidate.latitude, lng: candidate.longitude },
        ),
      }))
      .filter((candidate) => candidate.distance <= competitorRadius)
      .sort((a, b) => a.distance - b.distance);
  }, [selectedHotel, state.hotels, competitorRadius]);

  const filtersLines = React.useMemo(() => describeFilters(filters), [filters]);
  const title = scopeTitle(scope);

  const handleFiltersChange = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (
      "regions" in patch ||
      "departements" in patch ||
      "villes" in patch
    ) {
      setScope(scopeFromFilters(next, state.hotels));
      setSelectedHotelId(null);
    }
    if ("annee" in patch) setSelectedHotelId(null);
  };

  const resetFilters = () => {
    setFilters(defaultFilters(filters.annee));
    setScope({ level: "france" });
    setSelectedHotelId(null);
    setDrawing(false);
    setDrawingPoints([]);
    toast({ title: "Filtres réinitialisés", tone: "info" });
  };

  const handleRegionSelect = (region: string) => {
    setDrawing(false);
    setDrawingPoints([]);
    setSelectedHotelId(null);

    // Un clic sur une région déjà retenue la retire du périmètre.
    if (filters.regions.includes(region)) {
      const nextRegions = filters.regions.filter((item) => item !== region);
      setFilters((current) => ({
        ...current,
        regions: nextRegions,
        departements: [],
        villes: [],
        geo: null,
      }));
      if (nextRegions.length === 0) {
        setScope({ level: "france" });
      } else if (nextRegions.length === 1) {
        setScope({ level: "region", region: nextRegions[0] });
      } else {
        // Plusieurs régions retenues : on garde la France entière à l'écran
        // pour que tous les périmètres sélectionnés restent visibles.
        setScope({ level: "france" });
      }
      toast({
        title: "Région retirée",
        description: `${region} ne fait plus partie du périmètre.`,
        tone: "info",
      });
      return;
    }

    setFilters((current) => ({
      ...current,
      regions: [...current.regions, region],
      departements: [],
      villes: [],
      geo: null,
    }));
    setScope(
      filters.regions.length > 0
        ? { level: "france" }
        : { level: "region", region },
    );
  };

  const handleCitySelect = (city: string) => {
    const region =
      state.hotels.find((hotel) => hotel.ville === city)?.region ?? scope.region;
    setScope({ level: "city", city, region });
    setSelectedHotelId(null);
    setDrawing(false);
    setDrawingPoints([]);
    setFilters((current) => ({
      ...current,
      regions: region ? [region] : current.regions,
      departements: [],
      villes: [city],
      geo: null,
    }));
  };

  const goFrance = () => {
    setScope({ level: "france" });
    setSelectedHotelId(null);
    setFilters((current) => ({
      ...current,
      regions: [],
      departements: [],
      villes: [],
      geo: null,
    }));
  };

  const goRegion = () => {
    if (!scope.region) return;
    setScope({ level: "region", region: scope.region });
    setSelectedHotelId(null);
    setFilters((current) => ({
      ...current,
      regions: current.regions.includes(scope.region as string)
        ? current.regions
        : [scope.region as string],
      departements: [],
      villes: [],
      geo: null,
    }));
  };

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "nom" || key === "ville" ? "asc" : "desc");
    }
  };

  const selectHotel = (hotelId: string, focus = false) => {
    setSelectedHotelId(hotelId);
    const hotel = state.hotels.find((item) => item.id === hotelId);
    if (!hotel) return;

    // À l'ouverture d'une fiche, proposer par défaut les concurrents
    // comparables situés dans le rayon courant.
    const family = categoryFamily(hotel.categorie);
    const initialRadius = 15;
    const initialSelection = state.hotels
      .filter(
        (candidate) =>
          candidate.id !== hotel.id && categoryFamily(candidate.categorie) === family,
      )
      .map((candidate) => ({
        id: candidate.id,
        distance: haversineKm(
          { lat: hotel.latitude, lng: hotel.longitude },
          { lat: candidate.latitude, lng: candidate.longitude },
        ),
      }))
      .filter((candidate) => candidate.distance <= initialRadius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6)
      .map((candidate) => candidate.id);
    setCompetitorRadius(initialRadius);
    setCompetitorSelection(initialSelection);

    if (focus && mapRef.current) {
      mapRef.current.flyTo({
        center: [hotel.longitude, hotel.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 12),
        duration: 550,
        // Décale la cible vers la droite pour laisser respirer la fiche
        // ouverte en bas à gauche de la carte.
        padding: { top: 0, right: 0, bottom: 40, left: 380 },
      });
    }
  };

  const handleBasketToggle = (hotelId: string) => {
    if (!state.basket.includes(hotelId) && state.basket.length >= 30) {
      toast({
        title: "Comparateur complet",
        description: "La sélection est limitée à 30 hôtels.",
        tone: "error",
      });
      return;
    }
    toggleBasket(hotelId);
  };

  const applySelection = (selection: SavedSelection) => {
    const normalized = normalizeFilters(
      selection.filters,
      selection.filters.annee ?? CURRENT_DATA_YEAR,
    );
    setFilters(normalized);
    setScope(scopeFromFilters(normalized, state.hotels));
    setSelectedHotelId(null);
    setDrawing(false);
    setDrawingPoints([]);
  };

  const handleCompetitorRadius = (value: number) => {
    setCompetitorRadius(value);
    if (!selectedHotel) return;
    const family = categoryFamily(selectedHotel.categorie);
    const eligible = new Set(
      state.hotels
        .filter(
          (candidate) =>
            candidate.id !== selectedHotel.id &&
            categoryFamily(candidate.categorie) === family &&
            haversineKm(
              { lat: selectedHotel.latitude, lng: selectedHotel.longitude },
              { lat: candidate.latitude, lng: candidate.longitude },
            ) <= value,
        )
        .map((candidate) => candidate.id),
    );
    setCompetitorSelection((current) => current.filter((id) => eligible.has(id)));
  };

  const toggleCompetitor = (hotelId: string) => {
    setCompetitorSelection((current) => {
      if (current.includes(hotelId)) {
        return current.filter((id) => id !== hotelId);
      }
      if (current.length >= 29) {
        toast({
          title: "Sélection complète",
          description: "Le comparateur accepte 30 acteurs au total, référence incluse.",
          tone: "info",
        });
        return current;
      }
      return [...current, hotelId];
    });
  };

  const selectAllCompetitors = () => {
    const ids = competitors.slice(0, 29).map((item) => item.hotel.id);
    setCompetitorSelection(ids);
    if (competitors.length > 29) {
      toast({
        title: "29 concurrents retenus",
        description: "Le comparateur est limité à 30 acteurs au total.",
        tone: "info",
      });
    }
  };

  const prepareCompetitorComparison = () => {
    if (!selectedHotel) return;
    const ids = [selectedHotel.id, ...competitorSelection].slice(0, 30);
    if (ids.length < 2) {
      toast({
        title: "Sélectionnez au moins un concurrent",
        description: "Cochez un ou plusieurs hôtels dans le rayon choisi.",
        tone: "info",
      });
      return;
    }
    setBasket(ids);
    setReference(selectedHotel.id);
    addAudit({
      action: "Sélection de concurrents autour",
      target: selectedHotel.nom,
      details: `${ids.length} hôtels · rayon ${competitorRadius} km · catégorie ${CATEGORY_LABEL[String(selectedHotel.categorie)]}`,
    });
    toast({
      title: "Panel de concurrents préparé",
      description: `${ids.length} hôtels · ${competitorRadius} km autour de ${selectedHotel.nom}`,
      tone: "success",
    });
    router.push("/comparateur");
  };

  const toggleDrawing = () => {
    if (drawing) {
      setDrawing(false);
      setDrawingPoints([]);
    } else {
      setDrawing(true);
      setDrawingPoints([]);
      setSelectedHotelId(null);
    }
  };

  const finishDrawing = () => {
    if (drawingPoints.length < 3) return;
    setFilters((current) => ({
      ...current,
      geo: {
        type: "polygon",
        points: drawingPoints,
        label: "Zone dessinée",
      },
    }));
    setDrawing(false);
    setDrawingPoints([]);
    setSelectedHotelId(null);
    toast({
      title: "Zone appliquée",
      description: `${drawingPoints.length} sommets · filtre géographique actif`,
      tone: "success",
    });
  };

  const captureMap = async (): Promise<MapCapture> => {
    const map = mapRef.current;
    if (!map) throw new Error("Carte non initialisée");
    map.triggerRepaint();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const canvas = map.getCanvas();
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  };

  const runExport = async (kind: "xlsx" | "csv" | "png" | "pptx") => {
    setExportOpen(false);
    if (filteredHotels.length === 0) {
      toast({
        title: "Périmètre vide",
        description: "Aucun hôtel à exporter avec les filtres actuels.",
        tone: "error",
      });
      return;
    }
    const meta = {
      titre: `Nova_${title}`,
      perimetre: title,
      auteur: currentUser.nom,
      filters,
    };
    setExporting(kind);
    try {
      if (kind === "xlsx") {
        exportHotelsXlsx(filteredHotels, state.kpis, filters.annee, meta);
      } else if (kind === "csv") {
        exportHotelsCsv(filteredHotels, state.kpis, filters.annee, meta);
      } else {
        const capture = await captureMap();
        const subtitle = `${filteredHotels.length} hôtels · ${fmtInt(summary.keys)} clés · exercice ${filters.annee} · ${fmtDate(EXTRACTION_DATE)}`;
        if (kind === "png") {
          await downloadMapPng(
            capture,
            `Carte hôtelière — ${title}`,
            subtitle,
            `Nova_Carte_${title}`,
          );
        } else {
          await exportMapPptx({
            capture,
            hotels: filteredHotels,
            kpis: state.kpis,
            annee: filters.annee,
            titre: `Carte hôtelière — ${title}`,
            sousTitre: subtitle,
            filtersLines,
            filename: `Nova_Carte_${title}`,
          });
        }
      }
      toast({
        title: "Export prêt",
        description:
          kind === "xlsx"
            ? "Classeur Excel : données, synthèse et méthodologie."
            : kind === "csv"
              ? "Fichier CSV brut généré."
              : kind === "png"
                ? "Capture cartographique PNG générée."
                : "Présentation PowerPoint générée.",
        tone: "success",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Export impossible",
        description:
          kind === "png" || kind === "pptx"
            ? "La capture de la carte a échoué. Réessayez après le chargement complet du fond de carte."
            : "Une erreur est survenue pendant la génération du fichier.",
        tone: "error",
      });
    } finally {
      setExporting(null);
    }
  };

  const resultPanelProps: ResultsPanelProps = {
    hotels: sortedHotels,
    kpis: state.kpis,
    annee: filters.annee,
    basket: state.basket,
    selectedHotelId,
    onToggleBasket: handleBasketToggle,
    onSelectHotel: (hotelId) => selectHotel(hotelId, true),
    onClearBasket: clearBasket,
    onCompare: () => router.push("/comparateur"),
    sortKey,
    sortDirection,
    onSort: handleSort,
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      {/* En-tête de poste de travail --------------------------------------- */}
      <header className="shrink-0 border-b border-line bg-surface px-3 py-2 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[9.5px] text-muted">
              <button
                type="button"
                onClick={goFrance}
                className={cn(
                  "rounded-[2px] px-1 py-[1px] transition-colors hover:bg-black/[0.04] hover:text-ink",
                  scope.level === "france" && "font-semibold text-ink",
                )}
              >
                France
              </button>
              {scope.region && (
                <>
                  <ChevronRight className="size-2.5 text-faint" />
                  <button
                    type="button"
                    onClick={goRegion}
                    className={cn(
                      "max-w-[180px] truncate rounded-[2px] px-1 py-[1px] transition-colors hover:bg-black/[0.04] hover:text-ink",
                      scope.level === "region" && "font-semibold text-ink",
                    )}
                  >
                    {scope.region}
                  </button>
                </>
              )}
              {scope.city && (
                <>
                  <ChevronRight className="size-2.5 text-faint" />
                  <span className="max-w-[180px] truncate rounded-[2px] px-1 py-[1px] font-semibold text-ink">
                    {scope.city}
                  </span>
                </>
              )}
              <span className="ml-1 text-faint">·</span>
              <span className="tabular">{filteredHotels.length} hôtels</span>
              <DemoStamp className="ml-1 hidden sm:inline-flex" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <h1 className="text-[23px] font-semibold leading-none tracking-[-0.03em] text-ink">
                Carte &amp; recherche
              </h1>
              <p className="hidden text-[10px] text-faint sm:block">
                Exercice {filters.annee} · extraction {fmtDate(EXTRACTION_DATE)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSavedOpen(true)}
              className="hidden sm:inline-flex"
            >
              <Bookmark className="size-3.5" />
              <span className="hidden lg:inline">Sélections</span>
            </Button>
            <Link
              href="/hotels/nouveau"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden sm:inline-flex")}
            >
              <Plus className="size-3.5" />
              <span className="hidden xl:inline">Ajouter</span>
            </Link>
            <Popover.Root open={exportOpen} onOpenChange={setExportOpen}>
              <Popover.Trigger asChild>
                <Button variant="outline" size="sm" disabled={!!exporting}>
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">
                    {exporting ? "Génération…" : "Exporter"}
                  </span>
                  <ChevronDown className="size-3 opacity-50" />
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  align="end"
                  sideOffset={6}
                  className="z-[70] w-64 rounded-[3px] border border-line-strong bg-surface p-1 shadow-[0_12px_40px_rgba(15,36,51,0.2)]"
                >
                  <p className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                    {filteredHotels.length} hôtels · {fmtInt(summary.keys)} clés
                  </p>
                  <ExportItem
                    icon={<FileSpreadsheet className="size-3.5" />}
                    title="Classeur Excel"
                    hint="Données, synthèse, méthodologie"
                    onClick={() => void runExport("xlsx")}
                  />
                  <ExportItem
                    icon={<Table2 className="size-3.5" />}
                    title="CSV brut"
                    hint="Toutes les colonnes et sources"
                    onClick={() => void runExport("csv")}
                  />
                  <ExportItem
                    icon={<ImageIcon className="size-3.5" />}
                    title="Carte PNG"
                    hint="Capture avec légende et date"
                    onClick={() => void runExport("png")}
                  />
                  <ExportItem
                    icon={<Presentation className="size-3.5" />}
                    title="Diapositive PowerPoint"
                    hint="Carte, synthèse et sources"
                    onClick={() => void runExport("pptx")}
                  />
                  <p className="border-t border-line px-2 pb-1 pt-1.5 text-[9px] leading-snug text-faint">
                    Chaque export inclut les filtres, la date et les niveaux de
                    fiabilité.
                  </p>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            <Button
              variant="accent"
              size="sm"
              onClick={() => {
                if (state.basket.length < 2) {
                  toast({
                    title: "Sélectionnez au moins 2 hôtels",
                    description: "Cochez les hôtels dans la liste de résultats.",
                    tone: "info",
                  });
                  return;
                }
                router.push("/comparateur");
              }}
            >
              <GitCompareArrows className="size-3.5" />
              <span className="hidden sm:inline">Comparer</span>
              <span className="rounded-[2px] bg-white/15 px-1 text-[9.5px] tabular">
                {state.basket.length}
              </span>
            </Button>
          </div>
        </div>
      </header>

      {/* Bandeau d'indicateurs --------------------------------------------- */}
      <div className="grid shrink-0 grid-cols-2 border-b border-line bg-surface sm:grid-cols-4 2xl:grid-cols-8">
        <StatTile
          label="Hôtels"
          value={fmtInt(filteredHotels.length)}
          sub={title}
          accent
        />
        <StatTile label="Clés" value={fmtInt(summary.keys)} sub="capacité cumulée" />
        <StatTile
          label="CA cumulé"
          value={summary.caTotal ? `${fmtNum(summary.caTotal / 1_000_000, 1)} M€` : "—"}
          sub={`exercice ${filters.annee}`}
        />
        <StatTile
          label="CA moyen"
          value={summary.caMean != null ? fmtEuro(summary.caMean, true) : "—"}
          sub={`${summary.documented} fiche(s) documentée(s)`}
        />
        <StatTile
          label="CA / clé moyen"
          value={summary.caPerKeyMean != null ? fmtEuro(summary.caPerKeyMean) : "—"}
          sub="panel documenté"
        />
        <StatTile
          label="Fiches CA"
          value={`${summary.documented} / ${filteredHotels.length}`}
          sub={`exercice ${filters.annee}`}
        />
        <StatTile
          label="Spa"
          value={
            summary.spaShare != null ? `${fmtNum(summary.spaShare, 0)} %` : "—"
          }
          sub="des hôtels du périmètre"
        />
        <StatTile
          label="Restauration"
          value={
            summary.restaurantShare != null
              ? `${fmtNum(summary.restaurantShare, 0)} %`
              : "—"
          }
          sub="gastro ou brasserie"
        />
      </div>

      {/* Espace de travail -------------------------------------------------- */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[276px] shrink-0 border-r border-line md:block">
          <FilterPanel
            filters={filters}
            onChange={handleFiltersChange}
            hotels={state.hotels}
            resultCount={filteredHotels.length}
            resultKeys={summary.keys}
            onReset={resetFilters}
            drawing={drawing}
            drawingPoints={drawingPoints.length}
            onToggleDrawing={toggleDrawing}
            onFinishDrawing={finishDrawing}
          />
        </aside>

        <section className="relative min-h-0 min-w-0 flex-1 bg-[#e9e6df]">
          <div className="absolute inset-0">
            <NovaMap
            className="h-full w-full"
            hotels={filteredHotels}
            kpis={state.kpis}
            annee={filters.annee}
            metric={metric}
            scope={scope}
            geo={filters.geo}
            selectedRegions={filters.regions}
            selectedHotelId={selectedHotelId}
            drawing={drawing}
            drawingPoints={drawingPoints}
            onRegionSelect={handleRegionSelect}
            onCitySelect={handleCitySelect}
            onHotelSelect={(hotelId) => selectHotel(hotelId)}
            onMapPoint={(lat, lng) =>
              setDrawingPoints((points) => [...points, { lat, lng }])
            }
            onMapReady={(map) => {
              mapRef.current = map;
            }}
            />
          </div>

          {/* Barre d'outils cartographique */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2.5 sm:p-3">
            <div className="pointer-events-auto flex items-center rounded-[3px] border border-line-strong bg-surface/95 p-[2px] shadow-[0_4px_16px_rgba(15,36,51,0.12)] backdrop-blur-sm">
              {MAP_METRICS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMetric(item.value)}
                  className={cn(
                    "rounded-[2px] px-2 py-[5px] text-[10.5px] font-medium transition-colors",
                    metric === item.value
                      ? "bg-navy text-white"
                      : "text-ink-soft hover:bg-black/[0.045]",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="pointer-events-auto flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileFilters(true)}
                className="bg-surface/95 shadow-sm backdrop-blur-sm md:hidden"
              >
                <SlidersHorizontal className="size-3.5" />
                Filtres
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileResults(true)}
                className="bg-surface/95 shadow-sm backdrop-blur-sm xl:hidden"
              >
                <Users className="size-3.5" />
                Résultats
              </Button>
            </div>
          </div>

          {/* Légende */}
          {!selectedHotel && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[240px] rounded-[3px] border border-line-strong bg-surface/95 px-2.5 py-2 shadow-[0_4px_16px_rgba(15,36,51,0.12)] backdrop-blur-sm">
              <p className="mb-1 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                {scope.level === "france" && !filters.geo
                  ? `Régions · ${MAP_METRICS.find((item) => item.value === metric)?.label}`
                  : scope.level === "region" && !filters.geo
                    ? "Villes · nombre d'hôtels"
                    : "Catégorie d'hôtel"}
              </p>
              {scope.level === "france" && !filters.geo ? (
                <>
                  <div className="h-[6px] w-40 rounded-full bg-gradient-to-r from-[#e7edf0] to-[#24506a]" />
                  <div className="mt-1 flex justify-between text-[8px] text-faint">
                    <span>Faible</span>
                    <span>Élevé</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                  {CATEGORIES.map((category) => (
                    <span
                      key={String(category)}
                      className="inline-flex items-center gap-1 text-[9.5px] text-ink-soft"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ background: CATEGORY_COLOR[String(category)] }}
                      />
                      {CATEGORY_LABEL[String(category)]}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1.5 border-t border-line/80 pt-1 text-[8.5px] text-faint">
                {scope.level === "region"
                  ? "Cliquez une ville pour explorer · recliquez la région pour la retirer"
                  : "Cliquez une région pour l’ajouter ou la retirer"}
              </p>
            </div>
          )}

          {/* Fiche sélectionnée ------------------------------------------- */}
          {selectedHotel && (
            <div className="slide-in-right absolute bottom-3 left-3 z-20 max-h-[calc(100%-1.5rem)] w-[360px] max-w-[calc(100%-1.5rem)] overflow-y-auto scroll-thin rounded-xl border border-line bg-surface shadow-[0_18px_54px_rgba(15,31,58,0.18)]">
              <div
                className="h-[3px] w-full"
                style={{ background: CATEGORY_COLOR[String(selectedHotel.categorie)] }}
              />
              <div className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[18px] font-semibold leading-tight tracking-[-0.025em] text-ink">
                      {selectedHotel.nom}
                    </p>
                    <p className="mt-1 truncate text-[10.5px] text-muted">
                      {[selectedHotel.adresse, [selectedHotel.codePostal, selectedHotel.ville].filter(Boolean).join(" ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedHotelId(null)}
                    className="rounded-full p-1 text-faint hover:bg-paper hover:text-ink"
                    aria-label="Fermer la fiche"
                  >
                    <span className="text-[17px] leading-none">×</span>
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <CategoryBadge categorie={selectedHotel.categorie} />
                  <span className="truncate text-[10.5px] text-muted">{selectedHotel.groupe}</span>
                  <span className="text-[10.5px] text-faint">·</span>
                  <span className="text-[10.5px] text-muted">
                    {fmtInt(selectedHotel.cles)} clés
                  </span>
                  {selectedKpi && <ReliabilityBadge source={selectedKpi.source} />}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-line bg-paper/60 px-2.5 py-2">
                  <MiniKpi label="CA total" value={selectedKpi?.caTotal != null ? selectedKpi.caTotal / 1_000_000 : null} suffix=" M€" digits={2} />
                  <MiniKpi
                    label="CA / clé"
                    value={selectedKpi?.caTotal != null && selectedHotel.cles > 0 ? selectedKpi.caTotal / selectedHotel.cles : null}
                    suffix=" €"
                  />
                  <MiniKpi label="Clés" value={selectedHotel.cles} suffix="" digits={0} />
                </div>

                {/* Sélection des concurrents autour de l'hôtel */}
                <div className="mt-3.5 border-t border-line pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                      Concurrents comparables
                    </p>
                    <span className="rounded-full bg-accent-soft px-2 py-[1px] text-[10px] font-semibold tabular text-accent-strong">
                      {competitorRadius} km
                    </span>
                  </div>
                  <Slider
                    value={competitorRadius}
                    onChange={handleCompetitorRadius}
                    min={1}
                    max={100}
                    step={1}
                    className="mt-2.5"
                    aria-label="Rayon de recherche des concurrents"
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[9px] text-faint">
                    <span>1 km</span>
                    <span className="tabular">
                      {competitors.length} hôtel(s) dans le rayon
                    </span>
                    <span>100 km</span>
                  </div>
                  <p className="mt-1 text-[9px] leading-snug text-faint">
                    Distances calculées depuis les centroïdes communaux BAN.
                  </p>

                  {competitors.length > 0 ? (
                    <div className="scroll-thin mt-2 max-h-[148px] space-y-0.5 overflow-y-auto rounded-lg border border-line bg-paper/45 p-1">
                      {competitors.map(({ hotel: competitor, distance }) => (
                        <Checkbox
                          key={competitor.id}
                          checked={competitorSelection.includes(competitor.id)}
                          onChange={() => toggleCompetitor(competitor.id)}
                          className="w-full items-start gap-2 rounded-md px-1.5 py-1 hover:bg-surface"
                          label={
                            <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block truncate text-[10.5px] font-medium text-ink">
                                  {competitor.nom}
                                </span>
                                <span className="block truncate text-[9px] text-muted">
                                  {competitor.ville} · {CATEGORY_LABEL[String(competitor.categorie)]}
                                </span>
                              </span>
                              <span className="shrink-0 text-[9px] tabular text-faint">
                                {fmtNum(distance, 1)} km · {fmtInt(competitor.cles)} clés
                              </span>
                            </span>
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 rounded-lg border border-dashed border-line-strong px-3 py-2 text-[10px] leading-relaxed text-faint">
                      Aucun hôtel de catégorie comparable dans ce rayon. Augmentez le rayon pour élargir la recherche.
                    </p>
                  )}

                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[9.5px]">
                      <button
                        type="button"
                        onClick={selectAllCompetitors}
                        disabled={competitors.length === 0}
                        className="font-medium text-accent hover:underline disabled:opacity-40"
                      >
                        Tout
                      </button>
                      <span className="text-faint">·</span>
                      <button
                        type="button"
                        onClick={() => setCompetitorSelection([])}
                        disabled={competitorSelection.length === 0}
                        className="font-medium text-muted hover:text-ink hover:underline disabled:opacity-40"
                      >
                        Aucun
                      </button>
                    </div>
                    <span className="text-[9.5px] tabular text-muted">
                      {competitorSelection.length} retenu(s)
                    </span>
                  </div>

                  <div className="mt-2 flex gap-1.5">
                    <Link
                      href={`/hotels/${selectedHotel.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1")}
                    >
                      <FileText className="size-3.5" />
                      Fiche
                    </Link>
                    <Button
                      variant="accent"
                      size="sm"
                      className="flex-1"
                      onClick={prepareCompetitorComparison}
                      disabled={competitorSelection.length === 0}
                    >
                      <Users className="size-3.5" />
                      Comparer · {competitorSelection.length + 1}
                    </Button>
                  </div>
                </div>

                {selectedKpi && (
                  <p className="mt-2 truncate text-[9px] text-faint">
                    {selectedKpi.source.source} · {fmtDate(selectedKpi.source.dateSource)}
                  </p>
                )}
              </div>
            </div>
          )}

          {drawing && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-[3px] border border-accent/40 bg-surface/95 px-3 py-2 text-[10.5px] text-ink shadow-lg backdrop-blur-sm">
              <span className="font-medium">Dessin de zone</span> · cliquez pour poser
              les sommets ({drawingPoints.length}) puis validez dans le panneau.
            </div>
          )}
        </section>

        <aside className="hidden w-[368px] shrink-0 border-l border-line xl:block">
          <ResultsPanel {...resultPanelProps} />
        </aside>
      </div>

      {/* Tiroirs mobiles / tablette ---------------------------------------- */}
      {mobileFilters && (
        <div className="fixed inset-0 z-[85] flex md:hidden">
          <div
            className="absolute inset-0 bg-navy/45"
            onClick={() => setMobileFilters(false)}
          />
          <div className="relative flex h-full w-[min(90vw,320px)] flex-col bg-surface shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink">
                Filtres
              </p>
              <button
                type="button"
                onClick={() => setMobileFilters(false)}
                className="rounded p-1 text-muted hover:bg-black/5 hover:text-ink"
                aria-label="Fermer les filtres"
              >
                <span className="text-[18px] leading-none">×</span>
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <FilterPanel
                filters={filters}
                onChange={handleFiltersChange}
                hotels={state.hotels}
                resultCount={filteredHotels.length}
                resultKeys={summary.keys}
                onReset={resetFilters}
                drawing={drawing}
                drawingPoints={drawingPoints.length}
                onToggleDrawing={toggleDrawing}
                onFinishDrawing={finishDrawing}
              />
            </div>
          </div>
        </div>
      )}

      {mobileResults && (
        <div className="fixed inset-0 z-[85] flex justify-end xl:hidden">
          <div
            className="absolute inset-0 bg-navy/45"
            onClick={() => setMobileResults(false)}
          />
          <div className="relative h-full w-[min(94vw,390px)] bg-surface shadow-2xl">
            <ResultsPanel
              {...resultPanelProps}
              onClose={() => setMobileResults(false)}
            />
          </div>
        </div>
      )}

      <SavedSelectionsDialog
        open={savedOpen}
        onOpenChange={setSavedOpen}
        filters={filters}
        hotelIds={filteredHotels.map((hotel) => hotel.id)}
        onApply={applySelection}
      />
    </div>
  );
}

function ExportItem({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2 rounded-[2px] px-2 py-1.5 text-left transition-colors hover:bg-black/[0.045]"
    >
      <span className="mt-0.5 text-accent">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-medium text-ink">{title}</span>
        <span className="block text-[9.5px] leading-tight text-muted">{hint}</span>
      </span>
    </button>
  );
}

function MiniKpi({
  label,
  value,
  suffix,
  digits = 0,
}: {
  label: string;
  value: number | null | undefined;
  suffix: string;
  digits?: number;
}) {
  return (
    <div>
      <p className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-[12px] font-medium tabular text-ink">
        {value != null ? `${fmtNum(value, digits)}${suffix}` : "—"}
      </p>
    </div>
  );
}
