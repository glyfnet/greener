/**
 * NSW address lookup (FR-02, D-19).
 *
 * The endpoint and fields come from live responses recorded in
 * `server/test/fixtures/geocode/` (see `scripts/record-fixtures.ts`), and
 * from the service docs at https://maps.six.nsw.gov.au/sws/AddressLocation.html:
 *
 * - `GET https://maps.six.nsw.gov.au/services/public/Address_Location` with
 *   `houseNumber`, `roadName` (required), `roadType`, and `suburb` and/or
 *   `postCode`, plus `projection=EPSG:4326`.
 * - The response is `addressResult.numRecs` and `addressResult.addresses[]`,
 *   with `addressPoint.centreX` / `centreY`, `suburbName`, `postCode` and
 *   `council`. When nothing matches, the service returns
 *   `addressResult.errMsg` with `numRecs: 0`.
 *
 * The service answered in GDA94 (`EPSG:4283`) even when `EPSG:4326` was
 * asked for. GDA94 is within about 1–2 m of WGS84, which is below every
 * precision used here.
 *
 * Address lookups are never cached, and the address is never logged. The
 * street address stays out of the site label: the label is the suburb.
 */
import type { Citation, DataGap } from "../core/models.js";
import { fetchJson, type HttpDeps } from "./http.js";

const ENDPOINT = "https://maps.six.nsw.gov.au/services/public/Address_Location";
export const ADDRESS_DATASET_URL = "https://data.nsw.gov.au/data/dataset/1602c6c4-d396-4890-a031-388d83635b5a";
export const ADDRESS_PUBLISHER = "NSW Spatial Services (Department of Customer Service)";
/** Licence as given on data.nsw and the LPI information sheet (D-19). */
export const ADDRESS_LICENCE = "CC BY 3.0 AU (© Land and Property Information)";
/** At most this many candidates are returned for the user to choose from. */
export const MAX_CANDIDATES = 5;

export interface StreetAddress {
  houseNumber?: string;
  roadName: string;
  roadType?: string;
  suburb?: string;
  postCode?: string;
}

export function addressUrl(a: StreetAddress): string {
  const p = new URLSearchParams();
  if (a.houseNumber) p.set("houseNumber", a.houseNumber.trim());
  p.set("roadName", a.roadName.trim());
  if (a.roadType) p.set("roadType", a.roadType.trim());
  if (a.suburb) p.set("suburb", a.suburb.trim());
  if (a.postCode) p.set("postCode", a.postCode.trim());
  p.set("projection", "EPSG:4326");
  return `${ENDPOINT}?${p}`;
}

interface AddressResponse {
  addressResult?: {
    numRecs?: number;
    errMsg?: string;
    addresses?: { suburbName?: string; postCode?: number; council?: string; addressPoint?: { centreX?: number; centreY?: number } }[];
  };
}

export interface AddressCandidate {
  lat: number;
  lon: number;
  suburb: string;
  postCode?: string;
  council?: string;
}

export type AddressResult = { ok: true; candidates: AddressCandidate[]; citation: Citation } | { ok: false; notFound: boolean; dataGap: DataGap };

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

export async function lookupAddress(a: StreetAddress, deps: HttpDeps, today: string): Promise<AddressResult> {
  const r = await fetchJson<AddressResponse>(addressUrl(a), deps, { noCache: true });
  const gap = (reason: string, notFound = false): AddressResult => ({ ok: false, notFound, dataGap: { topic: "address lookup", reason } });
  if (!r.ok) return gap(`NSW Address Location Service: ${r.error}`);
  const res = r.data.addressResult;
  if (!res) return gap("NSW Address Location Service: unexpected response");
  const candidates: AddressCandidate[] = [];
  for (const x of res.addresses ?? []) {
    const lon = x.addressPoint?.centreX;
    const lat = x.addressPoint?.centreY;
    if (typeof lat !== "number" || typeof lon !== "number" || !x.suburbName) continue;
    candidates.push({ lat, lon, suburb: titleCase(x.suburbName), ...(x.postCode ? { postCode: String(x.postCode) } : {}), ...(x.council ? { council: x.council } : {}) });
    if (candidates.length >= MAX_CANDIDATES) break;
  }
  if (!candidates.length) return gap(res.errMsg ? `NSW Address Location Service: ${res.errMsg}` : "No matching NSW address", true);
  return {
    ok: true,
    candidates,
    citation: { id: "nsw:address-location", source: "research", title: "NSW Address Location Service", url: ADDRESS_DATASET_URL, publisher: ADDRESS_PUBLISHER, licence: ADDRESS_LICENCE, accessed: today },
  };
}
