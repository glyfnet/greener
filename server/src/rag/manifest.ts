/**
 * Global KB manifest schema (FR-41, FR-42, D-15).
 *
 * Shared by `npm run check:kb` and `npm run build:index`, so the rules for
 * tiers and licences are checked in one place.
 */
import { z } from "zod";

/**
 * Licences that permit redistribution of full text (FR-42). `maintainer`
 * marks text the maintainer wrote, released under kb/LICENSE (CC BY 4.0, D-14).
 * `permission` needs a `permission` record (Q-20).
 */
export const OPEN_LICENCES = ["maintainer", "CC-BY-4.0", "CC-BY-3.0-AU", "CC0-1.0", "permission"] as const;

/** Minimum words in a link-catalogue summary, so it is useful on its own (Section 7.4). */
export const MIN_SUMMARY_WORDS = 80;

const Base = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lower-case letters, digits and dashes"),
  title: z.string().min(1),
  sourceUrl: z.union([z.string().url(), z.string().regex(/^kb\/sources\/[a-z0-9-]+\.md$/)]).describe("Web URL, or the kb/sources path for maintainer-written text"),
  publisher: z.string().min(1),
  licence: z.string().min(1),
  region: z.string().min(1).describe("e.g. 'NSW', 'NSW coast', 'Australia'"),
  dateChecked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateChecked must be YYYY-MM-DD"),
  tags: z.array(z.string().min(1)).min(1),
  permission: z.object({ grantedBy: z.string().min(1), date: z.string().min(1), terms: z.string().min(1) }).optional(),
});

export const OpenContentItem = Base.extend({
  tier: z.literal("open_content"),
  file: z.string().regex(/^[a-z0-9-]+\.md$/, "file must be a .md file name in kb/sources"),
});

export const CatalogueItem = Base.extend({
  tier: z.literal("link_catalogue"),
  summary: z.string().min(1),
});

export const KbItem = z.discriminatedUnion("tier", [OpenContentItem, CatalogueItem]);
export type KbItem = z.infer<typeof KbItem>;

export const KbManifest = z.object({ items: z.array(KbItem) });
export type KbManifest = z.infer<typeof KbManifest>;

/** Tier and licence rules that a schema alone can't express (FR-42, Q-20). Returns error messages. */
export function manifestRuleErrors(manifest: KbManifest): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of manifest.items) {
    if (ids.has(item.id)) errors.push(`${item.id}: duplicate id`);
    ids.add(item.id);
    if (item.tier === "open_content") {
      if (!(OPEN_LICENCES as readonly string[]).includes(item.licence)) {
        errors.push(`${item.id}: open content needs a licence that permits redistribution (${OPEN_LICENCES.join(", ")}), not '${item.licence}'. Use the link catalogue instead.`);
      }
      if (item.licence === "permission" && !item.permission) errors.push(`${item.id}: licence 'permission' needs a permission record (Q-20)`);
    } else {
      const words = item.summary.trim().split(/\s+/).length;
      if (words < MIN_SUMMARY_WORDS) errors.push(`${item.id}: catalogue summary has ${words} words; write at least ${MIN_SUMMARY_WORDS} in your own words`);
    }
  }
  return errors;
}
