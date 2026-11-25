/**
 * `npm run docs:tools` — generate docs/tool-reference.md from the Zod
 * schemas (Section 12.4). With --check, fail when the file is out of date.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { TOOLS } from "../server/src/tools/registry.js";
import { fail, path } from "./lib.js";

const OUT = path("docs/tool-reference.md");

function render(): string {
  const L = [
    "# Tool reference",
    "",
    "Generated from the Zod schemas in `server/src/tools/` by `npm run docs:tools`. Do not edit by hand: `npm run check` fails when this file is out of date.",
    "",
    "The server is stateless (D-09): tools that need site data take it as input, and `save_*` tools return the validated data for Claude to save in the user's Project.",
    "",
    "| Tool | What it does |",
    "| --- | --- |",
    ...TOOLS.map((t) => `| [\`${t.name}\`](#${t.name}) | ${t.title} |`),
    "",
  ];
  for (const t of TOOLS) {
    L.push(`## ${t.name}`, "", t.description, "");
    // The card URI ends in a content hash; show it as <hash> so card edits don't change this file.
    if (t.meta) L.push(`UI resource: \`${String((t.meta.ui as { resourceUri?: string } | undefined)?.resourceUri ?? "").replace(/\/[0-9a-f]{12}$/, "/<hash>")}\``, "");
    L.push("Input schema:", "", "```json", JSON.stringify(z.toJSONSchema(t.input, { io: "input", unrepresentable: "any" }), null, 2), "```", "");
  }
  return L.join("\n");
}

const content = render();
if (process.argv.includes("--check")) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== content) fail("docs/tool-reference.md is out of date. Run: npm run docs:tools");
  console.log(`✓ docs/tool-reference.md is up to date (${TOOLS.length} tools)`);
} else {
  writeFileSync(OUT, content);
  console.log(`wrote docs/tool-reference.md (${TOOLS.length} tools)`);
}
