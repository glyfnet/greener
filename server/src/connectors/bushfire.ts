/**
 * NSW bushfire-prone land connector (FR-03, D-18).
 *
 * Endpoint and field names come from live responses recorded in
 * `server/test/fixtures/bushfire/` (see `scripts/record-fixtures.ts`):
 *
 * - `GET https://portal.spatial.nsw.gov.au/server/rest/services/Hosted/NSW_BushFire_Prone_Land/FeatureServer/0/query`
 *   with an envelope `geometry`, `geometryType=esriGeometryEnvelope`,
 *   `inSR=4326`, `spatialRel=esriSpatialRelIntersects`, `returnGeometry=false`.
 * - Fields used: `category` (0 = vegetation buffer, 1–3 = vegetation
 *   categories), `d_category` (label), `d_guidelin` (mapping guideline
 *   version), `lastupdate` (epoch ms).
 *
 * The site is rounded to 3 decimal places (about 100 m) and the envelope
 * reaches ±0.001° around it, so the answer covers land within about 100 m.
 * That errs towards "prone", the safe side. Results are not cached, because
 * the cache key would hold a location to about 100 m (docs/privacy.md).
 */
import type { Citation, DataGap } from "../core/models.js";
import { fetchJson, type HttpDeps } from "./http.js";

const QUERY = "https://portal.spatial.nsw.gov.au/server/rest/services/Hosted/NSW_BushFire_Prone_Land/FeatureServer/0/query";
export const BUSHFIRE_DATASET_URL = "https://data.nsw.gov.au/data/dataset/bush-fire-prone-land";
export const BUSHFIRE_PUBLISHER = "NSW Rural Fire Service";
/** Licence as given on the ArcGIS item and data.nsw (D-18). */
export const BUSHFIRE_LICENCE = "CC BY (attribution: NSW Rural Fire Service)";
/** Half-width of the query envelope, in degrees. */
export const ENVELOPE_DEG = 0.001;

/** Round to 3 decimal places (about 100 m), the precision point services get (D-18). */
export function roundPoint(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function bushfireUrl(lat: number, lon: number): string {
  const la = roundPoint(lat);
  const lo = roundPoint(lon);
  const p = new URLSearchParams({
    geometry: [lo - ENVELOPE_DEG, la - ENVELOPE_DEG, lo + ENVELOPE_DEG, la + ENVELOPE_DEG].map((n) => n.toFixed(4)).join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "category,d_category,d_guidelin,lastupdate",
    returnGeometry: "false",
    f: "json",
  });
  return `${QUERY}?${p}`;
}

interface QueryResponse {
  features?: { attributes?: { category?: number; d_category?: string; d_guidelin?: string; lastupdate?: number } }[];
  error?: { message?: string };
}

export interface BushfireCategory {
  category: number;
  label: string;
}

export type BushfireResult =
  | { ok: true; status: "prone" | "not_mapped"; categories: BushfireCategory[]; mapUpdated?: string; citation: Citation }
  | { ok: false; dataGap: DataGap };

export async function bushfireProne(lat: number, lon: number, deps: HttpDeps, today: string): Promise<BushfireResult> {
  const url = bushfireUrl(lat, lon);
  const r = await fetchJson<QueryResponse>(url, deps, { noCache: true });
  const gap = (reason: string): BushfireResult => ({ ok: false, dataGap: { topic: "bushfire-prone land status", reason } });
  if (!r.ok) return gap(`NSW bushfire-prone land map: ${r.error}`);
  if (r.data.error || !Array.isArray(r.data.features)) return gap(`NSW bushfire-prone land map: ${r.data.error?.message ?? "unexpected response"}`);

  const byCategory = new Map<number, BushfireCategory>();
  let updated = 0;
  for (const f of r.data.features) {
    const a = f.attributes;
    if (!a || typeof a.category !== "number") continue;
    byCategory.set(a.category, { category: a.category, label: a.d_category ?? `Category ${a.category}` });
    if (typeof a.lastupdate === "number") updated = Math.max(updated, a.lastupdate);
  }
  const categories = [...byCategory.values()].sort((x, y) => y.category - x.category);
  return {
    ok: true,
    status: categories.length ? "prone" : "not_mapped",
    categories,
    ...(updated ? { mapUpdated: new Date(updated).toISOString().slice(0, 10) } : {}),
    citation: { id: "nsw:bushfire-prone-land", source: "research", title: "NSW Bush Fire Prone Land map (within about 100 m of the site)", url: BUSHFIRE_DATASET_URL, publisher: BUSHFIRE_PUBLISHER, licence: BUSHFIRE_LICENCE, accessed: today },
  };
}
