/**
 * ArcGIS REST `identify` URLs for raster map services (D-20, D-22).
 *
 * The parameters are the ones used in the recorded fixtures
 * (`scripts/record-fixtures.ts`): a point in WGS84, `tolerance=0`, and a
 * small map extent and image size, which identify needs but which do not
 * change a raster's value at the point.
 */
import { roundPoint } from "./bushfire.js";

export function identifyUrl(service: string, lat: number, lon: number, layers: string): string {
  const la = roundPoint(lat);
  const lo = roundPoint(lon);
  const p = new URLSearchParams({
    geometry: `${lo},${la}`,
    geometryType: "esriGeometryPoint",
    sr: "4326",
    layers,
    tolerance: "0",
    mapExtent: [lo - 0.01, la - 0.01, lo + 0.01, la + 0.01].map((n) => n.toFixed(4)).join(","),
    imageDisplay: "100,100,96",
    returnGeometry: "false",
    f: "json",
  });
  return `${service}/identify?${p}`;
}

export interface IdentifyResponse {
  results?: { layerId?: number; attributes?: Record<string, string | undefined> }[];
  error?: { message?: string };
}
