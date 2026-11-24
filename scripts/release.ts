/**
 * `npm run release -- <version>` — the full release (Section 11.3).
 *
 * 1. Refuse unless on a clean `main`.
 * 2. Run `npm run check` and the strict KB link check.
 * 3. Bump the version in package.json, server/package.json, plugin.json and server.ts.
 * 4. Move the changelog's Unreleased section under the new version.
 * 5. Deploy to production, build the plugin zip, commit, tag, push, and
 *    create the GitHub release with `gh`.
 *
 * Pass --dry-run to run the checks and print the steps without changing anything.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fail, path } from "./lib.js";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const version = argv.find((a) => !a.startsWith("--"));
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) fail("usage: npm run release -- <major.minor.patch> [--dry-run]");

function run(cmd: string, args: string[], opts: { capture?: boolean; mutates?: boolean } = {}): string {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  if (dryRun && opts.mutates) return "";
  return execFileSync(cmd, args, { cwd: path(), stdio: opts.capture ? ["ignore", "pipe", "inherit"] : "inherit", encoding: "utf8" }) ?? "";
}

const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { capture: true }).trim();
if (branch !== "main") fail(`releases are made from main, not ${branch}`);
if (run("git", ["status", "--porcelain"], { capture: true }).trim()) fail("the working tree has uncommitted changes");

if (readFileSync(path("server/wrangler.toml"), "utf8").includes("TODO-set-public-repository-url")) fail("set CONTACT_URL in server/wrangler.toml to the public repository URL first (NFR-08)");
if (readFileSync(path("plugin/.claude-plugin/plugin.json"), "utf8").includes("example.workers.dev")) fail("set the real Worker URL in plugin/.claude-plugin/plugin.json first");

run("npm", ["run", "check"]);
run("npx", ["tsx", "scripts/check-kb.ts", "--strict"]);

function bumpJson(rel: string, set: (o: Record<string, unknown>) => void): void {
  const o = JSON.parse(readFileSync(path(rel), "utf8")) as Record<string, unknown>;
  set(o);
  if (!dryRun) writeFileSync(path(rel), `${JSON.stringify(o, null, 2)}\n`);
  console.log(`bump ${rel} → ${version}`);
}
bumpJson("package.json", (o) => (o.version = version));
bumpJson("server/package.json", (o) => (o.version = version));
bumpJson("plugin/.claude-plugin/plugin.json", (o) => (o.version = version));
const serverTs = readFileSync(path("server/src/server.ts"), "utf8").replace(/SERVER_VERSION = "[^"]+"/, `SERVER_VERSION = "${version}"`);
if (!dryRun) writeFileSync(path("server/src/server.ts"), serverTs);

const today = new Date().toISOString().slice(0, 10);
const changelog = readFileSync(path("CHANGELOG.md"), "utf8");
if (!changelog.includes("## [Unreleased]")) fail("CHANGELOG.md has no [Unreleased] section");
const notes = changelog.split("## [Unreleased]")[1]?.split(/\n## \[/)[0]?.trim() ?? "";
if (!notes) fail("the [Unreleased] section of CHANGELOG.md is empty");
if (!dryRun) writeFileSync(path("CHANGELOG.md"), changelog.replace("## [Unreleased]", `## [Unreleased]\n\n## [${version}] - ${today}`));

run("npm", ["run", "deploy", "-w", "server", "--", "--env", "production"], { mutates: true });
run("npm", ["run", "build:plugin"], { mutates: true });
run("git", ["commit", "-am", `chore(release): v${version}`], { mutates: true });
run("git", ["tag", `v${version}`], { mutates: true });
run("git", ["push", "origin", "main", "--tags"], { mutates: true });
const pkgName = (JSON.parse(readFileSync(path("plugin/.claude-plugin/plugin.json"), "utf8")) as { name: string }).name;
run("gh", ["release", "create", `v${version}`, `dist/${pkgName}-plugin-${version}.zip`, "--title", `v${version}`, "--notes", notes], { mutates: true });
console.log(dryRun ? "✓ dry run finished; nothing was changed" : `✓ released v${version}. Now run: npm run smoke -- --prod`);
