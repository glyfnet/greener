---
name: greener-research
description: Use when the user wants local species, climate and soil data for their site, a research report. Needs a saved site profile.
---

# Site research

Implements FR-10–FR-16 and NFR-07.

1. Read `profile.yaml` (see *Site files*) and call `get_site`. If there is no location, run `/greener-new` first.
2. Call `ala_species_near` with the profile's `location` (default radius 10 km).
3. Call `ala_species_profile` for up to 10 key species: the most recorded native plants, and threatened species that fit the user's goals.
4. Call `weed_status` with the introduced and invasive species names. These are removal targets for hand weeding, never for spraying (D-17).
5. Call `vegetation_community` for the likely original Plant Community Type (FR-14). Name it in the report, cite it, and favour local natives that belong in it. Check each one with `check_species`. Call `soil_properties` for modelled pH, clay, sand and organic carbon (FR-13). Put the user's own soil answer first, and say the values are estimates. Call `climate_normals` for 1991–2020 temperature, rainfall and cold nights (FR-12), and cite Open-Meteo with its link wherever the values appear. Record each gap and do not estimate the values (FR-32).
6. Call `search_knowledge` with the site type, goals and region (`NSW`). Also search the user's own Project documents (FR-44).
7. If any call fails, record a data gap and continue. One failed service must not stop the run (NFR-07).
8. Write the report as a `ResearchReport` (see `docs/tool-reference.md`): key native plants, key fauna, threatened species, invasive species, data gaps and every citation (FR-15). Keep the citation IDs the tools returned on each species.
9. Call `save_research`. Fix any errors it returns. Save the result as `research.yaml`, exactly as the tool gives it (see *Site files*).
10. Explain the findings in plain English (NFR-18). Do not give locations of threatened species more precisely than ALA does (NFR-10).

## Site files

Greener's server keeps nothing (D-09), so the site files live with the user. Each step that saves a file follows these rules:

- **Local folder** (Claude Code, or a filesystem connector the user has set up in the desktop app): write the file into the user's site folder.
- **claude.ai Project:** Claude can't add files to a Project's knowledge. Create the file as a download, or show it in one `yaml` (or `markdown`) code block if file creation is off. Then tell the user, in one line: "Download `<file>` and add it to this Project's knowledge with **+**, replacing any older copy, so later chats can use it."
- **Reading:** look in the project knowledge, the chat and the local folder. If a file is missing, ask the user to upload or paste it. Don't start the site again without asking. An older site may have `.json` files; read them, and save YAML from now on.

See `docs/specification.md` Sections 4.2, 7.5 and 8.
