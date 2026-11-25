# Developer setup

This guide is for people who build, test or deploy Greener. It covers your computer, a Cloudflare account, the first deploy and day-to-day work. Users installing the plugin should read [install.md](install.md) instead.

Cloudflare facts below come from the Cloudflare docs, checked on 25 November 2026 (see [Sources](#sources)).

## 1. Tools on your computer

| Tool | Why |
| --- | --- |
| Node 22.12 or later (`.nvmrc`), for example through [nvm](https://github.com/nvm-sh/nvm) | The scripts, tests and Wrangler |
| git and the [GitHub CLI](https://cli.github.com/) (`gh`) | Pull requests and releases (`npm run release` uses `gh`) |
| `zip` | `npm run build:plugin` |
| Claude Code (optional) | To try the plugin and the local server together |

Wrangler, the Cloudflare CLI, is a dev dependency, so you don't install it yourself.

```bash
git clone https://github.com/glyfnet/greener.git
cd greener
nvm use
npm install
npm run check
```

`npm run check` must pass before you change anything. It runs offline, using recorded fixtures.

## 2. Run the server locally

```bash
npm run dev
```

This builds the KB index and starts `wrangler dev`. The MCP endpoint is at `http://localhost:8787/mcp`. To call every tool against it:

```bash
npm run smoke -- --url http://localhost:8787/mcp
```

The connectors call the real public data services (ALA, NSW Spatial Services and others), so local runs need internet access.

**Try it in Claude Code.** claude.ai can't reach `localhost`, because Claude connects to connectors from Anthropic's cloud. Claude Code can:

```bash
claude mcp add --transport http greener-local http://localhost:8787/mcp
claude --plugin-dir plugin
```

`--plugin-dir` loads the skills (the `/greener-…` commands) from your working copy. The plugin's own server entry points at the deployed URL in `plugin/.claude-plugin/plugin.json`, so use the `greener-local` tools while you test.

You don't need a Cloudflare account for any of this.

## 3. Cloudflare account (only to deploy)

Greener runs on the Cloudflare Workers **free plan** (D-10). It needs no KV, database or secrets. The only state is the edge cache.

1. Sign up at [dash.cloudflare.com/sign-up/workers-and-pages](https://dash.cloudflare.com/sign-up/workers-and-pages).
2. Log Wrangler in. Run these from the repository root:

   ```bash
   npx wrangler login     # opens the browser to authorise Wrangler (OAuth)
   npx wrangler whoami    # shows the account you're logged in to
   ```

   By default Wrangler stores the token in a plaintext file (usually `~/.config/.wrangler/config/default.toml`). Add `--use-keyring` to store it in the OS keychain instead.

**Never put Cloudflare credentials in the repository** (CLAUDE.md rule 8). That includes account IDs, API tokens and `.dev.vars`. For automation, Wrangler reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the environment, and the token takes priority over `wrangler login`. Keep them in your shell, not in a committed file. Releases are manual (D-12), so you shouldn't normally need a token.

### Free plan limits that matter

| Limit (Workers Free) | Value |
| --- | --- |
| Requests | 100,000 a day, reset at midnight UTC. After that, Cloudflare returns error 1027. |
| CPU time | 10 ms for each request. Time spent waiting for data services doesn't count. |
| Subrequests | 50 for each request |
| Memory | 128 MB |
| Script size | 64 MiB uncompressed |
| Workers Logs | 200,000 events a day, kept for 3 days |

Cloudflare's docs say Workers Logs moves to Cloudflare Observability pricing on 1 December 2026. TODO: check whether that changes the free allowance for `[observability]` in `server/wrangler.toml`.

## 4. First deploy (staging)

`server/wrangler.toml` defines three Workers: `greener` (default), `greener-staging` and `greener-production`.

```bash
npm run deploy:staging
```

On the first deploy, if your account has no `workers.dev` subdomain yet, Wrangler asks you to set one up. You can see or change it later in the dashboard: **Workers & Pages → Your subdomain → Change**.

The staging endpoint is then (the project's own is `https://greener-staging.eric-c93.workers.dev/mcp`):

```text
https://greener-staging.<your-subdomain>.workers.dev/mcp
```

If the deploy doesn't print a `workers.dev` URL, add `workers_dev = true` under `[env.staging]` (and `[env.production]`) in `server/wrangler.toml`, then deploy again. Cloudflare's docs show this setting per environment.

Check it:

```bash
SMOKE_STAGING_URL=https://greener-staging.<your-subdomain>.workers.dev/mcp npm run smoke
```

To try staging in claude.ai, add it as a custom connector (**Customize → Connectors → + Add → Add custom connector**, with **No sign in**). Name it differently from the production connector, for example "Greener staging".

## 5. Before the first release

The project's Workers are on the `eric-c93.workers.dev` subdomain. Staging is `https://greener-staging.eric-c93.workers.dev/mcp`, and production will be `https://greener-production.eric-c93.workers.dev/mcp`. These are already set in `plugin/.claude-plugin/plugin.json`, `scripts/smoke.ts` and `docs/install.md`. If you deploy to your own account, set your own subdomain in those files, or set `SMOKE_STAGING_URL` and `SMOKE_PROD_URL` in your shell.

`npm run release` won't run until this placeholder is replaced ([release.md](release.md)):

| File | Set |
| --- | --- |
| `server/wrangler.toml` | `CONTACT_URL` in all three environments: the public repository URL, sent in the User-Agent (NFR-08) |

The repository also has to be public, so that users can download the release zip and add the marketplace.

Then follow [release.md](release.md). `npm run release -- <version>` deploys `--env production`, builds `dist/greener-plugin-<version>.zip` and creates the GitHub release. Finish with `npm run smoke -- --prod`.

## 6. Watching the deployed Worker

- **Live logs:** `npx wrangler tail greener-production` streams each request's logs. The server logs one JSON line for each tool call: the tool name, the duration and `ok` or `error`, with no location and no user text ([privacy.md](privacy.md)).
- **Dashboard:** **Workers & Pages → greener-production → Observability**. CPU time and wall time are in each invocation log. Requests that went over the CPU limit show under **Metrics → Errors → Invocation Statuses**.
- **After each release,** check CPU time and request counts against the free plan (D-10, Q-17).

## 7. Day-to-day work

- Branches, commits and pull requests: [CONTRIBUTING.md](../CONTRIBUTING.md).
- Adding knowledge-base items: [kb-guide.md](kb-guide.md).
- After changing a tool: `npm run docs:tools`, then commit `docs/tool-reference.md`.
- New data source: a decision row and ADR first, then `npm run fixtures:record -- <source>` to record real responses (CLAUDE.md rule 4). Add the new host to `ALLOWED_HOSTS` in `server/src/connectors/http.ts`.

## Sources

- [Cloudflare Workers: get started](https://developers.cloudflare.com/workers/get-started/guide/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Wrangler general commands (`login`, `whoami`)](https://developers.cloudflare.com/workers/wrangler/commands/general/)
- [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)
- [workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Wrangler system environment variables](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/)
- [Claude: custom connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
