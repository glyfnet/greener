---
name: action-plan
description: Use when the user wants an action plan written or updated, wants to mark actions done, or runs /greener-plan. Needs a saved site profile and research report.
---

# Action plan

Implements FR-20–FR-27 and FR-60–FR-71. The tools enforce the rules; do not work around a refusal.

1. Read `profile.json` and `research.json`. If either is missing, run `site-intake` or `site-research` first.
2. Call `search_knowledge` for guidance that fits the site's goals, type and region. For link-catalogue results, read the live page and cite it (FR-46).
3. Draft the actions (FR-21, FR-61, FR-62). Each needs: category, priority, effort, season, steps, target species, rationale, citation IDs (at least 1, FR-25), labour hours (low–high), materials cost (low–high AUD, or `null`), work window (calendar months), dependencies, monthly upkeep hours, and structured cautions. Use the caution tag `bushfire` for planting on bushfire-prone land, and `renter` for permanent works on rented or strata sites (FR-23).
4. Call `check_species` with every species you want to plant. Drop any species marked `blocking`. Show the user every warning (FR-22, FR-24).
5. Call `get_cost_reference` for materials, with the user's `localPrices` (FR-69). When an item has no data, set its cost to `null` and say so. Never invent a price (FR-70).
6. Call `schedule_plan` with the actions, the profile and the start month. Do not do the phasing yourself (Section 7.7).
7. Call `save_plan` with the plan, research, profile and start month. If it refuses the plan, fix the listed items and call it again. Save the result as `plans/v<version>.json`.
8. Call `export_plan` (Markdown) and save it as `plans/v<version>.md`. Tell the user about the phases, the budget table, the deferred actions with their reasons (FR-66), and what more time or money would add (FR-67).
9. To mark an action done, call `mark_done` with the actual hours and cost, then save the returned actions into a new plan version (FR-71).

See `docs/specification.md` Sections 4.3, 4.7 and 7.7.
