---
name: site-intake
description: Use when the user wants to start a new Greener site, change an answer about their site, load site answers from a file, or runs /greener-new. Builds the site profile with the standard question bank.
---

# Site intake

Implements FR-01–FR-09, FR-10a, FR-10b. The server keeps nothing (D-09): pass the profile in every call and keep the profile each tool returns.

1. Check that web access is on, because later steps read live guide pages (FR-46). If it is off, ask the user to turn it on.
2. If the user gave a JSON or YAML answers file, convert it to a profile and go to step 7 (FR-05).
3. Call `ask_question` with no `questionId` to get the next question. Hosts with MCP Apps show a card with buttons. Otherwise show the numbered list from the result text, and take a number as the answer (FR-09).
4. When the user answers in chat, call `save_answer` with the profile so far, the `questionId` and the answer: `{ optionIds }`, `{ other: "text" }` or `{ notSure: true }`. The result gives the updated profile and the next question. When the card is used, it calls `save_answer` itself, and you receive the profile as context.
5. Location (question 1): with "Use my location", pass `location` to `save_answer`. With a typed suburb or postcode, call `geocode` with `query`. Address lookup is not available yet, so ask for the user's current location or for latitude and longitude, then call `geocode` with `lat` and `lon` (FR-02).
6. Bushfire-prone land: on *Not sure*, call `bushfire_status`. Tell the user the result and that the council's map is authoritative. When they confirm, save the suggested answer and keep the citation for the report (FR-03). If the lookup fails, the status stays unknown. Never guess it.
7. Call `save_profile` with the whole profile. If it returns errors, fix them and call it again. Ask up to 3 of the `followUps` it returns (FR-04).
8. Save the returned profile as `profile.json` in the user's Project. Tell the user what is still missing.
9. To change one answer later, read `profile.json`, call `save_answer` for that question only, then `save_profile` again (FR-06).

Question 11 (sprays) records what the user does now. Greener plans are chemical-free (D-17). If the user sprays, the plan will include steps to phase it out, so say this kindly and without judgement.

Detailed mode (FR-10a): if the user wants exact values, set `profile.mode` to `"detailed"` and fill `profile.detailed` (hours for each season, exact budgets, area in m²).

See `docs/specification.md` Sections 4.1 and 7.3.
