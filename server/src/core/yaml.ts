/**
 * A small YAML writer for output data (D-24). It writes only, never parses.
 * Claude reads the YAML files and passes their data back to the tools.
 *
 * It covers what our models hold: objects, arrays, strings, numbers,
 * booleans and null. Strings that could be misread are written as JSON
 * strings, which are valid YAML double-quoted scalars. Multi-line strings
 * use a block literal (`|-`) when that keeps them exact.
 *
 * No imports and no other top-level code: `scripts/build-index.ts` inlines
 * this file into the question card script.
 */
export function toYaml(value: unknown): string {
  const PLAIN = /^[A-Za-z][A-Za-z0-9 ,.'()/+%&–—-]*$/;
  const RESERVED = /^(true|false|yes|no|on|off|null|y|n)$/i;
  const KEY = /^[A-Za-z_][A-Za-z0-9_-]*$/;

  const scalar = (v: unknown): string | undefined => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean") return String(v);
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
    if (typeof v === "string") return PLAIN.test(v) && !RESERVED.test(v) && !v.endsWith(" ") ? v : JSON.stringify(v);
    return undefined;
  };

  const block = (s: string, pad: string): string | undefined => {
    // Exact round trip only: no carriage returns or tabs, no leading or trailing whitespace, no trailing newline.
    if (!s.includes("\n") || /[\r\t]/.test(s) || /^\s|\s$/.test(s) || s.split("\n").some((l) => / $/.test(l))) return undefined;
    return `|-\n${s.split("\n").map((l) => (l ? `${pad}${l}` : "")).join("\n")}`;
  };

  const key = (k: string) => (KEY.test(k) && !RESERVED.test(k) ? k : JSON.stringify(k));

  const write = (v: unknown, indent: number): string[] => {
    const pad = "  ".repeat(indent);
    if (Array.isArray(v)) {
      if (!v.length) return ["[]"];
      const out: string[] = [];
      for (const item of v) {
        const lines = write(item, indent + 1);
        const nested = typeof item === "object" && item !== null && (Array.isArray(item) ? item.length > 0 : Object.keys(item).length > 0);
        if (nested) out.push(`${pad}- ${lines[0]!.trimStart()}`, ...lines.slice(1));
        else out.push(`${pad}- ${lines.join("\n")}`);
      }
      return out;
    }
    if (typeof v === "object" && v !== null) {
      const entries = Object.entries(v).filter(([, x]) => x !== undefined);
      if (!entries.length) return ["{}"];
      const out: string[] = [];
      for (const [k, x] of entries) {
        if (typeof x === "string") {
          const b = block(x, `${pad}  `);
          out.push(`${pad}${key(k)}: ${b ?? scalar(x)}`);
        } else if (typeof x === "object" && x !== null && (Array.isArray(x) ? x.length > 0 : Object.keys(x).some((kk) => (x as Record<string, unknown>)[kk] !== undefined))) {
          out.push(`${pad}${key(k)}:`, ...write(x, indent + 1));
        } else {
          out.push(`${pad}${key(k)}: ${write(x, indent + 1).join("\n")}`);
        }
      }
      return out;
    }
    if (typeof v === "string" && indent > 0) return [block(v, pad) ?? scalar(v) ?? "null"];
    return [scalar(v) ?? "null"];
  };

  return `${write(value, 0).join("\n")}\n`;
}
