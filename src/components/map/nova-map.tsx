"use client";

import * as React from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Filters, Hotel, KpiYear } from "@/lib/types";
import { CATEGORY_COLOR } from "@/lib/constants";
import { FRANCE_BOUNDS, circlePolygon, mapBounds } from "@/lib/geo";
import { kpiFor } from "@/lib/stats";
import { fmtInt } from "@/lib/format";

export type MapLevel = "france" | "region" | "city";
export type MapMetric = "hotels" | "cles" | "revpar" | "caTotal";

export interface MapScope {
  level: MapLevel;
  region?: string;
  city?: string;
}

const BASEMAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const REGION_LOW = "#e7edf0";
const REGION_HIGH = "#24506a";
const REGION_EMPTY = "#ece9e1";

/** Interpolation linéaire entre deux couleurs hexadécimales. */
function mixColor(a: string, b: string, ratio: number) {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const channel = (x: number, y: number) =>
    Math.round(x + (y - x) * Math.max(0, Math.min(1, ratio)));
  return `rgb(${channel(r1, r2)}, ${channel(g1, g2)}, ${channel(b1, b2)})`;
}

interface RegionDatum {
  count: number;
  keys: number;
  revpar: number | null;
  caTotal: number;
}

function aggregateRegions(
  hotels: Hotel[],
  kpis: KpiYear[],
  annee: number,
): Record<string, RegionDatum> {
  const result: Record<string, RegionDatum> = {};
  for (const hotel of hotels) {
    const current =
      result[hotel.region] ??
      (result[hotel.region] = { count: 0, keys: 0, revpar: null, caTotal: 0 });
    current.count += 1;
    current.keys += hotel.cles;
    const kpi = kpiFor(hotel.id, kpis, annee);
    if (kpi?.caTotal) current.caTotal += kpi.caTotal;
    if (kpi?.revpar) {
      current.revpar = current.revpar
        ? (current.revpar * (current.count - 1) + kpi.revpar) / current.count
        : kpi.revpar;
    }
  }
  return result;
}

function metricOfRegion(datum: RegionDatum | undefined, metric: MapMetric): number | null {
  if (!datum) return null;
  if (metric === "hotels") return datum.count;
  if (metric === "cles") return datum.keys;
  if (metric === "revpar") return datum.revpar;
  return datum.caTotal;
}

function fitCoords(map: MapLibreMap, coordinates: unknown) {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      west = Math.min(west, value[0]);
      east = Math.max(east, value[0]);
      south = Math.min(south, value[1]);
      north = Math.max(north, value[1]);
      return;
    }
    value.forEach(visit);
  };
  visit(coordinates);
  if (west < east && south < north) {
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 40, duration: 700, maxZoom: 9 },
    );
  }
}

export interface NovaMapProps {
  hotels: Hotel[];
  kpis: KpiYear[];
  annee: number;
  metric: MapMetric;
  scope: MapScope;
  geo: Filters["geo"];
  selectedRegions?: string[];
  selectedHotelId?: string | null;
  drawing?: boolean;
  drawingPoints?: { lat: number; lng: number }[];
  onRegionSelect?: (region: string) => void;
  onCitySelect?: (city: string) => void;
  onHotelSelect?: (hotelId: string) => void;
  onMapPoint?: (lat: number, lng: number) => void;
  onMapReady?: (map: MapLibreMap) => void;
  className?: string;
  compact?: boolean;
}

/**
 * Carte MapLibre unique, réutilisée par la recherche, les fiches et le comparateur.
 * Trois niveaux : régions (choroplèthe), villes (bulles), hôtels (points).
 */
export function NovaMap({
  hotels,
  kpis,
  annee,
  metric,
  scope,
  geo,
  selectedRegions = [],
  selectedHotelId,
  drawing = false,
  drawingPoints = [],
  onRegionSelect,
  onCitySelect,
  onHotelSelect,
  onMapPoint,
  onMapReady,
  className,
  compact = false,
}: NovaMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const [ready, setReady] = React.useState(false);
  const [mapError, setMapError] = React.useState<string | null>(null);
  const [regionGeo, setRegionGeo] = React.useState<GeoJSON.FeatureCollection | null>(null);
  const layersReady = React.useRef(false);
  const popupRef = React.useRef<Popup | null>(null);
  const lastFocus = React.useRef("");
  const callbackRefs = React.useRef({
    onRegionSelect,
    onCitySelect,
    onHotelSelect,
    onMapPoint,
    drawing,
  });
  React.useEffect(() => {
    callbackRefs.current = {
      onRegionSelect,
      onCitySelect,
      onHotelSelect,
      onMapPoint,
      drawing,
    };
  }, [onRegionSelect, onCitySelect, onHotelSelect, onMapPoint, drawing]);

  const regionData = React.useMemo(
    () => aggregateRegions(hotels, kpis, annee),
    [hotels, kpis, annee],
  );

  const cityFeatures = React.useMemo(() => {
    const grouped: Record<
      string,
      { lng: number; lat: number; count: number; keys: number; region: string }
    > = {};
    for (const hotel of hotels) {
      if (scope.region && hotel.region !== scope.region) continue;
      const current = grouped[hotel.ville] ?? {
        lng: 0,
        lat: 0,
        count: 0,
        keys: 0,
        region: hotel.region,
      };
      current.lng += hotel.longitude;
      current.lat += hotel.latitude;
      current.count += 1;
      current.keys += hotel.cles;
      grouped[hotel.ville] = current;
    }
    return {
      type: "FeatureCollection" as const,
      features: Object.entries(grouped).map(([city, datum]) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [datum.lng / datum.count, datum.lat / datum.count],
        },
        properties: {
          ville: city,
          region: datum.region,
          count: datum.count,
          keys: datum.keys,
        },
      })),
    };
  }, [hotels, scope.region]);

  const visibleHotels = React.useMemo(() => {
    if (scope.city) return hotels.filter((hotel) => hotel.ville === scope.city);
    return hotels;
  }, [hotels, scope.city]);

  const hotelFeatures = React.useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: visibleHotels.map((hotel) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [hotel.longitude, hotel.latitude] },
        properties: {
          id: hotel.id,
          nom: hotel.nom,
          categorie: String(hotel.categorie),
          keys: hotel.cles,
          ville: hotel.ville,
          color: CATEGORY_COLOR[String(hotel.categorie)],
          selected: hotel.id === selectedHotelId ? 1 : 0,
        },
      })),
    }),
    [visibleHotels, selectedHotelId],
  );

  // Marqueur dédié à l'hôtel sélectionné : visible même lorsque les autres
  // points sont regroupés ou masqués par le niveau de zoom.
  const selectedFeature = React.useMemo(() => {
    const hotel = hotels.find((item) => item.id === selectedHotelId);
    return {
      type: "FeatureCollection" as const,
      features: hotel
        ? [
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [hotel.longitude, hotel.latitude],
              },
              properties: { nom: hotel.nom },
            },
          ]
        : [],
    };
  }, [hotels, selectedHotelId]);

  const geoFeature = React.useMemo(() => {
    if (!geo) return null;
    if (geo.type === "circle") {
      const points = circlePolygon(geo.center, geo.radiusKm);
      return {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            geometry: {
              type: "Polygon" as const,
              coordinates: [[...points.map((p) => [p.lng, p.lat]), [points[0].lng, points[0].lat]]],
            },
            properties: {},
          },
        ],
      };
    }
    if (geo.points.length < 3) return null;
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: {
            type: "Polygon" as const,
            coordinates: [[...geo.points.map((p) => [p.lng, p.lat]), [geo.points[0].lng, geo.points[0].lat]]],
          },
          properties: {},
        },
      ],
    };
  }, [geo]);

  // --- Initialisation unique -------------------------------------------------
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [2.4, 46.55],
      zoom: 5.1,
      minZoom: 4,
      maxZoom: 17,
      attributionControl: { compact: true },
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapError(
        "La carte interactive nécessite WebGL 2. Activez l’accélération graphique de votre navigateur.",
      );
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", () => {
      setReady(true);
      onMapReady?.(map);
    });
    return () => {
      map.remove();
      mapRef.current = null;
      layersReady.current = false;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Données administratives ----------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    fetch("/geo/regions.geojson")
      .then((response) => response.json())
      .then((json: GeoJSON.FeatureCollection) => {
        if (!cancelled) setRegionGeo(json);
      })
      .catch(() => {
        // Fond de carte seul si le GeoJSON est indisponible.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Création des couches --------------------------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !regionGeo || layersReady.current) return;

    map.addSource("nova-regions", { type: "geojson", data: regionGeo });
    map.addSource("nova-cities", { type: "geojson", data: cityFeatures });
    map.addSource("nova-hotels", {
      type: "geojson",
      data: hotelFeatures,
      cluster: true,
      clusterRadius: 42,
      clusterMaxZoom: 13,
    });
    map.addSource("nova-selected-hotel", {
      type: "geojson",
      data: selectedFeature,
    });
    map.addSource("nova-geo", {
      type: "geojson",
      data: geoFeature ?? { type: "FeatureCollection", features: [] },
    });
    map.addSource("nova-drawing", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: "nova-region-fill",
      type: "fill",
      source: "nova-regions",
      paint: { "fill-color": ["get", "fillColor"], "fill-opacity": 1 },
    });
    map.addLayer({
      id: "nova-region-line",
      type: "line",
      source: "nova-regions",
      paint: {
        "line-color": ["case", ["==", ["get", "selected"], 1], "#c15f2f", "#b9c3d2"],
        "line-width": ["case", ["==", ["get", "selected"], 1], 2, 0.8],
      },
    });
    map.addLayer({
      id: "nova-city-halo",
      type: "circle",
      source: "nova-cities",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 13, 40, 38],
        "circle-color": "#174965",
        "circle-opacity": 0.12,
        "circle-stroke-width": 0,
      },
    });
    map.addLayer({
      id: "nova-city-circles",
      type: "circle",
      source: "nova-cities",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 8, 40, 24],
        "circle-color": "#1c455c",
        "circle-opacity": 0.88,
        "circle-stroke-color": "#fffefa",
        "circle-stroke-width": 1.5,
      },
    });
    map.addLayer({
      id: "nova-city-labels",
      type: "symbol",
      source: "nova-cities",
      layout: {
        "text-field": ["to-string", ["get", "count"]],
        "text-size": 10,
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#ffffff" },
    });
    map.addLayer({
      id: "nova-hotel-clusters",
      type: "circle",
      source: "nova-hotels",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#0f2433",
        "circle-opacity": 0.88,
        "circle-radius": ["step", ["get", "point_count"], 15, 5, 19, 12, 24],
        "circle-stroke-color": "#fffefa",
        "circle-stroke-width": 2,
      },
    });
    map.addLayer({
      id: "nova-hotel-cluster-count",
      type: "symbol",
      source: "nova-hotels",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["to-string", ["get", "point_count"]],
        "text-size": 10,
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
      },
      paint: { "text-color": "#ffffff" },
    });
    map.addLayer({
      id: "nova-hotel-points",
      type: "circle",
      source: "nova-hotels",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "keys"],
          20,
          4,
          450,
          10,
        ],
        "circle-stroke-color": ["case", ["get", "selected"], "#a8653f", "#fffefa"],
        "circle-stroke-width": ["case", ["get", "selected"], 2.5, 1.3],
        "circle-opacity": 0.94,
      },
    });
    map.addLayer({
      id: "nova-selected-halo",
      type: "circle",
      source: "nova-selected-hotel",
      paint: {
        "circle-radius": 18,
        "circle-color": "#c15f2f",
        "circle-opacity": 0.16,
      },
    });
    map.addLayer({
      id: "nova-selected-point",
      type: "circle",
      source: "nova-selected-hotel",
      paint: {
        "circle-radius": 6,
        "circle-color": "#c15f2f",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2.2,
      },
    });
    map.addLayer({
      id: "nova-geo-fill",
      type: "fill",
      source: "nova-geo",
      paint: { "fill-color": "#a8653f", "fill-opacity": 0.08 },
    });
    map.addLayer({
      id: "nova-geo-line",
      type: "line",
      source: "nova-geo",
      paint: { "line-color": "#a8653f", "line-width": 1.6, "line-dasharray": [3, 2] },
    });
    map.addLayer({
      id: "nova-drawing-fill",
      type: "fill",
      source: "nova-drawing",
      filter: ["==", "$type", "Polygon"],
      paint: { "fill-color": "#a8653f", "fill-opacity": 0.1 },
    });
    map.addLayer({
      id: "nova-drawing-line",
      type: "line",
      source: "nova-drawing",
      filter: ["==", "$type", "LineString"],
      paint: { "line-color": "#a8653f", "line-width": 1.5 },
    });
    map.addLayer({
      id: "nova-drawing-points",
      type: "circle",
      source: "nova-drawing",
      filter: ["==", "$type", "Point"],
      paint: {
        "circle-radius": 4,
        "circle-color": "#a8653f",
        "circle-stroke-color": "#fffefa",
        "circle-stroke-width": 1.5,
      },
    });

    layersReady.current = true;

    // Interactions -----------------------------------------------------------
    map.on("mouseenter", "nova-region-fill", () => {
      if (callbackRefs.current.drawing) return;
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "nova-region-fill", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("click", "nova-region-fill", (event) => {
      if (callbackRefs.current.drawing) return;
      const name = event.features?.[0]?.properties?.nom as string | undefined;
      if (name) callbackRefs.current.onRegionSelect?.(name);
    });
    map.on("mousemove", "nova-region-fill", (event) => {
      if (callbackRefs.current.drawing) return;
      const feature = event.features?.[0];
      if (!feature) return;
      const props = feature.properties ?? {};
      const datum = regionData[props.nom as string];
      popupRef.current?.remove();
      popupRef.current = new Popup({ closeButton: false, closeOnClick: false, offset: 12 })
        .setLngLat(event.lngLat)
        .setHTML(
          `<div style="padding:8px 10px;font-family:Inter,sans-serif;min-width:150px">
            <div style="font-size:11px;font-weight:600;color:#172029">${props.nom}</div>
            <div style="margin-top:3px;font-size:10px;color:#6b747b">${fmtInt(datum?.count ?? 0)} hôtels · ${fmtInt(datum?.keys ?? 0)} clés</div>
            <div style="font-size:10px;color:#6b747b">RevPAR moy. ${datum?.revpar ? `${Math.round(datum.revpar)} €` : "—"}</div>
            <div style="font-size:9px;color:#a8653f;margin-top:4px">Cliquer pour explorer</div>
          </div>`,
        )
        .addTo(map);
    });
    map.on("mouseleave", "nova-region-fill", () => {
      popupRef.current?.remove();
    });

    map.on("mouseenter", "nova-city-circles", () => {
      if (!callbackRefs.current.drawing) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "nova-city-circles", () => {
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    });
    map.on("click", "nova-city-circles", (event) => {
      if (callbackRefs.current.drawing) return;
      const city = event.features?.[0]?.properties?.ville as string | undefined;
      if (city) callbackRefs.current.onCitySelect?.(city);
    });
    map.on("mousemove", "nova-city-circles", (event) => {
      if (callbackRefs.current.drawing) return;
      const feature = event.features?.[0];
      if (!feature) return;
      const props = feature.properties ?? {};
      popupRef.current?.remove();
      popupRef.current = new Popup({ closeButton: false, closeOnClick: false, offset: 10 })
        .setLngLat(event.lngLat)
        .setHTML(
          `<div style="padding:7px 9px;font-family:Inter,sans-serif">
            <div style="font-size:11px;font-weight:600;color:#172029">${props.ville}</div>
            <div style="font-size:10px;color:#6b747b">${props.count} hôtels · ${fmtInt(Number(props.keys))} clés</div>
          </div>`,
        )
        .addTo(map);
    });

    map.on("click", "nova-hotel-clusters", (event) => {
      if (callbackRefs.current.drawing) return;
      const feature = event.features?.[0];
      if (!feature) return;
      const clusterId = feature.properties?.cluster_id;
      if (clusterId === undefined) return;
      const source = map.getSource("nova-hotels") as GeoJSONSource;
      void source.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({
          center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
        });
      });
    });
    map.on("mouseenter", "nova-hotel-clusters", () => {
      if (!callbackRefs.current.drawing) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "nova-hotel-clusters", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("click", "nova-hotel-points", (event) => {
      if (callbackRefs.current.drawing) return;
      const id = event.features?.[0]?.properties?.id as string | undefined;
      if (id) callbackRefs.current.onHotelSelect?.(id);
    });
    map.on("mouseenter", "nova-hotel-points", () => {
      if (!callbackRefs.current.drawing) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "nova-hotel-points", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("click", (event: MapMouseEvent) => {
      if (!callbackRefs.current.drawing) return;
      callbackRefs.current.onMapPoint?.(event.lngLat.lat, event.lngLat.lng);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, regionGeo]);

  // --- Mise à jour des données et styles ------------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !layersReady.current) return;

    const values = Object.keys(regionData)
      .map((region) => metricOfRegion(regionData[region], metric))
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;

    if (regionGeo) {
      const enriched = {
        ...regionGeo,
        features: regionGeo.features.map((feature) => {
          const nom = String(feature.properties?.nom ?? "");
          const datum = regionData[nom];
          const value = metricOfRegion(datum, metric);
          const ratio = value === null ? 0 : (value - min) / Math.max(1, max - min);
          return {
            ...feature,
            properties: {
              ...feature.properties,
              fillColor: value === null ? REGION_EMPTY : mixColor(REGION_LOW, REGION_HIGH, ratio),
              selected: selectedRegions.length
                ? selectedRegions.includes(nom)
                  ? 1
                  : 0
                : scope.level !== "france" && scope.region === nom
                  ? 1
                  : 0,
            },
          };
        }),
      };
      (map.getSource("nova-regions") as GeoJSONSource | undefined)?.setData(
        enriched as GeoJSON.FeatureCollection,
      );
    }

    (map.getSource("nova-cities") as GeoJSONSource | undefined)?.setData(
      cityFeatures,
    );
    (map.getSource("nova-hotels") as GeoJSONSource | undefined)?.setData(
      hotelFeatures,
    );
    (map.getSource("nova-selected-hotel") as GeoJSONSource | undefined)?.setData(
      selectedFeature,
    );
    (map.getSource("nova-geo") as GeoJSONSource | undefined)?.setData(
      (geoFeature ?? { type: "FeatureCollection", features: [] }) as GeoJSON.FeatureCollection,
    );

    const showCities = scope.level === "region" && !geo;
    const showHotels = scope.level === "city" || !!geo;
    for (const layer of ["nova-city-halo", "nova-city-circles", "nova-city-labels"]) {
      if (map.getLayer(layer))
        map.setLayoutProperty(layer, "visibility", showCities ? "visible" : "none");
    }
    for (const layer of ["nova-hotel-clusters", "nova-hotel-cluster-count"]) {
      if (map.getLayer(layer))
        map.setLayoutProperty(layer, "visibility", showHotels ? "visible" : "none");
    }
    if (map.getLayer("nova-hotel-points")) {
      map.setLayoutProperty("nova-hotel-points", "visibility", showHotels ? "visible" : "none");
    }
    if (map.getLayer("nova-region-fill")) {
      // Le choroplèthe ne doit pas masquer le fond de carte lorsqu'on zoome
      // sur une ville ou un hôtel : son opacité s'efface avec le zoom.
      map.setPaintProperty(
        "nova-region-fill",
        "fill-opacity",
        [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          scope.level === "france" ? 0.96 : 0.62,
          9,
          scope.level === "france" ? 0.5 : 0.28,
          11,
          0,
        ],
      );
    }
    if (map.getLayer("nova-region-line")) {
      map.setPaintProperty("nova-region-line", "line-width", [
        "case",
        ["==", ["get", "selected"], 1],
        2,
        0.8,
      ]);
      map.setPaintProperty("nova-region-line", "line-color", [
        "case",
        ["==", ["get", "selected"], 1],
        "#c15f2f",
        "#b9c3d2",
      ]);
    }
  }, [ready, regionData, metric, scope, selectedRegions, cityFeatures, hotelFeatures, selectedFeature, geoFeature, regionGeo, geo]);

  // --- Aperçu du polygone en cours de dessin --------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !layersReady.current) return;
    const features: GeoJSON.Feature[] = drawingPoints.map((point) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      properties: {},
    }));
    if (drawingPoints.length >= 2) {
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: drawingPoints.map((point) => [point.lng, point.lat]),
        },
        properties: {},
      });
    }
    if (drawingPoints.length >= 3) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [...drawingPoints.map((point) => [point.lng, point.lat]), [drawingPoints[0].lng, drawingPoints[0].lat]],
          ],
        },
        properties: {},
      });
    }
    (map.getSource("nova-drawing") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features,
    });
  }, [drawingPoints, ready]);

  // --- Focus / cadrage -------------------------------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const key = geo
      ? `geo:${geo.type === "circle" ? `${geo.center.lat},${geo.center.lng},${geo.radiusKm}` : geo.points.length}`
      : `${scope.level}:${scope.region ?? ""}:${scope.city ?? ""}`;
    if (lastFocus.current === key) return;
    lastFocus.current = key;

    if (geo) {
      if (geo.type === "circle") {
        const points = circlePolygon(geo.center, geo.radiusKm);
        map.fitBounds(mapBounds(points), { padding: 64, duration: 700 });
      } else if (geo.points.length >= 3) {
        map.fitBounds(mapBounds(geo.points), { padding: 64, duration: 700 });
      }
      return;
    }
    if (scope.level === "city" && scope.city) {
      const cityHotels = hotels.filter((hotel) => hotel.ville === scope.city);
      if (cityHotels.length) {
        map.fitBounds(
          mapBounds(cityHotels.map((hotel) => ({ lat: hotel.latitude, lng: hotel.longitude }))),
          { padding: 70, duration: 700, maxZoom: 14 },
        );
      }
      return;
    }
    if (scope.level === "region" && scope.region && regionGeo) {
      const feature = regionGeo.features.find(
        (item) => item.properties?.nom === scope.region,
      );
      if (feature && feature.geometry.type !== "GeometryCollection") {
        fitCoords(map, feature.geometry.coordinates);
      }
      return;
    }
    map.fitBounds(
      [
        [FRANCE_BOUNDS.west, FRANCE_BOUNDS.south],
        [FRANCE_BOUNDS.east, FRANCE_BOUNDS.north],
      ],
      { padding: compact ? 12 : 24, duration: 650 },
    );
  }, [ready, scope, geo, regionGeo, hotels, compact]);

  // --- Curseur pendant le dessin --------------------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = drawing ? "crosshair" : "";
    if (drawing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [drawing, ready]);

  return (
    <div ref={containerRef} className={className} aria-label="Carte des hôtels">
      {mapError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-paper/95 p-6">
          <p className="max-w-sm text-center text-[12px] leading-relaxed text-muted">
            {mapError}
          </p>
        </div>
      )}
    </div>
  );
}
