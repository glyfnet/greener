/**
 * Static data compiled by `npm run build:index` into `src/generated/`.
 * Validated at build time, so the Worker does no parsing work per request
 * (D-10). The objects are frozen: no mutable global state (Section 12.2).
 */
import type { DeclaredWeed } from "./core/checks.js";
import type { CostRow } from "./core/models.js";
import type { QuestionBank } from "./core/questionnaire.js";
import type { KbIndex } from "./rag/bm25.js";
import type { StaticData } from "./tools/context.js";
import bank from "./generated/question-bank.json";
import kbIndex from "./generated/kb-index.json";
import costTable from "./generated/cost-reference.json";
import declaredWeeds from "./generated/declared-weeds.json";
import { INTAKE_CARD_HTML } from "./generated/intake-card.js";

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

export const STATIC_DATA: StaticData = deepFreeze({
  bank: bank as unknown as QuestionBank,
  kbIndex: kbIndex as unknown as KbIndex,
  costTable: costTable as unknown as CostRow[],
  declaredWeeds: declaredWeeds as unknown as DeclaredWeed[],
  intakeCardHtml: INTAKE_CARD_HTML,
});
