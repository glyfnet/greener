# P-01: Toolchain — Node 22, wrangler 4, Vitest 5

- Status: Proposed (needs a decision row in specification Section 2)
- Date: 2026-11-24

## Context and problem

The scaffold pinned Node 20 with wrangler 3, Vitest 2 and `@cloudflare/vitest-pool-workers` 0.6. Current wrangler releases need Node 22.12 or later. Some packages already need Node 20.18, including `undici`, which the local Workers runtime uses. The scaffold's Node 20.10 also hit an npm 10.2 bug when resolving peer dependencies.

## Decision

- Node 22 LTS (`.nvmrc` = 22, `engines.node` >= 22.12).
- wrangler ^4.167, `@cloudflare/vitest-plugin` ^1.9 (the renamed `vitest-pool-workers`), Vitest ^5, zod ^4, `@modelcontextprotocol/sdk` ^1.32.
- New dev dependencies, approved by the maintainer on 24 Nov 2026: `typescript-eslint` (ESLint cannot parse TypeScript without it) and `yaml` (for `kb/manifest.yaml` and `data/question-bank.yaml`). Both run in the scripts only and do not ship in the Worker.

## Consequences

Contributors need Node 22. Zod 4 gives `z.toJSONSchema`, so the tool reference is generated from the same schemas as validation (Section 12.2).
