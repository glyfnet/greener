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
import { toYaml } from "../core/yaml.js";

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

/** A successful result: the summary as YAML text for Claude (D-24) and as structured data. */
export function ok(summary: Record<string, unknown>, text?: string): ToolResult {
  return { content: [{ type: "text", text: text ?? toYaml(summary) }], structuredContent: summary };
}

/**
 * A result that holds a file for the user's Project (D-09, D-24). The text
 * gives Claude the exact YAML to save, then the rest of the summary.
 */
export function okWithFile(fileName: string, key: string, data: unknown, rest: Record<string, unknown>): ToolResult {
  const text = `Save this as ${fileName}, exactly as written: in the user's site folder if you can write one, otherwise as a file the user downloads and adds to their Project's knowledge with + (Claude can't add it to a Project itself):\n\n\`\`\`yaml\n${toYaml(data)}\`\`\`\n\n${toYaml({ saveAs: fileName, ...rest })}`;
  return ok({ [key]: data, saveAs: fileName, ...rest }, text);
}

/** A structured error with fix hints, never a stack trace (Section 12.2). */
export function fail(error: string, fixHints: string[] = []): ToolResult {
  const body = { error, fixHints };
  return { content: [{ type: "text", text: toYaml(body) }], structuredContent: body, isError: true };
}
