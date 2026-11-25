/**
 * Live species photo lookup (FR-17, D-23): Wikidata and Wikimedia Commons
 * first, then the Atlas of Living Australia species image.
 *
 * The endpoints and fields come from the live responses recorded in
 * `server/test/fixtures/images/` (see `scripts/record-fixtures.ts`):
 *
 * - Wikidata: `GET https://www.wikidata.org/w/api.php?action=query&generator=search`
 *   with `gsrsearch=haswbstatement:"P225=<name>"` (P225 is the taxon name)
 *   and `prop=pageimages&piprop=name`. `query.pages[].pageimage` is the
 *   Commons file name of the taxon's image (P18).
 * - Commons: `GET https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo`
 *   with `iiprop=url|extmetadata` and `iiurlwidth=320`. Each
 *   `imageinfo[0]` has `thumburl`, `descriptionurl` and `extmetadata`
 *   (`LicenseShortName.value`, `Artist.value` as HTML).
 *
 * - ALA, when Commons has no usable photo: `GET https://api.ala.org.au/species/search?q=<name>&pageSize=1`
 *   gives `searchResults.results[0].image` (an image ID), and
 *   `GET https://images.ala.org.au/ws/image/<id>` gives `creator`,
 *   `rightsHolder`, `license` (a licence URL) and `recognisedLicence.acronym`.
 *   The thumbnail is `images.ala.org.au/image/proxyImageThumbnailLarge?imageId=<id>`
 *   and the page is `images.ala.org.au/image/details?imageId=<id>`.
 *
 * Up to four requests per species. A taxon name is not a site location, so
 * every response is cached for 30 days.
 */
import { cleanImageUrl, licenceFromUrl, plainText, SpeciesImage, usableLicence } from "../core/images.js";
import { fetchJson, type HttpDeps } from "./http.js";

const WIKIDATA = "https://www.wikidata.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const ALA_SPECIES = "https://api.ala.org.au/species/search";
const ALA_IMAGES = "https://images.ala.org.au";
export const IMAGE_TTL_SECONDS = 30 * 24 * 60 * 60;
export const THUMB_WIDTH = 320;

export function wikidataImageUrl(scientificName: string): string {
  const p = new URLSearchParams({ action: "query", generator: "search", gsrsearch: `haswbstatement:"P225=${scientificName}"`, gsrlimit: "1", prop: "pageimages", piprop: "name", format: "json", formatversion: "2" });
  return `${WIKIDATA}?${p}`;
}

export function commonsInfoUrl(fileName: string): string {
  const p = new URLSearchParams({
    action: "query",
    titles: `File:${fileName}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: String(THUMB_WIDTH),
    iiextmetadatafilter: "LicenseShortName|Artist",
    format: "json",
    formatversion: "2",
  });
  return `${COMMONS}?${p}`;
}

export function alaSpeciesImageUrl(scientificName: string): string {
  return `${ALA_SPECIES}?${new URLSearchParams({ q: scientificName, pageSize: "1" })}`;
}

export function alaImageInfoUrl(imageId: string): string {
  return `${ALA_IMAGES}/ws/image/${encodeURIComponent(imageId)}`;
}

interface AlaSearchResponse {
  searchResults?: { results?: { scientificName?: string; image?: string | null }[] };
}
interface AlaImageResponse {
  success?: boolean;
  creator?: string;
  rightsHolder?: string;
  license?: string;
  recognisedLicence?: { acronym?: string } | null;
}

interface WikidataResponse {
  query?: { pages?: { title?: string; pageimage?: string }[] };
}
interface CommonsResponse {
  query?: { pages?: { missing?: boolean; imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string } | undefined> }[] }[] };
}

export type ImageLookup = { ok: true; image: SpeciesImage } | { ok: false; reason: string };
type Info = { kind: "flora" | "fauna"; commonName?: string; alaGuid?: string };
type Found = { thumbUrl: string; sourcePage: string; creator: string; licence: string };

const ttl = { ttlSeconds: IMAGE_TTL_SECONDS };

/** Check the licence and creator, then build the validated record. */
function accept(scientificName: string, info: Info, f: { thumbUrl: string; sourcePage: string; creator: string; licence: string }, today: string): ImageLookup {
  const licence = usableLicence(f.licence);
  if (!licence) return { ok: false, reason: `the image licence (${f.licence || "none"}) does not allow reuse` };
  const creator = f.creator || (licence === "CC0" || licence === "Public domain" ? "Unknown" : "");
  if (!creator) return { ok: false, reason: "the image has no named creator to credit" };
  const parsed = SpeciesImage.safeParse({
    scientificName,
    ...(info.alaGuid ? { alaGuid: info.alaGuid } : {}),
    kind: info.kind,
    ...(info.commonName ? { commonName: info.commonName } : {}),
    thumbUrl: f.thumbUrl,
    sourcePage: f.sourcePage,
    creator: creator.slice(0, 200),
    licence,
    retrievedOn: today,
    reviewed: false,
  });
  return parsed.success ? { ok: true, image: parsed.data } : { ok: false, reason: "the image details did not pass validation" };
}

async function fromCommons(scientificName: string, deps: HttpDeps): Promise<{ ok: true; found: Found } | { ok: false; reason: string }> {
  const wd = await fetchJson<WikidataResponse>(wikidataImageUrl(scientificName), deps, ttl);
  if (!wd.ok) return { ok: false, reason: `Wikidata: ${wd.error}` };
  const file = wd.data.query?.pages?.[0]?.pageimage;
  if (!file) return { ok: false, reason: "Wikidata has no image for this species" };
  const cm = await fetchJson<CommonsResponse>(commonsInfoUrl(file), deps, ttl);
  if (!cm.ok) return { ok: false, reason: `Wikimedia Commons: ${cm.error}` };
  const ii = cm.data.query?.pages?.[0]?.imageinfo?.[0];
  if (!ii?.thumburl || !ii.descriptionurl) return { ok: false, reason: "Wikimedia Commons has no details for the image" };
  return {
    ok: true,
    found: { thumbUrl: cleanImageUrl(ii.thumburl), sourcePage: ii.descriptionurl, creator: plainText(ii.extmetadata?.Artist?.value ?? ""), licence: ii.extmetadata?.LicenseShortName?.value ?? "" },
  };
}

async function fromAla(scientificName: string, deps: HttpDeps): Promise<{ ok: true; found: Found } | { ok: false; reason: string }> {
  const s = await fetchJson<AlaSearchResponse>(alaSpeciesImageUrl(scientificName), deps, ttl);
  if (!s.ok) return { ok: false, reason: `ALA: ${s.error}` };
  const hit = s.data.searchResults?.results?.[0];
  if (!hit?.image || hit.scientificName?.toLowerCase() !== scientificName.toLowerCase()) return { ok: false, reason: "ALA has no image for this species" };
  const im = await fetchJson<AlaImageResponse>(alaImageInfoUrl(hit.image), deps, ttl);
  if (!im.ok || !im.data.success) return { ok: false, reason: `ALA images: ${im.ok ? "image not found" : im.error}` };
  const id = encodeURIComponent(hit.image);
  return {
    ok: true,
    found: {
      thumbUrl: `${ALA_IMAGES}/image/proxyImageThumbnailLarge?imageId=${id}`,
      sourcePage: `${ALA_IMAGES}/image/details?imageId=${id}`,
      creator: plainText(im.data.creator || im.data.rightsHolder || ""),
      licence: licenceFromUrl(im.data.license ?? "") || (im.data.recognisedLicence?.acronym ?? ""),
    },
  };
}

/**
 * Find a usable photo for one species: Commons first, then ALA. `info`
 * comes from the caller (ALA name matching); the result is always unreviewed.
 */
export async function lookupSpeciesImage(scientificName: string, info: Info, deps: HttpDeps, today: string): Promise<ImageLookup> {
  const reasons: string[] = [];
  for (const source of [fromCommons, fromAla]) {
    const r = await source(scientificName, deps);
    if (!r.ok) {
      reasons.push(r.reason);
      continue;
    }
    const a = accept(scientificName, info, r.found, today);
    if (a.ok) return a;
    reasons.push(a.reason);
  }
  return { ok: false, reason: reasons.join("; ") };
}
