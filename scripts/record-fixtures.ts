/**
 * `npx tsx scripts/record-fixtures.ts` — record live API responses as test
 * fixtures (rule 4, Section 12.3). Run on purpose only, never in a normal
 * test run. Uses a public, non-user test point in central Sydney.
 *
 * Each fixture file is `{ url, recordedAt, status, body }`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { NEAR_QUERIES, occurrenceUrl } from "../server/src/connectors/ala.js";
import { path } from "./lib.js";

/** Public test point: Hyde Park, Sydney. Not a user site. */
export const TEST_POINT = { lat: -33.873, lon: 151.211, radiusKm: 10 };
const OUT = path("server/test/fixtures/ala");

const targets: { name: string; url: string }[] = [
  ...NEAR_QUERIES.map((q) => ({ name: `occ-${q.key}`, url: occurrenceUrl(TEST_POINT.lat, TEST_POINT.lon, TEST_POINT.radiusKm, q) })),
  { name: "species-lomandra-longifolia", url: `https://api.ala.org.au/species/search?${new URLSearchParams({ q: "Lomandra longifolia", pageSize: "5" })}` },
  { name: "namematch-lomandra-longifolia", url: `https://api.ala.org.au/namematching/api/search?${new URLSearchParams({ q: "Lomandra longifolia" })}` },
  { name: "namematch-lantana-camara", url: `https://api.ala.org.au/namematching/api/search?${new URLSearchParams({ q: "Lantana camara" })}` },
  { name: "namematch-acacia-terminalis", url: `https://api.ala.org.au/namematching/api/search?${new URLSearchParams({ q: "Acacia terminalis" })}` },
  { name: "namematch-not-a-plant", url: `https://api.ala.org.au/namematching/api/search?${new URLSearchParams({ q: "Notaplant fakeus" })}` },
];

mkdirSync(OUT, { recursive: true });
for (const t of targets) {
  const res = await fetch(t.url, { headers: { Accept: "application/json", "User-Agent": "Greener fixture recorder" }, signal: AbortSignal.timeout(60000) });
  const body: unknown = await res.json();
  writeFileSync(`${OUT}/${t.name}.json`, `${JSON.stringify({ url: t.url, recordedAt: new Date().toISOString(), status: res.status, body }, null, 2)}\n`);
  console.log(`${res.status} ${t.name}`);
}
