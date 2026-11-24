/**
 * Native plant nurseries near the site (FR-20 local resources, D-17).
 *
 * The directory is `data/native-nurseries.csv`, validated at build time.
 * Every row names its source and the date it was checked (rule 4).
 * Coordinates come from the NSW Address Location Service: the exact
 * address for public premises (`coord_precision: address`), otherwise the
 * town to 2 decimal places (`town`). A home-based business is listed by
 * town only, with no street address, phone or email.
 */
import { z } from "zod";
import { parseCsv } from "./cost.js";

export const Nursery = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  kind: z.enum(["nursery", "market_stall"]),
  town: z.string().min(1),
  council: z.string().min(1),
  lat: z.number().min(-44).max(-10),
  lon: z.number().min(112).max(154),
  coordPrecision: z.enum(["address", "town"]),
  mailOrder: z.boolean(),
  website: z.string().url().optional(),
  offers: z.string().min(1),
  visiting: z.string().min(1),
  sourceUrl: z.string().url(),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type Nursery = z.infer<typeof Nursery>;

const HEADER = "id,name,kind,town,council,lat,lon,coord_precision,mail_order,website,offers,visiting,source_url,as_of";

/** Parse and validate the nursery CSV. Throws with row numbers on bad data. */
export function parseNurseries(csv: string): Nursery[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header || header.join(",") !== HEADER) throw new Error(`native-nurseries.csv header must be: ${HEADER}`);
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const [id, name, kind, town, council, lat, lon, coordPrecision, mailOrder, website, offers, visiting, sourceUrl, asOf] = r;
    if (mailOrder !== "yes" && mailOrder !== "no") throw new Error(`native-nurseries.csv row ${i + 2}: mail_order must be yes or no`);
    const parsed = Nursery.safeParse({ id, name, kind, town, council, lat: Number(lat), lon: Number(lon), coordPrecision, mailOrder: mailOrder === "yes", website: website || undefined, offers, visiting, sourceUrl, asOf });
    if (!parsed.success) throw new Error(`native-nurseries.csv row ${i + 2}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
    if (seen.has(parsed.data.id)) throw new Error(`native-nurseries.csv row ${i + 2}: duplicate id ${parsed.data.id}`);
    seen.add(parsed.data.id);
    return parsed.data;
  });
}

/** Great-circle distance in km (haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Nurseries within the radius, nearest first, with the distance rounded to whole km. */
export function nurseriesNear(list: readonly Nursery[], lat: number, lon: number, radiusKm: number): (Nursery & { distanceKm: number })[] {
  return list
    .map((n) => ({ ...n, distanceKm: Math.round(distanceKm(lat, lon, n.lat, n.lon)) }))
    .filter((n) => n.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name));
}
