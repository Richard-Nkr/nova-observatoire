"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  ChevronDown,
  CircleDot,
  MapPin,
  Pentagon,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import type { Filters, Hotel, Fiabilite } from "@/lib/types";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  EQUIPMENT_FILTERS,
  EXPLOITATIONS,
  GAMMES,
  HOTEL_TYPES,
  RELIABILITY_META,
} from "@/lib/constants";
import { CITY_COORDS } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, SearchInput } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";

// ---------------------------------------------------------------------------
// Petits composants de filtrage
// ---------------------------------------------------------------------------

function FilterSection({
  title,
  children,
  defaultOpen = false,
  count = 0,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b border-line/80">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-soft">
          {title}
          {count > 0 && (
            <span className="rounded-[2px] bg-accent-soft px-1 text-[9px] font-semibold tabular text-accent-strong">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn("size-3.5 text-faint transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="px-3 pb-3.5">{children}</div>}
    </div>
  );
}

function MultiPicker<T extends string>({
  label,
  options,
  selected,
  onChange,
  display,
  searchable = true,
}: {
  label: string;
  options: T[];
  selected: T[];
  onChange: (values: T[]) => void;
  display?: (value: T) => string;
  searchable?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const render = (value: T) => display?.(value) ?? value;
  const filtered = query
    ? options.filter((option) =>
        render(option).toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  const toggle = (value: T) => {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-[28px] w-full items-center justify-between gap-2 rounded-[3px] border border-line-strong bg-surface px-2 text-left text-[11.5px]",
            selected.length === 0 && "text-faint",
          )}
        >
          <span className="truncate">
            {selected.length === 0
              ? label
              : selected.length === 1
                ? render(selected[0])
                : `${selected.length} sélectionnés`}
          </span>
          <ChevronDown className="size-3 shrink-0 text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={6}
          className="z-[70] w-[250px] rounded-[3px] border border-line-strong bg-surface p-2 shadow-[0_12px_36px_rgba(15,36,51,0.18)]"
        >
          {searchable && options.length > 8 && (
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-1.5 top-1/2 size-3 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrer…"
                className="h-[26px] w-full rounded-[2px] border border-line bg-paper pl-6 pr-1.5 text-[11px] outline-none focus:border-accent"
              />
            </div>
          )}
          <div className="scroll-thin max-h-[240px] space-y-1 overflow-y-auto pr-0.5">
            {filtered.map((option) => (
              <Checkbox
                key={option}
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
                label={render(option)}
                className="rounded-[2px] px-1 py-0.5 hover:bg-black/[0.03]"
              />
            ))}
            {filtered.length === 0 && (
              <p className="px-1 py-2 text-[11px] text-faint">Aucun résultat</p>
            )}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1.5 w-full border-t border-line pt-1.5 text-left text-[10px] text-muted hover:text-ink"
            >
              Tout désélectionner
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NumRange({
  minValue,
  maxValue,
  onChange,
  unit,
  placeholder = ["Min", "Max"],
  step,
}: {
  minValue: number | null;
  maxValue: number | null;
  onChange: (min: number | null, max: number | null) => void;
  unit?: string;
  placeholder?: [string, string];
  step?: number;
}) {
  const parse = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        inputMode="numeric"
        step={step}
        value={minValue ?? ""}
        onChange={(event) => onChange(parse(event.target.value), maxValue)}
        placeholder={placeholder[0]}
        className="h-[27px] px-1.5 text-[11px]"
      />
      <span className="text-[10px] text-faint">–</span>
      <Input
        type="number"
        inputMode="numeric"
        step={step}
        value={maxValue ?? ""}
        onChange={(event) => onChange(minValue, parse(event.target.value))}
        placeholder={placeholder[1]}
        className="h-[27px] px-1.5 text-[11px]"
      />
      {unit && <span className="w-6 shrink-0 text-[9.5px] text-faint">{unit}</span>}
    </div>
  );
}

function GeoSearch({
  onSelect,
}: {
  onSelect: (center: { lat: number; lng: number }, label: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [remote, setRemote] = React.useState<
    { label: string; lat: number; lng: number }[]
  >([]);
  const [loading, setLoading] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const local = Object.entries(CITY_COORDS)
    .filter(([city]) => city.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 4)
    .map(([label, coords]) => ({ label, lat: coords.lat, lng: coords.lng }));

  const searchRemote = React.useCallback(async () => {
    if (query.trim().length < 3) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5&type=municipality`,
        { signal: controller.signal },
      );
      const json = (await response.json()) as {
        features?: {
          properties: { label: string; city?: string };
          geometry: { coordinates: [number, number] };
        }[];
      };
      setRemote(
        (json.features ?? []).map((feature) => ({
          label: feature.properties.label,
          lng: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1],
        })),
      );
    } catch {
      // Hors ligne : les suggestions locales restent disponibles.
    } finally {
      setLoading(false);
    }
  }, [query]);

  const results = [...local, ...remote.filter((r) => !local.some((l) => l.label === r.label))].slice(
    0,
    7,
  );

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (results[0]) {
                onSelect({ lat: results[0].lat, lng: results[0].lng }, results[0].label);
                setOpen(false);
                setQuery("");
              } else {
                void searchRemote();
              }
            }
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Ville, adresse…"
          className="h-[28px] pl-7 pr-7 text-[11.5px]"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRemote([]);
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
            aria-label="Effacer"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
      {open && query.trim().length > 1 && (
        <div className="absolute left-0 right-0 top-[31px] z-40 rounded-[3px] border border-line-strong bg-surface p-1 shadow-[0_10px_28px_rgba(15,36,51,0.16)]">
          {results.map((result) => (
            <button
              key={`${result.label}-${result.lat}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect({ lat: result.lat, lng: result.lng }, result.label);
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center gap-1.5 rounded-[2px] px-1.5 py-1.5 text-left text-[11px] text-ink-soft hover:bg-black/[0.04]"
            >
              <MapPin className="size-3 shrink-0 text-faint" />
              <span className="truncate">{result.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => void searchRemote()}
            className="mt-0.5 flex w-full items-center gap-1.5 border-t border-line px-1.5 py-1.5 text-left text-[10px] text-muted hover:text-ink"
          >
            <Search className="size-3" />
            {loading ? "Recherche BAN…" : "Rechercher dans la Base Adresse Nationale"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panneau principal
// ---------------------------------------------------------------------------

export interface FilterPanelProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  hotels: Hotel[];
  resultCount: number;
  resultKeys: number;
  onReset: () => void;
  drawing: boolean;
  drawingPoints: number;
  onToggleDrawing: () => void;
  onFinishDrawing: () => void;
}

export function FilterPanel({
  filters,
  onChange,
  hotels,
  resultCount,
  resultKeys,
  onReset,
  drawing,
  drawingPoints,
  onToggleDrawing,
  onFinishDrawing,
}: FilterPanelProps) {
  const regions = React.useMemo(
    () => Array.from(new Set(hotels.map((hotel) => hotel.region))).sort((a, b) => a.localeCompare(b, "fr")),
    [hotels],
  );
  const departements = React.useMemo(
    () => Array.from(new Set(hotels.map((hotel) => hotel.departement))).sort((a, b) => a.localeCompare(b, "fr")),
    [hotels],
  );
  const villes = React.useMemo(
    () => Array.from(new Set(hotels.map((hotel) => hotel.ville))).sort((a, b) => a.localeCompare(b, "fr")),
    [hotels],
  );
  const groupes = React.useMemo(
    () => Array.from(new Set(hotels.map((hotel) => hotel.groupe))).sort((a, b) => a.localeCompare(b, "fr")),
    [hotels],
  );

  const toggleArray = <K extends keyof Filters>(key: K, value: string) => {
    const current = filters[key] as unknown as string[];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    onChange({ [key]: next } as unknown as Partial<Filters>);
  };

  const toggleCategory = (category: Filters["categories"][number]) => {
    onChange({
      categories: filters.categories.includes(category)
        ? filters.categories.filter((item) => item !== category)
        : [...filters.categories, category],
    });
  };

  const reliabilityCount =
    filters.fiabiliteMin !== "all" || filters.geo ? 1 : 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink">
            Filtres
          </p>
          <p className="text-[10px] text-muted tabular">
            {resultCount} hôtels · {resultKeys.toLocaleString("fr-FR")} clés
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="h-6 px-1.5 text-[10px]">
          <RotateCcw className="size-3" />
          Réinit.
        </Button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <FilterSection
          title="Périmètre géographique"
          defaultOpen
          count={filters.geo ? 1 : 0}
        >
          <div className="space-y-2">
            <GeoSearch
              onSelect={(center, label) =>
                onChange({
                  geo: { type: "circle", center, radiusKm: 15, label },
                })
              }
            />

            {filters.geo?.type === "circle" && (
              <div className="rounded-[2px] border border-[#e5d6c8] bg-accent-soft/50 p-2">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1 text-[10.5px] leading-tight text-ink-soft">
                    <CircleDot className="size-3 shrink-0 text-accent" />
                    <span className="truncate">{filters.geo.label}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange({ geo: null })}
                    className="text-faint hover:text-ink"
                    aria-label="Supprimer le périmètre"
                  >
                    <X className="size-3" />
                  </button>
                </div>
                <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
                  <span>Rayon</span>
                  <span className="tabular font-medium text-ink">
                    {filters.geo.radiusKm} km
                  </span>
                </div>
                <Slider
                  value={filters.geo.radiusKm}
                  min={1}
                  max={100}
                  onChange={(radiusKm) =>
                    onChange({
                      geo: filters.geo && filters.geo.type === "circle"
                        ? { ...filters.geo, radiusKm }
                        : null,
                    })
                  }
                  aria-label="Rayon de recherche"
                />
              </div>
            )}

            {filters.geo?.type === "polygon" && (
              <div className="flex items-center justify-between rounded-[2px] border border-line bg-paper px-2 py-1.5 text-[10.5px]">
                <span className="flex items-center gap-1.5">
                  <Pentagon className="size-3.5 text-accent" />
                  Zone dessinée · {filters.geo.points.length} pts
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ geo: null })}
                  className="text-faint hover:text-ink"
                  aria-label="Supprimer le polygone"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}

            <div className="flex gap-1.5">
              <Button
                variant={drawing ? "accent" : "outline"}
                size="sm"
                onClick={onToggleDrawing}
                className="flex-1 text-[10.5px]"
              >
                <Pentagon className="size-3" />
                {drawing ? "Annuler" : "Dessiner une zone"}
              </Button>
              {drawing && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onFinishDrawing}
                  disabled={drawingPoints < 3}
                  className="text-[10.5px]"
                >
                  Terminer
                </Button>
              )}
            </div>
            {drawing && (
              <p className="rounded-[2px] bg-navy/[0.045] px-2 py-1.5 text-[10px] leading-snug text-muted">
                Cliquez sur la carte pour poser les sommets, puis validez.
              </p>
            )}

            <div className="grid grid-cols-1 gap-1.5 pt-1">
              <MultiPicker
                label="Toutes les régions"
                options={regions}
                selected={filters.regions}
                onChange={(values) => onChange({ regions: values })}
              />
              <MultiPicker
                label="Tous les départements"
                options={departements}
                selected={filters.departements}
                onChange={(values) => onChange({ departements: values })}
              />
              <MultiPicker
                label="Toutes les villes"
                options={villes}
                selected={filters.villes}
                onChange={(values) => onChange({ villes: values })}
              />
            </div>
          </div>
        </FilterSection>

        <FilterSection
          title="Hôtel"
          defaultOpen
          count={filters.categories.length + filters.gammes.length + filters.types.length}
        >
          <div className="space-y-2.5">
            <SearchInput
              value={filters.search}
              onChange={(search) => onChange({ search })}
              placeholder="Nom, ville, groupe…"
            />
            <div>
              <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                Catégorie
              </p>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((category) => {
                  const active = filters.categories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={cn(
                        "rounded-[2px] border px-1.5 py-[2px] text-[10.5px] transition-colors",
                        active
                          ? "border-navy bg-navy text-white"
                          : "border-line-strong bg-surface text-ink-soft hover:border-navy/40",
                      )}
                    >
                      {CATEGORY_LABEL[String(category)]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <MultiPicker
                label="Toutes les gammes"
                options={GAMMES}
                selected={filters.gammes}
                onChange={(values) => onChange({ gammes: values })}
              />
              <MultiPicker
                label="Tous les types"
                options={HOTEL_TYPES}
                selected={filters.types}
                onChange={(values) => onChange({ types: values })}
              />
              <MultiPicker
                label="Toutes les exploitations"
                options={EXPLOITATIONS}
                selected={filters.exploitations}
                onChange={(values) => onChange({ exploitations: values })}
              />
              <MultiPicker
                label="Tous les groupes"
                options={groupes}
                selected={filters.groupes}
                onChange={(values) => onChange({ groupes: values })}
              />
            </div>
          </div>
        </FilterSection>

        <FilterSection
          title="Capacité & performance"
          count={
            [
              filters.clesMin,
              filters.clesMax,
              filters.adrMin,
              filters.adrMax,
              filters.revparMin,
              filters.revparMax,
              filters.toMin,
              filters.toMax,
              filters.caMin,
              filters.caMax,
            ].filter((value) => value !== null).length > 0
              ? 1
              : 0
          }
        >
          <div className="space-y-2.5">
            <div>
              <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                Clés
              </p>
              <NumRange
                minValue={filters.clesMin}
                maxValue={filters.clesMax}
                onChange={(clesMin, clesMax) => onChange({ clesMin, clesMax })}
              />
            </div>
            <div>
              <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                ADR
              </p>
              <NumRange
                minValue={filters.adrMin}
                maxValue={filters.adrMax}
                onChange={(adrMin, adrMax) => onChange({ adrMin, adrMax })}
                unit="€"
                step={10}
              />
            </div>
            <div>
              <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                RevPAR
              </p>
              <NumRange
                minValue={filters.revparMin}
                maxValue={filters.revparMax}
                onChange={(revparMin, revparMax) => onChange({ revparMin, revparMax })}
                unit="€"
                step={10}
              />
            </div>
            <div>
              <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                Taux d’occupation
              </p>
              <NumRange
                minValue={filters.toMin === null ? null : Math.round(filters.toMin * 100)}
                maxValue={filters.toMax === null ? null : Math.round(filters.toMax * 100)}
                onChange={(toMin, toMax) =>
                  onChange({
                    toMin: toMin === null ? null : toMin / 100,
                    toMax: toMax === null ? null : toMax / 100,
                  })
                }
                unit="%"
                placeholder={["Min %", "Max %"]}
              />
            </div>
            <div>
              <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                CA total
              </p>
              <NumRange
                minValue={filters.caMin}
                maxValue={filters.caMax}
                onChange={(caMin, caMax) => onChange({ caMin, caMax })}
                unit="€"
                step={100000}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Ouverture ≥">
                <Input
                  type="number"
                  value={filters.anneeOuvertureMin ?? ""}
                  onChange={(event) =>
                    onChange({
                      anneeOuvertureMin: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                  placeholder="1990"
                  className="h-[27px] text-[11px]"
                />
              </Field>
              <Field label="Rénovation ≥">
                <Input
                  type="number"
                  value={filters.renovationMin ?? ""}
                  onChange={(event) =>
                    onChange({
                      renovationMin: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                  placeholder="2015"
                  className="h-[27px] text-[11px]"
                />
              </Field>
            </div>
          </div>
        </FilterSection>

        <FilterSection
          title="Équipements"
          count={filters.equipements.length}
        >
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            {EQUIPMENT_FILTERS.map((equipment) => (
              <Checkbox
                key={equipment.key}
                checked={filters.equipements.includes(equipment.key)}
                onChange={() => toggleArray("equipements", equipment.key)}
                label={equipment.label}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Fiabilité des données" count={reliabilityCount}>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => onChange({ fiabiliteMin: "all" })}
              className={cn(
                "flex w-full items-center justify-between rounded-[2px] px-2 py-1.5 text-[11px]",
                filters.fiabiliteMin === "all"
                  ? "bg-navy/[0.06] text-ink"
                  : "text-muted hover:bg-black/[0.025]",
              )}
            >
              Toutes les valeurs
              <span className="tabular text-[10px] text-faint">N1 · N2 · N3</span>
            </button>
            {(["N1", "N2"] as Fiabilite[]).map((level) => {
              const meta = RELIABILITY_META[level];
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onChange({ fiabiliteMin: level })}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[2px] px-2 py-1.5 text-[11px]",
                    filters.fiabiliteMin === level
                      ? "bg-navy/[0.06] text-ink"
                      : "text-muted hover:bg-black/[0.025]",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: meta.color }}
                    />
                    {level === "N1" ? "Observé / vérifié (N1)" : "N1 + recherche (N2)"}
                  </span>
                </button>
              );
            })}
            <p className="px-2 pt-1 text-[9.5px] leading-snug text-faint">
              Le filtre s’applique à la source de l’année sélectionnée.
            </p>
          </div>
        </FilterSection>
      </div>

      <div className="border-t border-line bg-[#faf8f3] px-3 py-2">
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="text-muted">Année de référence</span>
          <select
            value={filters.annee}
            onChange={(event) => onChange({ annee: Number(event.target.value) })}
            className="rounded-[2px] border border-line-strong bg-surface px-1.5 py-0.5 text-[10.5px] tabular"
          >
            {[2025, 2024, 2023, 2022, 2021].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
