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

export const PENDING: Record<"geocode" | "climate" | "soil" | "vegetation" | "bushfire", PendingSource> = {
  // TODO(Section 8): confirm Nominatim usage terms or choose a state address service.
  geocode: { topic: "address lookup", requirement: "FR-02", candidate: "Nominatim (OpenStreetMap) or a state address service", question: "Section 8, geocoding: To check" },
  // TODO(Q-06): BOM data or Open-Meteo? Check licence and attribution terms.
  climate: { topic: "climate normals", requirement: "FR-12", candidate: "Bureau of Meteorology or Open-Meteo", question: "Q-06" },
  // TODO(Section 8): confirm the Soil and Landscape Grid of Australia (TERN) API and licence.
  soil: { topic: "soil properties", requirement: "FR-13", candidate: "Soil and Landscape Grid of Australia (TERN)", question: "Section 8, soil: To check" },
  // TODO(Section 8): confirm the NVIS / NSW vegetation map spatial service.
  vegetation: { topic: "pre-clearing vegetation community", requirement: "FR-14", candidate: "NVIS and state vegetation maps", question: "Section 8, vegetation: To check" },
  // TODO(Section 8): confirm the NSW planning spatial service for bushfire-prone land.
  bushfire: { topic: "bushfire-prone land status", requirement: "FR-03", candidate: "NSW planning spatial services", question: "Section 8, bushfire-prone land: To check" },
};

export function pendingGap(key: keyof typeof PENDING): DataGap {
  const p = PENDING[key];
  return { topic: p.topic, reason: `Not available yet: the data source (${p.candidate}) is still being checked (${p.question}).` };
}
