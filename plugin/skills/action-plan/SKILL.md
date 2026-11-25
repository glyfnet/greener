---
name: greener-plan
description: Use when the user wants an action plan written or updated, wants to mark actions done. Needs a saved site profile and research report.
---

# Action plan

Implements FR-20–FR-27, FR-60–FR-71 and D-17. The tools enforce the rules; do not work around a refusal.

**Greener is for rewilding: Australian natives only (local natives first), never invasives, and no chemicals (D-17).** Never suggest herbicides, pesticides, poison baits, sprays or synthetic fertiliser. Weeds are removed by hand and the gap is replanted with local natives.

1. Read `profile.yaml` and `research.yaml` (see *Site files*). If the user has never made them, run `/greener-new` or `/greener-research` first.
2. Call `get_site_strategies` with the profile. Apartments, courtyards, rented or strata sites and bushfire-prone land are all fine: follow each strategy's guidance and `planRules`, use its `cautionTag` on the matching actions, and copy its `citations` into the plan's citations.
3. Call `search_knowledge` for guidance that fits the site's goals, type and region. For link-catalogue results, read the live page and cite it (FR-46).
4. Draft the actions (FR-21, FR-61, FR-62). Each needs: category, priority, effort, season, steps, target species, rationale, citation IDs (at least 1, FR-25), labour hours (low–high), materials cost (low–high AUD, or `null`), work window (calendar months), dependencies, monthly upkeep hours, and structured cautions. Use the caution tag `bushfire` for planting on bushfire-prone land, and `renter` for permanent works on rented or strata sites (FR-23).
5. Call `check_species` with every species you want to plant, the research and the site `location`. Plant only the `allowed` species; drop every `blocked` one. Copy the returned `citations` into the plan, and show the user every warning (FR-22, FR-24, D-17).
6. Call `get_cost_reference` for materials, with the user's `localPrices` (FR-69). Use the item names in `availableItems`. When an item has no data, set its cost to `null` and say so. Never invent a price (FR-70).
6a. Call `find_native_nurseries` with the site `location`. Add the nurseries and plant stalls the user may use to the plan's `localResources` (use each result's `localResource`), and copy their citations. Tell the user to ask for local provenance stock and to check opening hours. If none are listed nearby, say so and suggest the council, Landcare or the local Australian Plants Society group. Never invent a nursery (FR-20).
7. Call `schedule_plan` with the actions, the profile and the start month. Do not do the phasing yourself (Section 7.7).
8. Call `save_plan` with the plan, research, profile and start month. If it refuses the plan (a weed or a broken citation), fix the listed items and call it again. If it returns warnings, fix them with the strategy each one names, or explain them to the user. Save the result as `plans/v<version>.yaml`, exactly as the tool gives it (see *Site files*).
9. Call `export_plan` (Markdown) and save it as `plans/v<version>.md`. Tell the user about the phases, the budget table, the deferred actions with their reasons (FR-66), and what more time or money would add (FR-67).
10. To mark an action done, call `mark_done` with the actual hours and cost, then save the returned actions into a new plan version (FR-71).

## Site files

Greener's server keeps nothing (D-09), so the site files live with the user. Each step that saves a file follows these rules:

- **Local folder** (Claude Code, or a filesystem connector the user has set up in the desktop app): write the file into the user's site folder.
- **claude.ai Project:** Claude can't add files to a Project's knowledge. Create the file as a download, or show it in one `yaml` (or `markdown`) code block if file creation is off. Then tell the user, in one line: "Download `<file>` and add it to this Project's knowledge with **+**, replacing any older copy, so later chats can use it."
- **Reading:** look in the project knowledge, the chat and the local folder. If a file is missing, ask the user to upload or paste it. Don't start the site again without asking. An older site may have `.json` files; read them, and save YAML from now on.

See `docs/specification.md` Sections 4.3, 4.7, 7.5 and 7.7.
