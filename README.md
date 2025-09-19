# Sandbox Note for Obsidian

A simple, temporary scratchpad for your quick thoughts and ideas.

This plugin gives you a special "sandbox" note. Anything you write here is **not** saved to a file in your vault. It's a safe place to write messy notes without cluttering your workspace.

> **Important**: All sandbox notes share the same content. If you open multiple sandbox tabs, they will all show the same text and update in real-time.

![Demo Image](assets/demo.png)

## How It Works

-   **No Files Created**: Write freely without creating new `.md` files in your vault.
-   **A Familiar Editor Experience**: Enjoy an editing experience that feels almost identical to Obsidian's native editor. While it supports most core features like Markdown, links, and commands, some complex plugin interactions may not work as expected.
-   **Safe for Your Session**: Your content is kept safe as long as Obsidian is running. If you close a sandbox tab by accident, just open a new one to get your text back.

## How to Use

-   Click the file icon in the ribbon to open a new sandbox note.
-   Or, use the Command Palette (`Ctrl/Cmd+P`) and search for "Open sandbox note".

---

## ⚠️ Risks and Limitations

To provide this editor experience, this plugin needs to use some of Obsidian's internal (undocumented) APIs. Please be aware of the following risks:

-   **Future Obsidian updates might break this plugin.** Since the APIs are not official, the plugin could stop working after an Obsidian update. We will do our best to fix it, but we cannot guarantee it will always work.
-   **This plugin is provided "as is".** Please use it at your own risk.

We value transparency and want you to understand how the plugin works.

---

## Optional: Auto-Save Feature

You can turn on an "auto-save" option in the plugin settings.

-   **What it does**: When enabled, the content of your sandbox note is saved inside the plugin's own settings file (`data.json`). This happens when you switch to another tab or close the note.
-   **Why use it?**: This allows your sandbox content to be restored even after you restart Obsidian.
-   **Note**: This feature still does **not** create any `.md` files in your vault.

## Installation

1.  Open Obsidian's **Settings**.
2.  Go to **Community plugins** and turn off **Restricted mode**.
3.  Click **Browse** to search for community plugins.
4.  Search for "**Sandbox Note**".
5.  Click **Install**, and then click **Enable**.

## Acknowledgements

The concept for this plugin was partly inspired by the excellent [obsidian-lineage](https://github.com/ycnmhd/obsidian-lineage) plugin by ycnmhd.
