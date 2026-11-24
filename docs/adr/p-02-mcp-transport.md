# P-02: MCP transport — official SDK, stateless web-standard Streamable HTTP

- Status: Proposed (Section 12.2 says to choose in the first build)
- Date: 2026-11-24

## Context and problem

Section 12.2 allows the official MCP TypeScript SDK in stateless Streamable HTTP mode, or the Cloudflare MCP handler.

## Decision

Use `@modelcontextprotocol/sdk` with `WebStandardStreamableHTTPServerTransport`, `sessionIdGenerator: undefined` and `enableJsonResponse: true`. Each request builds a new `McpServer` and closes it afterwards (`server/src/server.ts`). No extra dependency is needed.

The question card follows the MCP Apps extension: the tool's `_meta.ui.resourceUri` (and the legacy `ui/resourceUri` key) points to `ui://intake-card`, which is served with MIME type `text/html;profile=mcp-app`. The card speaks JSON-RPC over `postMessage` (`ui/initialize`, `ui/notifications/tool-result`, `tools/call`, `ui/update-model-context`, `ui/message`). These names were checked against the `@modelcontextprotocol/ext-apps` 2.0.4 type definitions, which are not a dependency.

## Consequences

No sessions and no Durable Objects. The Worker integration test (`server/test/worker/`) runs the real endpoint in the Workers runtime.
