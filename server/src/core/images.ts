/**
 * Species photos (FR-17, D-23).
 *
 * Photos come from Wikimedia Commons, through the image Wikidata picks for a
 * taxon (P18). The server never stores or serves image bytes: it returns a
 * thumbnail link, the creator, the licence and the Commons file page.
 *
 * `data/species-images.csv` holds rows recorded by `npm run images:record`
 * and checked by hand (`reviewed`). Species not in the file are looked up
 * live and marked unreviewed.
 *
 * Only licences that allow reuse with attribution are accepted (rule 6:
 * the rule lives here, not in a prompt): CC0, public domain, CC BY and
 * CC BY-SA. Commons does not accept non-commercial licences.
 */
import { z } from "zod";
import { parseCsv } from "./cost.js";

const IMAGE_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);
const host = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};

export const SpeciesImage = z.object({
  scientificName: z.string().regex(/^[A-Z][a-z-]+ [a-z-]+( (subsp\.|var\.|f\.) [a-z-]+)?$/, "a species name such as Lomandra longifolia"),
  alaGuid: z.string().url().optional(),
  kind: z.enum(["flora", "fauna"]),
  commonName: z.string().min(1).optional(),
  thumbUrl: z.string().url().refine((u) => IMAGE_HOSTS.has(host(u)), "must be a Wikimedia image host"),
  sourcePage: z.string().url().refine((u) => host(u) === "commons.wikimedia.org", "must be a Commons file page"),
  creator: z.string().min(1).max(200),
  licence: z.string().refine((l) => usableLicence(l) !== undefined, "licence must be CC0, public domain, CC BY or CC BY-SA"),
  retrievedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reviewed: z.boolean(),
});
export type SpeciesImage = z.infer<typeof SpeciesImage>;

/**
 * Normalise a Commons `LicenseShortName` to the form we show, or `undefined`
 * when the licence is not one we accept. Version numbers are kept.
 */
export function usableLicence(short: string): string | undefined {
  const s = short.trim().replace(/\s+/g, " ");
  if (/^(CC0|CC0 1\.0)$/i.test(s)) return "CC0";
  if (/^(public domain|PDM|PD)$/i.test(s)) return "Public domain";
  const m = /^CC[ -]BY(-SA)?(?: (\d\.\d))?(?: ([a-z]{2,3}))?$/i.exec(s);
  if (!m) return undefined;
  return `CC BY${m[1] ? "-SA" : ""}${m[2] ? ` ${m[2]}` : ""}${m[3] ? ` ${m[3].toLowerCase()}` : ""}`;
}

/** Plain text from the HTML that Commons gives for an author. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drop tracking parameters from a Wikimedia URL, so the link is stable. */
export function cleanImageUrl(u: string): string {
  const url = new URL(u);
  for (const k of [...url.searchParams.keys()]) if (k.startsWith("utm_")) url.searchParams.delete(k);
  return url.toString();
}

/** The credit line to show next to the photo (NFR-17). */
export function imageCredit(img: Pick<SpeciesImage, "creator" | "licence">): string {
  return `Photo: ${img.creator}, ${img.licence}, via Wikimedia Commons`;
}

/** Markdown that shows the photo, links it to its file page, and credits it. */
export function imageMarkdown(img: SpeciesImage): string {
  const alt = img.commonName ? `${img.scientificName} (${img.commonName})` : img.scientificName;
  const label = img.reviewed ? "" : " Example photo, not checked by Greener.";
  return `[![${alt}](${img.thumbUrl})](${img.sourcePage})\n*${imageCredit(img)}.${label}*`;
}

export const IMAGE_CSV_HEADER = "scientific_name,ala_guid,kind,common_name,thumb_url,source_page,creator,licence,retrieved_on,reviewed";

/** Parse and validate the photo CSV. Throws with row numbers on bad data. */
export function parseSpeciesImages(csv: string): SpeciesImage[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header || header.join(",") !== IMAGE_CSV_HEADER) throw new Error(`species-images.csv header must be: ${IMAGE_CSV_HEADER}`);
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const [scientificName, alaGuid, kind, commonName, thumbUrl, sourcePage, creator, licence, retrievedOn, reviewed] = r;
    if (reviewed !== "yes" && reviewed !== "no") throw new Error(`species-images.csv row ${i + 2}: reviewed must be yes or no`);
    const parsed = SpeciesImage.safeParse({ scientificName, alaGuid: alaGuid || undefined, kind, commonName: commonName || undefined, thumbUrl, sourcePage, creator, licence, retrievedOn, reviewed: reviewed === "yes" });
    if (!parsed.success) throw new Error(`species-images.csv row ${i + 2}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
    const key = parsed.data.scientificName.toLowerCase();
    if (seen.has(key)) throw new Error(`species-images.csv row ${i + 2}: duplicate species ${parsed.data.scientificName}`);
    seen.add(key);
    return parsed.data;
  });
}

/** Rows back to CSV, sorted by name, for the recorder script. */
export function speciesImagesCsv(rows: readonly SpeciesImage[]): string {
  const cell = (v: string | undefined) => (v === undefined ? "" : /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [...rows]
    .sort((a, b) => a.scientificName.localeCompare(b.scientificName))
    .map((r) => [r.scientificName, r.alaGuid, r.kind, r.commonName, r.thumbUrl, r.sourcePage, r.creator, r.licence, r.retrievedOn, r.reviewed ? "yes" : "no"].map(cell).join(","));
  return `${IMAGE_CSV_HEADER}\n${lines.join("\n")}\n`;
}
