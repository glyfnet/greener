/**
 * Cost reference lookup (Section 7.7, FR-68–FR-70).
 *
 * Prices come only from `data/cost-reference.csv` or the user's own local
 * prices. When neither has an item, the result says "no data" — it never
 * invents a price (FR-70).
 */
import { CostRow, type LocalPrice } from "./models.js";
import { normaliseName } from "./checks.js";

/** Parse a simple RFC 4180 CSV (quoted fields, commas, doubled quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

const COST_HEADER = ["item", "unit", "low_aud", "high_aud", "region", "source", "as_of"];

/** Parse and validate the cost reference CSV. Throws with row numbers on bad data. */
export function parseCostReference(csv: string): CostRow[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header || header.join(",") !== COST_HEADER.join(",")) throw new Error(`cost-reference.csv header must be: ${COST_HEADER.join(",")}`);
  return rows.map((r, i) => {
    const parsed = CostRow.safeParse({ item: r[0], unit: r[1], lowAud: Number(r[2]), highAud: Number(r[3]), region: r[4], source: r[5], asOf: r[6] });
    if (!parsed.success) throw new Error(`cost-reference.csv row ${i + 2}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
    if (parsed.data.highAud < parsed.data.lowAud) throw new Error(`cost-reference.csv row ${i + 2}: high_aud is below low_aud`);
    return parsed.data;
  });
}

export type CostMatch =
  | { item: string; found: true; source: "local_price" | "cost_reference"; unit: string; lowAud: number; highAud: number; asOf: string; region?: string; citationId: string; note: string }
  | { item: string; found: false; note: string };

/** Look up items. Local prices win over the reference table (FR-69); a region match wins over others. */
export function lookupCosts(items: string[], region: string | undefined, table: CostRow[], localPrices: LocalPrice[] = []): CostMatch[] {
  return items.map((item) => {
    const key = normaliseName(item);
    const local = localPrices.find((p) => normaliseName(p.item) === key);
    if (local) {
      return { item, found: true, source: "local_price", unit: local.unit, lowAud: local.lowAud, highAud: local.highAud, asOf: local.asOf, citationId: `cost:local:${key}`, note: `Your own price, as of ${local.asOf}. This is an estimate.` };
    }
    const rows = table.filter((r) => normaliseName(r.item) === key);
    const row = (region && rows.find((r) => normaliseName(r.region) === normaliseName(region))) || rows[0];
    if (!row) return { item, found: false, note: `No cost data for '${item}'. The plan will not give a price for it (FR-70).` };
    return {
      item,
      found: true,
      source: "cost_reference",
      unit: row.unit,
      lowAud: row.lowAud,
      highAud: row.highAud,
      asOf: row.asOf,
      region: row.region,
      citationId: `cost:${normaliseName(row.region).replace(/\s+/g, "-")}:${key.replace(/\s+/g, "-")}`,
      note: `Estimate from ${row.source}, as of ${row.asOf}${region && normaliseName(row.region) !== normaliseName(region) ? ` (region ${row.region}, not ${region})` : ""}.`,
    };
  });
}
