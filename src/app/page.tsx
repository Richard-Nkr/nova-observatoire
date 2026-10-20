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
import { fmtDate, fmtInt, fmtNum } from "@/lib/format";
import { haversineKm } from "@/lib/geo";
import { kpiFor, mean, median, metricValues, sum } from "@/lib/stats";
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
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";

const MAP_METRICS: { value: MapMetric; label: string }[] = [
  { value: "hotels", label: "Hôtels" },
  { value: "cles", label: "Clés" },
  { value: "revpar", label: "RevPAR" },
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
  const [sortKey, setSortKey] = React.useState("revpar");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [selectedHotelId, setSelectedHotelId] = React.useState<string | null>(null);
  const [drawing, setDrawing] = React.useState(false);
  const [drawingPoints, setDrawingPoints] = React.useState<{ lat: number; lng: number }[]>([]);
  const [mobileFilters, setMobileFilters] = React.useState(false);
  const [mobileResults, setMobileResults] = React.useState(false);
  const [savedOpen, setSavedOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState<string | null>(null);
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
    const values = (key: "adr" | "revpar" | "to") =>
      metricValues(filteredHotels, state.kpis, key, filters.annee);
    const adr = values("adr");
    const revpar = values("revpar");
    const to = values("to");
    const caTotal = sum(
      filteredHotels.map(
        (hotel) => kpiFor(hotel.id, state.kpis, filters.annee)?.caTotal ?? 0,
      ),
    );
    const keys = sum(filteredHotels.map((hotel) => hotel.cles));
    const spa = filteredHotels.filter((hotel) => hotel.equipements.spa).length;
    const restaurant = filteredHotels.filter(
      (hotel) =>
        hotel.equipements.restaurantGastro || hotel.equipements.brasserie,
    ).length;
    return {
      adrMean: mean(adr),
      adrMedian: median(adr),
      revparMean: mean(revpar),
      toMean: mean(to),
      caTotal,
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
    setScope({ level: "region", region });
    setSelectedHotelId(null);
    setDrawing(false);
    setDrawingPoints([]);
    setFilters((current) => ({
      ...current,
      regions: [region],
      departements: [],
      villes: [],
      geo: null,
    }));
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
      regions: [scope.region as string],
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
    if (focus && hotel && mapRef.current) {
      mapRef.current.flyTo({
        center: [hotel.longitude, hotel.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 12),
        duration: 550,
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

  const openNearbyCompetitors = (hotel: Hotel) => {
    const family = categoryFamily(hotel.categorie);
    const candidates = state.hotels
      .filter(
        (candidate) =>
          candidate.id !== hotel.id && categoryFamily(candidate.categorie) === family,
      )
      .map((candidate) => ({
        hotel: candidate,
        distance: haversineKm(
          { lat: hotel.latitude, lng: hotel.longitude },
          { lat: candidate.latitude, lng: candidate.longitude },
        ),
      }));
    let radius = 15;
    let nearby = candidates.filter((item) => item.distance <= radius);
    if (nearby.length < 2) {
      radius = 30;
      nearby = candidates.filter((item) => item.distance <= radius);
    }
    nearby.sort((a, b) => a.distance - b.distance);
    const ids = [hotel.id, ...nearby.slice(0, 29).map((item) => item.hotel.id)];
    if (ids.length < 2) {
      toast({
        title: "Pas assez de concurrents",
        description: "Aucun hôtel de catégorie comparable dans un rayon de 30 km.",
        tone: "error",
      });
      return;
    }
    setBasket(ids);
    setReference(hotel.id);
    addAudit({
      action: "Sélection de concurrents autour",
      target: hotel.nom,
      details: `${ids.length} hôtels · rayon ${radius} km · catégorie ${CATEGORY_LABEL[String(hotel.categorie)]}`,
    });
    toast({
      title: "Panel de concurrents préparé",
      description: `${ids.length} hôtels · ${radius} km autour de ${hotel.nom}`,
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
            <div className="mt-0.5 flex items-baseline gap-2">
              <h1 className="font-serif text-[22px] leading-none tracking-[-0.01em] text-ink">
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
          label="ADR moyen"
          value={summary.adrMean != null ? `${fmtNum(summary.adrMean, 0)} €` : "—"}
          sub={
            summary.adrMedian != null
              ? `médiane ${fmtNum(summary.adrMedian, 0)} €`
              : "médiane —"
          }
        />
        <StatTile
          label="RevPAR moyen"
          value={
            summary.revparMean != null ? `${fmtNum(summary.revparMean, 0)} €` : "—"
          }
          sub="par clé disponible"
        />
        <StatTile
          label="TO moyen"
          value={
            summary.toMean != null ? `${fmtNum(summary.toMean * 100, 1)} %` : "—"
          }
          sub="taux d'occupation"
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
                  ? "Cliquez une ville pour explorer ses hôtels"
                  : "Cliquez une région pour zoomer"}
              </p>
            </div>
          )}

          {/* Fiche sélectionnée */}
          {selectedHotel && (
            <div className="slide-in-right absolute bottom-3 left-3 z-20 w-[336px] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-[3px] border border-line-strong bg-surface shadow-[0_14px_44px_rgba(15,36,51,0.22)]">
              <div
                className="h-[3px] w-full"
                style={{ background: CATEGORY_COLOR[String(selectedHotel.categorie)] }}
              />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-serif text-[18px] leading-tight text-ink">
                      {selectedHotel.nom}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-muted">
                      {selectedHotel.adresse} · {selectedHotel.codePostal}{" "}
                      {selectedHotel.ville}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedHotelId(null)}
                    className="rounded p-1 text-faint hover:bg-black/5 hover:text-ink"
                    aria-label="Fermer la fiche"
                  >
                    <span className="text-[16px] leading-none">×</span>
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <CategoryBadge categorie={selectedHotel.categorie} />
                  <span className="text-[10.5px] text-muted">{selectedHotel.groupe}</span>
                  <span className="text-[10.5px] text-faint">·</span>
                  <span className="text-[10.5px] text-muted">
                    {fmtInt(selectedHotel.cles)} clés
                  </span>
                  {selectedKpi && <ReliabilityBadge source={selectedKpi.source} />}
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-[2px] border border-line bg-paper/60 px-2 py-1.5">
                  <MiniKpi label="ADR" value={selectedKpi?.adr} suffix=" €" />
                  <MiniKpi label="RevPAR" value={selectedKpi?.revpar} suffix=" €" />
                  <MiniKpi
                    label="TO"
                    value={selectedKpi?.to != null ? selectedKpi.to * 100 : null}
                    suffix=" %"
                    digits={1}
                  />
                </div>
                <div className="mt-3 flex gap-1.5">
                  <Link
                    href={`/hotels/${selectedHotel.id}`}
                    className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[3px] border border-line-strong bg-surface px-2.5 text-[11px] font-medium text-ink transition-colors hover:bg-white"
                  >
                    <FileText className="size-3.5" />
                    Ouvrir la fiche
                  </Link>
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 text-[11px]"
                    onClick={() => openNearbyCompetitors(selectedHotel)}
                  >
                    <Users className="size-3.5" />
                    Concurrents autour
                  </Button>
                </div>
                {selectedKpi && (
                  <p className="mt-1.5 truncate text-[9px] text-faint">
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
