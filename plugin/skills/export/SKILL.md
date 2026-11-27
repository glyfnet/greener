---
name: export
description: Use when the user wants to export, download or save their Greener action plan as Markdown, YAML or PDF.
argument-hint: "[markdown|yaml]"
---

# Export

Implements FR-50 and FR-51.

1. Read the latest plan, `profile.yaml` and `research.yaml` (see *Site files*).
2. Call `export_plan` with the format the user asked for (markdown or yaml; markdown if they didn't say), plus the profile, research and start month, so the export includes the phases and the budget table (FR-50).
3. Save the result as Markdown (`.md`) or YAML (`.yaml`) (see *Site files*). Show the plan as Markdown in the chat. Don't make an HTML file or an HTML artifact (D-24).
4. For PDF (FR-51, should-have), offer to turn the Markdown into a PDF document.

## Site files

Greener's server keeps nothing (D-09), so the site files live with the user. Each step that saves a file follows these rules:

- **Local folder** (Claude Code, or a filesystem connector the user has set up in the desktop app): write the file into the user's site folder.
- **claude.ai Project:** Claude can't add files to a Project's knowledge. Create the file as a download, or show it in one `yaml` (or `markdown`) code block if file creation is off. Then tell the user, in one line: "Download `<file>` and add it to this Project's knowledge with **+**, replacing any older copy, so later chats can use it."
- **Reading:** look in the project knowledge, the chat and the local folder. If a file is missing, ask the user to upload or paste it. Don't start the site again without asking. An older site may have `.json` files; read them, and save YAML from now on.
