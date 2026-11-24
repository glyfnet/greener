---
name: site-research
description: Use when the user wants local species, climate and soil data for their site, a research report, or runs /greener-research. Needs a saved site profile.
---

# Site research

Implements FR-10–FR-16 and NFR-07.

1. Read `profile.json` from the user's Project and call `get_site`. If there is no location, run `site-intake` first.
2. Call `ala_species_near` with the profile's `location` (default radius 10 km).
3. Call `ala_species_profile` for up to 10 key species: the most recorded native plants, and threatened species that fit the user's goals.
4. Call `weed_status` with the introduced and invasive species names. These are removal targets for hand weeding, never for spraying (D-17).
5. Call `climate_normals`, `soil_properties` and `vegetation_community`. These sources are still being checked, so they return data gaps. Record each gap and do not estimate the values (FR-32).
6. Call `search_knowledge` with the site type, goals and region (`NSW`). Also search the user's own Project documents (FR-44).
7. If any call fails, record a data gap and continue. One failed service must not stop the run (NFR-07).
8. Write the report as a `ResearchReport` (see `docs/tool-reference.md`): key native plants, key fauna, threatened species, invasive species, data gaps and every citation (FR-15). Keep the citation IDs the tools returned on each species.
9. Call `save_research`. Fix any errors it returns. Save the result as `research.json` in the Project.
10. Explain the findings in plain English (NFR-18). Do not give locations of threatened species more precisely than ALA does (NFR-10).

See `docs/specification.md` Sections 4.2 and 8.
