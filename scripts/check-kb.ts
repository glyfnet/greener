/**
 * `npm run check:kb` — validate KB metadata, tiers and licences (FR-41,
 * FR-42) and check that source URLs still work (FR-47).
 *
 *   --offline  skip the link check (no network)
 *   --strict   fail on a broken link (used by `npm run release`)
 *
 * Without --strict a broken link is reported but does not fail the check,
 * so `npm run check` still passes on a flaky network.
 */
import { existsSync, readdirSync } from "node:fs";
import { manifestRuleErrors } from "../server/src/rag/manifest.js";
import { fail, loadManifest, path } from "./lib.js";

const args = new Set(process.argv.slice(2));
const offline = args.has("--offline");
const strict = args.has("--strict");

let manifest;
try {
  manifest = loadManifest();
} catch (e) {
  fail(`kb/manifest.yaml is invalid:\n${e instanceof Error ? e.message : String(e)}`);
}

const errors = manifestRuleErrors(manifest);
const files = new Set(readdirSync(path("kb/sources")).filter((f) => f.endsWith(".md")));
for (const item of manifest.items) {
  if (item.tier === "open_content") {
    if (!existsSync(path("kb/sources", item.file))) errors.push(`${item.id}: kb/sources/${item.file} does not exist`);
    files.delete(item.file);
  }
}
for (const f of files) errors.push(`kb/sources/${f} has no manifest entry`);
if (errors.length) fail(`KB check failed:\n  ${errors.join("\n  ")}`);
console.log(`✓ ${manifest.items.length} KB items: metadata, tiers and licences are valid`);

async function checkLink(url: string): Promise<string | undefined> {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, { method, redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Greener KB link check" } });
      if (res.ok) return undefined;
      if (method === "GET") return `HTTP ${res.status}`;
    } catch (e) {
      if (method === "GET") return e instanceof Error ? e.message : "network error";
    }
  }
  return "unreachable";
}

if (!offline) {
  const broken: string[] = [];
  for (const item of manifest.items) {
    if (!item.sourceUrl.startsWith("http")) continue;
    const problem = await checkLink(item.sourceUrl);
    if (problem) broken.push(`${item.id}: ${item.sourceUrl} (${problem})`);
  }
  if (broken.length) {
    const msg = `Broken or moved links (FR-47):\n  ${broken.join("\n  ")}`;
    if (strict) fail(msg);
    console.warn(`! ${msg}\n  (warning only; release runs with --strict)`);
  } else console.log(`✓ ${manifest.items.length} source links work`);
}
