import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildServer, handleMcp } from "../../src/server.js";
import { TOOLS } from "../../src/tools/registry.js";
import type { Tool } from "../../src/tools/define.js";
import { action, FIRE_POINT, fixtureFetch, location, plan, profile, research, TEST_POINT, testContext } from "../helpers.js";

const tool = (name: string): Tool => {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(name);
  return t;
};
const call = async (name: string, args: unknown, ctx = testContext()) => {
  const r = await tool(name).run(args, ctx);
  return { ...r, data: r.structuredContent as Record<string, unknown> };
};
const cap = { hoursPerWeek: { summer: 2, autumn: 2, winter: 2, spring: 2 }, upfrontAud: 500, yearlyAud: 200 };

describe("tool contract (Section 12.3)", () => {
  it("keeps the tool list stable: a rename is a major version", () => {
    expect(TOOLS.map((t) => t.name)).toMatchInlineSnapshot(`
      [
        "get_question_bank",
        "ask_question",
        "save_answer",
        "geocode",
        "bushfire_status",
        "save_profile",
        "get_site",
        "ala_species_near",
        "ala_species_profile",
        "climate_normals",
        "soil_properties",
        "vegetation_community",
        "weed_status",
        "save_research",
        "search_knowledge",
        "get_site_strategies",
        "check_species",
        "get_cost_reference",
        "schedule_plan",
        "mark_done",
        "save_plan",
        "export_plan",
        "search_site",
        "get_plan_section",
      ]
    `);
  });

  it("gives every tool a snake_case name, a description and a JSON schema", () => {
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(t.description.length).toBeGreaterThan(40);
      expect(z.toJSONSchema(t.input, { io: "input", unrepresentable: "any" })).toMatchObject({ type: "object" });
    }
  });

  it("returns a structured error with hints for bad input, never a stack trace", async () => {
    const r = await call("geocode", { lat: "north" });
    expect(r.isError).toBe(true);
    expect(r.data.fixHints).toEqual([expect.stringContaining("lat")]);
    expect(JSON.stringify(r)).not.toMatch(/at .*\.ts:\d+/);
  });

  it("registers every tool and the question card on the MCP server", () => {
    expect(() => buildServer(testContext())).not.toThrow();
  });
});

describe("intake tools", () => {
  it("walks the intake: ask, answer, next, with a numbered list for text hosts (FR-09)", async () => {
    const first = await call("ask_question", {});
    expect(first.data.question).toMatchObject({ id: "location" });
    expect(first.content[0]?.text).toContain("1. Use my location");
    const saved = await call("save_answer", { questionId: "location", answer: { optionIds: ["use_my_location"] }, location });
    expect(saved.data).toMatchObject({ saved: "location", complete: false, question: { id: "site_type" }, progress: { index: 2, total: 20 } });
    const p = saved.data.profile as { location?: unknown };
    expect(p.location).toMatchObject({ lat: -33.87 });
    const again = await call("ask_question", { profile: saved.data.profile, questionId: "location" });
    expect(again.data.question).toMatchObject({ id: "location" });
    const skipped = await call("ask_question", { profile: saved.data.profile, skipIds: ["site_type"] });
    expect(skipped.data.question).toMatchObject({ id: "area" });
  });

  it("links the question card UI resource on ask_question (MCP Apps)", () => {
    expect(tool("ask_question").meta).toMatchObject({ ui: { resourceUri: "ui://intake-card" }, "ui/resourceUri": "ui://intake-card" });
  });

  it("refuses an answer that does not fit, and an unknown question", async () => {
    expect((await call("save_answer", { questionId: "site_type", answer: { optionIds: ["castle"] } })).isError).toBe(true);
    expect((await call("save_answer", { questionId: "nope", answer: { optionIds: ["x"] } })).isError).toBe(true);
    expect((await call("ask_question", { questionId: "nope" })).isError).toBe(true);
  });

  it("reports completion with follow-ups (FR-04)", async () => {
    const bank = testContext().data.bank;
    const answers = Object.fromEntries(bank.questions.map((q) => [q.id, { optionIds: [q.options[0]?.id ?? ""] }]));
    answers.site_type = { optionIds: ["apartment"] };
    answers.area = { optionIds: ["ha_2_50"] };
    const r = await call("ask_question", { profile: { location, answers } });
    expect(r.data.complete).toBe(true);
    expect((r.data.followUps as string[])[0]).toContain("apartment");
    expect((r.data.followUps as string[]).length).toBeLessThanOrEqual(3);
  });

  it("validates a whole profile and loads one from a file (FR-05)", async () => {
    const ok = await call("save_profile", { profile: profile({ site_type: { optionIds: ["suburban"] }, hours_per_week: { optionIds: ["h_1_2"] } }) });
    expect(ok.data).toMatchObject({ complete: false, saveAs: "profile.json", capacity: { upfrontAud: 0 } });
    expect(ok.data.missing).toContain("tenure");
    const bad = await call("save_profile", { profile: { answers: { site_type: { optionIds: ["castle"] } } } });
    expect(bad.isError).toBe(true);
    const hidden = await call("save_profile", { profile: { answers: { site_type: { optionIds: ["apartment"] }, soil: { optionIds: ["clay"] } } } });
    expect(hidden.data.fixHints).toEqual([expect.stringContaining("not a question for this site")]);
    expect((await call("save_profile", { profile: { schemaVersion: 99 } })).isError).toBe(true);
  });

  it("geocodes coordinates, refuses non-Australian ones, and records a gap for addresses (FR-02)", async () => {
    expect((await call("geocode", { lat: -33.87, lon: 151.21 })).data.location).toMatchObject({ precision: "exact", state: "NSW" });
    expect((await call("geocode", { lat: 51.5, lon: -0.1 })).isError).toBe(true);
    expect((await call("geocode", { query: "Newtown NSW" })).data).toMatchObject({ location: null, dataGap: { topic: "suburb or postcode lookup" } });
    expect((await call("geocode", {})).isError).toBe(true);
  });

  it("geocodes a NSW street address to its suburb, with the council and a citation (FR-02, D-19)", async () => {
    const r = await call("geocode", { address: { houseNumber: "346", roadName: "Panorama", roadType: "Ave", suburb: "Bathurst", postCode: "2795" } });
    expect(r.data).toMatchObject({ location: { lat: -33.429684292575985, lon: 149.56705027301055, label: "Bathurst", precision: "exact", state: "NSW" }, council: "Bathurst Regional", citation: { id: "nsw:address-location" } });
    expect(JSON.stringify(r.data)).not.toContain("Panorama");
    const missing = await call("geocode", { address: { houseNumber: "1", roadName: "Notarealname", roadType: "St", suburb: "Bathurst" } });
    expect(missing.data).toMatchObject({ location: null, nextStep: expect.stringContaining("not found") });
    expect((await call("geocode", { address: { roadName: "Panorama" } })).isError).toBe(true);
  });

  it("asks the user to pick when several addresses match", async () => {
    const two = { addressResult: { numRecs: 2, addresses: ["BATHURST", "KELSO"].map((s, i) => ({ suburbName: s, postCode: 2795, addressPoint: { centreX: 149.5 + i / 10, centreY: -33.4 } })) } };
    const r = await call("geocode", { address: { roadName: "Main", postCode: "2795" } }, testContext({ fetch: async () => new Response(JSON.stringify(two)) }));
    expect(r.data.location).toBeNull();
    expect((r.data.candidates as { location: { label: string } }[]).map((c) => c.location.label)).toEqual(["Bathurst", "Kelso"]);
  });

  it("looks up bushfire-prone land and suggests an answer (FR-03, D-18)", async () => {
    const fire = await call("bushfire_status", { location: { ...location, ...FIRE_POINT, precision: "exact" } });
    expect(fire.data).toMatchObject({ status: "prone", suggestedAnswer: { questionId: "bushfire_prone", answer: { optionIds: ["yes"] } }, citation: { id: "nsw:bushfire-prone-land" } });
    expect((fire.data.notes as string[]).join(" ")).toContain("not a planning certificate");
    const city = await call("bushfire_status", { location: { ...location, ...TEST_POINT } });
    expect(city.data).toMatchObject({ status: "not_mapped", suggestedAnswer: { answer: { optionIds: ["no"] } } });
    expect((city.data.notes as string[]).join(" ")).toContain("approximate");
  });

  it("returns unknown bushfire status with a gap when the map fails, not a guess (NFR-07)", async () => {
    expect((await call("bushfire_status", { location })).data).toMatchObject({ status: "unknown", dataGap: { topic: "bushfire-prone land status" } });
  });

  it("summarises a site file", async () => {
    const r = await call("get_site", { profile: profile({ soil: { notSure: true } }) });
    expect(r.data).toMatchObject({ answers: { soil: "not sure" }, nextUnanswered: "location" });
    expect(JSON.stringify(r.data)).not.toContain("151.21");
  });

  it("lists the question bank for a site", async () => {
    const r = await call("get_question_bank", { profile: profile({ site_type: { optionIds: ["apartment"] } }) });
    expect(r.data.total).toBe(17);
  });
});

describe("research tools", () => {
  it("returns species near the site from fixtures", async () => {
    const r = await call("ala_species_near", { location: { ...location, lat: -33.873, lon: 151.211 } });
    expect(r.isError).toBeUndefined();
    expect((r.data.nativePlants as unknown[]).length).toBeGreaterThan(0);
    expect((r.data.citations as unknown[]).length).toBe(6);
  });

  it("returns a data gap when ALA is down (NFR-07)", async () => {
    const ctx = testContext({ fetch: async () => new Response("x", { status: 503 }) });
    const r = await call("ala_species_near", { location }, ctx);
    expect((r.data.dataGaps as unknown[]).length).toBe(6);
    const p = await call("ala_species_profile", { name: "Lomandra longifolia" }, ctx);
    expect(p.data).toMatchObject({ found: false });
  });

  it("returns a species profile", async () => {
    expect((await call("ala_species_profile", { name: "Lomandra longifolia" })).data).toMatchObject({ found: true, family: "Asparagaceae" });
  });

  it("returns data gaps for sources still being checked", async () => {
    for (const name of ["climate_normals", "soil_properties", "vegetation_community"]) {
      expect((await call(name, { location })).data).toMatchObject({ available: false, dataGap: expect.objectContaining({ reason: expect.stringContaining("still being checked") }) });
    }
  });

  it("checks names against the declared weed list", async () => {
    const r = await call("weed_status", { names: ["Lantana camara", "Lomandra longifolia"] });
    expect(r.data.results).toEqual([expect.objectContaining({ name: "Lantana camara", declared: true, sourceUrl: "https://weeds.dpi.nsw.gov.au/Weed/Lantana" }), { name: "Lomandra longifolia", declared: false }]);
    expect(r.data.dataGap).toBeUndefined();
  });

  it("says 'unknown', not 'not a weed', when the list is empty", async () => {
    const r = await call("weed_status", { names: ["Lantana camara"] }, testContext({ data: { declaredWeeds: [] } }));
    expect(r.data.results).toEqual([{ name: "Lantana camara", declared: null }]);
    expect(r.data.dataGap).toBeDefined();
  });

  it("validates a research report and its citations (FR-15)", async () => {
    expect((await call("save_research", { research: research() })).data).toMatchObject({ saveAs: "research.json", counts: { keyNativePlants: 3 } });
    const broken = { ...research(), keyFauna: [{ scientificName: "X", tags: [], citationIds: ["missing"] }] };
    expect((await call("save_research", { research: broken })).isError).toBe(true);
    expect((await call("save_research", { research: { radiusKm: 10 } })).isError).toBe(true);
  });
});

describe("knowledge and plan tools", () => {
  it("searches the global KB and asks Claude to read catalogue pages live (FR-46)", async () => {
    const r = await call("search_knowledge", { query: "occurrence records native introduced" });
    const results = r.data.results as { citationId: string; kb: string; tier: string; readLive?: string }[];
    expect(results[0]?.kb).toBe("global");
    const cat = results.find((x) => x.tier === "link_catalogue");
    expect(cat?.readLive).toContain("Read the live page");
    expect((await call("search_knowledge", { query: "zzzz qqqq" })).data.note).toContain("do not guess");
  });

  it("checks species with ALA name matching (NFR-01, FR-24)", async () => {
    const r = await call("check_species", { names: ["Lomandra longifolia", "Lantana camara", "Notaplant fakeus"], research: research() });
    const results = r.data.results as { query: string; verdict: string; blocking: boolean; alaName: string | null; nameWarning?: string }[];
    expect(results[0]).toMatchObject({ alaName: "Lomandra longifolia", verdict: "local_native", blocking: false });
    expect(results[1]).toMatchObject({ verdict: "declared_weed", blocking: true });
    expect(results[2]).toMatchObject({ alaName: null, verdict: "not_native", blocking: true });
    expect(results[2]?.nameWarning).toContain("could not match");
  });

  it("allows Australian natives and blocks invasives, checked live (D-17)", async () => {
    const names = ["Banksia serrata", "Eucalyptus marginata", "Jacaranda mimosifolia", "Grevillea robusta"];
    const r = await call("check_species", { names, research: research(), location });
    const byName = Object.fromEntries((r.data.results as { query: string; verdict: string }[]).map((x) => [x.query, x.verdict]));
    expect(byName).toEqual({ "Banksia serrata": "local_native", "Eucalyptus marginata": "australian_native", "Jacaranda mimosifolia": "introduced", "Grevillea robusta": "introduced" });
    expect(r.data.allowed).toEqual(["Banksia serrata", "Eucalyptus marginata"]);
    expect(r.data.blocked).toEqual(["Jacaranda mimosifolia", "Grevillea robusta"]);
    expect((r.data.citations as { id: string }[]).map((c) => c.id)).toContain("ala:aus:eucalyptus-marginata");
    expect(r.data.dataGaps).toBeUndefined();
    const noLoc = await call("check_species", { names: ["Banksia serrata"], research: research() });
    expect(noLoc.data.blocked).toEqual(["Banksia serrata"]);
    expect(noLoc.data.note).toContain("Pass the site location");
  });

  it("saves Australian natives, and refuses invasives and chemicals (D-17)", async () => {
    const ok1 = plan({ plantingList: [{ scientificName: "Banksia serrata", citationIds: ["ala:near:banksia-serrata"] }, { scientificName: "Eucalyptus marginata", citationIds: ["ala:aus:eucalyptus-marginata"] }], citations: [{ id: "ala:near:banksia-serrata", source: "research", title: "ALA" }, { id: "ala:aus:eucalyptus-marginata", source: "research", title: "ALA" }] });
    const saved = await call("save_plan", { plan: ok1, research: research(), profile: profile() });
    expect(saved.isError).toBeUndefined();
    expect((saved.data.warnings as { code: string }[]).map((w) => w.code)).toContain("australian_native");
    const invasive = plan({ plantingList: [{ scientificName: "Grevillea robusta", citationIds: ["ala:occ:native-plants"] }] });
    const r = await call("save_plan", { plan: invasive, research: research(), profile: profile() });
    expect(r.isError).toBe(true);
    expect((r.data.fixHints as string[])[0]).toContain("invasive here");
    const sprayed = plan({ actions: [action("a1", { title: "Spray weeds", category: "weed_control" })] });
    expect((await call("save_plan", { plan: sprayed, research: research(), profile: profile() })).isError).toBe(true);
  });

  it("returns dated costs, and no data for unknown items (FR-68, FR-70)", async () => {
    const r = await call("get_cost_reference", { items: ["Native tube stock", "Gold nest box"], region: "NSW southern tablelands" });
    expect(r.data.matches).toEqual([expect.objectContaining({ found: true, lowAud: 2.2, highAud: 2.75, asOf: "2026-11-24" }), expect.objectContaining({ found: false })]);
    expect(r.data.availableItems).toContain("Native tube stock (each, NSW southern tablelands)");
  });

  it("gives strategies for apartments, renters and bushfire-prone land with resolvable citations", async () => {
    const apt = await call("get_site_strategies", { profile: profile({ site_type: { optionIds: ["apartment"] }, tenure: { optionIds: ["rent"] } }) });
    const s1 = apt.data.strategies as { id: string; citationIds: string[]; citations: { id: string }[] }[];
    expect(s1.map((s) => s.id)).toEqual(["chemical_free", "small_space", "removable"]);
    for (const s of s1) expect(s.citations.map((c) => c.id)).toEqual(s.citationIds);
    const fire = await call("get_site_strategies", { profile: profile({ site_type: { optionIds: ["rural"] }, bushfire_prone: { optionIds: ["yes"] } }) });
    expect((fire.data.strategies as { id: string }[]).map((s) => s.id)).toEqual(["chemical_free", "bushfire"]);
    expect((await call("get_site_strategies", { profile: profile() })).data.strategies).toHaveLength(1);
  });

  it("saves a bushfire-prone plan with warnings and the strategy (FR-23)", async () => {
    const fire = profile({ bushfire_prone: { optionIds: ["yes"] } });
    const r = await call("save_plan", { plan: plan(), research: research(), profile: fire });
    expect(r.isError).toBeUndefined();
    expect((r.data.warnings as { code: string }[]).map((w) => w.code)).toContain("bushfire_caution");
    expect((r.data.strategies as { id: string }[]).map((x) => x.id)).toContain("bushfire");
  });

  it("schedules from a profile or a capacity, and needs one of them", async () => {
    const byCap = await call("schedule_plan", { actions: [action("a")], startMonth: 3, capacity: cap });
    expect(byCap.data).toMatchObject({ phases: expect.any(Array), monthlySummary: { months: 36 } });
    const byProfile = await call("schedule_plan", { actions: [action("a")], startMonth: 3, profile: profile({ hours_per_week: { optionIds: ["h_1_2"] } }), includeMonthly: true });
    expect((byProfile.data.monthly as unknown[]).length).toBe(36);
    expect(byProfile.data.capacityGaps).toEqual(["upfront_budget", "yearly_budget"]);
    expect((await call("schedule_plan", { actions: [action("a")], startMonth: 3 })).isError).toBe(true);
    const cyc = await call("schedule_plan", { actions: [action("a", { dependsOn: ["a"] })], startMonth: 3, capacity: cap });
    expect(cyc.isError).toBe(true);
    expect(cyc.data.fixHints).toEqual([expect.stringContaining("itself")]);
  });

  it("marks an action done (FR-71)", async () => {
    const r = await call("mark_done", { actions: [action("a"), action("b")], actionId: "a", month: 1, actualHours: 3, actualCostAud: 12, startMonth: 3, capacity: cap });
    expect((r.data.actions as { id: string; done?: unknown }[])[0]?.done).toEqual({ month: 1, hours: 3, costAud: 12 });
    expect((await call("mark_done", { actions: [action("a")], actionId: "a", month: 1, actualHours: 1, actualCostAud: 1, startMonth: 3 })).isError).toBe(true);
  });

  it("saves a clean plan and refuses one with a weed (FR-24)", async () => {
    const good = await call("save_plan", { plan: plan(), research: research(), profile: profile({ hours_per_week: { optionIds: ["h_2_5"] } }), startMonth: 3 });
    expect(good.data).toMatchObject({ saveAs: "plans/v1.json", schedule: expect.any(Object) });
    const weedy = plan({ plantingList: [{ scientificName: "Lantana camara", citationIds: ["ala:occ:native-plants"] }] });
    const bad = await call("save_plan", { plan: weedy, research: research(), profile: profile() });
    expect(bad.isError).toBe(true);
    expect((bad.data.fixHints as string[])[0]).toContain("Lantana camara");
    expect((await call("save_plan", { plan: { version: 1 }, research: research(), profile: profile() })).isError).toBe(true);
  });

  it("exports Markdown and JSON (FR-50)", async () => {
    const md = await call("export_plan", { plan: plan(), research: research(), profile: profile({ hours_per_week: { optionIds: ["h_2_5"] } }), startMonth: 3 });
    expect(md.data.markdown).toContain("## Phases");
    expect(md.content[0]?.text).toContain("# Biodiversity action plan");
    expect((await call("export_plan", { plan: plan(), format: "json" })).data).toMatchObject({ fileName: "plan-v1.json" });
  });

  it("searches the site file and gets plan sections", async () => {
    expect(((await call("search_site", { query: "lomandra", research: research() })).data.hits as unknown[]).length).toBeGreaterThan(0);
    expect((await call("search_site", { query: "zebra" })).data.note).toContain("do not guess");
    expect((await call("get_plan_section", { plan: plan(), section: "goals" })).data.data).toEqual(["Attract birds"]);
  });
});

describe("MCP over HTTP (stateless)", () => {
  const rpc = (body: unknown) => new Request("https://test.invalid/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify(body) });

  it("answers initialize, tools/list, tools/call and resources/read with no session", async () => {
    const ctx = testContext({ fetch: fixtureFetch().fn });
    const log: unknown[] = [];
    const init = await (await handleMcp(rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } }), ctx)).json();
    expect(init).toMatchObject({ result: { serverInfo: { name: "greener" } } });
    const list = (await (await handleMcp(rpc({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }), ctx)).json()) as { result: { tools: { name: string; _meta?: unknown }[] } };
    expect(list.result.tools).toHaveLength(TOOLS.length);
    expect(list.result.tools.find((t) => t.name === "ask_question")?._meta).toMatchObject({ ui: { resourceUri: "ui://intake-card" } });
    const called = (await (await handleMcp(rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "geocode", arguments: { lat: -33.87, lon: 151.21 } } }), ctx, (l) => log.push(l))).json()) as { result: { structuredContent: unknown } };
    expect(called.result.structuredContent).toMatchObject({ location: { lat: -33.87 } });
    expect(log).toEqual([{ tool: "geocode", ms: expect.any(Number), result: "ok" }]);
    const res = (await (await handleMcp(rpc({ jsonrpc: "2.0", id: 4, method: "resources/read", params: { uri: "ui://intake-card" } }), ctx)).json()) as { result: { contents: { mimeType: string; text: string }[] } };
    expect(res.result.contents[0]?.mimeType).toBe("text/html;profile=mcp-app");
    expect(res.result.contents[0]?.text).toContain("ui/initialize");
    expect(res.result.contents[0]?.text).not.toContain("/*CARD_SCRIPT*/");
  });
});
