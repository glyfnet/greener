# P-04: `save_*` tools validate and return data; Claude saves it

- Status: Proposed
- Date: 2026-11-24

## Context and problem

Section 7.2 names `save_profile`, `save_research` and `save_plan`, and says each validates and saves. D-09 says the server keeps no user data.

## Decision

The `save_*` tools validate the data, run the checks and return the canonical data with a file name (`profile.yaml`, `research.yaml`, `plans/v<n>.yaml`) and the exact YAML to save (D-24). The skill then saves that output with the user: in a local site folder, or as a download that the user adds to their Project's knowledge, because Claude can't add files there itself (Q-21). Tools that need site data (`get_site`, `search_site`, `get_plan_section`, `schedule_plan`, `export_plan`) take it as input in each call. The intake card carries the draft profile between `save_answer` calls.

Coordinates are rounded to 2 decimal places (about 1 km) before they go to ALA. Logs hold the tool name, duration and result only.

## Consequences

Tool inputs are larger, but no user data reaches server storage (NFR-09).
