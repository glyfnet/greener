/**
 * Tool definition helper. Each tool has one Zod input schema, which is used
 * for validation, for the MCP tool list and for the generated tool reference
 * (Section 12.2).
 */
import { z } from "zod";
import { fail, type ToolContext, type ToolResult } from "./context.js";

export interface Tool {
  name: string;
  title: string;
  description: string;
  input: z.ZodObject;
  meta?: Record<string, unknown>;
  /** Parses `args` with `input`, then runs the handler. Never throws. */
  run(args: unknown, ctx: ToolContext): Promise<ToolResult>;
}

/** Turn Zod issues into plain-English hints Claude can act on. */
export function zodHints(error: z.ZodError): string[] {
  return error.issues.slice(0, 10).map((i) => `${i.path.length ? i.path.join(".") : "input"}: ${i.message}`);
}

export function defineTool<S extends z.ZodObject>(def: {
  name: string;
  title: string;
  description: string;
  input: S;
  meta?: Record<string, unknown>;
  handler: (args: z.infer<S>, ctx: ToolContext) => Promise<ToolResult> | ToolResult;
}): Tool {
  if (!/^[a-z]+(_[a-z]+)*$/.test(def.name)) throw new Error(`tool name ${def.name} must be snake case (verb_noun)`);
  return {
    name: def.name,
    title: def.title,
    description: def.description,
    input: def.input,
    ...(def.meta ? { meta: def.meta } : {}),
    async run(args, ctx) {
      const parsed = def.input.safeParse(args ?? {});
      if (!parsed.success) return fail(`Invalid input for ${def.name}.`, zodHints(parsed.error));
      try {
        return await def.handler(parsed.data, ctx);
      } catch (e) {
        if (e instanceof z.ZodError) return fail(`Invalid data for ${def.name}.`, zodHints(e));
        const errors = (e as { errors?: unknown }).errors;
        if (Array.isArray(errors)) return fail(`${def.name} could not finish.`, errors.map(String));
        // Never return a stack trace (Section 12.2).
        return fail(`${def.name} failed unexpectedly. Try again, or report it if it keeps happening.`);
      }
    },
  };
}
