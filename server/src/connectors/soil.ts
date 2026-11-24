/**
 * Soil properties from the Soil and Landscape Grid of Australia (FR-13, D-22).
 *
 * The endpoint and fields come from live responses recorded in
 * `server/test/fixtures/soil/` (see `scripts/record-fixtures.ts`):
 *
 * - `GET https://soils.csiro.au/arcgis/rest/services/TERN/<ATTR>_ACLEP_AU_TRN_N/MapServer/identify`
 *   for ATTR in PHC (pH in CaCl2), CLY (clay), SND (sand) and SOC (organic
 *   carbon).
 * - Layer 1 is the 0–5 cm estimate (`*_000_005_EV_*`) and layer 5 is the
 *   5–15 cm estimate (`*_005_015_EV_*`). The value is in
 *   `attributes["Classify.Pixel Value"]`, as a string.
 *
 * Units: the TERN catalogue records give organic carbon in %. Clay and sand
 * are mass fractions, in %.
 * TODO(D-22): confirm which SLGA release the TRN_N services serve, and that
 * its units match the Release 1 records.
 *
 * These are modelled estimates on a 90 m grid. The site is rounded to 3
 * decimal places, and results are not cached.
 */
import type { Citation, DataGap } from "../core/models.js";
import { identifyUrl, type IdentifyResponse } from "./arcgis.js";
import { fetchJson, limited, type HttpDeps } from "./http.js";

export const SOIL_ATTRIBUTES = [
  { code: "PHC", key: "phCaCl2", label: "pH (CaCl₂)", unit: "" },
  { code: "CLY", key: "clayPercent", label: "Clay", unit: "%" },
  { code: "SND", key: "sandPercent", label: "Sand", unit: "%" },
  { code: "SOC", key: "organicCarbonPercent", label: "Organic carbon", unit: "%" },
] as const;
export type SoilKey = (typeof SOIL_ATTRIBUTES)[number]["key"];

/** Identify layers: 0–5 cm and 5–15 cm expected values. */
const LAYERS = { "0-5cm": 1, "5-15cm": 5 } as const;

export const SLGA_URL = "https://www.csiro.au/en/research/natural-environment/land/soil-and-landscape-grid-of-australia";
export const SLGA_PUBLISHER = "TERN and CSIRO (Soil and Landscape Grid of Australia)";
export const SLGA_LICENCE = "CC BY 4.0";

export const soilUrl = (code: string, lat: number, lon: number) =>
  identifyUrl(`https://soils.csiro.au/arcgis/rest/services/TERN/${code}_ACLEP_AU_TRN_N/MapServer`, lat, lon, `all:${LAYERS["0-5cm"]},${LAYERS["5-15cm"]}`);

export type SoilDepths = { "0-5cm": number | null; "5-15cm": number | null };
export type SoilResult = { ok: true; properties: Partial<Record<SoilKey, SoilDepths>>; dataGaps: DataGap[]; citation: Citation } | { ok: false; dataGap: DataGap };

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

export async function soilProperties(lat: number, lon: number, deps: HttpDeps, today: string): Promise<SoilResult> {
  const results = await limited(SOIL_ATTRIBUTES.map((a) => () => fetchJson<IdentifyResponse>(soilUrl(a.code, lat, lon), deps, { noCache: true })), 2);
  const properties: Partial<Record<SoilKey, SoilDepths>> = {};
  const dataGaps: DataGap[] = [];
  SOIL_ATTRIBUTES.forEach((a, i) => {
    const r = results[i];
    const failed = !r || !r.ok ? (r?.ok === false ? r.error : "no response") : r.data.error ? (r.data.error.message ?? "service error") : !Array.isArray(r.data.results) ? "unexpected response" : undefined;
    if (failed || !r?.ok) {
      dataGaps.push({ topic: `soil ${a.label.toLowerCase()}`, reason: `Soil and Landscape Grid of Australia: ${failed}` });
      return;
    }
    const value = (layer: number) => {
      const v = Number.parseFloat(r.data.results?.find((x) => x.layerId === layer)?.attributes?.["Classify.Pixel Value"] ?? "");
      return Number.isFinite(v) ? round(v, a.code === "PHC" || a.code === "SOC" ? 2 : 0) : null;
    };
    properties[a.key] = { "0-5cm": value(LAYERS["0-5cm"]), "5-15cm": value(LAYERS["5-15cm"]) };
  });
  if (!Object.keys(properties).length) return { ok: false, dataGap: { topic: "soil properties", reason: dataGaps[0]?.reason ?? "Soil and Landscape Grid of Australia: no data" } };
  return {
    ok: true,
    properties,
    dataGaps,
    citation: { id: "tern:slga", source: "research", title: "Soil and Landscape Grid of Australia: modelled soil properties at 0–5 and 5–15 cm", url: SLGA_URL, publisher: SLGA_PUBLISHER, licence: SLGA_LICENCE, accessed: today },
  };
}
