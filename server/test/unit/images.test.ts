import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { commonsInfoUrl, lookupSpeciesImage, wikidataImageUrl } from "../../src/connectors/images.js";
import { imageMarkdown, parseSpeciesImages, plainText, speciesImagesCsv, usableLicence, IMAGE_CSV_HEADER } from "../../src/core/images.js";
import { TOOLS } from "../../src/tools/registry.js";
import { fixture, fixtureFetch, loadFixtures, testContext } from "../helpers.js";

const deps = (fetch = fixtureFetch().fn) => ({ fetch, userAgent: "Greener/test", sleep: async () => {} });
const csv = readFileSync(new URL("../../../data/species-images.csv", import.meta.url), "utf8");
const row = "Lomandra longifolia,,flora,Mat-rush,https://thumb.wikimedia.org/a/330px-L.jpg,https://commons.wikimedia.org/wiki/File:L.jpg,Eric in SF,CC BY-SA 3.0,2026-11-25,no";

describe("species photo rules (FR-17, D-23)", () => {
  it("accepts only CC0, public domain, CC BY and CC BY-SA", () => {
    expect(["CC0", "Public domain", "CC BY 3.0 au", "CC BY-SA 4.0", "cc by-sa 3.0"].map(usableLicence)).toEqual(["CC0", "Public domain", "CC BY 3.0 au", "CC BY-SA 4.0", "CC BY-SA 3.0"]);
    for (const l of ["CC BY-NC 4.0", "CC BY-NC-SA 4.0", "CC BY-ND 4.0", "GFDL", "Attribution", ""]) expect(usableLicence(l)).toBeUndefined();
  });

  it("turns a Commons author into plain text", () => {
    expect(plainText('<div class="fn"><a href="//x">Diliff</a> &amp; co</div>')).toBe("Diliff & co");
  });

  it("validates the shipped photo file", () => {
    const rows = parseSpeciesImages(csv);
    expect(rows.length).toBeGreaterThanOrEqual(16);
    expect(rows.every((r) => usableLicence(r.licence) && r.creator)).toBe(true);
    expect(speciesImagesCsv(rows)).toBe(csv);
  });

  it("rejects bad rows with the row number", () => {
    const bad = (r: string) => () => parseSpeciesImages(`${IMAGE_CSV_HEADER}\n${r}\n`);
    expect(bad(row.replace("CC BY-SA 3.0", "CC BY-NC 4.0"))).toThrow(/row 2: licence/);
    expect(bad(row.replace("thumb.wikimedia.org", "example.com"))).toThrow(/Wikimedia image host/);
    expect(bad(row.replace(",no", ",maybe"))).toThrow(/reviewed must be yes or no/);
    expect(() => parseSpeciesImages(`${IMAGE_CSV_HEADER}\n${row}\n${row}\n`)).toThrow(/duplicate species/);
    expect(() => parseSpeciesImages("name\n")).toThrow(/header/);
  });

  it("writes Markdown with the credit, and labels unreviewed photos", () => {
    const [img] = parseSpeciesImages(`${IMAGE_CSV_HEADER}\n${row}\n`);
    expect(imageMarkdown(img!)).toBe("[![Lomandra longifolia (Mat-rush)](https://thumb.wikimedia.org/a/330px-L.jpg)](https://commons.wikimedia.org/wiki/File:L.jpg)\n*Photo: Eric in SF, CC BY-SA 3.0, via Wikimedia Commons. Example photo, not checked by Greener.*");
    expect(imageMarkdown({ ...img!, reviewed: true })).not.toContain("Example photo");
  });
});

describe("Wikidata and Commons photo lookup (recorded fixtures)", () => {
  it("builds the URLs the fixtures were recorded from", () => {
    expect(wikidataImageUrl("Lomandra longifolia")).toBe(fixture("wikidata-lomandra-longifolia", "images").url);
    expect(commonsInfoUrl("Lomandra_longifolia.jpg")).toBe(fixture("commons-lomandra-longifolia", "images").url);
  });

  it("finds a free photo with its creator and licence", async () => {
    const r = await lookupSpeciesImage("Phascolarctos cinereus", { kind: "fauna", commonName: "Koala" }, deps(), "2026-11-25");
    expect(r).toMatchObject({ ok: true, image: { creator: "Diliff", licence: "CC BY-SA 3.0", reviewed: false, sourcePage: "https://commons.wikimedia.org/wiki/File:Koala_climbing_tree.jpg" } });
    if (r.ok) expect(r.image.thumbUrl).not.toContain("utm_");
  });

  it("returns a reason, not a photo, when there is none or it cannot be used", async () => {
    expect(await lookupSpeciesImage("Notaplant fakeus", { kind: "flora" }, deps(), "d")).toEqual({ ok: false, reason: "Wikidata has no image for this species" });
    const fixtures = loadFixtures();
    const url = fixture("commons-lomandra-longifolia", "images").url;
    const swap = (from: string, to: string) => {
      const m = new Map(fixtures);
      m.set(url, { ...fixtures.get(url)!, body: JSON.parse(JSON.stringify(fixtures.get(url)!.body).replace(from, to)) });
      return deps(fixtureFetch(m).fn);
    };
    expect(await lookupSpeciesImage("Lomandra longifolia", { kind: "flora" }, swap("CC BY-SA 3.0", "CC BY-NC 4.0"), "2026-11-25")).toMatchObject({ ok: false, reason: expect.stringContaining("does not allow reuse") });
    expect(await lookupSpeciesImage("Lomandra longifolia", { kind: "flora" }, swap(">Eric in SF<", "><"), "2026-11-25")).toMatchObject({ ok: false, reason: "the image has no named creator to credit" });
    expect(await lookupSpeciesImage("Lomandra longifolia", { kind: "flora" }, deps(async () => new Response("x", { status: 500 })), "2026-11-25")).toMatchObject({ ok: false, reason: expect.stringContaining("Wikidata") });
  });
});

describe("get_species_images tool", () => {
  const tool = TOOLS.find((t) => t.name === "get_species_images")!;
  const run = async (names: string[], ctx = testContext()) => (await tool.run({ names }, ctx)).structuredContent as Record<string, unknown>;

  it("serves stored photos without calling any service", async () => {
    const ff = fixtureFetch();
    const r = await run(["Eucalyptus viminalis"], testContext({ fetch: ff.fn }));
    expect(ff.calls).toHaveLength(0);
    expect(r.images).toMatchObject([{ query: "Eucalyptus viminalis", credit: expect.stringMatching(/^Photo: .+ via Wikimedia Commons$/), markdown: expect.stringContaining("](https://commons.wikimedia.org/") }]);
  });

  it("looks up other species live and reports the misses", async () => {
    const r = await run(["Lomandra longifolia", "Notaplant fakeus"], testContext({ data: { speciesImages: [] } }));
    expect(r.images).toMatchObject([{ scientificName: "Lomandra longifolia", kind: "flora", reviewed: false, licence: "CC BY-SA 3.0" }]);
    expect(r.missing).toEqual([{ name: "Notaplant fakeus", reason: "ALA does not know this name as a plant or animal species" }]);
  });

  it("caps live lookups and returns the rest to retry", async () => {
    const names = Array.from({ length: 14 }, (_, i) => `Fake species${String.fromCharCode(97 + i)}`);
    const r = await run(names, testContext({ data: { speciesImages: [] } }));
    expect(r.retry).toEqual(names.slice(12));
    expect((r.missing as unknown[]).length).toBe(12);
  });
});
