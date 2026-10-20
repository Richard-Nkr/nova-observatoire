"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Download,
  GitCompareArrows,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { CATEGORIES, CATEGORY_LABEL, CURRENT_DATA_YEAR, EXTRACTION_DATE, GROUPES } from "@/lib/constants";
import { fmtDate, fmtInt, fmtNum } from "@/lib/format";
import {
  defaultFilters,
  filterHotels,
  sortHotels,
  type SortDirection,
} from "@/lib/filters";
import { kpiFor, sum } from "@/lib/stats";
import { useStore } from "@/lib/store";
import type { Categorie, Filters } from "@/lib/types";
import { exportHotelsXlsx } from "@/lib/exports";
import { cn } from "@/lib/utils";
import { DemoStamp, ReliabilityBadge } from "@/components/reliability";
import { CategoryBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, SearchInput, Select } from "@/components/ui/field";
import { Card, PageHeader, StatTile } from "@/components/ui/misc";
import { TableShell, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type DirectorySort =
  | "nom"
  | "ville"
  | "categorie"
  | "cles"
  | "adr"
  | "to"
  | "revpar"
  | "note"
  | "caTotal";

export default function HotelsPage() {
  const router = useRouter();
  const { state, currentUser, toggleBasket } = useStore();
  const { toast } = useToast();
  const [filters, setFilters] = React.useState<Filters>(() => defaultFilters(CURRENT_DATA_YEAR));
  const [sortKey, setSortKey] = React.useState<DirectorySort>("revpar");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");

  const hotels = React.useMemo(
    () => filterHotels(state.hotels, state.kpis, filters),
    [state.hotels, state.kpis, filters],
  );
  const sorted = React.useMemo(
    () => sortHotels(hotels, state.kpis, sortKey, sortDirection, filters.annee),
    [hotels, state.kpis, sortKey, sortDirection, filters.annee],
  );

  const stats = React.useMemo(() => {
    const keys = sum(hotels.map((hotel) => hotel.cles));
    const adrs = hotels
      .map((hotel) => kpiFor(hotel.id, state.kpis, filters.annee)?.adr)
      .filter((value): value is number => value != null);
    const n1 = hotels.filter((hotel) => {
      const source = kpiFor(hotel.id, state.kpis, filters.annee)?.source ?? hotel.source;
      return source.fiabilite === "N1";
    }).length;
    return {
      keys,
      adr: adrs.length ? sum(adrs) / adrs.length : null,
      n1Share: hotels.length ? (n1 / hotels.length) * 100 : null,
    };
  }, [hotels, state.kpis, filters.annee]);

  const regions = React.useMemo(
    () => Array.from(new Set(state.hotels.map((hotel) => hotel.region))).sort(),
    [state.hotels],
  );
  const villes = React.useMemo(
    () =>
      Array.from(
        new Set(
          state.hotels
            .filter((hotel) => !filters.regions.length || filters.regions.includes(hotel.region))
            .map((hotel) => hotel.ville),
        ),
      ).sort(),
    [state.hotels, filters.regions],
  );

  const onSort = (key: string) => {
    const typed = key as DirectorySort;
    if (typed === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(typed);
      setSortDirection(typed === "nom" || typed === "ville" ? "asc" : "desc");
    }
  };

  const toggleCategory = (category: Categorie) => {
    setFilters((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  };

  const reset = () => setFilters(defaultFilters(CURRENT_DATA_YEAR));

  const exportExcel = () => {
    exportHotelsXlsx(sorted, state.kpis, filters.annee, {
      titre: "Portefeuille hôtelier",
      perimetre: "Répertoire filtré",
      auteur: currentUser.nom,
      filters,
    });
    toast({
      title: "Classeur généré",
      description: `${sorted.length} fiches, sources et méthodologie incluses.`,
      tone: "success",
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Base hôtelière"
        title="Fiches hôtels"
        description="Le répertoire central de l’observatoire : 200 établissements fictifs répartis sur cinq régions, filtrables et exportables avec leurs sources."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="size-3.5" />
              Exporter Excel
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => router.push("/comparateur")}
              disabled={state.basket.length < 2}
            >
              <GitCompareArrows className="size-3.5" />
              Comparer · {state.basket.length}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 border-y border-line bg-surface sm:grid-cols-4">
        <StatTile label="Hôtels" value={fmtInt(hotels.length)} sub={`sur ${state.hotels.length} fiches`} accent />
        <StatTile label="Clés" value={fmtInt(stats.keys)} sub="capacité cumulée" />
        <StatTile
          label="ADR moyen"
          value={stats.adr != null ? `${fmtNum(stats.adr, 0)} €` : "—"}
          sub={`exercice ${filters.annee}`}
        />
        <StatTile
          label="Sources N1"
          value={stats.n1Share != null ? `${fmtNum(stats.n1Share, 0)} %` : "—"}
          sub="observé / vérifié"
        />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
          <SearchInput
            value={filters.search}
            onChange={(search) => setFilters((current) => ({ ...current, search }))}
            placeholder="Nom, ville, groupe, adresse…"
            className="w-full sm:w-[250px]"
          />
          <Select
            value={filters.regions[0] ?? ""}
            onChange={(region) =>
              setFilters((current) => ({
                ...current,
                regions: region ? [region] : [],
                villes: [],
              }))
            }
            options={regions.map((region) => ({ value: region, label: region }))}
            placeholder="Toutes les régions"
            className="w-[180px]"
            aria-label="Filtrer par région"
          />
          <Select
            value={filters.villes[0] ?? ""}
            onChange={(ville) =>
              setFilters((current) => ({ ...current, villes: ville ? [ville] : [] }))
            }
            options={villes.map((ville) => ({ value: ville, label: ville }))}
            placeholder="Toutes les villes"
            className="w-[150px]"
            aria-label="Filtrer par ville"
          />
          <Select
            value={filters.groupes[0] ?? ""}
            onChange={(groupe) =>
              setFilters((current) => ({ ...current, groupes: groupe ? [groupe] : [] }))
            }
            options={GROUPES.map((groupe) => ({ value: groupe, label: groupe }))}
            placeholder="Tous les groupes"
            className="w-[170px]"
            aria-label="Filtrer par groupe"
          />
          <div className="flex items-center gap-1">
            {CATEGORIES.map((category) => (
              <button
                key={String(category)}
                type="button"
                onClick={() => toggleCategory(category)}
                className={cn(
                  "rounded-[2px] border px-1.5 py-[4px] text-[10px] font-medium transition-colors",
                  filters.categories.includes(category)
                    ? "border-navy bg-navy text-white"
                    : "border-line-strong bg-surface text-ink-soft hover:bg-paper",
                )}
              >
                {CATEGORY_LABEL[String(category)]}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Select
              value={String(filters.annee)}
              onChange={(annee) =>
                setFilters((current) => ({ ...current, annee: Number(annee) }))
              }
              options={[2025, 2024, 2023, 2022, 2021].map((year) => ({
                value: String(year),
                label: `Exercice ${year}`,
              }))}
              className="w-[135px]"
              aria-label="Exercice"
            />
            <Button variant="ghost" size="sm" onClick={reset}>
              <SlidersHorizontal className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-line bg-paper/40 px-3 py-2">
          <p className="text-[11px] text-muted">
            <span className="font-semibold text-ink">{sorted.length}</span> établissements ·{" "}
            <span className="tabular">{fmtInt(stats.keys)}</span> clés · extraction{" "}
            {fmtDate(EXTRACTION_DATE)} <DemoStamp className="ml-1" />
          </p>
          <p className="hidden text-[10px] text-faint sm:block">
            Cochez les fiches pour préparer un comparatif
          </p>
        </div>

        {sorted.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Building2 className="mx-auto mb-2 size-6 text-faint" />
            <p className="font-serif text-[19px] text-ink">Aucun hôtel ne correspond</p>
            <p className="mt-1 text-[12px] text-muted">Élargissez la recherche ou réinitialisez les filtres.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
              Réinitialiser les filtres
            </Button>
          </div>
        ) : (
          <TableShell className="max-h-[calc(100dvh-360px)]">
            <thead>
              <tr>
                <Th className="w-8" />
                <Th sortable active={sortKey === "nom"} direction={sortDirection} onSort={() => onSort("nom")}>
                  Hôtel
                </Th>
                <Th sortable active={sortKey === "categorie"} direction={sortDirection} onSort={() => onSort("categorie")}>
                  Cat.
                </Th>
                <Th>Groupe</Th>
                <Th sortable active={sortKey === "ville"} direction={sortDirection} onSort={() => onSort("ville")}>
                  Ville
                </Th>
                <Th sortable align="right" active={sortKey === "cles"} direction={sortDirection} onSort={() => onSort("cles")}>
                  Clés
                </Th>
                <Th sortable align="right" active={sortKey === "adr"} direction={sortDirection} onSort={() => onSort("adr")}>
                  ADR
                </Th>
                <Th sortable align="right" active={sortKey === "to"} direction={sortDirection} onSort={() => onSort("to")}>
                  TO
                </Th>
                <Th sortable align="right" active={sortKey === "revpar"} direction={sortDirection} onSort={() => onSort("revpar")}>
                  RevPAR
                </Th>
                <Th sortable align="right" active={sortKey === "note"} direction={sortDirection} onSort={() => onSort("note")}>
                  Note
                </Th>
                <Th>Source</Th>
                <Th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((hotel) => {
                const kpi = kpiFor(hotel.id, state.kpis, filters.annee);
                const inBasket = state.basket.includes(hotel.id);
                return (
                  <tr
                    key={hotel.id}
                    onClick={() => router.push(`/hotels/${hotel.id}`)}
                    className="group cursor-pointer transition-colors hover:bg-accent-soft/30"
                  >
                    <Td onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={inBasket}
                        onChange={() => toggleBasket(hotel.id)}
                        label={<span className="sr-only">Comparer {hotel.nom}</span>}
                      />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-7 w-[2px] rounded-full"
                          style={{ background: categoryColor(hotel.categorie) }}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{hotel.nom}</p>
                          <p className="flex items-center gap-1 text-[9.5px] text-faint">
                            <MapPin className="size-2.5" />
                            {hotel.adresse}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <CategoryBadge categorie={hotel.categorie} />
                    </Td>
                    <Td className="max-w-[120px] truncate text-[10.5px]">{hotel.groupe}</Td>
                    <Td>
                      <p className="text-ink">{hotel.ville}</p>
                      <p className="text-[9.5px] text-faint">{hotel.departement}</p>
                    </Td>
                    <Td align="right" className="tabular">{fmtInt(hotel.cles)}</Td>
                    <Td align="right" className="tabular">
                      {kpi?.adr != null ? `${fmtNum(kpi.adr, 0)} €` : "—"}
                    </Td>
                    <Td align="right" className="tabular">
                      {kpi?.to != null ? `${fmtNum(kpi.to * 100, 1)} %` : "—"}
                    </Td>
                    <Td align="right" className="tabular font-medium">
                      {kpi?.revpar != null ? `${fmtNum(kpi.revpar, 0)} €` : "—"}
                    </Td>
                    <Td align="right" className="tabular">
                      {kpi?.note != null ? fmtNum(kpi.note, 1) : "—"}
                    </Td>
                    <Td>{kpi && <ReliabilityBadge source={kpi.source} />}</Td>
                    <Td>
                      <ArrowRight className="size-3.5 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Card>

      <div className="flex items-center justify-between text-[10.5px] text-faint">
        <p>
          Chaque valeur est rattachée à une source datée. Les estimations N3 sont en italique
          gris dans les fiches.
        </p>
        <Link href="/" className="inline-flex items-center gap-1 text-accent hover:underline">
          <Search className="size-3" />
          Rechercher sur la carte
        </Link>
      </div>
    </div>
  );
}

function categoryColor(category: Categorie): string {
  if (category === "Palace") return "#B1844B";
  return { 1: "#9AA7AE", 2: "#9AA7AE", 3: "#7F98A6", 4: "#3E728D", 5: "#174965" }[category];
}
