# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Saving site files: Claude can't add files to a claude.ai Project's knowledge, so the skills now give each file as a download and tell the user to add it with **+**. They write to a local site folder when there is one (Claude Code or a filesystem connector), and ask for a missing file instead of starting again. The install and user guides explain this (Q-21).

### Changed

- Output data is YAML and documents are Markdown (D-24). Site files are now `profile.yaml`, `research.yaml` and `plans/v<n>.yaml`, and each save tool gives the exact YAML to save. `export_plan` takes `format: "yaml"` instead of `"json"`: this is a breaking change to the tool's schema, made before the first release. Tool text for Claude and the question card's profile messages are YAML. The skills say never to make HTML files or artifacts. Older `.json` site files can still be read.
=======
### Fixed

- Sources in the Markdown export are now proper links: `- **id**: [title](<url>)`. Before, raw URLs with `*` in the query string were shown as broken text or emphasis (FR-50).
- ALA citations now link to pages for people: the ALA records page (`biocache.ala.org.au/occurrences/search`, same species, place and radius) and the species page (`bie.ala.org.au/species/…`), not the JSON API.

### Added

- Species photos (FR-17, D-23): the `get_species_images` tool returns a Wikimedia Commons photo for each species, with the creator, licence, a credit line and Markdown. Photos come from `data/species-images.csv` (16 starter rows from the Armidale Tree Group koala list, recorded with `npm run images:record`) or a live lookup (Wikidata and Commons, then the ALA species image). Only CC0, public domain, CC BY, CC BY-SA and CC BY-NC photos with a named creator are accepted.
- `review-species-images` Claude Code skill for the maintainer, with `npm run images:record -- --pending`, `--approve` and `--remove`.
- Armidale Tree Group: 2026 koala habitat species list, the Saumarez, Invergowrie, Bee and Neighbour-Hider pack lists, and the Every Tree Counts brochure in the KB. The wholesale entry names the 9 species the group marks as not local to the New England Tablelands, and the cost table gains tree guard and stake prices (FR-41, FR-68).

### Changed

- The plugin's `/greener-…` commands are now skills (each skill's `name` is its command), and the `commands/` folder is gone, so Claude no longer warns that the plugin uses the legacy command format. `/greener-export` has its own skill. The commands keep their names.

### Fixed

- The question card's URI now includes a hash of its HTML (`ui://intake-card/<hash>`). Claude caches a card by its URI, so after the card fix it kept showing the old card, whose final message had no profile.
- Question card: it now tells the host its height, so it is no longer cut off (MCP Apps `ui/notifications/size-changed`). Only `ask_question` opens a card, so answers saved from chat no longer add another card. The model is told not to repeat a card's question as text, and tapping Other more than once shows only one answer box. When the card finishes, its message to Claude now carries the whole profile, because some hosts do not pass on model context updates and the answers were lost (FR-07, FR-09, D-09).

### Added

- 4 more KB items: the Australian Plants Society NSW plant database, the City of Casey's web Indigenous Plant Guide, the Mornington Peninsula Shire native plant map, and WWF-Australia's native plants for balconies and gardens (FR-41).
- 6 more KB items on growing natives: ABC News expert tips, Green Adelaide's plant choice page and local native plant map, the Phillip Island Bushbank planting guide, and the Ozbreed and Seasol guides (general advice only, no products or chemicals) (FR-41).
- Worker URLs on `eric-c93.workers.dev`: staging is deployed and passed the smoke test for all 25 tools, and the plugin, smoke script and install guide point at the production Worker that the first release deploys.
- 6 KB items on native plants: the ANPSA plant guides, Botanic Gardens of Sydney's horticulturist's guide, the Casey and Cardinia indigenous plant guide (Victoria), CSIRO's Guide to Useful Native Plants from Eastern Temperate Australia, Conservation Volunteers Australia's Nature Block guide, and the Native Plant Project online native nursery with its delivery limits (FR-41).
- Buy Me a Coffee link in `.github/FUNDING.yml` and the README (D-16).
- Install guide for users (`docs/install.md`: plugin upload, connector-only on the Free plan, Team and Enterprise, Claude Code, Project setup) and a developer setup guide (`docs/developer-setup.md`: local testing, Cloudflare account, first deploy, free plan limits, monitoring).
- New England sources: 5 KB items (Armidale Tree Group's Plants of the New England database and wholesale species lists, WeedWise Northern Tablelands, and the Uralla and Armidale council weed pages), and Armidale Tree Group hiko seedling prices in the cost table (FR-68).
- `find_native_nurseries` lists native plant nurseries and plant stalls near the site, with what they offer, how to visit and a citation, for the plan's local resources (FR-20). The first entries are in Armidale and Uralla: Armidale Tree Group, Cool Natives Nursery, and the Australian Plants Society stalls at the Armidale and Uralla markets.
- Northern Tablelands priority weeds (Armidale Regional, Uralla and four other councils) from NSW WeedWise: 9 new species, for example sweet briar and honey locust, and the regional duties for 95 species already on the list (FR-24).
- `climate_normals` returns 1991–2020 monthly temperature and rainfall and mean cold nights (at or below 0 °C and 2 °C) from the Open-Meteo Historical Weather API (ERA5), cached for 30 days (FR-12, D-21).
- `soil_properties` returns modelled pH (CaCl₂), clay, sand and organic carbon at 0–5 and 5–15 cm from the Soil and Landscape Grid of Australia, with units and a citation. It is not cached (FR-13, D-22).
- `vegetation_community` returns the pre-clearing Plant Community Type at the site from the NSW State Vegetation Type Map, with a citation. It is not cached (FR-14, D-20).
- `geocode` looks up NSW street addresses in the NSW Address Location Service and returns the suburb, the council and a citation. Lookups are never cached, and the street address stays out of the plan (FR-02, D-19).
- `bushfire_status` looks up the NSW RFS Bush Fire Prone Land map within about 100 m of the site, and suggests an answer for the bushfire question with a citation (FR-03, D-18). The result is never cached.
- Data source decisions D-18 to D-22 (bushfire, geocoding, vegetation, climate, soil), with recorded fixtures. Q-06 is closed.
- D-17 rewilding policy: Australian natives only (local first), never invasives, and no chemicals. `save_plan` refuses invasives, non-natives and chemical methods; `check_species` and `save_plan` check species live with ALA, near the site and across Australia; new `chemical_free` and `phase_out_sprays` strategies; KB guides on chemical-free weed control (WeedWise lantana and ground asparagus).

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
