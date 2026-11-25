/**
 * What every tool handler receives. Built fresh for each request, so the
 * Worker keeps no mutable state between requests (Section 12.2).
 */
import type { DeclaredWeed } from "../core/checks.js";
import type { SpeciesImage } from "../core/images.js";
import type { Nursery } from "../core/nurseries.js";
import type { CostRow } from "../core/models.js";
import type { QuestionBank } from "../core/questionnaire.js";
import type { HttpDeps } from "../connectors/http.js";
import type { KbIndex } from "../rag/bm25.js";

/** Read-only data built at release time and shipped with the Worker. */
export interface StaticData {
  bank: QuestionBank;
  kbIndex: KbIndex;
  costTable: CostRow[];
  declaredWeeds: DeclaredWeed[];
  nurseries: Nursery[];
  speciesImages: SpeciesImage[];
  intakeCardHtml: string;
}

export interface ToolContext {
  http: HttpDeps;
  data: StaticData;
  /** ISO date (YYYY-MM-DD) used in citations. */
  today: string;
}

/** The result shape the MCP SDK expects from a tool. */
export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/** A successful result: the summary as text (for hosts without structured output) and as data. */
export function ok(summary: Record<string, unknown>, text?: string): ToolResult {
  return { content: [{ type: "text", text: text ?? JSON.stringify(summary) }], structuredContent: summary };
}

/** A structured error with fix hints, never a stack trace (Section 12.2). */
export function fail(error: string, fixHints: string[] = []): ToolResult {
  const body = { error, fixHints };
  return { content: [{ type: "text", text: JSON.stringify(body) }], structuredContent: body, isError: true };
}
