# Greener

Greener is a Claude plugin with a remote MCP server that helps Australian
land holders increase the biodiversity of their own site. It asks a short
questionnaire, pulls in local species, climate and soil data, writes a
site-specific action plan, and answers follow-up questions — all with no
install on your computer.

The full requirements and technical specification lives at
[`docs/specification.md`](docs/specification.md). That document is the
source of truth for every decision in this repository (see its Section 2,
Decision log).

## For users

1. Open Claude (web, desktop or mobile) and go to **Settings → Customize**.
2. Add the Greener connector (directory listing pending — see `docs/specification.md` Q-18; until then, add it from this repository's `.claude-plugin/marketplace.json`).
3. Run `/greener-new` to start a plan for your site.

No API key, no download, no local setup.

## For developers

```bash
npm install
npm run dev        # run the MCP server locally (wrangler dev)
npm run check       # lint, typecheck, unit tests, KB check, index build
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full developer setup,
branch and commit conventions, and how to add knowledge-base items.

Needs Node 22 (`nvm use`). All docs are indexed in [`docs/`](docs/README.md):
the [specification](docs/specification.md), the
[architecture](docs/architecture.md), the generated
[tool reference](docs/tool-reference.md), the [user guide](docs/user-guide.md)
and the [ADRs](docs/adr/README.md).

### Status of release 1

Working now: the simple-mode intake with a question card and a numbered-list
fallback, ALA species research, native, weed and constraint checks, the
budget and phasing engine, keyword search over the KB, Markdown and JSON
export, and all 23 MCP tools. Climate, soil, vegetation, address lookup,
bushfire lookup, the declared weed list and the cost table are still waiting
on source checks: those tools return data gaps. See
[docs/architecture.md, Open items](docs/architecture.md#open-items).

## Support this project

Greener is free, with no paid tier. If it's useful to you, you can support
hosting costs via [Buy Me a Coffee](https://buymeacoffee.com/) (link set in
`.github/FUNDING.yml` once the account exists — D-16).

## Licence

Code: Apache-2.0 ([`LICENSE`](LICENSE)). Maintainer-written knowledge-base
text: CC BY 4.0 ([`kb/LICENSE`](kb/LICENSE)).
