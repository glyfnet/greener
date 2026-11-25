# Installing Greener

This guide is for people who want to use Greener to plan biodiversity on their own land. You don't need to install anything on your computer. Greener runs inside Claude. For how to use it once it's installed, see the [user guide](user-guide.md).

Menu names below come from Claude's help pages, checked on 25 November 2026. Claude's screens change from time to time, so if a name doesn't match, look for the nearest equivalent.

## What you need

- A Claude account at [claude.ai](https://claude.ai). You can use the web, the desktop app or the mobile app.
- For the full Greener plugin, with its guided `/greener-…` commands, you need a **paid plan**: Pro, Max, Team or Enterprise. Claude's help page lists plugins for paid plans only.
- On the **Free** plan you can still add the Greener *connector* (see [Option B](#option-b-connector-only-any-plan)). You get Greener's data and checks, but not the guided commands.

Greener is free. It has no account, no sign-in and no API key.

## Option A: install the plugin (paid plans, recommended)

The plugin gives you the guided commands (`/greener-new`, `/greener-plan` and the others) and connects to the Greener server for you.

1. Download the latest `greener-plugin-<version>.zip` from the [Greener releases page](https://github.com/glyfnet/greener/releases). Don't unzip it.
2. In Claude, open **Customize → Plugins**.
3. Select **Add**, then **Upload plugin**, and choose the zip file.
4. Check that Greener is listed and turned on.

If you'd rather get updates from GitHub, you can add Greener's marketplace instead of uploading a zip. In **Customize → Plugins**, select **Add → Add marketplace**, enter `glyfnet/greener`, then install **greener** from it.

> TODO: the repository is private for now. Until it's public, the releases page and the marketplace won't open for other people. Ask the maintainer for the zip file.

**If the commands don't appear:** Greener's commands are skills, and Claude says skills need code execution. Open **Settings → Capabilities** and turn on **Code execution and file creation** (newer screens call it **Create and edit files**).

## Option B: connector only (any plan)

Use this if you're on the Free plan, or if you only want Greener's tools without the guided commands.

1. In Claude, open **Customize → Connectors**.
2. Select **+ Add**, then **Add custom connector**.
3. For the name, enter `Greener`. For the URL, enter the Greener server address:

   `https://greener-production.eric-c93.workers.dev/mcp`

   > TODO: this address starts working at the first release, when the production Worker is deployed.

4. Select **Continue**. Under **Authentication**, choose **No sign in**, because Greener has no accounts.
5. Select **Add**.

The Free plan allows one custom connector.

Without the plugin, there are no `/greener-…` commands. Ask in plain words instead, for example: *"Use Greener to help me plan native plantings for my backyard in Armidale."*

## Team and Enterprise plans

An organisation Owner has to add Greener first:

- **Plugin:** an Owner decides which plugin sources members can add. Ask them to allow Greener, or to upload it for the organisation.
- **Connector:** an Owner adds it under **Organization settings → Connectors → Add → Custom → Web**, with the same name and URL as in Option B. Each member then opens **Customize → Connectors**, finds Greener, and selects **Connect**.

## Claude Code (developers and power users)

In Claude Code, type:

```text
/plugin marketplace add glyfnet/greener
/plugin install greener@greener-marketplace
```

To update it, open `/plugin`, go to the **Installed** tab, select Greener and choose **Update now**. Third-party marketplaces don't update on their own.

## Set up your site

1. **Make a Project for your site.** Go to [claude.ai/projects](https://claude.ai/projects) and select **+ New Project**. Name it after your site, for example "Backyard, Uralla". Greener saves your answers and plans in this Project. The Greener server keeps nothing ([privacy](privacy.md)).
2. **Turn on web search**, so Claude can open the guides that Greener links to. TODO: check the current setting name in Claude's help.
3. **Make sure Greener is on in the chat.** Select **+** at the bottom left, go to **Connectors**, and check that Greener is turned on.
4. **Start:** type `/greener-new`. Claude asks about 20 short questions about your site. Then go on with the [user guide](user-guide.md).

## Mobile

Set Greener up on the web or in the desktop app first. Claude says that services you connect there are available in the mobile app the next time you log in. Adding connectors from the mobile app is still in beta.

## Remove Greener

- **Plugin:** open **Customize → Plugins**, open Greener, then use the **Disable plugin** toggle, or choose **Remove** from the menu.
- **Connector:** open **Customize → Connectors** and choose **Remove**.
- **Claude Code:** open `/plugin`, go to the **Installed** tab, select Greener and choose **Uninstall**.

Removing Greener doesn't delete your Project. Your answers and plans stay in your Claude account until you delete them.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| `/greener-new` doesn't appear when you type `/` | Check the plugin is turned on, and that **Code execution and file creation** is on. |
| Claude says it can't reach Greener | Check Greener is on in the chat's **+ → Connectors** menu. If it still fails, the server may be down for a while, so try again later. |
| An answer says "data gap" | Greener couldn't get that data, for example because your site is outside NSW or a public data service didn't answer. This is expected, and Greener won't guess. |
| Something else | Open an issue on the [GitHub repository](https://github.com/glyfnet/greener/issues). |

## Sources

- [Getting started with custom connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
- [Use connectors](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities)
- [Use plugins in Claude](https://support.claude.com/en/articles/13837440-use-plugins-in-claude)
- [Using skills in Claude](https://support.claude.com/en/articles/12512180-using-skills-in-claude)
- [Create and manage Projects](https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects)
- [Claude Code: discover and install plugins](https://code.claude.com/docs/en/plugins/install.md)
