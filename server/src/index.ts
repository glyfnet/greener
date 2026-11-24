/**
 * Cloudflare Worker entry point (Section 7.1). Routing only — no business
 * logic. Every request builds its own context; nothing persists between
 * requests (Section 12.2).
 */
import { STATIC_DATA } from "./data.js";
import { handleMcp, SERVER_NAME, SERVER_VERSION } from "./server.js";
import type { ToolContext } from "./tools/context.js";

export interface Env {
  /** Contact URL for the User-Agent (NFR-08). Set in wrangler.toml [vars]. */
  CONTACT_URL: string;
}

export function makeContext(env: Env, fetcher: (r: Request) => Promise<Response> = (r) => fetch(r), cache?: Cache): ToolContext {
  return {
    http: { fetch: fetcher, userAgent: `Greener/${SERVER_VERSION} (+${env.CONTACT_URL})`, ...(cache ? { cache } : {}) },
    data: STATIC_DATA,
    today: new Date().toISOString().slice(0, 10),
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") {
      const cache = typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : undefined;
      return handleMcp(request, makeContext(env, undefined, cache), (line) => console.log(JSON.stringify(line)));
    }
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(`${SERVER_NAME} ${SERVER_VERSION}: MCP endpoint at /mcp\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return new Response("Not found\n", { status: 404 });
  },
};
