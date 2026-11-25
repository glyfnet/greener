/**
 * Live species photo lookup: Wikidata, then Wikimedia Commons (FR-17, D-23).
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
 * Two requests per species. A taxon name is not a site location, so both
 * responses are cached for 30 days.
 */
import { cleanImageUrl, plainText, SpeciesImage, usableLicence } from "../core/images.js";
import { fetchJson, type HttpDeps } from "./http.js";

const WIKIDATA = "https://www.wikidata.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
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

interface WikidataResponse {
  query?: { pages?: { title?: string; pageimage?: string }[] };
}
interface CommonsResponse {
  query?: { pages?: { missing?: boolean; imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string } | undefined> }[] }[] };
}

export type ImageLookup = { ok: true; image: SpeciesImage } | { ok: false; reason: string };

/**
 * Find a usable photo for one species. `kind` and `commonName` come from the
 * caller (ALA name matching); the result is always unreviewed.
 */
export async function lookupSpeciesImage(
  scientificName: string,
  info: { kind: "flora" | "fauna"; commonName?: string; alaGuid?: string },
  deps: HttpDeps,
  today: string,
): Promise<ImageLookup> {
  const wd = await fetchJson<WikidataResponse>(wikidataImageUrl(scientificName), deps, { ttlSeconds: IMAGE_TTL_SECONDS });
  if (!wd.ok) return { ok: false, reason: `Wikidata: ${wd.error}` };
  const file = wd.data.query?.pages?.[0]?.pageimage;
  if (!file) return { ok: false, reason: "Wikidata has no image for this species" };

  const cm = await fetchJson<CommonsResponse>(commonsInfoUrl(file), deps, { ttlSeconds: IMAGE_TTL_SECONDS });
  if (!cm.ok) return { ok: false, reason: `Wikimedia Commons: ${cm.error}` };
  const ii = cm.data.query?.pages?.[0]?.imageinfo?.[0];
  if (!ii?.thumburl || !ii.descriptionurl) return { ok: false, reason: "Wikimedia Commons has no details for the image" };

  const licence = usableLicence(ii.extmetadata?.LicenseShortName?.value ?? "");
  if (!licence) return { ok: false, reason: `the image licence (${ii.extmetadata?.LicenseShortName?.value ?? "none"}) does not allow reuse` };
  const creator = plainText(ii.extmetadata?.Artist?.value ?? "") || (licence === "CC0" || licence === "Public domain" ? "Unknown" : "");
  if (!creator) return { ok: false, reason: "the image has no named creator to credit" };

  const parsed = SpeciesImage.safeParse({
    scientificName,
    ...(info.alaGuid ? { alaGuid: info.alaGuid } : {}),
    kind: info.kind,
    ...(info.commonName ? { commonName: info.commonName } : {}),
    thumbUrl: cleanImageUrl(ii.thumburl),
    sourcePage: ii.descriptionurl,
    creator: creator.slice(0, 200),
    licence,
    retrievedOn: today,
    reviewed: false,
  });
  return parsed.success ? { ok: true, image: parsed.data } : { ok: false, reason: "the image details did not pass validation" };
}
