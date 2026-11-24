/**
 * The full tool list. A contract test snapshots these names so an accidental
 * rename fails `npm run check` — a rename is a major version (Section 11.3).
 */
import type { Tool } from "./define.js";
import { intakeTools } from "./intake.js";
import { knowledgeTools } from "./knowledge.js";
import { planTools } from "./plan.js";
import { researchTools } from "./research.js";

export const TOOLS: readonly Tool[] = [...intakeTools, ...researchTools, ...knowledgeTools, ...planTools];
