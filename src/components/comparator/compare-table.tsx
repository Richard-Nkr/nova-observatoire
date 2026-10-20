"use client";

import * as React from "react";
import { X } from "lucide-react";
import { TableShell, Td, Th } from "@/components/ui/table";
import { CategoryBadge } from "@/components/ui/badge";
import { ReliabilityBadge } from "@/components/reliability";
import { KPI_LABELS } from "@/lib/constants";
import { formatMetric } from "@/lib/stats";
import { bestWorst, comparisonStats, gapToReference, type ComparisonColumn } from "@/lib/comparison";
import type { KpiKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtInt } from "@/lib/format";

const GROUPS: { label: string; keys: KpiKey[] }[] = [
  { label: "Performance documentée", keys: ["caTotal"] },
  {
    label: "Structure et productivité",
    keys: ["cles", "caParCle", "surfaceTotale"],
  },
];

/** Tableau dense : une colonne par acteur, une ligne par indicateur, écarts à la référence. */
export function CompareTable({
  columns,
  onRemoveHotel,
  onSetReference,
}: {
  columns: ComparisonColumn[];
  onRemoveHotel: (hotelId: string) => void;
  onSetReference: (hotelId: string) => void;
}) {
  if (!columns.length) return null;
  return (
    <TableShell className="max-h-[70vh] rounded-[3px] border border-line bg-surface">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 w-[190px] min-w-[190px] border-b border-r border-line bg-[#f7f5ef] px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.07em] text-muted">
              Indicateur
            </th>
            {columns.map((column) => (
              <th
                key={column.id}
                className={cn(
                  "sticky top-0 z-20 min-w-[168px] border-b border-l border-line bg-[#f7f5ef] px-2.5 py-2 align-top",
                  column.isReference && "border-l-2 border-l-accent bg-accent-soft/60",
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="line-clamp-2 text-[10.5px] font-semibold leading-tight tracking-normal text-ink">
                    {column.nom}
                  </span>
                  {!column.isReference && column.hotelId && (
                    <button
                      type="button"
                      aria-label={`Retirer ${column.nom}`}
                      onClick={() => onRemoveHotel(column.hotelId!)}
                      className="mt-0.5 rounded p-0.5 text-faint hover:bg-black/5 hover:text-danger"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <CategoryBadge categorie={column.categorie} />
                  <span className="text-[9.5px] text-muted">{fmtInt(column.cles)} clés</span>
                </div>
                <p className="mt-0.5 truncate text-[9.5px] font-normal text-faint">{column.ville}</p>
                {column.isReference ? (
                  <span className="mt-1 inline-block rounded-[2px] bg-accent px-1 py-[1px] text-[8px] font-semibold uppercase tracking-[0.08em] text-white">
                    Référence
                  </span>
                ) : (
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => column.hotelId && onSetReference(column.hotelId)}
                      className="text-[8.5px] uppercase tracking-[0.06em] text-muted underline-offset-2 hover:text-accent hover:underline"
                    >
                      Définir réf.
                    </button>
                    <ReliabilityBadge source={column.source} />
                  </div>
                )}
                {column.isReference && (
                  <div className="mt-1">
                    <ReliabilityBadge source={column.source} showText />
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((group) => (
            <React.Fragment key={group.label}>
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="sticky left-0 border-b border-line bg-[#f2efe8] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-accent"
                >
                  {group.label}
                </td>
              </tr>
              {group.keys.map((key) => {
                const metric = KPI_LABELS[key];
                const limits = bestWorst(columns, key);
                const referenceValue = columns[0]?.values[key] ?? null;
                return (
                  <tr key={key} className="group">
                    <td className="sticky left-0 z-10 border-b border-r border-line/70 bg-surface px-3 py-[7px] group-hover:bg-[#fbfaf6]">
                      <span className="block text-[11.5px] text-ink">{metric.label}</span>
                      <span className="text-[9px] uppercase tracking-[0.05em] text-faint">
                        {metric.unit}
                      </span>
                    </td>
                    {columns.map((column) => {
                      const value = column.values[key] ?? null;
                      const gap = column.isReference ? null : gapToReference(key, value, referenceValue);
                      const isBest = limits != null && value === limits.best;
                      const isWorst = limits != null && value === limits.worst;
                      return (
                        <Td
                          key={column.id}
                          align="right"
                          className={cn(
                            "border-l border-line/70 px-2.5",
                            column.isReference && "border-l-2 border-l-accent/45 bg-accent-soft/20",
                            isBest && "bg-green-soft/50",
                            isWorst && "bg-danger-soft/45",
                          )}
                          title={column.source.source}
                        >
                          <span
                            className={cn(
                              "block text-[12px] font-medium text-ink",
                              column.source.fiabilite === "N3" && "font-normal italic text-grey",
                              value == null && "font-normal text-faint",
                            )}
                          >
                            {formatMetric(key, value, true)}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block text-[9px] tabular leading-tight",
                              column.isReference && "text-accent",
                              gap?.favorable === true && "text-green",
                              gap?.favorable === false && "text-danger",
                              gap?.favorable == null && "text-faint",
                            )}
                          >
                            {column.isReference ? "référence" : gap?.text ?? "—"}
                          </span>
                        </Td>
                      );
                    })}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
    </TableShell>
  );
}

export function ComparisonStatsTable({ columns }: { columns: ComparisonColumn[] }) {
  const keys: KpiKey[] = ["caTotal", "caParCle", "adr", "to", "revpar", "ebitdaPct", "note", "cles"];
  return (
    <TableShell className="rounded-[3px] border border-line bg-surface">
        <thead>
          <tr>
            <Th>Indicateur</Th>
            <Th align="right">Moyenne</Th>
            <Th align="right">Médiane</Th>
            <Th align="right">Minimum</Th>
            <Th align="right">Maximum</Th>
            <Th align="right">Valeurs</Th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const stats = comparisonStats(columns, key);
            return (
              <tr key={key}>
                <Td className="font-medium text-ink">{KPI_LABELS[key].label}</Td>
                <Td align="right">{formatMetric(key, stats.mean, true)}</Td>
                <Td align="right">{formatMetric(key, stats.median, true)}</Td>
                <Td align="right">{formatMetric(key, stats.min, true)}</Td>
                <Td align="right">{formatMetric(key, stats.max, true)}</Td>
                <Td align="right" className="text-muted">{stats.count}</Td>
              </tr>
            );
          })}
        </tbody>
    </TableShell>
  );
}
