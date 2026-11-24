# D-17: Planting and chemical policy — local natives only, no chemicals

- Status: Accepted
- Date: 2026-11-24
- Decided by: the maintainer
- Source: [specification Section 2, Decision log](../specification.md#2-decision-log)

## Context and problem

Greener is for rewilding. FR-22 allows a non-local species in a plan if it carries a clear warning, and nothing stopped a plan from recommending herbicides or poison baits.

## Decision

- Plant **local natives only**. A species must have native records near the site, either in the research report or from a live ALA query. If it doesn't, the plan is refused.
- **No chemicals**: no herbicides, pesticides, insecticides, fungicides, poison baits or synthetic fertilisers in any action.

## Consequences

- `checkSpecies` blocks `not_recorded_locally`. `check_species` and `save_plan` query ALA for native records of each species that is not in the research report, so genuine local natives are not blocked.
- `checkChemicals` scans action titles and steps for chemical methods, and `save_plan` refuses those actions. Text that says *not* to use a chemical ("no herbicide") is allowed.
- `get_site_strategies` always returns the `chemical_free` strategy, with methods from the WeedWise profiles. Sites where the user already sprays also get a plan to phase it out.
- WeedWise profiles list chemical options too. The KB summaries include only the non-chemical methods.
