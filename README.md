# Sandbox Note for Obsidian

A simple, temporary spot for your quick thoughts.

This plugin gives you a special "Sandbox Note." Write anything you want here; it's **not** saved as a regular file in your vault. It's a clean space for messy notes without clutter.

> **Important**: Each Sandbox Note tab is independent by default. However, you can open the same note in multiple tabs, and they will sync content automatically.

![Demo Image](assets/demo.png)

## How It Works

This plugin offers a flexible temporary note-taking experience:

*   **Ephemeral by Default**: Each new sandbox note you open is a fresh, empty scratchpad. Its content persists across Obsidian restarts but is separate from other notes.
*   **Synced Tabs (Optional)**: If you open the same sandbox note (e.g., using "Open in new tab"), the content will be synchronized across all tabs for that specific note.
*   **Persistent Storage**: Note contents are automatically saved in the plugin's local database (IndexedDB), ensuring your temporary thoughts aren't lost when you close Obsidian.
*   **No Files Created**: Write freely without creating new `.md` files in your vault, keeping your file explorer clean.
*   **Familiar Editor**: Works just like Obsidian's own markdown editor, supporting markdown, links, and commands.

## How to Use

*   Click the ribbon icon (flame icon) to open a new **Sandbox Note**.
*   Or, use the Command Palette (`Ctrl/Cmd+P`) and search for "Open new hot sandbox note."
*   You can manually save your Sandbox Note with `Ctrl+S` (or `Cmd+S`) if enabled in settings.

---

## ⚠️ Risks and Limitations

This plugin uses some of Obsidian's internal tools to work. Please know:

*   **Obsidian updates might break it.** We'll try to fix issues, but can't promise it will always work.
*   **Use at your own risk.**

We want you to understand how it works.

---

## Auto-Save

You can turn on an "auto-save" option in the plugin settings.

*   **What it does**: Your Sandbox Note content saves itself automatically in the plugin's local database. This happens shortly after you stop typing.
*   **Why use it?**: Your Sandbox Note content will be there even after you restart Obsidian.
*   **Still no `.md` files**: This feature still does **not** create any `.md` files in your vault.

## Installation

1.  Open Obsidian's **Settings**.
2.  Go to **Community plugins** and turn off **Restricted mode**.
3.  Click **Browse** to find community plugins.
4.  Search for "**Sandbox Note**".
5.  Click **Install**, then **Enable**.

## Acknowledgements

The idea for this plugin was partly inspired by the [obsidian-lineage](https://github.com/ycnmhd/obsidian-lineage) plugin by ycnmhd.
