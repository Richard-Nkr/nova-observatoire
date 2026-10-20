"use client";

import * as React from "react";
import type { Hotel, KpiYear } from "@/lib/types";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/constants";
import { fmtEuro, fmtInt } from "@/lib/format";
import { kpiFor } from "@/lib/stats";
import { cn } from "@/lib/utils";

type RegionFeature = {
  properties?: { nom?: string; code?: string };
  geometry: { type: string; coordinates: unknown };
};

type Ring = number[][];
type PolygonCoords = Ring[];

function polygonsOf(geometry: RegionFeature["geometry"]): PolygonCoords[] {
  if (geometry.type === "Polygon") return [geometry.coordinates as PolygonCoords];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as PolygonCoords[];
  return [];
}

function withinBounds(
  hotel: Hotel,
  bounds: { west: number; south: number; east: number; north: number },
) {
  return (
    hotel.longitude > bounds.west &&
    hotel.longitude < bounds.east &&
    hotel.latitude > bounds.south &&
    hotel.latitude < bounds.north
  );
}

function project(
  lng: number,
  lat: number,
  bounds: { west: number; south: number; east: number; north: number },
  width: number,
  height: number,
) {
  return {
    x: ((lng - bounds.west) / (bounds.east - bounds.west)) * width,
    y: ((bounds.north - lat) / (bounds.north - bounds.south)) * height,
  };
}

/**
 * Carte concurrentielle légère en SVG : fond administratif, marqueurs numérotés et
 * légende. Elle est volontairement autonome pour être exportée dans PowerPoint.
 */
export function CompetitiveMap({
  hotels,
  kpis,
  annee,
  title,
  className,
  mapRef,
  contextHotels,
}: {
  hotels: Hotel[];
  kpis: KpiYear[];
  annee: number;
  title?: string;
  className?: string;
  mapRef?: React.RefObject<HTMLDivElement | null>;
  contextHotels?: Hotel[];
}) {
  const [regions, setRegions] = React.useState<RegionFeature[]>([]);
  const [departments, setDepartments] = React.useState<RegionFeature[]>([]);
  const width = 820;
  const height = 460;

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/geo/regions.geojson").then((response) => response.json()),
      fetch("/geo/departements.geojson").then((response) => response.json()),
    ])
      .then(([regionData, departmentData]: [{ features?: RegionFeature[] }, { features?: RegionFeature[] }]) => {
        if (cancelled) return;
        setRegions(regionData.features ?? []);
        setDepartments(departmentData.features ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setRegions([]);
          setDepartments([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bounds = React.useMemo(() => {
    if (!hotels.length) return { west: -5, south: 42, east: 9, north: 51.4 };
    const lngs = hotels.map((hotel) => hotel.longitude);
    const lats = hotels.map((hotel) => hotel.latitude);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const spanLng = Math.max(maxLng - minLng, 0.16);
    const spanLat = Math.max(maxLat - minLat, 0.22);
    const paddedLng = Math.max(spanLng, 0.42);
    const paddedLat = Math.max(spanLat, 0.3);
    const padLng = paddedLng * 0.35;
    const padLat = paddedLat * 0.4;
    return {
      west: minLng - padLng,
      east: maxLng + padLng,
      south: minLat - padLat,
      north: maxLat + padLat,
    };
  }, [hotels]);

  const local = bounds.east - bounds.west < 3.2;
  const toPaths = React.useCallback(
    (features: RegionFeature[]) =>
      features.flatMap((feature) =>
        polygonsOf(feature.geometry).map((polygon) =>
          polygon
            .map(
              (ring) =>
                ring
                  .map(([lng, lat], index) => {
                    const point = project(lng, lat, bounds, width, height);
                    return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
                  })
                  .join(" ") + " Z",
            )
            .join(" "),
        ),
      ),
    [bounds],
  );
  const paths = React.useMemo(() => toPaths(regions), [regions, toPaths]);
  const departmentPaths = React.useMemo(
    () => (local ? toPaths(departments) : []),
    [departments, local, toPaths],
  );

  const contextPoints = (contextHotels ?? [])
    .filter((hotel) => withinBounds(hotel, bounds) && !hotels.some((panelHotel) => panelHotel.id === hotel.id))
    .map((hotel) => ({
      hotel,
      point: project(hotel.longitude, hotel.latitude, bounds, width, height),
    }));

  const cityLabels = React.useMemo(() => {
    const groups = new Map<string, { count: number; lng: number; lat: number }>();
    for (const hotel of contextHotels ?? []) {
      if (!withinBounds(hotel, bounds)) continue;
      const current = groups.get(hotel.ville) ?? { count: 0, lng: 0, lat: 0 };
      current.count += 1;
      current.lng += hotel.longitude;
      current.lat += hotel.latitude;
      groups.set(hotel.ville, current);
    }
    return [...groups.entries()]
      .filter(([ville]) => !hotels.some((hotel) => hotel.ville === ville))
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 7)
      .map(([ville, group]) => ({
        ville,
        point: project(group.lng / group.count, group.lat / group.count, bounds, width, height),
      }));
  }, [contextHotels, bounds, hotels]);

  const centerLat = (bounds.north + bounds.south) / 2;
  const scaleKm = bounds.east - bounds.west < 1 ? 5 : bounds.east - bounds.west < 2.5 ? 10 : 100;
  const scaleWidth = (scaleKm / (111.32 * Math.cos((centerLat * Math.PI) / 180))) *
    (width / (bounds.east - bounds.west));

  const markers = hotels.map((hotel, index) => {
    const point = project(hotel.longitude, hotel.latitude, bounds, width, height);
    const kpi = kpiFor(hotel.id, kpis, annee);
    return { hotel, index: index + 1, point, kpi };
  });

  return (
    <div
      ref={mapRef}
      className={cn(
        "overflow-hidden rounded-[3px] border border-line bg-[#f2efe7]",
        className,
      )}
    >
      <div className="border-b border-line bg-surface px-3 py-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-accent">
          Positionnement concurrentiel
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <p className="font-serif text-[17px] text-ink">
            {title ?? "Carte du panel"}
          </p>
          <p className="text-[10px] text-muted">
            {hotels.length} hôtels · exercice {annee} · source Nova Observatoire
          </p>
        </div>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Carte du panel concurrentiel"
          className="block h-auto w-full"
        >
          <defs>
            <pattern id="nova-map-grid" width="41" height="41" patternUnits="userSpaceOnUse">
              <path d="M 41 0 L 0 0 0 41" fill="none" stroke="#e4dfd4" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="#eae6dc" />
          <rect width={width} height={height} fill="url(#nova-map-grid)" />
          {departmentPaths.length > 0 ? (
            <>
              <g>
                {departmentPaths.map((path, index) => (
                  <path key={index} d={path} fill="#f7f5ef" stroke="#d5cec1" strokeWidth="0.55" />
                ))}
              </g>
              <g>
                {paths.map((path, index) => (
                  <path key={index} d={path} fill="none" stroke="#aaa393" strokeWidth="0.9" />
                ))}
              </g>
            </>
          ) : (
            <g>
              {paths.map((path, index) => (
                <path key={index} d={path} fill="#f7f5ef" stroke="#c9c2b4" strokeWidth="0.7" />
              ))}
            </g>
          )}
          {contextPoints.map(({ hotel, point }) => (
            <circle
              key={`context-${hotel.id}`}
              cx={point.x}
              cy={point.y}
              r={2.1}
              fill="#7f8a90"
              opacity={0.34}
            >
              <title>{hotel.nom}</title>
            </circle>
          ))}
          {cityLabels.map(({ ville, point }) => (
            <text
              key={ville}
              x={point.x}
              y={Math.max(12, point.y - 8)}
              textAnchor="middle"
              fontSize="8.2"
              fontWeight="600"
              fill="#6e6a61"
              stroke="#f7f5ef"
              strokeWidth="3"
              paintOrder="stroke"
              letterSpacing="0.4"
            >
              {ville.toUpperCase()}
            </text>
          ))}
          {markers.map(({ hotel, index, point }) => {
            const color = CATEGORY_COLOR[String(hotel.categorie)];
            return (
              <g key={hotel.id}>
                <circle cx={point.x} cy={point.y} r={11} fill="#ffffff" opacity={0.72} />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={8.4}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="1.6"
                />
                <text
                  x={point.x}
                  y={point.y + 2.9}
                  textAnchor="middle"
                  fontSize="7.2"
                  fontWeight="700"
                  fill="#ffffff"
                >
                  {index}
                </text>
              </g>
            );
          })}
          <g transform={`translate(${width - 34 - scaleWidth}, ${height - 20})`}>
            <line x1={0} y1={0} x2={scaleWidth} y2={0} stroke="#6e6a61" strokeWidth="1.2" />
            <line x1={0} y1={-3} x2={0} y2={3} stroke="#6e6a61" strokeWidth="1" />
            <line x1={scaleWidth} y1={-3} x2={scaleWidth} y2={3} stroke="#6e6a61" strokeWidth="1" />
            <text x={scaleWidth / 2} y={-5} textAnchor="middle" fontSize="7.5" fill="#6e6a61">
              {scaleKm} km
            </text>
          </g>
        </svg>
        <div className="pointer-events-none absolute right-2.5 top-2.5 rounded-[2px] border border-line-strong/70 bg-surface/90 px-2 py-1.5">
          <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
            Catégorie
          </p>
          <div className="mt-0.5 flex flex-col gap-0.5">
            {(["2", "3", "4", "5", "Palace"] as const).map((category) => (
              <span
                key={category}
                className="flex items-center gap-1.5 text-[9px] text-ink-soft"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: CATEGORY_COLOR[category] }}
                />
                {CATEGORY_LABEL[category]}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-line bg-surface px-3 py-1.5 text-[8.5px] text-faint">
        Fond schématique · limites administratives · {local ? "échelle locale" : "échelle nationale"} · points gris = hôtels de l’observatoire
      </div>
      <div className="grid gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-2 sm:grid-cols-2">
        {markers.map(({ hotel, index, kpi }) => (
          <div key={hotel.id} className="flex items-baseline gap-1.5 text-[10px]">
            <span className="inline-flex size-[14px] shrink-0 items-center justify-center rounded-full bg-navy text-[7.5px] font-semibold text-white">
              {index}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">{hotel.nom}</span>
            <span className="tabular text-muted">{fmtInt(hotel.cles)} clés</span>
            <span className="tabular text-muted">
              {kpi?.adr != null ? fmtEuro(kpi.adr, true) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
