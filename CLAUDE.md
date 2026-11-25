# Rules for AI coding agents

This file is loaded automatically by Claude Code. The source of truth for
this project is [`docs/specification.md`](docs/specification.md) — read the
relevant section before starting any task.

## Rules (specification Section 12.1)

1. **Work from the specification.** Every task names the FR, NFR or D IDs
   it implements. Acceptance criteria come from those requirements, not
   from invention.
2. **Write tests with the code.** A task is complete only when
   `npm run check` passes. Run it and show the result — don't just claim
   tests pass.
3. **Keep changes small.** One task, one pull request. Aim for under
   ~400 changed lines, not counting fixtures.
4. **Do not invent external facts.** API endpoints, field names, species
   data, licences and prices come only from verified sources. Every
   connector test uses a fixture recorded from a real response.
5. **No new dependency without approval.** Prefer the Workers runtime and
   web-standard APIs. Every new package must work in the Workers runtime.
6. **Rules go in code, not in prompts.** Native-species checks, weed
   checks, budget limits and schema validation live in tested TypeScript.
   Skills explain; tools enforce.
7. **Update docs in the same change.** A change to behaviour, a tool or a
   decision updates the docs, the tool reference or an ADR in the same PR.
8. **Never commit secrets.** `.dev.vars` and other local files stay in
   `.gitignore`.
9. **Mark uncertainty.** When unsure, write a TODO with a question — don't
   guess.

## Commands

| Command | Action |
| --- | --- |
| `npm install` | Install all workspace dependencies |
| `npm run dev` | Run the server locally (`wrangler dev`) |
| `npm run check` | KB check, index build, lint, typecheck, unit + Worker tests with coverage, tool-reference check, audit — must pass before merge |
| `npm test` | Unit tests only (Vitest), offline, fixtures only |
| `npm run check:kb` | Validate KB metadata/tiers, check catalogue links |
| `npm run build:index` | Build the global KB index from `kb/sources` |
| `npm run build:plugin` | Zip `plugin/` for upload / GitHub release |
| `npm run docs:tools` | Regenerate `docs/tool-reference.md` from the Zod schemas |
| `npm run fixtures:record` | Re-record ALA fixtures from live responses (on purpose only) |
| `npm run images:record -- <name>...` | Add Commons species photos to `data/species-images.csv` (review each row by hand — D-23) |
| `npm run deploy:staging` | Build index + deploy to staging Worker |
| `npm run smoke` | Call each MCP tool on a deployed Worker and check responses |
| `npm run release -- <version>` | Full release: check, bump, changelog, deploy, zip, tag, GitHub release |

## Folder map

| Path | Holds |
| --- | --- |
| `plugin/` | Plugin manifest and skills; each skill's `name` is its slash command (thin layer — spec Sections 7.2, 7.6) |
| `server/src/index.ts` | Worker entry, routing only; `server.ts` builds one MCP server per request |
| `server/src/tools/` | One Zod-validated definition per MCP tool |
| `server/src/generated/` | Built by `npm run build:index` (git-ignored) |
| `server/src/core/` | Pure core: models (Zod), questionnaire, checks, schedule — no I/O |
| `server/src/connectors/` | One client per external data service — retry, rate limit, cache |
| `server/src/rag/` | Search over the prebuilt KB index |
| `server/ui/intake-card/` | MCP App for the question card |
| `kb/` | Global knowledge base sources + manifest (two tiers — D-15) |
| `data/` | `question-bank.yaml`, `cost-reference.csv`, `declared-weeds.csv` |
| `scripts/` | `build-index.ts`, `check-kb.ts`, `gen-tool-reference.ts`, `record-fixtures.ts`, `smoke.ts`, `build-plugin.ts`, `release.ts` |
| `docs/adr/` | One ADR per decision ID in the spec's decision log |

Node 22 is required (`.nvmrc`).

## Decision IDs in play

D-01…D-22 are closed (specification Section 2) — don't reopen them without
a new decision row. Open questions are tracked in specification Section 13;
check there before assuming an unconfirmed candidate (e.g. a data source
under "To check" in Section 8) is final.
Proposed decisions from the first build are ADRs P-01…P-04 in `docs/adr/`.

**D-17 (rewilding policy):** Australian natives only (local preferred), never invasives, and no chemicals. Enforced in
`core/checks.ts` (`checkSpecies`, `checkChemicals`) — never relax it in a skill.

## Design standards (specification Section 12.2, abbreviated)

- TypeScript `strict`, ES modules, no `any`. One Zod schema per data type;
  types and tool JSON schemas are both generated from it.
- Workers runtime is stateless — no mutable global state between requests,
  every `fetch` has a timeout, heavy work happens at build time not request
  time (free-plan CPU limit, D-10).
- Tool names are `verb_noun`. Validate inputs with Zod. Outputs are small
  summaries with citation IDs — never raw bulk data.
- The server fetches only fixed, known API hosts — never a URL from a user.
