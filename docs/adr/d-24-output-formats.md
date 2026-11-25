# D-24: Output formats — YAML for data, Markdown for documents

- Status: Accepted when the PR that adds it is merged
- Date: 2026-11-26
- Decided by: the maintainer ("use YAML as opposed to JSON for any output data, and Markdown as opposed to HTML; keep CSV for data files")
- Source: [specification Section 2](../specification.md#2-decision-log)
- Requirements: FR-50, FR-05, D-09

## Context and problem

The save tools returned JSON, the skills saved `profile.json`, `research.json` and `plans/v<n>.json` in the user's Project, and `export_plan` offered JSON. Users open these files, and YAML is easier for people to read and edit. Plans and reports should be Markdown, not HTML.

## Decision

- **YAML for output data:**
  - The site files: `profile.yaml`, `research.yaml` and `plans/v<n>.yaml`. Each `save_*` result starts with "Save this as <file>…" and the exact YAML, followed by a short YAML summary.
  - `export_plan` with `format: "yaml"`, which replaces `"json"`.
  - The text content of every tool result (what Claude reads), and the question card's profile messages.
  - The maintainer's `images:record -- --pending` listing.
- **Markdown for documents:** plans, reports and exports. The server instructions and skills tell Claude not to make HTML files or HTML artifacts.
- **Unchanged:**
  - CSV for repository data files (`data/*.csv`), and YAML for `data/question-bank.yaml` and `kb/manifest.yaml`.
  - The question card stays HTML, because the MCP Apps spec defines a View as an HTML resource.
  - MCP `structuredContent` and JSON-RPC stay JSON, because the protocol defines them that way.
  - Answer files in JSON or YAML are still accepted (FR-05). Claude reads the YAML files and passes the data to the tools, so the server never parses YAML.
- **No new dependency (rule 5):** `server/src/core/yaml.ts` is a small YAML writer for our data shapes: objects, arrays, strings, numbers, booleans and null.
  - Strings that YAML could misread (`yes`, `null`, numbers, dates, `: `, `#`, leading symbols, edge whitespace) are written as JSON strings. JSON strings are valid YAML.
  - Multi-line strings use `|-` when that keeps them exact.
  - Tests check that everything the writer emits parses back to the same data with the `yaml` package, which is already a dev dependency.
  - `build:index` inlines the writer into the card script. It has no imports for that reason.

## Consequences

- `export_plan`'s `format` enum changes. Before the first release, this is allowed without a major version.
- Sites saved before this change have `.json` files. The skills read them, and save YAML from then on.
- Some tool text may be slightly longer or shorter than the JSON was. YAML usually has fewer brackets and quotes.
