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

Follow the [install guide](docs/install.md): upload the plugin in
**Customize → Plugins** (paid plans), or add the connector in
**Customize → Connectors** (any plan). Then run `/greener-new` in a
Project for your site. No API key and no local setup.

## For developers

```bash
npm install
npm run dev        # run the MCP server locally (wrangler dev)
npm run check       # lint, typecheck, unit tests, KB check, index build
```

See the [developer setup guide](docs/developer-setup.md) for tools,
local testing, the Cloudflare account and the first deploy, and
[`CONTRIBUTING.md`](CONTRIBUTING.md) for
branch and commit conventions and how to add knowledge-base items.

Needs Node 22 (`nvm use`). All docs are indexed in [`docs/`](docs/README.md):
the [specification](docs/specification.md), the
[architecture](docs/architecture.md), the generated
[tool reference](docs/tool-reference.md), the [user guide](docs/user-guide.md)
and the [ADRs](docs/adr/README.md).

### Status of release 1

Working now: the simple-mode intake with a question card and a numbered-list
fallback, ALA species research, native, weed and constraint checks, the
budget and phasing engine, keyword search over the KB, Markdown and JSON
export, and all 25 MCP tools, with strategies for apartments, rented sites and bushfire-prone land. Plans are for rewilding: Australian natives only (local first), never invasives, and no chemicals (D-17). Bushfire-prone land is looked up on the NSW RFS map (D-18). NSW street addresses are looked up in the NSW Address Location Service (D-19). `vegetation_community` returns the likely original vegetation community from the NSW State Vegetation Type Map (D-20). `soil_properties` returns modelled soil values from the Soil and Landscape Grid of Australia (D-22). `climate_normals` returns 1991–2020 climate normals from Open-Meteo (D-21). Only suburb-only address lookup still returns a data gap. `find_native_nurseries` lists native nurseries and plant stalls near the site; the directory covers Armidale and Uralla so far. The declared weed list (Greater Sydney) and the cost table (two
rows) have a first set of sourced data. See
[docs/architecture.md, Open items](docs/architecture.md#open-items).

## Support this project

Greener is free, with no paid tier. If it's useful to you, you can support
hosting costs via [Buy Me a Coffee](https://buymeacoffee.com/) (link set in
`.github/FUNDING.yml` once the account exists — D-16).

## Licence

Code: Apache-2.0 ([`LICENSE`](LICENSE)). Maintainer-written knowledge-base
text: CC BY 4.0 ([`kb/LICENSE`](kb/LICENSE)).
