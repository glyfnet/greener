# P-03: Species checks from ALA establishment data while the weed list is empty

- Status: Proposed
- Date: 2026-11-24

## Context and problem

FR-22 and FR-24 need native and weed checks. Specification Section 8 still marks state declared weed lists as *To check*, so the repository has no verified declared weed list, and rule 4 forbids inventing one. Live ALA queries on 24 Nov 2026 showed three things:

- `stateInvasive` flags biosecurity pests (fruit fly, for example), not garden weeds.
- `establishmentMeans` and `degreeOfEstablishment` separate native from introduced records near a site. Lantana, *Asparagus aethiopicus* and privet appear as introduced near central Sydney.
- `degreeOfEstablishment:cultivated` overlaps local natives grown in gardens (16 natives in the test query), so it must not count as introduced.
- The ALA species search (BIE) has no native-status field.

## Decision

`check_species` and `save_plan` apply these rules, in this order (`server/src/core/checks.ts`):

1. On `data/declared-weeds.csv` for the state → **blocked**.
2. Flagged `stateInvasive` near the site → **blocked**.
3. Introduced records near the site and no native records → **blocked**. This is stricter than FR-22's "clear warning", in favour of NFR-03.
4. Both native and introduced records nearby → **warning**.
5. Native records nearby → allowed.
6. No records nearby → **warning** (FR-22).

`declared-weeds.csv` ships empty with a TODO. `weed_status` returns `declared: null` (unknown), not `false`, while the list is empty.

## Consequences

The weed check is only as good as ALA's establishment tags until a verified declared weed list is added. Section 8's declared-weed row stays open, and so does the "ALA species (BIE)" row: its endpoint now has recorded fixtures, but the maintainer should confirm the status.

## Update, 24 Nov 2026

- `data/declared-weeds.csv` now holds the 126 NSW WeedWise priority weeds for Greater Sydney. The source page footer links the NSW Government CC BY 4.0 notice. `<Genus> species` rows block a whole genus, and a listed subspecies gives the species a `related_declared` warning.
- Site-constraint findings (renter, apartment, bushfire) are now **warnings** with a site strategy, not refusals, so constrained sites get a plan that is shaped to fit them. Weeds and broken citations still refuse the plan.
