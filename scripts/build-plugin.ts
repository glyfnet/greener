/**
 * `npm run build:plugin` — zip the `plugin/` folder for upload to claude.ai
 * and for the GitHub release (Section 11.2). Uses the system `zip` command,
 * so no new dependency is needed.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { fail, path } from "./lib.js";

const manifest = JSON.parse(readFileSync(path("plugin/.claude-plugin/plugin.json"), "utf8")) as { name: string; version: string; mcpServers?: Record<string, { url?: string }> };
const url = Object.values(manifest.mcpServers ?? {})[0]?.url ?? "";
if (url.includes("example.")) console.warn(`! plugin.json still points at a placeholder server URL (${url}). Set the real Worker URL before a release.`);

const out = path("dist");
mkdirSync(out, { recursive: true });
const zip = `${out}/${manifest.name}-plugin-${manifest.version}.zip`;
rmSync(zip, { force: true });
try {
  execFileSync("zip", ["-r", "-X", zip, ".", "-x", "*.DS_Store"], { cwd: path("plugin"), stdio: "inherit" });
} catch {
  fail("zip failed. Is the 'zip' command installed?");
}
console.log(`✓ wrote ${zip}`);
