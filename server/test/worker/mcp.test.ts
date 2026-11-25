/**
 * Worker integration test (Section 12.3): the MCP endpoint runs inside the
 * Workers runtime and answers real MCP requests. Only tools that make no
 * outbound requests are called, so the test stays offline (NFR-14).
 */
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../../src/index.js";

const post = (body: unknown) =>
  worker.fetch(new Request("https://greener.test/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify(body) }), env as unknown as { CONTACT_URL: string });

describe("Worker", () => {
  it("serves a health line and 404s other paths", async () => {
    const env2 = env as unknown as { CONTACT_URL: string };
    expect(await (await worker.fetch(new Request("https://greener.test/"), env2)).text()).toContain("MCP endpoint at /mcp");
    expect((await worker.fetch(new Request("https://greener.test/nope"), env2)).status).toBe(404);
  });

  it("answers MCP initialize and tools/list in the Workers runtime", async () => {
    const init = (await (await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } })).json()) as { result: { serverInfo: { name: string } } };
    expect(init.result.serverInfo.name).toBe("greener");
    const list = (await (await post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })).json()) as { result: { tools: unknown[] } };
    expect(list.result.tools.length).toBe(26);
  });

  it("runs the intake and the scheduler inside the Workers runtime", async () => {
    const r = (await (await post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "save_answer", arguments: { questionId: "site_type", answer: { optionIds: ["rural"] } } } })).json()) as { result: { structuredContent: { question: { id: string } } } };
    expect(r.result.structuredContent.question.id).toBe("location");
    const action = { id: "a", title: "A", category: "other", priority: "high", effort: "low", season: ["autumn"], steps: ["x"], rationale: "y", citationIds: ["c"], labourHours: { low: 1, high: 2 }, materialsAud: null, window: { startMonth: 1, endMonth: 12 } };
    const s = (await (await post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "schedule_plan", arguments: { actions: [action], startMonth: 3, capacity: { hoursPerWeek: { summer: 1, autumn: 1, winter: 1, spring: 1 }, upfrontAud: 100, yearlyAud: 100 } } } })).json()) as { result: { structuredContent: { scheduled: { phase: number }[] } } };
    expect(s.result.structuredContent.scheduled[0]?.phase).toBe(0);
  });
});
