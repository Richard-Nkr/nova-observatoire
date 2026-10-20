/**
 * Utilitaires géographiques autonomes.
 * Les formules restent volontairement simples (sphère) : à l'échelle de la
 * France métropolitaine, l'écart avec WGS84 reste négligeable pour du filtrage.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export const FRANCE_CENTER: LatLng = { lat: 46.6, lng: 2.4 };
export const FRANCE_BOUNDS = {
  west: -5.4,
  south: 41.2,
  east: 9.7,
  north: 51.3,
};

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distance orthodromique en kilomètres (haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Approximation locale mètres -> degrés. Suffisante pour tracer un cercle
 * de rayon donné et pour le test d'appartenance.
 */
export function circlePolygon(
  center: LatLng,
  radiusKm: number,
  steps = 96,
): LatLng[] {
  const points: LatLng[] = [];
  const latDelta = radiusKm / 111.32;
  const lngDelta =
    radiusKm / (111.32 * Math.max(0.15, Math.cos(toRad(center.lat))));
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    points.push({
      lat: center.lat + Math.sin(angle) * latDelta,
      lng: center.lng + Math.cos(angle) * lngDelta,
    });
  }
  return points;
}

/** Test point-dans-polygone (ray casting, fonctionne avec les trous ignorés). */
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function bboxOf(points: LatLng[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    west: Math.min(...lngs),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    north: Math.max(...lats),
  };
}

export function centroidOf(points: LatLng[]): LatLng {
  if (!points.length) return FRANCE_CENTER;
  return {
    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
  };
}

/** Bounds MapLibre [[west,south],[east,north]]. */
export function mapBounds(points: LatLng[]): [[number, number], [number, number]] {
  const b = bboxOf(points.length ? points : [{ lat: 41.2, lng: -5.4 }, { lat: 51.3, lng: 9.7 }]);
  return [
    [b.west, b.south],
    [b.east, b.north],
  ];
}

/** Ville connue -> coordonnées pour le ciblage rapide. */
export const CITY_COORDS: Record<string, LatLng> = {
  Paris: { lat: 48.8566, lng: 2.3522 },
  Courbevoie: { lat: 48.8967, lng: 2.2565 },
  "La Défense": { lat: 48.892, lng: 2.236 },
  Neuilly: { lat: 48.8848, lng: 2.2687 },
  "Boulogne-Billancourt": { lat: 48.8352, lng: 2.2409 },
  Versailles: { lat: 48.8014, lng: 2.1301 },
  "Saint-Denis": { lat: 48.9362, lng: 2.3574 },
  "Roissy-en-France": { lat: 49.004, lng: 2.517 },
  "Disneyland Paris": { lat: 48.8674, lng: 2.7836 },
  Lyon: { lat: 45.764, lng: 4.8357 },
  "Aix-en-Provence": { lat: 43.5297, lng: 5.4474 },
  Marseille: { lat: 43.2965, lng: 5.3698 },
  Nice: { lat: 43.7102, lng: 7.262 },
  Cannes: { lat: 43.5528, lng: 7.0174 },
  Antibes: { lat: 43.5808, lng: 7.1251 },
  Monaco: { lat: 43.7384, lng: 7.4246 },
  Toulon: { lat: 43.1242, lng: 5.928 },
  Avignon: { lat: 43.9493, lng: 4.8055 },
  Bordeaux: { lat: 44.8378, lng: -0.5792 },
  "Arcachon": { lat: 44.6523, lng: -1.1785 },
  Biarritz: { lat: 43.4832, lng: -1.5586 },
  Pau: { lat: 43.2951, lng: -0.3708 },
  Toulouse: { lat: 43.6047, lng: 1.4442 },
  Montpellier: { lat: 43.6108, lng: 3.8767 },
  Nîmes: { lat: 43.8367, lng: 4.3601 },
  Perpignan: { lat: 42.6887, lng: 2.8948 },
  Carcassonne: { lat: 43.213, lng: 2.3491 },
  Annecy: { lat: 45.8992, lng: 6.1294 },
  Chamonix: { lat: 45.9237, lng: 6.8694 },
  "Courchevel": { lat: 45.415, lng: 6.634 },
  "Val d'Isère": { lat: 45.448, lng: 6.98 },
  Megève: { lat: 45.8569, lng: 6.6177 },
  Grenoble: { lat: 45.1885, lng: 5.7245 },
  "Aix-les-Bains": { lat: 45.6885, lng: 5.9152 },
  Clermont: { lat: 45.7772, lng: 3.087 },
  "La Rochelle": { lat: 46.1603, lng: -1.1511 },
  Nantes: { lat: 47.2184, lng: -1.5536 },
  Rennes: { lat: 48.1173, lng: -1.6778 },
  Brest: { lat: 48.3904, lng: -4.4861 },
  Deauville: { lat: 49.36, lng: 0.075 },
  Rouen: { lat: 49.4431, lng: 1.0993 },
  Lille: { lat: 50.6292, lng: 3.0573 },
  Strasbourg: { lat: 48.5734, lng: 7.7521 },
  Reims: { lat: 49.2583, lng: 4.0317 },
  Dijon: { lat: 47.322, lng: 5.0415 },
  Vichy: { lat: 46.1271, lng: 3.4267 },
  Tours: { lat: 47.3941, lng: 0.6848 },
};
