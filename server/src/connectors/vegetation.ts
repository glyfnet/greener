/**
 * NSW pre-clearing vegetation community (FR-14, D-20).
 *
 * The endpoint and fields come from live responses recorded in
 * `server/test/fixtures/vegetation/` (see `scripts/record-fixtures.ts`):
 *
 * - `GET https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/VIS/SVTM_NSW_1750_PCT/MapServer/identify`,
 *   layer 2 (`NSW_PlantCommunityType_5m`).
 * - Attributes used: `PCTID`, `PCTName`, `vegClass`, `vegForm`.
 *
 * The map is a statewide model of the vegetation before clearing. It gives
 * the *likely original* community, not what grows there now. The site is
 * rounded to 3 decimal places (about 100 m), and the result is not cached.
 */
import type { Citation, DataGap } from "../core/models.js";
import { identifyUrl, type IdentifyResponse } from "./arcgis.js";
import { fetchJson, type HttpDeps } from "./http.js";

const SERVICE = "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/VIS/SVTM_NSW_1750_PCT/MapServer";
export const PCT_LAYER = 2;
export const SVTM_DATASET_URL = "https://data.nsw.gov.au/data/dataset/nsw-state-vegetation-type-map-pre-clearing";
export const SVTM_PUBLISHER = "NSW Department of Climate Change, Energy, the Environment and Water";
export const SVTM_LICENCE = "CC BY";

export const vegetationUrl = (lat: number, lon: number) => identifyUrl(SERVICE, lat, lon, `all:${PCT_LAYER}`);

export interface VegetationCommunity {
  pctId: number;
  name: string;
  vegetationClass?: string;
  formation?: string;
}

export type VegetationResult = { ok: true; community: VegetationCommunity | null; citation: Citation } | { ok: false; dataGap: DataGap };

export async function vegetationCommunity(lat: number, lon: number, deps: HttpDeps, today: string): Promise<VegetationResult> {
  const r = await fetchJson<IdentifyResponse>(vegetationUrl(lat, lon), deps, { noCache: true });
  const gap = (reason: string): VegetationResult => ({ ok: false, dataGap: { topic: "pre-clearing vegetation community", reason } });
  if (!r.ok) return gap(`NSW State Vegetation Type Map: ${r.error}`);
  if (r.data.error || !Array.isArray(r.data.results)) return gap(`NSW State Vegetation Type Map: ${r.data.error?.message ?? "unexpected response"}`);
  const a = r.data.results.find((x) => x.layerId === PCT_LAYER)?.attributes;
  const pctId = Number(a?.PCTID);
  const community: VegetationCommunity | null =
    a && a.PCTName && Number.isInteger(pctId) && pctId > 0 ? { pctId, name: a.PCTName, ...(a.vegClass ? { vegetationClass: a.vegClass } : {}), ...(a.vegForm ? { formation: a.vegForm } : {}) } : null;
  return {
    ok: true,
    community,
    citation: { id: "nsw:svtm-pre-clearing", source: "research", title: "NSW State Vegetation Type Map, pre-clearing Plant Community Types", url: SVTM_DATASET_URL, publisher: SVTM_PUBLISHER, licence: SVTM_LICENCE, accessed: today },
  };
}
