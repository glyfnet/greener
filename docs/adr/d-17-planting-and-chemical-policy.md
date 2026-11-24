# D-17: Planting and chemical policy — Australian natives, no invasives, no chemicals

- Status: Accepted
- Date: 2026-11-24
- Decided by: the maintainer
- Source: [specification Section 2, Decision log](../specification.md#2-decision-log)

## Context and problem

Greener is for rewilding. FR-22 allows a non-local species in a plan if it carries a clear warning, and nothing stopped a plan from recommending herbicides or poison baits.

## Decision

- Plant **Australian natives only**, and prefer local natives. Never plant **invasives**.
- Blocked: priority weeds (`data/declared-weeds.csv`), species ALA flags as `stateInvasive`, and species recorded as introduced near the site with no native records there. The last rule also blocks Australian natives that are invasive outside their range, for example *Grevillea robusta* around Sydney.
- Allowed: species with native records near the site (best), species with both native and introduced records nearby (warning: buy local stock), and species that are native to Australia but not recorded nearby (warning: a local native is better).
- "Native to Australia" means more native-tagged than introduced-tagged ALA records nationally. Live data checked on 24 Nov 2026: Jacaranda 1 native to 1,669 introduced, Lantana 91 to 19,656, *Persoonia hirsuta* 219 to 2, *Eucalyptus marginata* 646 to 9.
- **No chemicals**: no herbicides, pesticides, insecticides, fungicides, poison baits or synthetic fertilisers in any action.

## Consequences

- For each species the research report doesn't cover, `check_species` and `save_plan` make two ALA queries (`speciesEstablishment`): native and introduced counts near the site, and across Australia. At most 25 species are checked per call.
- `checkChemicals` scans action titles and steps for chemical methods, and `save_plan` refuses those actions. Text that says *not* to use a chemical ("no herbicide") is allowed.
- `get_site_strategies` always returns the `chemical_free` strategy, with methods from the WeedWise profiles. Sites where the user already sprays also get a plan to phase it out.
- WeedWise profiles list chemical options too. The KB summaries include only the non-chemical methods.
