"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartFrame, CHART_COLORS } from "@/components/charts";
import { Card, SectionTitle } from "@/components/ui/misc";
import { Select } from "@/components/ui/field";
import { CATEGORY_COLOR } from "@/lib/constants";
import { KPI_LABELS } from "@/lib/constants";
import { formatMetric } from "@/lib/stats";
import type { ComparisonColumn } from "@/lib/comparison";
import type { KpiKey } from "@/lib/types";
import { fmtEuro, fmtInt } from "@/lib/format";

type ScatterDatum = {
  id: string;
  nom: string;
  caTotal: number;
  cles: number;
  categorie: string;
  isReference: boolean;
};

function ScatterTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: ScatterDatum }[];
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const datum = payload[0].payload;
  return (
    <div className="rounded-[3px] border border-line-strong bg-surface px-3 py-2 text-[11px] shadow-[0_8px_28px_rgba(15,36,51,0.16)]">
      <p className="font-medium text-ink">{datum.nom}</p>
      <p className="mt-0.5 text-[10px] text-muted">
        CA {fmtEuro(datum.caTotal, true)} · {fmtEuro(datum.caTotal / Math.max(1, datum.cles))} / clé
      </p>
      <p className="mt-0.5 text-[10px] text-muted">
        {fmtInt(datum.cles)} clés · {datum.categorie}
        {datum.isReference ? " · référence" : ""}
      </p>
    </div>
  );
}

/** CA × capacité, taille = nombre de clés. */
export function PriceOccupancyScatter({ columns }: { columns: ComparisonColumn[] }) {
  const data: ScatterDatum[] = columns
    .filter((column) => column.values.caTotal != null && column.cles > 0)
    .map((column) => ({
      id: column.id,
      nom: column.nom,
      caTotal: column.values.caTotal as number,
      cles: column.cles,
      categorie: column.categorie === "Palace" ? "Palace" : `${column.categorie}★`,
      isReference: column.isReference,
    }));
  const reference = data.find((datum) => datum.isReference);
  const keyCounts = data.map((datum) => datum.cles);
  const domain: [number, number] = [
    Math.floor(Math.min(...keyCounts, reference?.cles ?? 0) * 0.85),
    Math.ceil(Math.max(...keyCounts, reference?.cles ?? 0) * 1.08),
  ];
  return (
    <Card>
      <SectionTitle hint="Taille de bulle = nombre de clés. Ligne cuivrée = actif de référence.">
        CA × capacité
      </SectionTitle>
      <ChartFrame height={290} empty={data.length < 2}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 22, left: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.line} strokeDasharray="2 3" />
            <XAxis
              dataKey="cles"
              type="number"
              name="Clés"
              domain={domain}
              tick={{ fontSize: 9, fill: "#6b747b" }}
              axisLine={{ stroke: "#d3ccbf" }}
              tickLine={false}
              tickFormatter={(value: number) => fmtInt(value)}
              label={{ value: "Nombre de clés", position: "insideBottom", offset: -10, fontSize: 9, fill: "#949b9f" }}
            />
            <YAxis
              dataKey="caTotal"
              type="number"
              name="CA"
              tick={{ fontSize: 9, fill: "#6b747b" }}
              axisLine={{ stroke: "#d3ccbf" }}
              tickLine={false}
              tickFormatter={(value: number) => fmtEuro(value, true)}
              width={58}
            />
            <ZAxis dataKey="cles" range={[70, 420]} />
            <Tooltip content={<ScatterTip />} />
            {reference && (
              <>
                <ReferenceLine x={reference.cles} stroke={CHART_COLORS.copper} strokeDasharray="3 3" />
                <ReferenceLine y={reference.caTotal} stroke={CHART_COLORS.copper} strokeDasharray="3 3" />
              </>
            )}
            <Scatter data={data} name="Hôtels">
              {data.map((datum) => (
                <Cell
                  key={datum.id}
                  fill={datum.isReference ? CHART_COLORS.copper : CATEGORY_COLOR[datum.categorie]}
                  fillOpacity={datum.isReference ? 0.95 : 0.68}
                  stroke={datum.isReference ? "#8b5030" : "#ffffff"}
                  strokeWidth={datum.isReference ? 2 : 1}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </ChartFrame>
    </Card>
  );
}

const RANKED_METRICS: KpiKey[] = ["caTotal", "caParCle", "cles", "surfaceTotale"];

/** Classement du panel sur l'indicateur choisi. */
export function RankedBars({ columns }: { columns: ComparisonColumn[] }) {
  const [metric, setMetric] = React.useState<KpiKey>("caParCle");
  const data = columns
    .filter((column) => column.values[metric] != null)
    .sort((a, b) => (b.values[metric] as number) - (a.values[metric] as number))
    .slice(0, 12)
    .map((column) => ({
      id: column.id,
      nom: column.nom.length > 30 ? `${column.nom.slice(0, 29)}…` : column.nom,
      valeur: (metric === "to" || metric === "ebitdaPct" ? (column.values[metric] as number) * 100 : column.values[metric]) as number,
      isReference: column.isReference,
      categorie: column.categorie === "Palace" ? "Palace" : `${column.categorie}★`,
    }))
    .reverse();
  const hidden = columns.filter((column) => column.values[metric] != null).length - data.length;
  return (
    <Card>
      <SectionTitle
        hint={hidden > 0 ? `12 premiers affichés · ${hidden} autre(s)` : "Ensemble du panel"}
        action={
          <Select
            value={metric}
            onChange={(value) => setMetric(value as KpiKey)}
            options={RANKED_METRICS.map((key) => ({ value: key, label: KPI_LABELS[key].short }))}
            className="w-[132px]"
            aria-label="Indicateur classé"
          />
        }
      >
        Classement du panel
      </SectionTitle>
      <ChartFrame height={Math.max(250, data.length * 24 + 28)} empty={data.length < 2}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 38, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={CHART_COLORS.line} horizontal={false} strokeDasharray="2 3" />
            <XAxis
              type="number"
              tick={{ fontSize: 9, fill: "#6b747b" }}
              axisLine={{ stroke: "#d3ccbf" }}
              tickLine={false}
              tickFormatter={(value: number) => formatMetric(metric, value, true)}
            />
            <YAxis
              dataKey="nom"
              type="category"
              width={150}
              tick={{ fontSize: 9, fill: "#39444e" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => formatMetric(metric, Number(value), true)}
              contentStyle={{ fontSize: 11, borderColor: "#d3ccbf", borderRadius: 3 }}
            />
            <Bar dataKey="valeur" radius={[0, 2, 2, 0]} barSize={12}>
              {data.map((datum) => (
                <Cell key={datum.id} fill={datum.isReference ? CHART_COLORS.copper : CHART_COLORS.navySoft} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <p className="mt-1 text-[10px] italic text-faint">
        {metric === "to" || metric === "ebitdaPct" ? "Valeurs en %." : `Valeurs en ${KPI_LABELS[metric].unit}.`}
      </p>
    </Card>
  );
}

const RADAR_KEYS: KpiKey[] = ["caTotal", "caParCle", "cles", "surfaceTotale"];
const RADAR_COLORS = ["#a8653f", "#174965", "#3e728d", "#7f98a6", "#256b4e", "#9a5d10"];

/** Radar normalisé 0–100 : 100 = meilleure valeur du panel sur l'axe. */
export function NormalizedRadar({ columns }: { columns: ComparisonColumn[] }) {
  const shown = columns.slice(0, 6);
  const data = RADAR_KEYS.map((key) => {
    const values = shown
      .map((column) => column.values[key])
      .filter((value): value is number => value != null && Number.isFinite(value));
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const item: Record<string, string | number> = { subject: KPI_LABELS[key].short };
    for (const column of shown) {
      const value = column.values[key];
      if (value == null) {
        item[column.id] = 0;
      } else if (max === min) {
        item[column.id] = 50;
      } else {
        item[column.id] = Math.round(((value - min) / (max - min)) * 100);
      }
    }
    return item;
  });
  return (
    <Card>
      <SectionTitle hint="Indice 0–100, recalculé sur chaque axe. Limité aux 6 premiers acteurs.">
        Profil normalisé
      </SectionTitle>
      <ChartFrame height={300} empty={shown.length < 2}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke={CHART_COLORS.line} />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "#39444e" }} />
            <Tooltip contentStyle={{ fontSize: 11, borderColor: "#d3ccbf", borderRadius: 3 }} />
            <Legend wrapperStyle={{ fontSize: 9.5 }} iconSize={7} />
            {shown.map((column, index) => (
              <Radar
                key={column.id}
                name={column.isReference ? `${column.nom} (réf.)` : column.nom}
                dataKey={column.id}
                stroke={RADAR_COLORS[index % RADAR_COLORS.length]}
                fill={RADAR_COLORS[index % RADAR_COLORS.length]}
                fillOpacity={index === 0 ? 0.16 : 0.05}
                strokeWidth={index === 0 ? 2 : 1.2}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <p className="mt-1 text-[10px] italic text-faint">
        Les indicateurs manquants sont représentés à zéro, jamais interpolés.
      </p>
    </Card>
  );
}

/** Mini courbe de repère de la référence sur le panel. */
export function ReferenceGapLine({ columns }: { columns: ComparisonColumn[] }) {
  const [metric, setMetric] = React.useState<KpiKey>("caParCle");
  const reference = columns.find((column) => column.isReference);
  const values = columns
    .filter((column) => !column.isReference && column.values[metric] != null)
    .map((column) => (column.values[metric] as number))
    .sort((a, b) => a - b);
  const refValue = reference?.values[metric] ?? null;
  if (refValue == null || !values.length) return null;
  const below = values.filter((value) => value < refValue).length;
  const percentile = Math.round((below / values.length) * 100);
  return (
    <Card>
      <SectionTitle
        action={
          <Select
            value={metric}
            onChange={(value) => setMetric(value as KpiKey)}
            options={RANKED_METRICS.map((key) => ({ value: key, label: KPI_LABELS[key].short }))}
            className="w-[132px]"
            aria-label="Indicateur de position"
          />
        }
      >
        Position de la référence
      </SectionTitle>
      <p className="text-[30px] font-semibold leading-none tracking-[-0.035em] text-ink">{percentile}<span className="text-[15px] text-muted">e percentile</span></p>
      <p className="mt-1 text-[11.5px] text-muted">
        {below} concurrent(s) sur {values.length} affichent une valeur inférieure pour {KPI_LABELS[metric].short.toLowerCase()}.
      </p>
      <div className="mt-3">
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={values.map((value, index) => ({ index, value }))} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <ReferenceLine y={refValue} stroke={CHART_COLORS.copper} strokeDasharray="3 3" />
            <Bar dataKey="value">
              {values.map((value, index) => (
                <Cell key={index} fill={value >= refValue ? CHART_COLORS.navySoft : "#d8d2c5"} />
              ))}
            </Bar>
            <Tooltip formatter={(value) => formatMetric(metric, Number(value), true)} contentStyle={{ fontSize: 11, borderColor: "#d3ccbf", borderRadius: 3 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 flex items-center gap-2 text-[10.5px] text-muted">
        <span className="inline-block h-[2px] w-6 bg-accent" />
        Référence : {formatMetric(metric, refValue, true)}
      </p>
    </Card>
  );
}
