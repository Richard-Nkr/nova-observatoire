"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const CHART_COLORS = {
  navy: "#174965",
  navySoft: "#7f98a6",
  copper: "#a8653f",
  green: "#256b4e",
  amber: "#9a5d10",
  grey: "#949b9f",
  line: "#e4dfd5",
};

export function ChartTip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }[];
  label?: string | number;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[3px] border border-line-strong bg-surface px-2.5 py-2 text-[11px] shadow-[0_8px_28px_rgba(15,36,51,0.16)]">
      {label !== undefined && (
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </p>
      )}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <span
            className="size-1.5 rounded-full"
            style={{ background: entry.color ?? CHART_COLORS.navy }}
          />
          <span className="text-muted">{entry.name}</span>
          <span className="ml-auto tabular font-medium text-ink">
            {typeof entry.value === "number" && formatter
              ? formatter(entry.value, entry.name ?? "")
              : String(entry.value ?? "—")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ChartFrame({
  children,
  height = 230,
  className,
  empty,
}: {
  children: React.ReactNode;
  height?: number;
  className?: string;
  empty?: boolean;
}) {
  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      {empty ? (
        <div className="flex h-full items-center justify-center border border-dashed border-line bg-paper/40 text-[11.5px] text-faint">
          Données insuffisantes pour cet indicateur
        </div>
      ) : (
        children
      )}
    </div>
  );
}
