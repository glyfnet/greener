/**
 * `npm run images:record -- <scientific name>...` — look up a Commons photo
 * for each species and add it to `data/species-images.csv` (D-23). Run on
 * purpose only. New rows are `reviewed: no`.
 *
 * Review each new row by hand: open `source_page`, check that the photo
 * shows the named species (a living plant or animal, not a map, drawing or
 * herbarium sheet) and that the licence and creator match. Then set
 * `reviewed` to `yes`. Rows already in the file are left as they are, unless
 * `--refresh` is given, which re-records unreviewed rows.
 */
import { writeFileSync } from "node:fs";
import { matchName } from "../server/src/connectors/ala.js";
import { lookupSpeciesImage } from "../server/src/connectors/images.js";
import { parseSpeciesImages, speciesImagesCsv, type SpeciesImage } from "../server/src/core/images.js";
import { path, readText } from "./lib.js";

const FILE = "data/species-images.csv";
const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const names = args.filter((a) => a !== "--refresh");
const rows = new Map<string, SpeciesImage>(parseSpeciesImages(readText(FILE)).map((r) => [r.scientificName.toLowerCase(), r]));
if (refresh) for (const r of rows.values()) if (!r.reviewed) names.push(r.scientificName);
if (!names.length) throw new Error("give one or more scientific names, or --refresh");

const deps = { fetch: (r: Request) => fetch(r), userAgent: "Greener image recorder (+https://github.com/glyfnet/greener)" };
const today = new Date().toISOString().slice(0, 10);
for (const name of [...new Set(names)]) {
  const existing = rows.get(name.toLowerCase());
  if (existing && (existing.reviewed || !refresh)) {
    console.log(`kept     ${name}`);
    continue;
  }
  const m = await matchName(name, deps);
  const match = m.ok ? m.match : undefined;
  const kind = match?.kingdom === "Plantae" ? "flora" : match?.kingdom === "Animalia" ? "fauna" : undefined;
  if (!match?.matched || !match.scientificName || !kind) {
    console.log(`no match ${name} (ALA name matching)`);
    continue;
  }
  if (match.scientificName !== name) console.log(`         ${name} is ${match.scientificName} in ALA`);
  const r = await lookupSpeciesImage(
    match.scientificName,
    { kind, ...(match.vernacularName ? { commonName: match.vernacularName } : {}), ...(match.taxonConceptId ? { alaGuid: match.taxonConceptId } : {}) },
    deps,
    today,
  );
  if (!r.ok) {
    console.log(`no photo ${match.scientificName}: ${r.reason}`);
    continue;
  }
  rows.set(match.scientificName.toLowerCase(), r.image);
  console.log(`added    ${match.scientificName} (${r.image.licence}, ${r.image.creator}) ${r.image.sourcePage}`);
}
writeFileSync(path(FILE), speciesImagesCsv([...rows.values()]));
console.log(`wrote ${FILE}: ${rows.size} rows. Review the new rows before you commit.`);
