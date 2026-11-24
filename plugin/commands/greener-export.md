---
description: Export the current action plan as Markdown or JSON
argument-hint: [markdown|json]
---

Read the latest plan in the user's Project and call `export_plan` with format
$ARGUMENTS (default markdown), plus the profile, research and start month so
the export includes phases and the budget table (FR-50). Save the result as a
Project file. For PDF (FR-51, should-have), offer to turn the Markdown into a PDF
document.
