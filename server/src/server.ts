/**
 * Build one MCP server for one request. Stateless: nothing is kept after the
 * response (D-05, D-09). Kept apart from the Worker entry point so tests can
 * run it with fake connectors (NFR-14).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { INTAKE_CARD_URI } from "./tools/intake.js";
import type { ToolContext } from "./tools/context.js";
import { TOOLS } from "./tools/registry.js";

export const SERVER_NAME = "greener";
export const SERVER_VERSION = "0.1.0";
/** MIME type for MCP App resources (MCP Apps extension). */
export const MCP_APP_MIME = "text/html;profile=mcp-app";

export interface LogLine {
  tool: string;
  ms: number;
  result: "ok" | "error";
}

export function buildServer(ctx: ToolContext, log: (line: LogLine) => void = () => {}): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: "Greener helps land holders in New South Wales, Australia, increase biodiversity on their site. Use the plugin skills: site-intake, site-research, action-plan, site-advisor. The server keeps no user data: pass the site file in each call and save what the tools return in the user's Project." },
  );
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.input, ...(tool.meta ? { _meta: tool.meta } : {}) },
      async (args: unknown) => {
        const start = Date.now();
        const result = await tool.run(args, ctx);
        // Log tool, timing and result code only — no user text or location (Section 12.5).
        log({ tool: tool.name, ms: Date.now() - start, result: result.isError ? "error" : "ok" });
        return result;
      },
    );
  }
  server.registerResource(
    "intake-card",
    INTAKE_CARD_URI,
    { title: "Greener question card", description: "Buttons for one intake question (FR-07).", mimeType: MCP_APP_MIME },
    async () => ({ contents: [{ uri: INTAKE_CARD_URI, mimeType: MCP_APP_MIME, text: ctx.data.intakeCardHtml }] }),
  );
  return server;
}

/** Handle one MCP request over stateless Streamable HTTP. */
export async function handleMcp(request: Request, ctx: ToolContext, log?: (line: LogLine) => void): Promise<Response> {
  const server = buildServer(ctx, log);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // Close after the response body is built; JSON responses are complete here.
    void server.close();
  }
}
