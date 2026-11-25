/**
 * `npm run images:record -- <scientific name>...` — look up a photo (Commons,
 * then ALA) for each species and add it to `data/species-images.csv` (D-23).
 * Run on purpose only. New rows are `reviewed: no`. Rows already in the file
 * are left as they are, unless `--refresh` is given, which re-records
 * unreviewed rows.
 *
 * Review (the `review-species-images` skill walks through it):
 *   --pending            list unreviewed rows as YAML
 *   --approve <name>...  set `reviewed` to yes, after a person has checked it
 *   --remove <name>...   drop a wrong photo (the species then has no row)
 */
import { writeFileSync } from "node:fs";
import { matchName } from "../server/src/connectors/ala.js";
import { lookupSpeciesImage } from "../server/src/connectors/images.js";
import { parseSpeciesImages, speciesImagesCsv, type SpeciesImage } from "../server/src/core/images.js";
import { toYaml } from "../server/src/core/yaml.js";
import { path, readText } from "./lib.js";

const FILE = "data/species-images.csv";
const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const names = args.filter((a) => !a.startsWith("--"));
const rows = new Map<string, SpeciesImage>(parseSpeciesImages(readText(FILE)).map((r) => [r.scientificName.toLowerCase(), r]));
const save = () => writeFileSync(path(FILE), speciesImagesCsv([...rows.values()]));

if (args.includes("--pending")) {
  console.log(toYaml([...rows.values()].filter((r) => !r.reviewed)));
  process.exit(0);
}
for (const flag of ["--approve", "--remove"] as const) {
  if (!args.includes(flag)) continue;
  for (const name of names) {
    const r = rows.get(name.toLowerCase());
    if (!r) throw new Error(`${name} is not in ${FILE}`);
    if (flag === "--approve") rows.set(name.toLowerCase(), { ...r, reviewed: true });
    else rows.delete(name.toLowerCase());
    console.log(`${flag === "--approve" ? "approved" : "removed "} ${r.scientificName}`);
  }
  save();
  process.exit(0);
}
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
save();
console.log(`wrote ${FILE}: ${rows.size} rows. Review the new rows before you commit.`);
