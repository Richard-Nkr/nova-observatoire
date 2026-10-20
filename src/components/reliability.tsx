import * as React from "react";
import { cn } from "@/lib/utils";
import { RELIABILITY_META } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import type { KpiKey, SourceRef } from "@/lib/types";
import { formatMetric } from "@/lib/stats";
import { Tooltip } from "./ui/tooltip";

/** Pastille de fiabilité, toujours accompagnée de sa source au survol. */
export function ReliabilityBadge({
  source,
  className,
  showText = false,
}: {
  source: SourceRef;
  className?: string;
  showText?: boolean;
}) {
  const meta = RELIABILITY_META[source.fiabilite];
  return (
    <Tooltip
      content={
        <span className="block space-y-1">
          <span className="block font-semibold tracking-wide">
            {source.fiabilite} · {meta.description}
          </span>
          <span className="block text-white/80">{source.source}</span>
          <span className="block text-white/60">
            {fmtDate(source.dateSource)} · {source.auteur}
          </span>
          {source.hypothese && (
            <span className="block border-t border-white/15 pt-1 italic text-white/75">
              Hypothèse : {source.hypothese}
            </span>
          )}
        </span>
      }
    >
      <span
        className={cn(
          "inline-flex cursor-help items-center gap-1 rounded-[2px] border px-1 py-[1px] text-[9.5px] font-semibold leading-[14px] tracking-[0.04em]",
          source.fiabilite === "N3" && "italic",
          className,
        )}
        style={{
          color: meta.color,
          background: meta.bg,
          borderColor: meta.border,
        }}
      >
        {source.fiabilite}
        {showText && <span className="font-normal">{meta.description}</span>}
      </span>
    </Tooltip>
  );
}

export function SourceInline({
  source,
  className,
}: {
  source: SourceRef;
  className?: string;
}) {
  return (
    <Tooltip
      content={
        <span className="block space-y-1">
          <span className="block font-semibold">{source.source}</span>
          <span className="block text-white/70">
            {fmtDate(source.dateSource)} · {source.auteur} · {source.fiabilite}
          </span>
          {source.hypothese && (
            <span className="block italic text-white/70">{source.hypothese}</span>
          )}
        </span>
      }
    >
      <span className={cn("cursor-help truncate text-[10.5px] text-muted", className)}>
        {source.source}
      </span>
    </Tooltip>
  );
}

/**
 * Valeur d'indicateur + fiabilité. Une estimation N3 est en italique gris,
 * conformément à la règle de lecture métier.
 */
export function KpiValue({
  value,
  source,
  kpi,
  compact,
  className,
}: {
  value: number | null | undefined;
  source?: SourceRef;
  kpi: KpiKey;
  compact?: boolean;
  className?: string;
}) {
  const estimated = source?.fiabilite === "N3";
  return (
    <span className={cn("inline-flex items-baseline gap-1 tabular", className)}>
      <span
        className={cn(
          "text-[12px] font-medium",
          estimated && "italic font-normal text-grey",
          (value === null || value === undefined) && "text-faint",
        )}
      >
        {formatMetric(kpi, value, compact)}
      </span>
      {source && <ReliabilityBadge source={source} />}
    </span>
  );
}

export function DemoStamp({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] border border-dashed border-[#c8b9a8] px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#8a6c52]",
        className,
      )}
    >
      Démo
    </span>
  );
}
