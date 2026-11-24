/**
 * `npm run smoke` — call each MCP tool on a deployed Worker and check the
 * responses (Section 11.2, Section 12.3).
 *
 *   npm run smoke                 staging (SMOKE_STAGING_URL or the default below)
 *   npm run smoke -- --prod       production (SMOKE_PROD_URL)
 *   npm run smoke -- --url <url>  any MCP endpoint, e.g. http://localhost:8787/mcp
 *
 * Uses a public test point in central Sydney, not a user site.
 */
import { TOOLS } from "../server/src/tools/registry.js";
import { fail } from "./lib.js";

// TODO: set these after the first deploy (they depend on the Cloudflare account subdomain).
const DEFAULTS = { staging: "https://greener-staging.example.workers.dev/mcp", prod: "https://greener-production.example.workers.dev/mcp" };

const argv = process.argv.slice(2);
const urlArg = argv.indexOf("--url");
const url = urlArg >= 0 ? argv[urlArg + 1] : argv.includes("--prod") ? (process.env.SMOKE_PROD_URL ?? DEFAULTS.prod) : (process.env.SMOKE_STAGING_URL ?? DEFAULTS.staging);
if (!url) fail("missing URL after --url");

let id = 0;
async function rpc(method: string, params: Record<string, unknown>): Promise<{ result?: Record<string, unknown>; error?: { message: string } }> {
  const res = await fetch(url as string, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  return (await res.json()) as { result?: Record<string, unknown>; error?: { message: string } };
}

const loc = { lat: -33.87, lon: 151.21, label: "Sydney (smoke test)", precision: "approximate", state: "NSW" };
const research = {
  createdAt: "2026-01-01",
  radiusKm: 10,
  keyNativePlants: [{ scientificName: "Lomandra longifolia", tags: ["native"], citationIds: ["c1"] }],
  keyFauna: [],
  threatenedSpecies: [],
  invasiveSpecies: [],
  dataGaps: [],
  citations: [{ id: "c1", source: "research", title: "Smoke test" }],
};
const action = { id: "a1", title: "Plant mat-rush", category: "planting", priority: "high", effort: "low", season: ["autumn"], steps: ["Plant"], rationale: "Habitat", citationIds: ["c1"], labourHours: { low: 1, high: 2 }, materialsAud: { low: 10, high: 20 }, window: { startMonth: 1, endMonth: 12 } };
const plan = { version: 1, createdAt: "2026-01-01", goals: ["Birds"], actions: [action], plantingList: [{ scientificName: "Lomandra longifolia", citationIds: ["c1"] }], monitoring: ["Count birds"], citations: [{ id: "c1", source: "research", title: "Smoke test" }] };
const capacity = { hoursPerWeek: { summer: 2, autumn: 2, winter: 2, spring: 2 }, upfrontAud: 500, yearlyAud: 200 };

const SAMPLES: Record<string, Record<string, unknown>> = {
  get_question_bank: {},
  ask_question: {},
  save_answer: { questionId: "site_type", answer: { optionIds: ["suburban"] } },
  geocode: { lat: -33.87, lon: 151.21 },
  bushfire_status: { location: loc },
  save_profile: { profile: { location: loc } },
  get_site: { profile: { location: loc } },
  ala_species_near: { location: loc },
  ala_species_profile: { name: "Lomandra longifolia" },
  climate_normals: { location: loc },
  soil_properties: { location: loc },
  vegetation_community: { location: loc },
  weed_status: { names: ["Lantana camara"] },
  save_research: { research },
  search_knowledge: { query: "native plants birds" },
  get_site_strategies: { profile: { location: loc, answers: { site_type: { optionIds: ["apartment"] }, tenure: { optionIds: ["rent"] } } } },
  check_species: { names: ["Lomandra longifolia"], research },
  get_cost_reference: { items: ["Native tube stock"] },
  schedule_plan: { actions: [action], startMonth: 3, capacity },
  mark_done: { actions: [action], actionId: "a1", month: 1, actualHours: 2, actualCostAud: 15, startMonth: 3, capacity },
  save_plan: { plan, research, profile: { location: loc } },
  export_plan: { plan },
  search_site: { query: "mat-rush", plan },
  get_plan_section: { plan, section: "goals" },
};

console.log(`Smoke test against ${url}`);
const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "greener-smoke", version: "0.1.0" } });
if (!init.result) fail(`initialize failed: ${init.error?.message}`);
const list = await rpc("tools/list", {});
const names = ((list.result?.tools as { name: string }[] | undefined) ?? []).map((t) => t.name);
const failures: string[] = [];
for (const t of TOOLS) {
  if (!names.includes(t.name)) {
    failures.push(`${t.name}: not in tools/list`);
    continue;
  }
  const args = SAMPLES[t.name];
  if (!args) {
    failures.push(`${t.name}: no smoke sample`);
    continue;
  }
  const start = Date.now();
  const r = await rpc("tools/call", { name: t.name, arguments: args });
  const ms = Date.now() - start;
  const isError = r.error || (r.result?.isError as boolean | undefined);
  console.log(`${isError ? "✗" : "✓"} ${t.name} (${ms} ms)`);
  if (isError) failures.push(`${t.name}: ${r.error?.message ?? JSON.stringify(r.result?.content).slice(0, 200)}`);
}
const res = await rpc("resources/read", { uri: "ui://intake-card" });
if (!res.result) failures.push("ui://intake-card: resource not readable");
if (failures.length) fail(`Smoke test failed:\n  ${failures.join("\n  ")}`);
console.log(`✓ all ${TOOLS.length} tools and the question card answered`);
