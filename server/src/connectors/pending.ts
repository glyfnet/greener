/**
 * Data services that are still "To check" in specification Section 8.
 *
 * Rule 4 forbids inventing endpoints or field names, so until each source is
 * checked (licence, terms, response format) these return a data gap. The run
 * then continues and the report lists the gap (NFR-07, FR-32).
 */
import type { DataGap } from "../core/models.js";

export interface PendingSource {
  topic: string;
  requirement: string;
  candidate: string;
  question: string;
}

export const PENDING: Record<"geocode" | "climate", PendingSource> = {
  // TODO(D-19): street addresses work; suburb-only lookup waits for the NSW Administrative Boundaries Theme licence.
  geocode: { topic: "suburb or postcode lookup", requirement: "FR-02", candidate: "NSW Administrative Boundaries Theme (suburb centroids)", question: "D-19, suburb lookup licence: To check" },
  // TODO(Q-06): BOM data or Open-Meteo? Check licence and attribution terms.
  climate: { topic: "climate normals", requirement: "FR-12", candidate: "Bureau of Meteorology or Open-Meteo", question: "Q-06" },
};

export function pendingGap(key: keyof typeof PENDING): DataGap {
  const p = PENDING[key];
  return { topic: p.topic, reason: `Not available yet: the data source (${p.candidate}) is still being checked (${p.question}).` };
}
