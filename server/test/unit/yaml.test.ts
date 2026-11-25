import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { toYaml } from "../../src/core/yaml.js";
import { plan, profile, research } from "../helpers.js";

const roundTrip = (v: unknown) => expect(parse(toYaml(v))).toEqual(JSON.parse(JSON.stringify(v)));

describe("YAML writer (D-24)", () => {
  it("writes readable YAML", () => {
    expect(toYaml({ name: "Lomandra longifolia", count: 3, ok: true, none: null, tags: ["native", "grass"], empty: [], obj: {}, nested: { a: 1 } })).toBe(
      "name: Lomandra longifolia\ncount: 3\nok: true\nnone: null\ntags:\n  - native\n  - grass\nempty: []\nobj: {}\nnested:\n  a: 1\n",
    );
    expect(toYaml({ steps: "Dig a hole.\nPlant it.\n\nWater it." })).toBe("steps: |-\n  Dig a hole.\n  Plant it.\n\n  Water it.\n");
  });

  it("quotes strings that YAML could misread", () => {
    for (const s of ["yes", "No", "null", "~", "123", "1.5", "0x1F", "-x", "a: b", "a #b", "#x", "[x]", "{x}", "*x", "&x", "!x", "%x", "@x", "`x", "'x'", '"x"', "x ", " x", "", "2026-11-26", "a\tb", "a\r\nb", "line\n", "\nline", "é", "x y"]) {
      roundTrip({ s, list: [s] });
    }
    expect(toYaml({ s: "yes" })).toBe('s: "yes"\n');
  });

  it("round-trips nested arrays, odd keys and the site files", () => {
    roundTrip({ "1": "a", "two words": [[1, 2], [], [{ a: [{ b: "c\nd" }] }]], y: { "": 0 }, n: -0.25 });
    roundTrip([{ a: 1, b: [1] }, "x", ["y", ["z"]]]);
    roundTrip(profile({ soil: { optionIds: ["clay"] } }));
    roundTrip(research());
    roundTrip(plan());
  });

  it("drops undefined and writes non-finite numbers as null", () => {
    expect(toYaml({ a: undefined, b: Number.NaN, c: [undefined] })).toBe("b: null\nc:\n  - null\n");
  });
});
