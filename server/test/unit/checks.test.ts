import { describe, expect, it } from "vitest";
import { buildSpeciesIndex, checkPlan, checkSpecies, normaliseName, type DeclaredWeed } from "../../src/core/checks.js";
import { action, plan, profile, research } from "../helpers.js";

const weeds: DeclaredWeed[] = [{ scientificName: "Senecio madagascariensis", state: "NSW", category: "Test category", sourceUrl: "https://example.invalid/weeds", asOf: "2026-01-01" }];
const idx = () => buildSpeciesIndex(research(), weeds);

describe("checkSpecies (FR-22, FR-24, NFR-03)", () => {
  it("allows a local native", () => {
    expect(checkSpecies("Lomandra longifolia", idx())).toMatchObject({ verdict: "local_native", blocking: false });
  });

  it("matches names regardless of case, spacing and infraspecific rank", () => {
    expect(checkSpecies("  lomandra   LONGIFOLIA ", idx()).verdict).toBe("local_native");
    expect(checkSpecies("Lomandra longifolia subsp. longifolia", idx()).verdict).toBe("local_native");
    expect(normaliseName(" A  b ")).toBe("a b");
  });

  it("blocks a declared weed, even with an infraspecific name", () => {
    expect(checkSpecies("Senecio madagascariensis", idx())).toMatchObject({ verdict: "declared_weed", blocking: true });
    expect(checkSpecies("Senecio madagascariensis var. x", idx()).blocking).toBe(true);
  });

  it("blocks a state-flagged invasive species and an introduced species", () => {
    expect(checkSpecies("Ceratitis capitata", idx())).toMatchObject({ verdict: "biosecurity_pest", blocking: true });
    expect(checkSpecies("Lantana camara", idx())).toMatchObject({ verdict: "introduced", blocking: true });
  });

  it("warns, without blocking, on mixed records and on species not recorded locally", () => {
    expect(checkSpecies("Callistemon linearis", idx())).toMatchObject({ verdict: "mixed_records", blocking: false });
    const far = checkSpecies("Eucalyptus unknownii", idx());
    expect(far).toMatchObject({ verdict: "not_recorded_locally", blocking: false });
    expect(far.message).toMatch(/^Warning/);
  });

  it("ignores declared weeds from other states", () => {
    const i = buildSpeciesIndex(research(), [{ ...weeds[0]!, state: "VIC" }]);
    expect(checkSpecies("Senecio madagascariensis", i).verdict).toBe("not_recorded_locally");
  });
});

describe("checkPlan (FR-22–FR-25)", () => {
  it("passes a clean plan", () => {
    const r = checkPlan(plan(), research(), profile(), weeds);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("refuses a plan that plants a declared weed or an introduced species", () => {
    const p = plan({ plantingList: [{ scientificName: "Senecio madagascariensis", citationIds: ["ala:occ:native-plants"] }] });
    const r = checkPlan(p, research(), profile(), weeds);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain("declared_weed");
    const p2 = plan({ actions: [action("a1", { category: "planting", plantings: [{ scientificName: "Lantana camara", citationIds: ["ala:occ:native-plants"] }] })] });
    const r2 = checkPlan(p2, research(), profile(), weeds);
    expect(r2.errors).toEqual([expect.objectContaining({ code: "introduced", actionId: "a1" })]);
  });

  it("warns on a species with no local records (FR-22)", () => {
    const p = plan({ plantingList: [{ scientificName: "Eucalyptus unknownii", citationIds: ["ala:occ:native-plants"] }] });
    const r = checkPlan(p, research(), profile(), weeds);
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toContain("not_recorded_locally");
  });

  it("refuses unknown citations and unknown quick wins (FR-25)", () => {
    const p = plan({ quickWins: ["nope"], actions: [action("a1", { citationIds: ["made-up"] })] });
    const codes = checkPlan(p, research(), profile(), weeds).errors.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(["unknown_citation", "unknown_action"]));
    const p2 = plan({ plantingList: [{ scientificName: "Lomandra longifolia", citationIds: ["nope"] }] });
    expect(checkPlan(p2, research(), profile(), weeds).errors.map((e) => e.code)).toContain("unknown_citation");
  });

  it("needs a renter caution on permanent works for renters (FR-23)", () => {
    const p = plan({ actions: [action("a1", { permanent: true })] });
    expect(checkPlan(p, research(), profile({ tenure: { optionIds: ["rent"] } }), weeds).errors[0]?.code).toBe("renter_permission");
    const ok = plan({ actions: [action("a1", { permanent: true, cautions: [{ tag: "renter", text: "Ask your landlord first." }] })] });
    expect(checkPlan(ok, research(), profile({ tenure: { optionIds: ["rent"] } }), weeds).ok).toBe(true);
    expect(checkPlan(p, research(), profile({ tenure: { optionIds: ["own"] } }), weeds).ok).toBe(true);
  });

  it("needs a bushfire caution on planting for bushfire-prone land (FR-23)", () => {
    const fire = profile({ bushfire_prone: { optionIds: ["yes"] } });
    expect(checkPlan(plan(), research(), fire, weeds).errors[0]?.code).toBe("bushfire_caution");
    const withCaution = plan({ actions: [action("a1", { category: "planting", cautions: [{ tag: "bushfire", text: "Keep the asset protection zone clear." }] })] });
    expect(checkPlan(withCaution, research(), fire, weeds).ok).toBe(true);
    const unsure = checkPlan(plan(), research(), profile({ bushfire_prone: { notSure: true } }), weeds);
    expect(unsure.ok).toBe(true);
    expect(unsure.warnings.map((w) => w.code)).toContain("bushfire_unknown");
  });
});
