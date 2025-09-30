import "../../log-setup";

// src/e2e/specs/main-features.spec.ts

import type { Page } from "@playwright/test";
import { DIST_DIR, PLUGIN_ID } from "e2e/config";
import type { VaultPageTextContext } from "e2e/obsidian-setup/setup";
import SandboxNotePlugin from "src/main";
import { VIEW_TYPE_HOT_SANDBOX } from "src/utils/constants";
import {
	CONVERT_HOT_SANDBOX_TO_FILE,
	OPEN_HOT_SANDBOX,
	runCommand,
} from "../../obsidian-commands/run-command";
import { expect, test } from "../../test-fixtures";

// --- Constants Definition ---
const DATA_TYPE_HOT_SANDBOX = `[data-type="${VIEW_TYPE_HOT_SANDBOX}"]`;
const DATA_TYPE_MARKDOWN = `[data-type="markdown"]`;
const ACTIVE_SANDBOX_VIEW_SELECTOR = `.workspace-leaf.mod-active > .workspace-leaf-content${DATA_TYPE_HOT_SANDBOX}`;
const ACTIVE_LEAF_SELECTOR = ".workspace-leaf.mod-active";
const ACTIVE_EDITOR_SELECTOR = `${ACTIVE_LEAF_SELECTOR} .cm-content`;
// const ACTIVE_TITLE_SELECTOR = `${ACTIVE_LEAF_SELECTOR} > .workspace-leaf-content > .view-header .view-header-title`;
const ACTIVE_TITLE_SELECTOR = `.workspace-tab-header.mod-active${DATA_TYPE_HOT_SANDBOX}`;
const ACTIVE_MARKDOWN_VIEW_SELECTR = `${ACTIVE_LEAF_SELECTOR} > .workspace-leaf-content${DATA_TYPE_MARKDOWN}`;

// const ACTIVE_SANDBOX_TITLE_SELECTOR = `${ACTIVE_SANDBOX_VIEW_SELECTOR} > .view-header`;

// --- Test Configuration ---
// For this test suite, we use a sandbox Vault with the plugin enabled.
test.use({
	vaultOptions: {
		useSandbox: true,
		plugins: [
			{
				pluginId: PLUGIN_ID,
				path: DIST_DIR,
			},
		], // Path to the built plugin
		enablePlugins: true,
	},
});

// --- Helper Functions ---

/**
 * Executes the command to create a new Hot Sandbox Note and optionally inputs text.
 * @param page Playwright Page object
 * @param content The text to input (optional)
 */
async function createNewSandboxNote(page: Page, content?: string) {
	await runCommand(page, OPEN_HOT_SANDBOX);
	await expect(
		page.locator(ACTIVE_SANDBOX_VIEW_SELECTOR).last()
	).toBeVisible();
	if (content) {
		await page.locator(ACTIVE_EDITOR_SELECTOR).focus();
		await page.keyboard.type(content);
		await expect(page.locator(ACTIVE_EDITOR_SELECTOR)).toHaveText(content);
	}
}

function getSandboxPlugin(
	pluginHandleMap: VaultPageTextContext["pluginHandleMap"]
) {
	return pluginHandleMap.evaluateHandle(
		(pluginHandleMap, [PLUGIN_ID]) => {
			return pluginHandleMap.get(PLUGIN_ID) as SandboxNotePlugin;
		},
		[PLUGIN_ID]
	);
}

/**
 * Retrieves the content of the currently active editor.
 * @param pluginHandleMap Playwright Page object
 * @returns The editor content string
 */
async function getActiveEditorContent(
	pluginHandleMap: VaultPageTextContext["pluginHandleMap"]
): Promise<string> {
	const pluginHandle = await getSandboxPlugin(pluginHandleMap);
	return pluginHandle.evaluate((plugin) => {
		const activeView = plugin.orchestrator.getActiveView();
		if (activeView) return activeView.getContent();
		throw new Error("failed to get active editor");
	});
}

// --- Test Suite ---

test.describe("HotSandboxNoteView Main Features", () => {
	test("1. Note Creation and Input", async ({ vault }) => {
		const { window: page } = vault;
		const testContent = "Hello, Sandbox!";

		// 1. Create a new sandbox note
		await createNewSandboxNote(page);

		// 2. Input text into the editor
		await page.locator(ACTIVE_EDITOR_SELECTOR).focus();
		await page.keyboard.type(testContent);

		// 3. Verify the input text exists in the editor
		await expect(page.locator(ACTIVE_EDITOR_SELECTOR)).toHaveText(
			testContent
		);

		// await page.pause();
		// 4.Verify that "*" appears in the tab title *after* content is added.
		await expect(page.locator(ACTIVE_TITLE_SELECTOR)).toHaveText(
			"*Hot Sandbox-1"
		);
	});

	test("2. Content Synchronization Across Multiple Views", async ({
		vault,
	}) => {
		const { window: page, pluginHandleMap } = vault;
		const initialContent = "Initial content.";
		const updatedContent = "Updated and synced!";

		// 1. Create the initial note
		await createNewSandboxNote(page, initialContent);

		// 2. Split the screen vertically
		await page.evaluate(() =>
			app.workspace.duplicateLeaf(app.workspace.activeLeaf!, "vertical")
		);

		await expect(
			page.locator(
				ACTIVE_SANDBOX_VIEW_SELECTOR.replace(".mod-active", "")
			)
		).toHaveCount(2);

		// 3. Verify the new (right) pane after splitting has the same content
		const rightPaneEditor = page.locator(ACTIVE_EDITOR_SELECTOR);
		await expect(rightPaneEditor).toHaveText(initialContent);

		// 4. Update the content of the right pane
		await rightPaneEditor.focus();
		await pluginHandleMap.evaluate(
			(map, [content, id]) => {
				const plugin = map.get(id) as SandboxNotePlugin;
				plugin.orchestrator.getActiveView()?.setContent(content);
			},
			[updatedContent, PLUGIN_ID]
		);

		// await page.pause();
		// 5. Verify the content of the left pane is also synchronized and updated
		const leftPaneEditor = page.locator(
			`.workspace-leaf.mod-active ${DATA_TYPE_HOT_SANDBOX}  ${DATA_TYPE_MARKDOWN} .cm-content`
		);
		await expect(leftPaneEditor).toHaveText(updatedContent);
	});

	test("3. Multiple Independent Note Groups", async ({ vault }) => {
		const { window: page } = vault;
		const note1Content = "This is the first note.";
		const note2Content = "This is the second, separate note.";

		// 1. Create the first note group
		await createNewSandboxNote(page, note1Content);
		await expect(page.locator(ACTIVE_TITLE_SELECTOR)).toHaveText(
			"*Hot Sandbox-1"
		);

		// 2. Create a second, independent note group
		await createNewSandboxNote(page, note2Content);
		await expect(page.locator(ACTIVE_TITLE_SELECTOR)).toHaveText(
			"*Hot Sandbox-2"
		);
		await expect(
			page.locator(
				ACTIVE_SANDBOX_VIEW_SELECTOR.replace(".mod-active", "")
			)
		).toHaveCount(2);

		// 3. Verify the content of the second note is correct (currently active)
		expect(await getActiveEditorContent(vault.pluginHandleMap)).toBe(
			note2Content
		);

		// 4. Verify the content of the first note has not changed (inactive leaf)
		const firstNoteContent = await page
			.locator(
				`${ACTIVE_SANDBOX_VIEW_SELECTOR.replace(
					".mod-active",
					""
				)} .cm-content`
			)
			.first()
			.textContent();
		expect(firstNoteContent).toBe(note1Content);
	});

	test("4. Converting Note to File", async ({ vault }) => {
		const { window: page } = vault;
		const noteContent = "This note will be converted to a file.";
		const expectedFileName = "Untitled";
		const expectedPath = "Notes/Daily";

		// 1. Create the note to be converted
		await createNewSandboxNote(page, noteContent);

		// 2. Execute the "Convert to file" command
		await runCommand(page, CONVERT_HOT_SANDBOX_TO_FILE);

		await page
			.getByPlaceholder(`e.g., My Scratchpad`, {
				exact: true,
			})
			.fill(expectedFileName);

		const folderInputEl = await page.getByPlaceholder(`e.g., Notes/Daily`, {
			exact: true,
		});
		await folderInputEl.fill(expectedPath);
		await folderInputEl.blur();

		await page.getByText("Save", { exact: true }).click();

		// 3. Verify the sandbox note view is closed
		await expect(
			page.locator(ACTIVE_MARKDOWN_VIEW_SELECTR)
		).not.toBeVisible();

		// 4. Verify a new Markdown file tab is opened
		await expect(page.locator(ACTIVE_MARKDOWN_VIEW_SELECTR)).toBeVisible();

		// 5. Verify the newly opened file name and content are correct
		await expect(
			page.locator(
				ACTIVE_TITLE_SELECTOR.replace(DATA_TYPE_HOT_SANDBOX, "")
			)
		).toContainText(expectedFileName);

		const expectedFile = `${expectedPath}/${expectedFileName}.md`;

		expect(
			await page.evaluate((expectedFile) => {
				app.vault.adapter.exists(expectedFile);
			}, expectedFile)
		);

		// Assuming the active view is now a standard Markdown editor
		const fileContent = await page.evaluate(() =>
			app.workspace.activeEditor?.editor?.getValue()
		);
		expect(fileContent).toBe(noteContent);

		await expect(
			page.locator(`${ACTIVE_LEAF_SELECTOR} ${DATA_TYPE_MARKDOWN}`)
		).toBeVisible();

		await page.evaluate(async () => {
			await app.workspace.activeLeaf?.history.back();
		});

		await expect(
			page.locator(`${ACTIVE_LEAF_SELECTOR} ${DATA_TYPE_HOT_SANDBOX}`)
		).toBeVisible();

		const sandboxNoteContent = await page.evaluate(() =>
			app.workspace.activeEditor?.editor?.getValue()
		);

		expect(sandboxNoteContent).toBe("");

		await createNewSandboxNote(page, noteContent);

		expect(
			await page.evaluate(
				() =>
					app.workspace.activeLeaf?.tabHeaderInnerTitleEl.textContent
			)
		).toBe("Hot Sandbox-1");
	});

	/*
    // --- Feature specified but not yet implemented ---
    test.skip("5. Confirmation before closing the last tab", async () => {
        // This feature is mentioned in the specifications, but the current codebase
        // does not implement the logic to show a confirmation dialog when closing
        // the last tab of a Hot Sandbox group.
        // Therefore, this test is skipped.
    });
    */
});
