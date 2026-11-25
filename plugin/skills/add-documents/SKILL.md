---
name: greener-add-docs
description: Use when the user wants to add their own documents or notes to their site's local knowledge base.
---

# Add documents

Implements FR-43.

This skill uses no MCP tools — it reads and writes directly in the user's
own Claude Project files, because the local KB must never go to the
server (D-09, D-11).

1. Ask the user what to add: a file already in their Project, or a note
   to write down now.
2. Save or update the item directly as a Project file. Keep it organised
   per site if the user manages more than one.
3. Confirm what was saved and remind the user that `/greener-ask` and
   `/greener-plan` will search this local KB alongside the global one, and
   will cite it by source (FR-44).

See `docs/specification.md` Section 4.5 (FR-43) and Section 7.5.
