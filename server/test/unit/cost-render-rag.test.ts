import { describe, expect, it } from "vitest";
import { lookupCosts, parseCostReference, parseCsv } from "../../src/core/cost.js";
import { attributions, planSection, planToMarkdown, searchSite } from "../../src/core/render.js";
import { schedulePlan } from "../../src/core/schedule.js";
import { buildIndex, search, stem, tokenize, type IndexedChunk } from "../../src/rag/bm25.js";
import { chunkMarkdown } from "../../src/rag/chunk.js";
import { KbManifest, manifestRuleErrors } from "../../src/rag/manifest.js";
import { STATIC_DATA } from "../../src/data.js";
import { action, plan, profile, research } from "../helpers.js";

const HEADER = "item,unit,low_aud,high_aud,region,source,as_of";

describe("cost reference (FR-68–FR-70)", () => {
  const table = parseCostReference(`${HEADER}\n"Tube stock, each",each,2,4,NSW coast,Test nursery list,2026-01-01\nTube stock,each,3,5,NSW tablelands,Test list,2026-02-01\n`);

  it("parses quoted CSV fields", () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3')).toEqual([["a", "b, c", 'd "e"'], ["1", "2", "3"]]);
    expect(table[0]?.item).toBe("Tube stock, each");
  });

  it("rejects a bad header or bad numbers", () => {
    expect(() => parseCostReference("item,price\n")).toThrow(/header/);
    expect(() => parseCostReference(`${HEADER}\nx,each,abc,4,NSW,s,2026-01-01`)).toThrow(/row 2/);
    expect(() => parseCostReference(`${HEADER}\nx,each,5,4,NSW,s,2026-01-01`)).toThrow(/below/);
  });

  it("prefers the region, then local prices, and says no data otherwise", () => {
    const [m] = lookupCosts(["Tube stock"], "NSW tablelands", table);
    expect(m).toMatchObject({ found: true, lowAud: 3, asOf: "2026-02-01" });
    const [local] = lookupCosts(["tube stock"], "NSW coast", table, [{ item: "Tube stock", unit: "each", lowAud: 1, highAud: 1, asOf: "2026-03-01" }]);
    expect(local).toMatchObject({ found: true, source: "local_price", lowAud: 1 });
    const [none] = lookupCosts(["Gold-plated nest box"], undefined, table);
    expect(none).toMatchObject({ found: false });
    expect(none?.note).toContain("No cost data");
    const [other] = lookupCosts(["Tube stock"], "Riverina", table);
    expect(other?.found && other.note).toContain("not Riverina");
  });

  it("ships dated, sourced prices (Q-12)", () => {
    expect(STATIC_DATA.costTable.length).toBeGreaterThan(0);
    for (const r of STATIC_DATA.costTable) {
      expect(r.source).toMatch(/https:\/\//);
      expect(r.asOf).toMatch(/^\d{4}-\d{2}/);
      expect(r.highAud).toBeGreaterThanOrEqual(r.lowAud);
    }
  });

  it("ships the declared weed list with a source for every row", () => {
    expect(STATIC_DATA.declaredWeeds.length).toBeGreaterThan(100);
    for (const w of STATIC_DATA.declaredWeeds) expect(w.sourceUrl).toMatch(/^https:\/\/weeds\.dpi\.nsw\.gov\.au\//);
    const names = STATIC_DATA.declaredWeeds.map((w) => w.scientificName);
    expect(names).toEqual(expect.arrayContaining(["Lantana camara", "Asparagus aethiopicus", "Senecio madagascariensis"]));
  });
});

describe("plan export and site search (FR-50, FR-30)", () => {
  it("renders Markdown with actions, sources and attribution", () => {
    const p = plan({ actions: [action("a1", { cautions: [{ tag: "pets", text: "Keep cats in at night." }], dependsOn: [] }), action("a2", { materialsAud: null, dependsOn: ["a1"], targetSpecies: ["Superb Fairy-wren"] })], quickWins: ["a1"] });
    const r = research();
    r.citations[0] = { ...r.citations[0]!, publisher: "Atlas of Living Australia", licence: "CC BY" };
    const sched = schedulePlan({ actions: p.actions, capacity: { hoursPerWeek: { summer: 2, autumn: 2, winter: 2, spring: 2 }, upfrontAud: 500, yearlyAud: 100 }, startMonth: 3 });
    const md = planToMarkdown(p, sched, r);
    expect(md).toContain("# Biodiversity action plan, version 1");
    expect(md).toContain("### a1: Action a1");
    expect(md).toContain("Materials: no cost data");
    expect(md).toContain("Do after: a1");
    expect(md).toContain("Keep cats in at night.");
    expect(md).toContain("## Budget (AUD, estimates)");
    expect(md).toContain("| *Lomandra longifolia* | Spiny-headed Mat-rush | 10 |");
    expect(md).toContain("Atlas of Living Australia, licensed CC BY");
    expect(md).toContain("## What more time or money would add");
  });

  it("dedupes attribution lines", () => {
    const c = { id: "x", source: "research" as const, title: "T", publisher: "P", licence: "L" };
    expect(attributions([c, { ...c, id: "y" }])).toEqual(["P, licensed L"]);
  });

  it("returns single sections and actions", () => {
    const p = plan();
    expect(planSection(p, "goals")).toEqual(["Attract birds"]);
    expect(planSection(p, "actions", "a1")).toHaveLength(1);
    expect(planSection(p, "actions")).toEqual([{ id: "a1", title: "Action a1", category: "planting", priority: "medium" }]);
    for (const s of ["quick_wins", "planting_list", "monitoring", "local_resources", "citations"] as const) expect(planSection(p, s)).toBeDefined();
  });

  it("searches the site file", () => {
    const hits = searchSite("lomandra", { research: research(), plan: plan(), profile: profile({ soil: { optionIds: ["clay"] } }) });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.citationIds).toContain("ala:occ:native-plants");
    expect(searchSite("clay soil", { profile: profile({ soil: { optionIds: ["clay"] } }) })[0]?.where).toBe("profile.soil");
    expect(searchSite("climate", { research: research() })[0]?.text).toContain("Data gap");
    expect(searchSite("xy", { research: research() })).toEqual([]);
  });
});

describe("KB search (Section 7.4, D-06)", () => {
  const chunk = (id: string, text: string, o: Partial<IndexedChunk> = {}): IndexedChunk => ({ chunkId: id, itemId: id.split("#")[0] ?? id, title: id, heading: "", text, tier: "open_content", url: "https://example.invalid", publisher: "p", licence: "maintainer", region: "Australia", dateChecked: "2026-01-01", tags: [], accessLevel: "public", ...o });

  it("tokenizes and stems", () => {
    expect(tokenize("The Native PLANTS of the bushes")).toEqual(["native", "plant", "bushe"]);
    expect(stem("species")).toBe("species");
    expect(stem("butterflies")).toBe("butterfly");
    expect(stem("grass")).toBe("grass");
  });

  it("ranks the most relevant chunk first and filters by region and tier", () => {
    const index = buildIndex(
      [
        chunk("frogs#1", "frog pond habitat frogs need shallow water and rocks"),
        chunk("birds#1", "birds nest in dense shrubs; plant shrubs for small birds", { region: "NSW" }),
        chunk("vic#1", "birds of victoria", { region: "VIC" }),
        chunk("cat", "birds catalogue summary", { tier: "link_catalogue" }),
      ],
      "2026-01-01",
    );
    const hits = search(index, "small birds shrubs", { region: "NSW" });
    expect(hits[0]?.chunk.chunkId).toBe("birds#1");
    expect(hits.map((h) => h.chunk.chunkId)).not.toContain("vic#1");
    expect(search(index, "birds", { tiers: ["link_catalogue"] }).map((h) => h.chunk.chunkId)).toEqual(["cat"]);
    expect(search(index, "zebra")).toEqual([]);
  });

  it("returns at most two chunks per item and respects the limit", () => {
    const index = buildIndex([chunk("a#1", "water"), chunk("a#2", "water"), chunk("a#3", "water"), chunk("b#1", "water")], "x");
    const hits = search(index, "water");
    expect(hits.filter((h) => h.chunk.itemId === "a")).toHaveLength(2);
    expect(search(index, "water", {}, 1)).toHaveLength(1);
  });

  it("chunks Markdown by heading with overlap", () => {
    const words = Array.from({ length: 100 }, (_, i) => `w${i}`).join(" ");
    const chunks = chunkMarkdown(`# Top\n\nintro text\n\n## Sub\n\n${words}`, 52, 0.15);
    expect(chunks[0]).toEqual({ heading: "Top", text: "intro text" });
    expect(chunks[1]?.heading).toBe("Top > Sub");
    expect(chunks.length).toBeGreaterThan(2);
    const first = chunks[1]?.text.split(" ") ?? [];
    const second = chunks[2]?.text.split(" ") ?? [];
    expect(first.slice(-6)).toEqual(second.slice(0, 6));
  });

  it("searches the shipped index", () => {
    const hits = search(STATIC_DATA.kbIndex, "how are actions put into phases");
    expect(hits[0]?.chunk.itemId).toBe("greener-how-plans-work");
  });
});

describe("KB manifest rules (FR-41, FR-42)", () => {
  const base = { id: "x", title: "X", sourceUrl: "https://example.invalid", publisher: "P", region: "NSW", dateChecked: "2026-01-01", tags: ["t"] };
  it("rejects open content without a redistributable licence", () => {
    const m = KbManifest.parse({ items: [{ ...base, tier: "open_content", file: "x.md", licence: "All rights reserved" }] });
    expect(manifestRuleErrors(m)[0]).toContain("permits redistribution");
  });
  it("needs a permission record for licence 'permission'", () => {
    const m = KbManifest.parse({ items: [{ ...base, tier: "open_content", file: "x.md", licence: "permission" }] });
    expect(manifestRuleErrors(m)[0]).toContain("permission record");
  });
  it("needs a thorough catalogue summary and unique IDs", () => {
    const m = KbManifest.parse({ items: [{ ...base, tier: "link_catalogue", licence: "n/a", summary: "too short" }, { ...base, tier: "link_catalogue", licence: "n/a", summary: "too short" }] });
    const errors = manifestRuleErrors(m);
    expect(errors.some((e) => e.includes("at least 80"))).toBe(true);
    expect(errors.some((e) => e.includes("duplicate"))).toBe(true);
  });
  it("rejects a bad date", () => {
    expect(KbManifest.safeParse({ items: [{ ...base, dateChecked: "24/11/2026", tier: "link_catalogue", licence: "x", summary: "s" }] }).success).toBe(false);
  });
});
