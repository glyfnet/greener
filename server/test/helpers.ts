/**
 * Test helpers: a fetch that answers only from recorded fixtures (NFR-14),
 * a fake cache, and small sample site data.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CacheLike, HttpDeps } from "../src/connectors/http.js";
import { ActionPlan, ResearchReport, SiteProfile, type ActionInput } from "../src/core/models.js";
import { STATIC_DATA } from "../src/data.js";
import type { StaticData, ToolContext } from "../src/tools/context.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "ala");

export interface Fixture {
  url: string;
  status: number;
  body: unknown;
}

export function loadFixtures(): Map<string, Fixture> {
  const m = new Map<string, Fixture>();
  for (const f of readdirSync(FIXTURES)) {
    const fx = JSON.parse(readFileSync(join(FIXTURES, f), "utf8")) as Fixture;
    m.set(fx.url, fx);
  }
  return m;
}

export function fixture(name: string): Fixture {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as Fixture;
}

/** The public test point the fixtures were recorded at (scripts/record-fixtures.ts). */
export const TEST_POINT = { lat: -33.873, lon: 151.211 };

/** A fetch that serves fixtures by exact URL; anything else is a 404 and is recorded in `misses`. */
export function fixtureFetch(fixtures = loadFixtures()) {
  const calls: Request[] = [];
  const misses: string[] = [];
  const fn = async (req: Request) => {
    calls.push(req);
    const fx = fixtures.get(req.url);
    if (!fx) {
      misses.push(req.url);
      return new Response("not found", { status: 404 });
    }
    return new Response(JSON.stringify(fx.body), { status: fx.status, headers: { "Content-Type": "application/json" } });
  };
  return { fn, calls, misses };
}

export function memoryCache(): CacheLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async match(req) {
      const v = store.get(req.url);
      return v === undefined ? undefined : new Response(v);
    },
    async put(req, res) {
      store.set(req.url, await res.text());
    },
  };
}

export function testContext(overrides: { fetch?: HttpDeps["fetch"]; data?: Partial<StaticData> } = {}): ToolContext {
  return {
    http: { fetch: overrides.fetch ?? fixtureFetch().fn, userAgent: "Greener/test (+https://example.invalid)", sleep: async () => {} },
    data: { ...STATIC_DATA, ...overrides.data },
    today: "2026-11-24",
  };
}

export const location = { lat: -33.87, lon: 151.21, label: "Test suburb", precision: "approximate" as const, state: "NSW" as const };

export function profile(answers: Record<string, { optionIds?: string[]; notSure?: boolean; other?: string }> = {}): SiteProfile {
  return SiteProfile.parse({ location, answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, { optionIds: [], ...v }])) });
}

export function research(): ResearchReport {
  return ResearchReport.parse({
    createdAt: "2026-11-24",
    radiusKm: 10,
    keyNativePlants: [
      { scientificName: "Lomandra longifolia", tags: ["native"], citationIds: ["ala:occ:native-plants"] },
      { scientificName: "Acacia terminalis", tags: ["native", "threatened"], citationIds: ["ala:occ:native-plants"] },
      { scientificName: "Callistemon linearis", tags: ["native", "introduced"], citationIds: ["ala:occ:native-plants"] },
    ],
    keyFauna: [{ scientificName: "Manorina melanocephala", tags: [], citationIds: ["ala:occ:fauna"] }],
    threatenedSpecies: [],
    invasiveSpecies: [
      { scientificName: "Lantana camara", tags: ["introduced"], citationIds: ["ala:occ:introduced-plants"] },
      { scientificName: "Ceratitis capitata", tags: ["biosecurity_pest"], citationIds: ["ala:occ:state-invasive"] },
    ],
    dataGaps: [{ topic: "climate normals", reason: "pending" }],
    citations: [
      { id: "ala:occ:native-plants", source: "research", title: "ALA native plants" },
      { id: "ala:occ:fauna", source: "research", title: "ALA fauna" },
      { id: "ala:occ:introduced-plants", source: "research", title: "ALA introduced plants" },
      { id: "ala:occ:state-invasive", source: "research", title: "ALA state invasive" },
    ],
  });
}

export function action(id: string, o: Partial<ActionInput> = {}): ActionInput {
  return {
    id,
    title: `Action ${id}`,
    category: "other",
    priority: "medium",
    effort: "low",
    season: ["autumn"],
    steps: ["Do it"],
    rationale: "Because",
    citationIds: ["ala:occ:native-plants"],
    labourHours: { low: 1, high: 2 },
    materialsAud: { low: 10, high: 20 },
    window: { startMonth: 1, endMonth: 12 },
    ...o,
  };
}

export function plan(o: Partial<Record<string, unknown>> = {}): ActionPlan {
  return ActionPlan.parse({
    version: 1,
    createdAt: "2026-11-24",
    goals: ["Attract birds"],
    quickWins: [],
    actions: [action("a1", { category: "planting", plantings: [{ scientificName: "Lomandra longifolia", citationIds: ["ala:occ:native-plants"] }] })],
    plantingList: [{ scientificName: "Lomandra longifolia", commonName: "Spiny-headed Mat-rush", quantity: 10, citationIds: ["ala:occ:native-plants"] }],
    monitoring: ["Count birds each season"],
    citations: [{ id: "kb:greener-how-plans-work#1", source: "global_kb", title: "How Greener builds and checks a plan" }],
    ...o,
  });
}
