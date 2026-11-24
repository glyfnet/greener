import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { distanceKm, nurseriesNear, parseNurseries } from "../../src/core/nurseries.js";

const HEADER = "id,name,kind,town,council,lat,lon,coord_precision,mail_order,website,offers,visiting,source_url,as_of";
const row = (over: Partial<Record<string, string>> = {}) => {
  const r = { id: "x", name: "X Nursery", kind: "nursery", town: "Armidale", council: "Armidale Regional", lat: "-30.5", lon: "151.6", coord_precision: "town", mail_order: "no", website: "", offers: "Natives", visiting: "Open daily", source_url: "https://example.org/x", as_of: "2026-11-25", ...over };
  return Object.values(r).join(",");
};

describe("native nursery directory (FR-20)", () => {
  it("parses the shipped directory, with a source and date on every row", () => {
    const list = parseNurseries(readFileSync(new URL("../../../data/native-nurseries.csv", import.meta.url), "utf8"));
    expect(list.length).toBeGreaterThanOrEqual(4);
    for (const n of list) expect(n.sourceUrl).toMatch(/^https:\/\//);
    expect(list.find((n) => n.id === "armidale-tree-group")).toMatchObject({ town: "Armidale", coordPrecision: "address", website: "https://armidaletreegroup.org.au/" });
    expect(list.find((n) => n.id === "cool-natives-nursery")).toMatchObject({ mailOrder: true, coordPrecision: "town" });
  });

  it("rejects bad rows with the row number", () => {
    expect(() => parseNurseries(`bad\n${row()}`)).toThrow("header");
    expect(() => parseNurseries(`${HEADER}\n${row({ mail_order: "maybe" })}`)).toThrow("row 2: mail_order");
    expect(() => parseNurseries(`${HEADER}\n${row({ kind: "shop" })}`)).toThrow("row 2: kind");
    expect(() => parseNurseries(`${HEADER}\n${row({ lat: "51" })}`)).toThrow("row 2: lat");
    expect(() => parseNurseries(`${HEADER}\n${row()}\n${row()}`)).toThrow("row 3: duplicate id x");
    expect(parseNurseries(`${HEADER}\n${row({ website: "https://example.org" })}`)[0]?.website).toBe("https://example.org");
  });

  it("measures distance and sorts by it", () => {
    expect(Math.round(distanceKm(-33.87, 151.21, -30.52, 151.67))).toBe(375);
    const list = parseNurseries(`${HEADER}\n${row({ id: "far", lat: "-31.5" })}\n${row({ id: "near", lat: "-30.51" })}`);
    expect(nurseriesNear(list, -30.5, 151.6, 200).map((n) => [n.id, n.distanceKm])).toEqual([["near", 1], ["far", 111]]);
    expect(nurseriesNear(list, -30.5, 151.6, 50).map((n) => n.id)).toEqual(["near"]);
  });
});
