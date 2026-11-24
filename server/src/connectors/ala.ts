/**
 * Atlas of Living Australia connector (FR-10, FR-11, FR-33, NFR-01).
 *
 * Endpoints and field names are taken from live responses recorded in
 * `server/test/fixtures/ala/` (see `scripts/record-fixtures.ts`):
 *
 * - Occurrence facets: `GET https://biocache-ws.ala.org.au/ws/occurrences/search`
 *   with `lat`, `lon`, `radius` (km), `pageSize=0`, `facets`, `fsort=count`,
 *   `flimit` and `fq`. Fields used: `establishmentMeans`,
 *   `degreeOfEstablishment`, `kingdom`, `stateConservation`,
 *   `countryConservation`, `stateInvasive`.
 * - Species search (BIE): `GET https://api.ala.org.au/species/search?q=`.
 * - Name matching: `GET https://api.ala.org.au/namematching/api/search?q=`.
 *
 * Citation URLs point at the API query that produced the data.
 * TODO: the ALA web pages (biocache.ala.org.au, bie.ala.org.au) returned
 * HTTP 403 to an automated check on 24 Nov 2026. Should citations link to
 * those pages instead? Verify the URL format in a browser first.
 *
 * `degreeOfEstablishment:cultivated` is deliberately not treated as
 * introduced: in a test query, 16 local natives (for example Acacia
 * longifolia) had cultivated records from gardens.
 *
 * Facets give species counts without paging raw records (Section 8 notes).
 */
import type { Citation, DataGap, SpeciesRecord, SpeciesTag } from "../core/models.js";
import { fetchJson, limited, type HttpDeps } from "./http.js";

const OCC = "https://biocache-ws.ala.org.au/ws/occurrences/search";
const SPECIES = "https://api.ala.org.au/species/search";
const NAMEMATCH = "https://api.ala.org.au/namematching/api/search";

export const ALA_PUBLISHER = "Atlas of Living Australia";
/** NFR-17. Individual records carry their own licences, mostly CC BY. */
export const ALA_LICENCE = "CC BY (record licences vary; see each data resource)";

/**
 * Coordinates are rounded to 2 decimal places (about 1 km) before they go to
 * ALA. With a 10 km radius this does not change the result in a useful way,
 * it improves cache sharing, and it keeps exact site locations out of URLs
 * and logs (D-09).
 */
export function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

interface FacetResponse {
  totalRecords?: number;
  facetResults?: { fieldName: string; fieldResult: { label: string; count: number; fq?: string }[] }[];
}

export interface OccurrenceQuery {
  key: string;
  title: string;
  fq: string[];
  flimit: number;
}

/** The fixed set of facet queries used by `ala_species_near`. */
export const NEAR_QUERIES: OccurrenceQuery[] = [
  { key: "native-plants", title: "native plants", fq: ["kingdom:Plantae", "(establishmentMeans:native OR degreeOfEstablishment:native)"], flimit: 30 },
  { key: "introduced-plants", title: "introduced plants", fq: ["kingdom:Plantae", "(establishmentMeans:introduced OR degreeOfEstablishment:established)"], flimit: 30 },
  { key: "fauna", title: "animals", fq: ["kingdom:Animalia"], flimit: 20 },
  { key: "native-fauna", title: "native animals", fq: ["kingdom:Animalia", "(establishmentMeans:native OR degreeOfEstablishment:native)"], flimit: 50 },
  { key: "threatened", title: "threatened species", fq: ["(stateConservation:* OR countryConservation:*)"], flimit: 20 },
  { key: "state-invasive", title: "species flagged invasive by the state", fq: ["stateInvasive:*"], flimit: 20 },
];

function params(lat: number, lon: number, radiusKm: number, q: OccurrenceQuery): URLSearchParams {
  const p = new URLSearchParams({ q: "*:*", lat: String(roundCoord(lat)), lon: String(roundCoord(lon)), radius: String(radiusKm), pageSize: "0", facets: "species", fsort: "count", flimit: String(q.flimit) });
  for (const f of q.fq) p.append("fq", f);
  return p;
}

export function occurrenceUrl(lat: number, lon: number, radiusKm: number, q: OccurrenceQuery): string {
  return `${OCC}?${params(lat, lon, radiusKm, q).toString()}`;
}

function speciesFacet(res: FacetResponse): { name: string; count: number }[] {
  const f = res.facetResults?.find((x) => x.fieldName === "species");
  return (f?.fieldResult ?? []).filter((r) => r.fq && !r.fq.startsWith("-")).map((r) => ({ name: r.label, count: r.count }));
}

export interface SpeciesNearResult {
  radiusKm: number;
  nativePlants: SpeciesRecord[];
  introducedPlants: SpeciesRecord[];
  fauna: SpeciesRecord[];
  threatened: SpeciesRecord[];
  stateInvasive: SpeciesRecord[];
  citations: Citation[];
  dataGaps: DataGap[];
}

/** Species near a site from ALA facets (FR-10, FR-11). Partial failures become data gaps (NFR-07). */
export async function speciesNear(lat: number, lon: number, radiusKm: number, deps: HttpDeps, today: string): Promise<SpeciesNearResult> {
  const results = await limited(NEAR_QUERIES.map((q) => () => fetchJson<FacetResponse>(occurrenceUrl(lat, lon, radiusKm, q), deps)));
  const lists = new Map<string, { name: string; count: number }[]>();
  const citations: Citation[] = [];
  const dataGaps: DataGap[] = [];
  NEAR_QUERIES.forEach((q, i) => {
    const r = results[i];
    if (r?.ok) {
      lists.set(q.key, speciesFacet(r.data));
      citations.push({ id: `ala:occ:${q.key}`, source: "research", title: `ALA occurrence records: ${q.title} within ${radiusKm} km`, url: occurrenceUrl(lat, lon, radiusKm, q), publisher: ALA_PUBLISHER, licence: ALA_LICENCE, accessed: today });
    } else {
      dataGaps.push({ topic: `ALA ${q.title}`, reason: r ? r.error : "not fetched" });
    }
  });
  const get = (k: string) => lists.get(k) ?? [];
  const nativeFauna = new Set(get("native-fauna").map((s) => s.name));
  const introduced = new Set(get("introduced-plants").map((s) => s.name));
  const invasive = new Set(get("state-invasive").map((s) => s.name));
  const rec = (name: string, count: number, tags: SpeciesTag[], cite: string, kingdom?: string): SpeciesRecord => ({ scientificName: name, recordCount: count, tags, citationIds: [cite], ...(kingdom ? { kingdom } : {}) });
  return {
    radiusKm,
    // A plant with both native and introduced records nearby is tagged both; the checks treat introduced as blocking.
    nativePlants: get("native-plants").map((s) => rec(s.name, s.count, introduced.has(s.name) ? ["native", "introduced"] : ["native"], "ala:occ:native-plants", "Plantae")),
    introducedPlants: get("introduced-plants").map((s) => rec(s.name, s.count, invasive.has(s.name) ? ["introduced", "biosecurity_pest"] : ["introduced"], "ala:occ:introduced-plants", "Plantae")),
    fauna: get("fauna").map((s) => rec(s.name, s.count, nativeFauna.has(s.name) ? ["native"] : [], "ala:occ:fauna", "Animalia")),
    threatened: get("threatened").map((s) => rec(s.name, s.count, ["threatened"], "ala:occ:threatened")),
    stateInvasive: get("state-invasive").map((s) => rec(s.name, s.count, ["biosecurity_pest"], "ala:occ:state-invasive")),
    citations,
    dataGaps,
  };
}

export interface Scope {
  lat: number;
  lon: number;
  radiusKm: number;
}

/** One species' records, with establishment facets, near a point or (no scope) across Australia. */
export function establishmentUrl(name: string, scope?: Scope): string {
  const p = new URLSearchParams({ q: "*:*", pageSize: "0" });
  if (scope) {
    p.set("lat", String(roundCoord(scope.lat)));
    p.set("lon", String(roundCoord(scope.lon)));
    p.set("radius", String(scope.radiusKm));
  }
  // Quotes inside the name would break the filter, so they are removed.
  p.append("fq", `species:"${name.replace(/"/g, "").trim()}"`);
  p.append("facets", "establishmentMeans");
  p.append("facets", "degreeOfEstablishment");
  p.append("flimit", "10");
  return `${OCC}?${p.toString()}`;
}

export interface Establishment {
  total: number;
  /** Records tagged native (establishmentMeans or degreeOfEstablishment). */
  native: number;
  /** Records tagged introduced, or established (naturalised). Cultivated is not counted. */
  introduced: number;
  citation: Citation;
}

/**
 * Native and introduced record counts for one species (D-17). The two tags
 * overlap, so each count is the larger of the two fields, which is enough
 * to compare native against introduced.
 */
export async function speciesEstablishment(name: string, deps: HttpDeps, today: string, scope?: Scope): Promise<{ ok: true; value: Establishment } | { ok: false; error: string }> {
  const url = establishmentUrl(name, scope);
  const r = await fetchJson<FacetResponse>(url, deps);
  if (!r.ok) return { ok: false, error: r.error };
  const facet = (field: string, label: string) => r.data.facetResults?.find((f) => f.fieldName === field)?.fieldResult.find((x) => x.label === label)?.count ?? 0;
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    ok: true,
    value: {
      total: r.data.totalRecords ?? 0,
      native: Math.max(facet("establishmentMeans", "native"), facet("degreeOfEstablishment", "native")),
      introduced: Math.max(facet("establishmentMeans", "introduced"), facet("degreeOfEstablishment", "established")),
      citation: { id: `ala:${scope ? "near" : "aus"}:${slug}`, source: "research", title: `ALA records of ${name.trim()} ${scope ? `within ${scope.radiusKm} km of the site` : "across Australia"}`, url, publisher: ALA_PUBLISHER, licence: ALA_LICENCE, accessed: today },
    },
  };
}

interface SpeciesSearchResponse {
  searchResults?: {
    results?: {
      guid?: string;
      idxtype?: string;
      name?: string;
      scientificName?: string;
      scientificNameAuthorship?: string;
      commonNameSingle?: string;
      kingdom?: string;
      family?: string;
      rank?: string;
      taxonomicStatus?: string;
      conservationStatus?: string | null;
      occurrenceCount?: number;
      infoSourceName?: string;
    }[];
  };
}

export interface SpeciesProfile {
  scientificName: string;
  authorship?: string;
  commonName?: string;
  kingdom?: string;
  family?: string;
  rank?: string;
  taxonomicStatus?: string;
  conservationStatus?: string;
  occurrenceCount?: number;
  nameSource?: string;
  guid: string;
  citation: Citation;
}

/** Species profile from ALA species search (FR-33). Picks the accepted taxon whose name matches. */
export async function speciesProfile(name: string, deps: HttpDeps, today: string): Promise<{ ok: true; profile: SpeciesProfile } | { ok: false; error: string }> {
  const url = `${SPECIES}?${new URLSearchParams({ q: name, pageSize: "5" }).toString()}`;
  const r = await fetchJson<SpeciesSearchResponse>(url, deps);
  if (!r.ok) return { ok: false, error: r.error };
  const want = name.trim().toLowerCase();
  const taxa = (r.data.searchResults?.results ?? []).filter((x) => x.idxtype === "TAXON" && x.guid);
  const hit = taxa.find((x) => (x.scientificName ?? x.name ?? "").toLowerCase() === want) ?? taxa[0];
  if (!hit?.guid) return { ok: false, error: `ALA has no taxon for '${name}'` };
  const sci = hit.scientificName ?? hit.name ?? name;
  return {
    ok: true,
    profile: {
      scientificName: sci,
      guid: hit.guid,
      ...(hit.scientificNameAuthorship ? { authorship: hit.scientificNameAuthorship } : {}),
      ...(hit.commonNameSingle ? { commonName: hit.commonNameSingle } : {}),
      ...(hit.kingdom ? { kingdom: hit.kingdom } : {}),
      ...(hit.family ? { family: hit.family } : {}),
      ...(hit.rank ? { rank: hit.rank } : {}),
      ...(hit.taxonomicStatus ? { taxonomicStatus: hit.taxonomicStatus } : {}),
      ...(hit.conservationStatus ? { conservationStatus: hit.conservationStatus } : {}),
      ...(hit.occurrenceCount !== undefined ? { occurrenceCount: hit.occurrenceCount } : {}),
      ...(hit.infoSourceName ? { nameSource: hit.infoSourceName } : {}),
      citation: { id: `ala:species:${sci.toLowerCase().replace(/\s+/g, "-")}`, source: "research", title: `ALA species: ${sci}`, url, publisher: ALA_PUBLISHER, licence: ALA_LICENCE, accessed: today },
    },
  };
}

interface NameMatchResponse {
  success?: boolean;
  scientificName?: string;
  taxonConceptID?: string;
  rank?: string;
  matchType?: string;
  kingdom?: string;
  vernacularName?: string;
  issues?: string[];
}

export interface NameMatch {
  query: string;
  matched: boolean;
  scientificName?: string;
  taxonConceptId?: string;
  rank?: string;
  matchType?: string;
  kingdom?: string;
  vernacularName?: string;
  issues: string[];
}

/** Resolve a name to the ALA taxonomy (NFR-01). */
export async function matchName(name: string, deps: HttpDeps): Promise<{ ok: true; match: NameMatch } | { ok: false; error: string }> {
  const r = await fetchJson<NameMatchResponse>(`${NAMEMATCH}?${new URLSearchParams({ q: name }).toString()}`, deps);
  if (!r.ok) return { ok: false, error: r.error };
  const d = r.data;
  if (!d.success || !d.scientificName) return { ok: true, match: { query: name, matched: false, issues: d.issues ?? [] } };
  return {
    ok: true,
    match: {
      query: name,
      matched: true,
      scientificName: d.scientificName,
      ...(d.taxonConceptID ? { taxonConceptId: d.taxonConceptID } : {}),
      ...(d.rank ? { rank: d.rank } : {}),
      ...(d.matchType ? { matchType: d.matchType } : {}),
      ...(d.kingdom ? { kingdom: d.kingdom } : {}),
      ...(d.vernacularName ? { vernacularName: d.vernacularName } : {}),
      issues: d.issues ?? [],
    },
  };
}
