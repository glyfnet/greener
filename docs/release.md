# Release process

Manual, with no GitHub Actions (D-12, specification Section 11.3).

## Merge a pull request

1. `gh pr checkout <number>`
2. `npm run check`. Fix it, or ask for changes, until it passes.
3. Read the diff. For KB items, confirm the licence and the source.
4. Squash merge on GitHub and delete the branch.

## Release

1. On `main`: `npm run deploy:staging`, then `npm run smoke`.
2. Run one full site in Claude against the staging connector.
3. `npm run release -- <version>` (add `--dry-run` first to see the steps).
4. `npm run smoke -- --prod`.

`npm run release` refuses to run until these placeholders are set:

- `CONTACT_URL` in `server/wrangler.toml`
- the server URL in `plugin/.claude-plugin/plugin.json`

Also set the server address in `docs/install.md`, the smoke URLs (`SMOKE_STAGING_URL`, `SMOKE_PROD_URL`) and `.github/FUNDING.yml`.

Cloudflare access comes from `wrangler login` ([developer-setup.md](developer-setup.md)). No tokens go in the repo. A change to a tool name or schema is a major version.

## Refresh fixtures

`npm run fixtures:record` re-records the ALA fixtures from live responses. Run it on purpose, review the diff, and then run `npm run check`.
