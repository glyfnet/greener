# Contributing to Greener

Thanks for your interest. This project is maintained through manual
reviews — there is no CI (specification Section 11.3); all checks run on
a contributor's and the maintainer's own computer.

## Dev setup

```bash
nvm use            # Node 22 (>= 22.12)
npm install
npm run dev         # wrangler dev, local MCP server
```

For local testing in Claude Code, the Cloudflare account and deploying,
see [`docs/developer-setup.md`](docs/developer-setup.md).

## Before opening a pull request

Run the full check suite and make sure it passes:

```bash
npm run check       # lint, typecheck, unit tests, KB check, index build
```

`npm run check` runs the KB check, the data and index build, lint,
typecheck, the unit and Workers-runtime tests with coverage, the
tool-reference check and `npm audit`. When you change a tool, run
`npm run docs:tools` and commit the updated `docs/tool-reference.md`.

Tests are offline. Connector tests use fixtures recorded from real
responses (`npm run fixtures:record`, run on purpose only).

The pull request template asks you to confirm this passed on your machine.
The maintainer runs it again before merging.

## Branch and commit conventions

- Branch from `main`. One task, one pull request — aim for under ~400
  changed lines, not counting fixtures.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).
- `main` is protected: changes land only through pull requests, and only
  the maintainer merges (squash merge, branch deleted after).

## Adding a knowledge-base item

See [`docs/kb-guide.md`](docs/kb-guide.md) and specification Section 11.4.
In short:

1. Decide the tier — **open content** (full text, only with an open
   licence or the maintainer's own words) or **link catalogue** (URL,
   metadata, and a thorough original summary).
2. Add the Markdown file to `kb/sources/` (open content only) and the
   metadata to `kb/manifest.yaml`.
3. Run `npm run check:kb` — it validates metadata, licence, tier, and
   checks that URLs still resolve.
4. For a licensed or permissioned source (e.g. a council planting list),
   record the permission in the manifest and confirm the tier it allows.

## Architectural decisions

Changing something already decided in `docs/specification.md` Section 2
needs a new decision row there and a corresponding ADR in `docs/adr/`
that supersedes the old one — see specification Section 12.4.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
