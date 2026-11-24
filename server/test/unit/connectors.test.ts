import { describe, expect, it } from "vitest";
import { matchName, NEAR_QUERIES, occurrenceUrl, roundCoord, speciesNear, speciesProfile } from "../../src/connectors/ala.js";
import { fetchJson, limited, type HttpDeps } from "../../src/connectors/http.js";
import { fixture, fixtureFetch, memoryCache, TEST_POINT } from "../helpers.js";

const deps = (fetch: HttpDeps["fetch"], extra: Partial<HttpDeps> = {}): HttpDeps => ({ fetch, userAgent: "Greener/test", sleep: async () => {}, ...extra });

describe("fetchJson (Section 12.2, FR-16, NFR-07, NFR-08)", () => {
  const url = "https://api.ala.org.au/x";

  it("refuses hosts that are not on the allow list, and http", async () => {
    let called = false;
    const f = async () => ((called = true), new Response("{}"));
    expect(await fetchJson("https://evil.example.com/x", deps(f))).toMatchObject({ ok: false });
    expect(await fetchJson("http://api.ala.org.au/x", deps(f))).toMatchObject({ ok: false });
    expect(await fetchJson("not a url", deps(f))).toMatchObject({ ok: false, error: "invalid URL" });
    expect(called).toBe(false);
  });

  it("sends a contact User-Agent and a timeout signal", async () => {
    let seen: Request | undefined;
    await fetchJson(url, deps(async (r) => ((seen = r), new Response("{}"))));
    expect(seen?.headers.get("User-Agent")).toBe("Greener/test");
    expect(seen?.signal).toBeDefined();
  });

  it("retries 5xx and 429, then succeeds", async () => {
    const statuses = [503, 429, 200];
    let n = 0;
    const r = await fetchJson<{ a: number }>(url, deps(async () => new Response(statuses[n++] === 200 ? '{"a":1}' : "x", { status: statuses[n - 1] ?? 200, headers: { "Retry-After": "1" } })));
    expect(r).toEqual({ ok: true, data: { a: 1 }, fromCache: false });
    expect(n).toBe(3);
  });

  it("does not retry a 4xx, and reports the status", async () => {
    let n = 0;
    expect(await fetchJson(url, deps(async () => (n++, new Response("x", { status: 404 }))))).toMatchObject({ ok: false, status: 404 });
    expect(n).toBe(1);
  });

  it("turns network errors, timeouts and bad JSON into results, never throws", async () => {
    expect(await fetchJson(url, deps(async () => Promise.reject(new TypeError("boom"))), { retries: 1 })).toMatchObject({ ok: false, error: "network error" });
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    expect(await fetchJson(url, deps(async () => Promise.reject(timeout)), { retries: 0, timeoutMs: 5 })).toMatchObject({ ok: false, error: expect.stringContaining("timed out") });
    expect(await fetchJson(url, deps(async () => new Response("<html>")))).toMatchObject({ ok: false });
  });

  it("caches successful responses with a 7-day max-age and serves from cache", async () => {
    const cache = memoryCache();
    let n = 0;
    const d = deps(async () => (n++, new Response('{"a":2}')), { cache });
    expect(await fetchJson(url, d)).toMatchObject({ fromCache: false });
    expect(await fetchJson(url, d)).toEqual({ ok: true, data: { a: 2 }, fromCache: true });
    expect(n).toBe(1);
  });

  it("keeps working when the cache throws", async () => {
    const cache = { match: async () => Promise.reject(new Error("x")), put: async () => Promise.reject(new Error("y")) };
    expect(await fetchJson(url, deps(async () => new Response('{"a":3}'), { cache }))).toMatchObject({ ok: true });
  });

  it("limits concurrency and keeps order", async () => {
    let active = 0;
    let peak = 0;
    const tasks = [1, 2, 3, 4, 5].map((i) => async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      return i;
    });
    expect(await limited(tasks, 2)).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe("ALA connector (recorded fixtures)", () => {
  it("rounds coordinates before they leave the server (D-09)", () => {
    expect(roundCoord(-33.87349)).toBe(-33.87);
    expect(occurrenceUrl(-33.87349, 151.2111, 10, NEAR_QUERIES[0]!)).toContain("lat=-33.87&lon=151.21");
  });

  it("builds the URLs the fixtures were recorded from", () => {
    expect(fixture("occ-native-plants").url).toBe(occurrenceUrl(TEST_POINT.lat, TEST_POINT.lon, 10, NEAR_QUERIES[0]!));
  });

  it("parses species facets into tagged lists with citations (FR-10, FR-11)", async () => {
    const ff = fixtureFetch();
    const r = await speciesNear(TEST_POINT.lat, TEST_POINT.lon, 10, deps(ff.fn), "2026-11-24");
    expect(ff.misses).toEqual([]);
    expect(r.dataGaps).toEqual([]);
    expect(r.nativePlants[0]).toMatchObject({ scientificName: "Acacia terminalis", tags: ["native"], citationIds: ["ala:occ:native-plants"] });
    expect(r.nativePlants.every((s) => s.scientificName !== "Not supplied")).toBe(true);
    expect(r.introducedPlants.map((s) => s.scientificName)).toContain("Lantana camara");
    expect(r.stateInvasive.every((s) => s.tags.includes("biosecurity_pest"))).toBe(true);
    expect(r.threatened.map((s) => s.scientificName)).toContain("Pteropus poliocephalus");
    expect(r.citations.map((c) => c.id)).toEqual(NEAR_QUERIES.map((q) => `ala:occ:${q.key}`));
    expect(r.citations[0]).toMatchObject({ publisher: "Atlas of Living Australia", accessed: "2026-11-24" });
    const mixed = r.nativePlants.filter((s) => s.tags.includes("introduced"));
    for (const s of mixed) expect(r.introducedPlants.map((x) => x.scientificName)).toContain(s.scientificName);
  });

  it("records a data gap per failed query and still returns the rest (NFR-07)", async () => {
    const ff = fixtureFetch();
    const flaky = async (req: Request) => (req.url.includes("stateInvasive") ? new Response("down", { status: 500 }) : ff.fn(req));
    const r = await speciesNear(TEST_POINT.lat, TEST_POINT.lon, 10, deps(flaky), "2026-11-24");
    expect(r.dataGaps).toEqual([{ topic: "ALA species flagged invasive by the state", reason: "service returned HTTP 500" }]);
    expect(r.stateInvasive).toEqual([]);
    expect(r.nativePlants.length).toBeGreaterThan(0);
  });

  it("parses a species profile (FR-33)", async () => {
    const r = await speciesProfile("Lomandra longifolia", deps(fixtureFetch().fn), "2026-11-24");
    expect(r.ok && r.profile).toMatchObject({ scientificName: "Lomandra longifolia", kingdom: "Plantae", family: "Asparagaceae", taxonomicStatus: "accepted", commonName: "Spiny-headed Mat-rush" });
    const miss = await speciesProfile("Nothing here", deps(fixtureFetch().fn), "2026-11-24");
    expect(miss.ok).toBe(false);
  });

  it("matches names to the ALA taxonomy (NFR-01)", async () => {
    const ok = await matchName("Lantana camara", deps(fixtureFetch().fn));
    expect(ok.ok && ok.match).toMatchObject({ matched: true, scientificName: "Lantana camara", kingdom: "Plantae" });
    const no = await matchName("Notaplant fakeus", deps(fixtureFetch().fn));
    expect(no.ok && no.match.matched).toBe(false);
    expect((await matchName("Unrecorded name", deps(fixtureFetch().fn))).ok).toBe(false);
  });
});

describe("NSW bushfire-prone land (FR-03, D-18)", async () => {
  const { bushfireProne, bushfireUrl, roundPoint } = await import("../../src/connectors/bushfire.js");
  const { FIRE_POINT } = await import("../helpers.js");

  it("builds the recorded URL, rounding the site to 3 decimal places", () => {
    expect(bushfireUrl(FIRE_POINT.lat, FIRE_POINT.lon)).toBe(fixture("katoomba", "bushfire").url);
    expect(bushfireUrl(-33.73304, 150.31296)).toBe(fixture("katoomba", "bushfire").url);
    expect(roundPoint(151.2114)).toBe(151.211);
  });

  it("reports mapped categories at a bushfire-prone point", async () => {
    const r = await bushfireProne(FIRE_POINT.lat, FIRE_POINT.lon, deps(fixtureFetch().fn), "2026-11-25");
    expect(r).toMatchObject({ ok: true, status: "prone", mapUpdated: "2025-05-14", citation: { id: "nsw:bushfire-prone-land", publisher: "NSW Rural Fire Service" } });
    if (r.ok) expect(r.categories).toEqual([{ category: 1, label: "Vegetation Category 1" }, { category: 0, label: "Vegetation Buffer" }]);
  });

  it("reports not mapped in central Sydney", async () => {
    expect(await bushfireProne(TEST_POINT.lat, TEST_POINT.lon, deps(fixtureFetch().fn), "2026-11-25")).toMatchObject({ ok: true, status: "not_mapped", categories: [] });
  });

  it("never caches the result, because the URL holds the site to about 100 m", async () => {
    const cache = memoryCache();
    await bushfireProne(FIRE_POINT.lat, FIRE_POINT.lon, deps(fixtureFetch().fn, { cache }), "2026-11-25");
    expect(cache.store.size).toBe(0);
  });

  it("turns a failed or malformed response into a data gap (NFR-07)", async () => {
    expect(await bushfireProne(0, 0, deps(fixtureFetch().fn), "d")).toMatchObject({ ok: false, dataGap: { topic: "bushfire-prone land status" } });
    const bad = async () => new Response(JSON.stringify({ error: { code: 400, message: "Invalid query" } }));
    expect(await bushfireProne(-33.7, 150.3, deps(bad), "d")).toMatchObject({ ok: false, dataGap: { reason: expect.stringContaining("Invalid query") } });
  });
});

describe("NSW address lookup (FR-02, D-19)", async () => {
  const { addressUrl, lookupAddress } = await import("../../src/connectors/geocode.js");
  const bathurst = { houseNumber: "346", roadName: "Panorama", roadType: "Ave", suburb: "Bathurst", postCode: "2795" };

  it("builds the recorded URL", () => {
    expect(addressUrl(bathurst)).toBe(fixture("panorama-ave-bathurst", "geocode").url);
    expect(addressUrl({ roadName: " George ", postCode: "2000" })).toBe("https://maps.six.nsw.gov.au/services/public/Address_Location?roadName=George&postCode=2000&projection=EPSG%3A4326");
  });

  it("returns the address point, suburb and council, never cached", async () => {
    const cache = memoryCache();
    const r = await lookupAddress(bathurst, deps(fixtureFetch().fn, { cache }), "2026-11-25");
    expect(r).toMatchObject({ ok: true, citation: { id: "nsw:address-location" } });
    if (r.ok) expect(r.candidates).toEqual([{ lat: -33.429684292575985, lon: 149.56705027301055, suburb: "Bathurst", postCode: "2795", council: "Bathurst Regional" }]);
    expect(cache.store.size).toBe(0);
  });

  it("says when no address matches, and when the service fails (NFR-07)", async () => {
    expect(await lookupAddress({ houseNumber: "1", roadName: "Notarealname", roadType: "St", suburb: "Bathurst" }, deps(fixtureFetch().fn), "d")).toMatchObject({ ok: false, notFound: true, dataGap: { reason: expect.stringContaining("No matching records") } });
    expect(await lookupAddress({ roadName: "X", suburb: "Y" }, deps(fixtureFetch().fn), "d")).toMatchObject({ ok: false, notFound: false });
    expect(await lookupAddress({ roadName: "X", suburb: "Y" }, deps(async () => new Response("{}")), "d")).toMatchObject({ ok: false, dataGap: { reason: expect.stringContaining("unexpected") } });
  });

  it("caps the candidates and skips entries without a point", async () => {
    const many = { addressResult: { numRecs: 8, addresses: [{ suburbName: "NOWHERE" }, ...Array.from({ length: 7 }, (_, i) => ({ suburbName: `PLACE ${i}`, addressPoint: { centreX: 150, centreY: -33 } }))] } };
    const r = await lookupAddress({ roadName: "Main", suburb: "X" }, deps(async () => new Response(JSON.stringify(many))), "d");
    expect(r.ok && r.candidates.length).toBe(5);
    expect(r.ok && r.candidates[0]).toEqual({ lat: -33, lon: 150, suburb: "Place 0" });
  });
});

describe("NSW pre-clearing vegetation community (FR-14, D-20)", async () => {
  const { vegetationCommunity, vegetationUrl } = await import("../../src/connectors/vegetation.js");
  const { FIRE_POINT } = await import("../helpers.js");

  it("builds the recorded URL", () => {
    expect(vegetationUrl(TEST_POINT.lat, TEST_POINT.lon)).toBe(fixture("sydney", "vegetation").url);
    expect(vegetationUrl(-33.87304, 151.21096)).toBe(fixture("sydney", "vegetation").url);
  });

  it("returns the Plant Community Type at each test point, never cached", async () => {
    const cache = memoryCache();
    const syd = await vegetationCommunity(TEST_POINT.lat, TEST_POINT.lon, deps(fixtureFetch().fn, { cache }), "2026-11-25");
    expect(syd).toMatchObject({ ok: true, community: { pctId: 3262, name: "Sydney Turpentine Ironbark Forest", vegetationClass: "Northern Hinterland Wet Sclerophyll Forests" }, citation: { id: "nsw:svtm-pre-clearing" } });
    expect(cache.store.size).toBe(0);
    expect(await vegetationCommunity(FIRE_POINT.lat, FIRE_POINT.lon, deps(fixtureFetch().fn), "d")).toMatchObject({ ok: true, community: { pctId: 3692, name: "Upper Blue Mountains Moist Forest" } });
  });

  it("returns no community off the map, and a gap on failure (NFR-07)", async () => {
    expect(await vegetationCommunity(-33.8, 151.3, deps(async () => new Response('{"results":[]}')), "d")).toMatchObject({ ok: true, community: null });
    expect(await vegetationCommunity(-33.8, 151.3, deps(fixtureFetch().fn), "d")).toMatchObject({ ok: false, dataGap: { topic: "pre-clearing vegetation community" } });
    expect(await vegetationCommunity(-33.8, 151.3, deps(async () => new Response('{"error":{"message":"bad"}}')), "d")).toMatchObject({ ok: false, dataGap: { reason: expect.stringContaining("bad") } });
  });
});
