---
name: site-intake
description: Use when the user wants to start a new Greener site, change an answer about their site, load site answers from a file, or runs /greener-new. Builds the site profile with the standard question bank.
---

# Site intake

Implements FR-01–FR-09, FR-10a, FR-10b. The server keeps nothing (D-09): pass the profile in every call and keep the profile each tool returns.

1. Check that web access is on, because later steps read live guide pages (FR-46). If it is off, ask the user to turn it on.
2. If the user gave a JSON or YAML answers file, convert it to a profile and go to step 7 (FR-05).
3. Call `ask_question` once, with no `questionId`. Hosts with MCP Apps show one question card with buttons, and that card runs the whole questionnaire: it saves each answer and shows the next question itself.
   - While the card is open, don't repeat the question or its options in chat, and don't call `ask_question` or `save_answer` again, because each call adds another card. Say one short line, such as "Answer in the card above", and wait.
   - When the card finishes, it sends a message that holds the whole profile as JSON. Use that profile for step 7. If a message says all questions are answered but holds no profile, ask the user to reload the card or answer the missing questions in chat. Never fill in answers yourself.
   - If the host can't show cards (for example a terminal), or the user says no card appeared, ask in chat with the numbered list from the result text and take a number as the answer (FR-09).
4. When the user answers in chat (no card), call `save_answer` with the profile so far, the `questionId` and the answer: `{ optionIds }`, `{ other: "text" }` or `{ notSure: true }`. The result gives the updated profile and the next question as a numbered list.
5. Location (question 1): with "Use my location", pass `location` to `save_answer`. For a typed NSW street address, split it into `address` fields (house number, road name, road type, suburb or postcode) and call `geocode`. If several addresses match, ask which one. Suburb-only lookup is not available yet, so if the user gives only a suburb, ask for the street address, their current location, or latitude and longitude (FR-02). The plan keeps the suburb, not the street address.
6. Bushfire-prone land: on *Not sure*, call `bushfire_status`. Tell the user the result and that the council's map is authoritative. When they confirm, save the suggested answer and keep the citation for the report (FR-03). If the lookup fails, the status stays unknown. Never guess it.
7. Call `save_profile` with the whole profile. If it returns errors, fix them and call it again. Ask up to 3 of the `followUps` it returns (FR-04).
8. Save the returned profile as `profile.json` in the user's Project. Tell the user what is still missing.
9. To change one answer later, read `profile.json`, call `save_answer` for that question only, then `save_profile` again (FR-06).

Question 11 (sprays) records what the user does now. Greener plans are chemical-free (D-17). If the user sprays, the plan will include steps to phase it out, so say this kindly and without judgement.

Detailed mode (FR-10a): if the user wants exact values, set `profile.mode` to `"detailed"` and fill `profile.detailed` (hours for each season, exact budgets, area in m²).

See `docs/specification.md` Sections 4.1 and 7.3.
