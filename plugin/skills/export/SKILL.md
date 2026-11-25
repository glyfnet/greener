---
name: greener-export
description: Use when the user wants to export, download or save their Greener action plan as Markdown, YAML or PDF.
argument-hint: "[markdown|yaml]"
---

# Export

Implements FR-50 and FR-51.

1. Read the latest plan, `profile.yaml` and `research.yaml` in the user's Project.
2. Call `export_plan` with the format the user asked for (markdown or yaml; markdown if they didn't say), plus the profile, research and start month, so the export includes the phases and the budget table (FR-50).
3. Save the result as a Project file: Markdown (`.md`) or YAML (`.yaml`). Show the plan as Markdown in the chat. Don't make an HTML file or an HTML artifact (D-24).
4. For PDF (FR-51, should-have), offer to turn the Markdown into a PDF document.
