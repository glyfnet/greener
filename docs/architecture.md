# Architecture

This page maps [specification](specification.md) Sections 6 and 7 to the code. Where they differ, the specification wins, and the difference is listed under "Open items".

## Shape

Greener is a Claude plugin (`plugin/`) plus a stateless remote MCP server (`server/`) on Cloudflare Workers (D-05, D-10). Claude, in the user's own account, does the reasoning. The server gets public data, searches the prebuilt KB index, and enforces the rules (Section 6.2).

```text
plugin/skills/*  ──MCP (Streamable HTTP, stateless)──▶  server/src/index.ts       routing only
                                                       server/src/server.ts      one McpServer per request
                                                       server/src/tools/*        Zod input → core/connectors/rag
                                                       server/src/core/*         pure rules, no I/O
                                                       server/src/connectors/*   ALA client, host allow list, cache
                                                       server/src/rag/*          BM25 over the shipped index
                                                       server/src/generated/*    built by npm run build:index
```

## Modules

| Path | Spec | Notes |
| --- | --- | --- |
| `core/models.ts` | 7.1 | One Zod schema per type: SiteProfile, ResearchReport, Action, ActionPlan, SpeciesRecord, Citation, CostRow. Types and tool JSON schemas both come from these. |
| `core/questionnaire.ts` | 7.3, FR-01–FR-10b | Skip logic, answer checks, numbered-list fallback, capacity from answers. The bank itself is `data/question-bank.yaml`. |
| `core/checks.ts` | FR-22–FR-25 | Species, citation and site-constraint checks. See "Species checks". |
| `core/schedule.ts` | 7.7, FR-61–FR-67, FR-71 | The budget and phasing engine. |
| `core/cost.ts` | FR-68–FR-70 | Cost lookup. Local prices win over the reference table. Missing items say "no data". |
| `core/render.ts` | FR-50, FR-30, NFR-17 | Markdown export with sources and attribution, plan sections, site search. |
| `connectors/http.ts` | 12.2, FR-16, NFR-07, NFR-08 | Host allow list, timeout, retry with backoff, 7-day edge cache, contact User-Agent. Never throws. |
| `connectors/ala.ts` | FR-10, FR-11, FR-33, NFR-01 | ALA occurrence facets, species search and name matching. Fixtures are in `server/test/fixtures/ala/`. |
| `connectors/pending.ts` | Section 8 | Sources still marked "To check" return a data gap (rule 4). |
| `rag/*` | 7.4, D-06 | Manifest schema and tier rules, Markdown chunking (about 500 tokens, 15% overlap), BM25 with an access filter and re-ranking. |
| `ui/intake-card/` | 7.3, FR-07 | MCP App question card: plain HTML and TypeScript, inlined at build time. |

## Stateless flow (D-09)

The server stores nothing. A `save_*` tool validates its input, runs the checks, and returns the canonical JSON. The skill saves that JSON in the user's Project as `profile.json`, `research.json` or `plans/v<n>.json`. Tools that need site data take it in the call. The question card carries the draft profile between `save_answer` calls and reports it to Claude with `ui/update-model-context`. See [ADR P-04](adr/p-04-stateless-save-tools.md).

Logs hold `{ tool, ms, result }` only. Coordinates are rounded to 2 decimal places (about 1 km) before they are sent to ALA.

## Species checks

`check_species` resolves names with ALA name matching (NFR-01). Then `checkSpecies` applies these rules in order:

| Evidence | Verdict | Planting |
| --- | --- | --- |
| On `data/declared-weeds.csv` for the state | `declared_weed` | blocked |
| ALA `stateInvasive` record near the site | `biosecurity_pest` | blocked |
| Introduced records nearby, no native records | `introduced` | blocked |
| Native and introduced records nearby | `mixed_records` | warning |
| Native records nearby | `local_native` | allowed |
| No records nearby | `not_recorded_locally` | warning |

`save_plan` runs the same checks on every planting, plus checks that citation IDs resolve (FR-25) and site constraints (FR-23). A renter or strata site needs a `renter` caution on permanent works. Bushfire-prone land needs a `bushfire` caution on planting and habitat actions. See [ADR P-03](adr/p-03-species-checks.md).

## Phasing engine (Section 7.7)

- Capacity: `C_m = h_season × 4.33 × 0.8 − upkeep of actions already done`, over a 36-month horizon. Seasons are southern-hemisphere (Dec–Feb is summer).
- Order: dependency level, then priority, then benefit per hour. Each action goes in the first month inside its window with enough hours and money, using the **high** estimates. The new upkeep must also fit every later month.
- Money is cumulative: the upfront budget, plus the yearly budget from month 13 and from month 25.
- Phase 0 (quick wins) is month 1, with ≤ 4 h and ≤ 10% of the upfront budget. Phase 1 is months 1–6, phase 2 is months 7–18 and phase 3 is months 19–36.
- Deferred actions have a reason (`time`, `money`, `season`, `dependency`) and, where it can be worked out, the extra hours a week or dollars needed.
- "What more would add": the engine runs again with +2 h a week and +50% budget, and lists the actions that move earlier (FR-67).

## Build-time work (D-10)

`npm run build:index` validates `data/*.yaml`, `data/*.csv` and `kb/manifest.yaml`, builds the BM25 index, transpiles the card script and writes `server/src/generated/` (git-ignored). The Worker does no parsing or indexing per request. The dry-run bundle is about 1.8 MB, or 320 KB gzipped.

## Open items

| Item | Status |
| --- | --- |
| Geocoding of addresses (FR-02) | Data gap until the source is checked (Section 8). Coordinates and the current location work. |
| Bushfire-prone lookup (FR-03) | Data gap; the user's answer is used. |
| Climate (FR-12), soil (FR-13), vegetation (FR-14) | Data gaps until Q-06 and the Section 8 checks close. |
| Declared weed list | `data/declared-weeds.csv` is empty (Section 8: To check). |
| Cost reference | `data/cost-reference.csv` is empty (Q-12). Plans show hours, and costs as "no data". |
| Icon set | Text placeholders (Q-14). |
| Apartment question count | 17, not the "about 14" in Section 7.3 (TODO in `data/question-bank.yaml`). |
| Server URL, contact URL, FUNDING.yml | Placeholders. `npm run release` refuses to run while they are set. |
| Live CPU-time check (Q-17) | Check Workers logs after the first staging deploy. |
