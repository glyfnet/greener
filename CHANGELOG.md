# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `get_site_strategies` tool: strategies for apartments and courtyards, rented or strata sites, and bushfire-prone land, citing NSW RFS and NSW Government guidance (FR-23).
- Declared weed list: 126 NSW WeedWise priority weeds for Greater Sydney, with genus-wide and subspecies matching (FR-24).
- First cost reference rows from the Yass Area Network nurseries (FR-68).
- 7 KB items: RFS habitat-in-APZ and APZ standards, NSW small-spaces gardening, City of Sydney urban habitat guide, WeedWise Greater Sydney, and maintainer guides for balconies and bushfire-prone land.

### Changed

- `save_plan` accepts apartment, rented and bushfire-prone sites. Missing cautions are now warnings with a strategy instead of refusals.
- `get_cost_reference` lists the available item names.

- MCP server on Cloudflare Workers: 23 tools over stateless Streamable HTTP, plus the `ui://intake-card` MCP App (FR-07, FR-09).
- Core: Zod models, question bank and skip logic (FR-01–FR-10b), species, citation and constraint checks (FR-22–FR-25), budget and phasing engine (Section 7.7, FR-61–FR-67, FR-71), cost lookup (FR-68–FR-70), and Markdown/JSON export (FR-50).
- ALA connector for occurrence facets, species search and name matching, with recorded fixtures (FR-10, FR-11, FR-33, NFR-01).
- BM25 search over the global KB, built at release time (D-06, FR-45), and the first two KB items.
- Scripts: build-index, check-kb (with link check), gen-tool-reference, record-fixtures, smoke, build-plugin and release.
- Docs: architecture, generated tool reference, user guide, KB guide, privacy, release, evals, ADRs D-01–D-16, and proposed ADRs P-01–P-04.
- Project scaffold: repository layout, plugin/server/kb/data/scripts
  skeletons, docs, and developer tooling config, per
  `docs/specification.md` Section 11.

### Changed

- Toolchain: Node 22, wrangler 4, Vitest 5, zod 4 (ADR P-01). Added the dev dependencies `typescript-eslint` and `yaml` (approved).
