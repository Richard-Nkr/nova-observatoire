"use client";

import * as React from "react";
import {
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { Hotel } from "@/lib/types";
import { CHART_COLORS, ChartFrame } from "@/components/charts";
import { fmtEuro, fmtInt, fmtNum } from "@/lib/format";

export const SECTOR_COLORS = ["#a8653f", "#174965", "#256b4e", "#9a5d10", "#7f98a6", "#6c7074", "#8b6b9e"];

export interface PositioningRow {
  hotel: Hotel;
  index: number;
  adr: number;
  note: number;
  revpar: number | null;
  keys: number;
  secteur: string;
}

/** Prix × qualité : ADR en abscisse, note en ordonnée, taille = nombre de clés. */
export function PositioningChart({
  rows,
  sectors,
  meanAdr,
  meanNote,
}: {
  rows: PositioningRow[];
  sectors: string[];
  meanAdr: number | null;
  meanNote: number | null;
}) {
  const [active, setActive] = React.useState<PositioningRow | null>(null);
  const grouped = sectors
    .map((sector, index) => ({
      sector,
      color: SECTOR_COLORS[index % SECTOR_COLORS.length],
      rows: rows.filter((row) => row.secteur === sector),
    }))
    .filter((group) => group.rows.length > 0);

  return (
    <div>
      <ChartFrame height={320} empty={rows.length < 2}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 18, right: 18, bottom: 22, left: 2 }}>
            <CartesianGrid stroke={CHART_COLORS.line} strokeDasharray="2 4" />
            <XAxis
              type="number"
              dataKey="adr"
              name="ADR"
              tick={{ fontSize: 9.5, fill: "#6b747b" }}
              tickFormatter={(value) => `${fmtInt(Number(value))} €`}
              axisLine={false}
              tickLine={false}
              domain={["dataMin - 25", "dataMax + 30"]}
              label={{ value: "ADR (€ HT)", position: "insideBottom", offset: -8, fontSize: 9, fill: "#949b9f" }}
            />
            <YAxis
              type="number"
              dataKey="note"
              name="Note"
              domain={[0, 10]}
              tick={{ fontSize: 9.5, fill: "#6b747b" }}
              tickFormatter={(value) => fmtNum(Number(value), 1)}
              axisLine={false}
              tickLine={false}
              width={28}
              label={{ value: "Note /10", angle: -90, position: "insideLeft", fontSize: 9, fill: "#949b9f" }}
            />
            <ZAxis type="number" dataKey="keys" range={[45, 440]} />
            {meanAdr != null && <ReferenceLine x={meanAdr} stroke={CHART_COLORS.copper} strokeDasharray="4 4" />}
            {meanNote != null && <ReferenceLine y={meanNote} stroke={CHART_COLORS.copper} strokeDasharray="4 4" />}
            {grouped.map((group) => (
              <Scatter
                key={group.sector}
                name={group.sector}
                data={group.rows}
                fill={group.color}
                fillOpacity={0.86}
                onMouseEnter={(data) => setActive((data as unknown as { payload?: PositioningRow })?.payload ?? null)}
                onMouseLeave={() => setActive(null)}
              >
                <LabelList dataKey="index" position="top" fill="#39444e" fontSize={9} />
              </Scatter>
            ))}
            <Tooltip
              cursor={{ stroke: CHART_COLORS.navySoft, strokeDasharray: "3 3" }}
              content={() =>
                active ? (
                  <div className="rounded-[3px] border border-line-strong bg-surface px-2.5 py-2 text-[11px] shadow-[0_8px_28px_rgba(15,36,51,0.16)]">
                    <p className="font-medium text-ink">{active.hotel.nom}</p>
                    <p className="mt-0.5 text-[10px] text-faint">{active.secteur} · {fmtInt(active.keys)} clés</p>
                    <p className="mt-1 tabular text-ink-soft">ADR {fmtEuro(active.adr)} · Note {fmtNum(active.note, 1)}/10</p>
                    <p className="tabular text-ink-soft">RevPAR {active.revpar != null ? fmtEuro(active.revpar) : "—"}</p>
                  </div>
                ) : null
              }
            />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartFrame>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {grouped.map((group) => (
          <span key={group.sector} className="inline-flex items-center gap-1.5 text-[10px] text-muted">
            <span className="size-2 rounded-full" style={{ background: group.color }} />
            {group.sector}
          </span>
        ))}
        <span className="text-[10px] text-faint">Taille = clés · repères pointillés = moyennes du panel</span>
      </div>
    </div>
  );
}
