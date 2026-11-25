---
name: greener-add-docs
description: Use when the user wants to add their own documents or notes to their site's local knowledge base.
---

# Add documents

Implements FR-43.

This skill uses no MCP tools. The local KB is the user's own files (Claude
Project knowledge or a local folder), and it must never go to the server
(D-09, D-11).

1. Ask the user what to add: a file already in their Project, or a note
   to write down now.
2. For a new note, write it as a Markdown file and save it (see *Site
   files*). On claude.ai, the user adds it to the Project's knowledge with
   **+**. A file already in the Project needs nothing more. Keep items
   organised per site if the user manages more than one.
3. Confirm what was saved and remind the user that `/greener-ask` and
   `/greener-plan` will search this local KB alongside the global one, and
   will cite it by source (FR-44).

## Site files

Greener's server keeps nothing (D-09), so the site files live with the user. Each step that saves a file follows these rules:

- **Local folder** (Claude Code, or a filesystem connector the user has set up in the desktop app): write the file into the user's site folder.
- **claude.ai Project:** Claude can't add files to a Project's knowledge. Create the file as a download, or show it in one `yaml` (or `markdown`) code block if file creation is off. Then tell the user, in one line: "Download `<file>` and add it to this Project's knowledge with **+**, replacing any older copy, so later chats can use it."
- **Reading:** look in the project knowledge, the chat and the local folder. If a file is missing, ask the user to upload or paste it. Don't start the site again without asking. An older site may have `.json` files; read them, and save YAML from now on.

See `docs/specification.md` Section 4.5 (FR-43) and Section 7.5.
