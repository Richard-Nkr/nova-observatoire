"use client";

import { Check, Minus, X } from "lucide-react";
import { TableShell, Td } from "@/components/ui/table";
import { CategoryBadge } from "@/components/ui/badge";
import { EQUIPMENT_ROWS } from "@/lib/hotel-utils";
import { fmtInt } from "@/lib/format";
import type { ComparisonColumn } from "@/lib/comparison";
import { cn } from "@/lib/utils";

/** Matrice des équipements : une colonne par acteur, la référence en tête. */
export function EquipmentMatrix({ columns }: { columns: ComparisonColumn[] }) {
  return (
    <div className="space-y-3">
      <TableShell className="rounded-[3px] border border-line bg-surface">
            <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 w-[190px] min-w-[190px] border-b border-r border-line bg-[#f7f5ef] px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.07em] text-muted">
                Équipement
              </th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={cn(
                    "sticky top-0 z-20 min-w-[118px] border-b border-l border-line bg-[#f7f5ef] px-2 py-2 align-top",
                    column.isReference && "border-l-2 border-l-accent bg-accent-soft/60",
                  )}
                >
                  <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-ink">{column.nom}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <CategoryBadge categorie={column.categorie} />
                    <span className="text-[9px] text-muted">{fmtInt(column.cles)} clés</span>
                  </div>
                  {column.isReference && (
                    <span className="mt-1 inline-block rounded-[2px] bg-accent px-1 py-[1px] text-[8px] font-semibold uppercase tracking-[0.08em] text-white">
                      Référence
                    </span>
                  )}
                </th>
              ))}
              <th className="sticky top-0 z-20 min-w-[98px] border-b border-l border-line bg-[#f7f5ef] px-2 py-2 text-right text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">
                Part du panel
              </th>
            </tr>
          </thead>
          <tbody>
            {EQUIPMENT_ROWS.map(({ key, label }) => {
              const known = columns.filter((column) => column.hotel);
              const equipped = known.filter((column) => column.hotel?.equipements[key]).length;
              return (
                <tr key={key}>
                  <Td className="sticky left-0 z-10 border-r border-line/70 bg-surface font-medium text-ink">
                    {label}
                  </Td>
                  {columns.map((column) => {
                    const value = column.hotel?.equipements[key];
                    return (
                      <Td
                        key={column.id}
                        align="center"
                        className={cn(
                          "border-l border-line/70",
                          column.isReference && "border-l-2 border-l-accent/45 bg-accent-soft/20",
                        )}
                      >
                        {value === undefined ? (
                          <span title="Non renseigné" className="inline-flex items-center gap-1 text-[9px] text-faint">
                            <Minus className="size-3" /> n.r.
                          </span>
                        ) : value ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green">
                            <Check className="size-3.5" /> Oui
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-faint">
                            <X className="size-3.5" /> Non
                          </span>
                        )}
                      </Td>
                    );
                  })}
                  <Td align="right" className="border-l border-line/70 text-[10px] text-muted">
                    {known.length ? `${equipped}/${known.length}` : "—"}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      <p className="text-[10px] italic text-faint">
        n.r. = non renseigné. L’actif client saisi manuellement ne porte pas d’équipements tant qu’ils ne sont pas documentés.
      </p>
    </div>
  );
}
