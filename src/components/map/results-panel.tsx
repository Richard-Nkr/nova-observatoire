"use client";

import * as React from "react";
import {
  ChevronRight,
  Columns3,
  GitCompareArrows,
  ListFilter,
  Trash2,
  X,
} from "lucide-react";
import type { Hotel, KpiYear } from "@/lib/types";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/constants";
import { fmtEuro, fmtNum, fmtTo } from "@/lib/format";
import { kpiFor } from "@/lib/stats";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/filters";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { ReliabilityBadge } from "@/components/reliability";
import { Th } from "@/components/ui/table";

export type ResultColumn =
  | "categorie"
  | "ville"
  | "cles"
  | "adr"
  | "to"
  | "revpar"
  | "caTotal"
  | "caParCle"
  | "note";

const COLUMN_DEFS: {
  id: ResultColumn;
  label: string;
  width: number;
  align?: "left" | "right";
  sortKey: string;
}[] = [
  { id: "categorie", label: "Cat.", width: 36, sortKey: "categorie" },
  { id: "ville", label: "Ville", width: 70, sortKey: "ville" },
  { id: "cles", label: "Clés", width: 38, align: "right", sortKey: "cles" },
  { id: "adr", label: "ADR", width: 50, align: "right", sortKey: "adr" },
  { id: "to", label: "TO", width: 40, align: "right", sortKey: "to" },
  { id: "revpar", label: "RevPAR", width: 54, align: "right", sortKey: "revpar" },
  { id: "caTotal", label: "CA", width: 52, align: "right", sortKey: "caTotal" },
  { id: "caParCle", label: "CA/clé", width: 56, align: "right", sortKey: "caParCle" },
  { id: "note", label: "Note", width: 40, align: "right", sortKey: "note" },
];

const DEFAULT_COLUMNS: ResultColumn[] = ["categorie", "caTotal", "caParCle"];

export interface ResultsPanelProps {
  hotels: Hotel[];
  kpis: KpiYear[];
  annee: number;
  basket: string[];
  selectedHotelId: string | null;
  onToggleBasket: (hotelId: string) => void;
  onSelectHotel: (hotelId: string) => void;
  onClearBasket: () => void;
  onCompare: () => void;
  onClose?: () => void;
  sortKey: string;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
}

/**
 * Liste de résultats synchronisée avec la carte.
 * Les colonnes sont configurables ; chaque ligne affiche la fiabilité
 * de l'exercice, avec la source complète au survol.
 */
export function ResultsPanel({
  hotels,
  kpis,
  annee,
  basket,
  selectedHotelId,
  onToggleBasket,
  onSelectHotel,
  onClearBasket,
  onCompare,
  onClose,
  sortKey,
  sortDirection,
  onSort,
}: ResultsPanelProps) {
  const [columns, setColumns] = React.useState<ResultColumn[]>(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = React.useState(false);
  const [limit, setLimit] = React.useState(80);

  const visible = COLUMN_DEFS.filter((column) => columns.includes(column.id));
  const shown = hotels.slice(0, limit);

  const toggleColumn = (column: ResultColumn) => {
    setColumns((current) =>
      current.includes(column)
        ? current.length > 1
          ? current.filter((item) => item !== column)
          : current
        : [...current, column],
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink">
            Résultats
          </p>
          <p className="truncate text-[10px] tabular text-muted">
            {hotels.length} hôtels au périmètre
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setColumnsOpen(true)}
            aria-label="Configurer les colonnes"
            title="Configurer les colonnes"
          >
            <Columns3 className="size-3.5" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="iconSm"
              onClick={onClose}
              aria-label="Fermer les résultats"
              className="xl:hidden"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-auto">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <ListFilter className="mb-3 size-5 text-faint" />
            <p className="font-serif text-[17px] text-ink">Aucun hôtel ne correspond</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              Élargissez le périmètre géographique ou retirez un critère.
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[350px] border-collapse text-left">
            <thead>
              <tr>
                <th className="sticky top-0 z-10 w-[24px] border-b border-line bg-[#f7f5ef] px-1.5 py-2">
                  <span className="sr-only">Comparer</span>
                </th>
                <Th
                  sortable
                  active={sortKey === "nom"}
                  direction={sortDirection}
                  onSort={() => onSort("nom")}
                  className="min-w-[132px]"
                >
                  Hôtel
                </Th>
                {visible.map((column) => (
                  <Th
                    key={column.id}
                    sortable
                    active={sortKey === column.sortKey}
                    direction={sortDirection}
                    onSort={() => onSort(column.sortKey)}
                    align={column.align}
                    className="whitespace-nowrap"
                  >
                    {column.label}
                  </Th>
                ))}
                <Th align="center" className="w-[32px]">
                  Fiab.
                </Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((hotel) => {
                const kpi = kpiFor(hotel.id, kpis, annee);
                const inBasket = basket.includes(hotel.id);
                const selected = selectedHotelId === hotel.id;
                return (
                  <tr
                    key={hotel.id}
                    onClick={() => onSelectHotel(hotel.id)}
                    className={cn(
                      "group cursor-pointer border-b border-line/70 transition-colors hover:bg-black/[0.022]",
                      selected && "bg-accent-soft/45 hover:bg-accent-soft/55",
                    )}
                  >
                    <td className="px-1.5 py-1.5 align-top">
                      <span onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={inBasket}
                          onChange={() => onToggleBasket(hotel.id)}
                          label={<span className="sr-only">Comparer {hotel.nom}</span>}
                        />
                      </span>
                    </td>
                    <td className="max-w-[165px] px-1.5 py-1.5 align-top">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectHotel(hotel.id);
                        }}
                        className="block w-full text-left"
                      >
                        <span
                          className="block truncate text-[11.5px] font-medium leading-tight text-ink group-hover:text-navy"
                          title={hotel.nom}
                        >
                          {hotel.nom}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[9.5px] text-muted">
                          <span
                            className="size-1.5 rounded-full"
                            style={{
                              background: CATEGORY_COLOR[String(hotel.categorie)],
                            }}
                          />
                          {hotel.ville}
                          <span className="text-faint">·</span>
                          <span className="tabular">{hotel.cles} clés</span>
                        </span>
                      </button>
                    </td>
                    {visible.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          "whitespace-nowrap px-1.5 py-1.5 align-top text-[11px]",
                          column.align === "right" && "text-right tabular",
                        )}
                      >
                        {renderCell(column.id, hotel, kpi)}
                      </td>
                    ))}
                    <td className="px-1 py-1.5 text-center align-top">
                      {kpi ? (
                        <ReliabilityBadge source={kpi.source} />
                      ) : (
                        <span className="text-[9px] text-faint">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {hotels.length > shown.length && (
          <div className="flex justify-center px-3 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLimit((value) => value + 80)}
              className="text-[11px]"
            >
              Afficher {Math.min(80, hotels.length - shown.length)} résultats de plus
              <ChevronRight className="size-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-line bg-[#faf8f3] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10.5px] tabular text-ink-soft">
              {basket.length > 0 ? (
                <>
                  <span className="font-semibold text-ink">{basket.length}</span> hôtel
                  {basket.length > 1 ? "s" : ""} dans le comparateur
                </>
              ) : (
                "Cochez 2 à 30 hôtels pour comparer"
              )}
            </p>
            {basket.length > 0 && (
              <button
                type="button"
                onClick={onClearBasket}
                className="mt-0.5 inline-flex items-center gap-1 text-[9.5px] text-muted hover:text-danger"
              >
                <Trash2 className="size-2.5" />
                Vider la sélection
              </button>
            )}
          </div>
          <Button
            variant="accent"
            size="sm"
            onClick={onCompare}
            disabled={basket.length < 2}
            className="shrink-0 text-[11px]"
          >
            <GitCompareArrows className="size-3.5" />
            Comparer
          </Button>
        </div>
        <p className="mt-1.5 text-[9px] leading-tight text-faint">
          Exercice {annee} · source et fiabilité au survol de chaque pastille.
        </p>
      </div>

      <Dialog open={columnsOpen} onOpenChange={setColumnsOpen}>
        <DialogContent>
          <DialogHeader
            title="Colonnes du tableau"
            description="Choisissez les indicateurs affichés dans la liste de résultats."
          />
          <DialogBody>
            <div className="grid grid-cols-2 gap-2">
              {COLUMN_DEFS.map((column) => (
                <Checkbox
                  key={column.id}
                  checked={columns.includes(column.id)}
                  onChange={() => toggleColumn(column.id)}
                  label={column.label}
                  className="rounded-[2px] border border-line px-2 py-1.5 hover:border-line-strong"
                />
              ))}
            </div>
            <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
              Le nom de l’hôtel, la fiabilité et la sélection restent toujours visibles.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setColumns(DEFAULT_COLUMNS)}
            >
              Réinitialiser
            </Button>
            <Button variant="primary" size="sm" onClick={() => setColumnsOpen(false)}>
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function renderCell(
  column: ResultColumn,
  hotel: Hotel,
  kpi: ReturnType<typeof kpiFor>,
) {
  switch (column) {
    case "categorie":
      return (
        <span
          className="inline-flex min-w-[30px] items-center justify-center rounded-[2px] border border-line px-1 py-[0.5px] text-[9.5px] font-medium"
          style={{
            color: CATEGORY_COLOR[String(hotel.categorie)],
            borderColor: `${CATEGORY_COLOR[String(hotel.categorie)]}40`,
            background: `${CATEGORY_COLOR[String(hotel.categorie)]}0d`,
          }}
        >
          {CATEGORY_LABEL[String(hotel.categorie)]}
        </span>
      );
    case "ville":
      return <span className="text-[10.5px] text-muted">{hotel.ville}</span>;
    case "cles":
      return <span>{fmtNum(hotel.cles, 0)}</span>;
    case "adr":
      return <span className={!kpi?.adr ? "text-faint" : undefined}>{fmtEuro(kpi?.adr)}</span>;
    case "to":
      return <span className={!kpi?.to ? "text-faint" : undefined}>{fmtTo(kpi?.to)}</span>;
    case "revpar":
      return (
        <span className={cn("font-medium", !kpi?.revpar && "font-normal text-faint")}>
          {fmtEuro(kpi?.revpar)}
        </span>
      );
    case "caTotal":
      return <span>{fmtEuro(kpi?.caTotal, true)}</span>;
    case "caParCle":
      return (
        <span>
          {kpi?.caTotal != null && hotel.cles > 0 ? fmtEuro(kpi.caTotal / hotel.cles) : "—"}
        </span>
      );
    case "note":
      return <span>{kpi?.note != null ? fmtNum(kpi.note, 1) : "—"}</span>;
    default:
      return null;
  }
}
