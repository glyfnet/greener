/**
 * Shared helpers for the build and check scripts.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { KbManifest } from "../server/src/rag/manifest.js";
import { QuestionBank } from "../server/src/core/questionnaire.js";
import { parseCsv } from "../server/src/core/cost.js";
import type { DeclaredWeed } from "../server/src/core/checks.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const path = (...p: string[]) => join(ROOT, ...p);

export function readText(rel: string): string {
  return readFileSync(path(rel), "utf8");
}

export function loadManifest(): KbManifest {
  return KbManifest.parse(parseYaml(readText("kb/manifest.yaml")));
}

export function loadQuestionBank(): QuestionBank {
  return QuestionBank.parse(parseYaml(readText("data/question-bank.yaml")));
}

const WEED_HEADER = "scientific_name,state,category,source_url,as_of";

export function parseDeclaredWeeds(csv: string): DeclaredWeed[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header || header.join(",") !== WEED_HEADER) throw new Error(`declared-weeds.csv header must be: ${WEED_HEADER}`);
  return rows.map((r, i) => {
    const [scientificName, state, category, sourceUrl, asOf] = r;
    if (!scientificName || !state || !category || !sourceUrl || !asOf) throw new Error(`declared-weeds.csv row ${i + 2}: every column is required`);
    if (!/^https:\/\//.test(sourceUrl)) throw new Error(`declared-weeds.csv row ${i + 2}: source_url must be an https URL`);
    return { scientificName, state, category, sourceUrl, asOf };
  });
}

export function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}
