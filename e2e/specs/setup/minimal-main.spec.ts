import "../../log-setup";

import { DIST_DIR, PLUGIN_ID } from "e2e/config";
import { getPluginHandleMap } from "e2e/obsidian-setup/helpers";
import type { VaultOptions } from "e2e/obsidian-setup/vault-manager";
import SandboxNotePlugin from "src/main";
import { VIEW_TYPE_HOT_SANDBOX } from "src/utils/constants";
import { delay, runCommandById } from "../../obsidian-commands/run-command";
import { expect, test } from "../../test-fixtures";
import { HotSandboxPage } from "./HotSandboxPage";

const vaultOptions: VaultOptions = {
	useSandbox: true,
	plugins: [{ pluginId: PLUGIN_ID, path: DIST_DIR }],
};

// --- Test Configuration ---
test.use({
	vaultOptions,
});

// --- Test Suite ---
test.describe("HotSandboxNoteView Main Features", () => {
	test.describe("1. Note Creation and Input", () => {
		test("should successfully create a new note and accept input", async ({
			vault,
		}) => {
			const hotSandbox = new HotSandboxPage(
				vault.window,
				vault.pluginHandleMap
			);
			const testContent = "Hello, Sandbox!";

			await hotSandbox.createNewSandboxNote(testContent);
			await hotSandbox.expectActiveTitle("*Hot Sandbox-1");
		});
	});

	test.describe("2. Content Synchronization Across Multiple Views", () => {
		test("should sync content when splitting the view", async ({
			vault,
		}) => {
			const hotSandbox = new HotSandboxPage(
				vault.window,
				vault.pluginHandleMap
			);
			const initialContent = "Initial content.";
			const updatedContent = "Updated and synced!";

			await hotSandbox.createNewSandboxNote(initialContent);
			await hotSandbox.splitVertically();
			await hotSandbox.expectSandboxViewCount(2);

			const rightPaneEditor = vault.window.locator(
				hotSandbox.activeEditor
			);
			await expect(rightPaneEditor).toHaveText(initialContent);

			await rightPaneEditor.focus();
			await hotSandbox.setActiveEditorContent(updatedContent);

			const leftPaneEditor = vault.window.locator(
				`.workspace-leaf.mod-active [data-type="${VIEW_TYPE_HOT_SANDBOX}"] [data-type="markdown"] .cm-content`
			);
			await expect(leftPaneEditor).toHaveText(updatedContent);
		});
	});

	test.describe("3. Multiple Independent Note Groups", () => {
		test("should allow creation of multiple independent sandbox notes", async ({
			vault,
		}) => {
			const hotSandbox = new HotSandboxPage(
				vault.window,
				vault.pluginHandleMap
			);
			const note1Content = "This is the first note.";
			const note2Content = "This is the second, separate note.";

			await hotSandbox.createNewSandboxNote(note1Content);
			await hotSandbox.expectActiveTitle("*Hot Sandbox-1");

			await hotSandbox.createNewSandboxNote(note2Content);
			await hotSandbox.expectActiveTitle("*Hot Sandbox-2");
			await hotSandbox.expectSandboxViewCount(2);

			expect(await hotSandbox.getActiveEditorContent()).toBe(
				note2Content
			);

			const firstNoteContent = await vault.window
				.locator(`${hotSandbox.allSandboxViews} .cm-content`)
				.first()
				.textContent();
			expect(firstNoteContent).toBe(note1Content);
		});
	});

	test.describe("4. Converting Note to File", () => {
		test("should successfully convert a hot sandbox note into a persistent file", async ({
			vault,
		}) => {
			const hotSandbox = new HotSandboxPage(
				vault.window,
				vault.pluginHandleMap
			);
			const noteContent = "This note will be converted to a file.";
			const fileName = "Untitled";
			const folderPath = "Adventurer";
			const expectedFile = `${folderPath}/${fileName}.md`;

			// Initial setup
			await hotSandbox.closeTab();
			await hotSandbox.expectTabCount(1);
			await hotSandbox.expectActiveTabType("empty");

			// Create sandbox note
			await hotSandbox.createNewSandboxNote(noteContent);
			await hotSandbox.expectTabCount(1);
			await hotSandbox.expectActiveTabType(VIEW_TYPE_HOT_SANDBOX);

			// Convert to file
			await hotSandbox.convertToFile(fileName, folderPath);
			await hotSandbox.expectActiveTabType("markdown");
			await hotSandbox.expectTabCount(1);

			// Verify file
			await hotSandbox.expectActiveTitleToContain(fileName);
			expect(await hotSandbox.fileExists(expectedFile)).toBeTruthy();
			expect(await hotSandbox.getActiveFileContent()).toBe(noteContent);

			// Go back to sandbox view
			await hotSandbox.goBackInHistory();
			await hotSandbox.expectActiveTabType(VIEW_TYPE_HOT_SANDBOX);
			expect(await hotSandbox.getActiveFileContent()).toBe("");

			// Close and create new
			await hotSandbox.closeTab();
			await hotSandbox.expectActiveTabType("empty");
			await hotSandbox.expectTabCount(1);

			await hotSandbox.createNewSandboxNote(noteContent);
			expect(await hotSandbox.getTabInnerTitle()).toBe("*Hot Sandbox-1");
		});
	});

	test.describe("5. Confirmation before closing the last tab", () => {
		test("should prompt confirmation before deleting the last sandbox note", async ({
			vault,
		}) => {
			const hotSandbox = new HotSandboxPage(
				vault.window,
				vault.pluginHandleMap
			);
			const { window: page } = vault;

			await hotSandbox.closeTab();
			await hotSandbox.createNewSandboxNote("test");

			expect(await hotSandbox.getActiveEditorContent()).toBe("test");
			await hotSandbox.expectActiveTabType(VIEW_TYPE_HOT_SANDBOX);

			// Try to close and decline
			await hotSandbox.closeTab();
			await expect(
				page.getByText("Delete Sandbox", { exact: true })
			).toBeVisible();
			await page.getByText("No", { exact: true }).click();
			await hotSandbox.expectActiveTabType(VIEW_TYPE_HOT_SANDBOX);

			// Try to close and confirm
			await hotSandbox.closeTab();
			await page.getByText("Yes", { exact: true }).click();
			await delay(100);
			await hotSandbox.expectActiveTabType("empty");

			// Undo close
			await hotSandbox.undoCloseTab();
			expect(await hotSandbox.getActiveEditorContent()).toBe("");
		});
	});

	test.describe("6. Toggle Source Mode", () => {
		test("should correctly toggle between Live Preview and Source Mode", async ({
			vault,
		}) => {
			const hotSandbox = new HotSandboxPage(
				vault.window,
				vault.pluginHandleMap
			);
			const CMD_TOGGLE_SOURCE = "editor:toggle-source";

			// Setup debug command
			const pluginHandle = await vault.pluginHandleMap.evaluateHandle(
				(map, [id]) => map.get(id) as SandboxNotePlugin,
				[PLUGIN_ID]
			);

			await pluginHandle.evaluate(
				(plugin, [cmdId]) => {
					plugin.addCommand({
						id: cmdId,
						name: "Toggle Source Mode",
						hotkeys: [{ key: "F1", modifiers: ["Alt"] }],
						callback: () => app.commands.executeCommandById(cmdId),
					});
				},
				[CMD_TOGGLE_SOURCE]
			);

			await hotSandbox.createNewSandboxNote("## test");
			await hotSandbox.expectActiveTabType(VIEW_TYPE_HOT_SANDBOX);
			await vault.window.locator(hotSandbox.activeEditor).focus();

			// Verify initial live preview mode
			await hotSandbox.expectSourceMode(true);

			// Toggle to source mode
			await runCommandById(vault.window, CMD_TOGGLE_SOURCE);
			await hotSandbox.expectSourceMode(false);

			// Toggle back to live preview
			await runCommandById(vault.window, CMD_TOGGLE_SOURCE);
			await hotSandbox.expectSourceMode(true);
		});
	});

	// Dedicated describe block for Test 7 to isolate the configuration override
	test.describe("7. Data Persistence After Reload", () => {
		test.use({
			vaultOptions: { ...vaultOptions, useSandbox: false },
		});

		test("should persist sandbox content after Obsidian reload when useSandbox is false", async ({
			vault,
			vaultOptions,
		}) => {
			const hotSandbox = new HotSandboxPage(
				vault.window,
				vault.pluginHandleMap
			);
			const persistentContent =
				"This content should persist after reload.";

			// Create sandbox note with content
			await hotSandbox.createNewSandboxNote(persistentContent);
			await hotSandbox.expectActiveTitle("*Hot Sandbox-1");
			expect(await hotSandbox.getActiveEditorContent()).toBe(
				persistentContent
			);

			// Reload Obsidian
			await vault.window.reload();
			await hotSandbox.waitForLayoutReady();

			// Verify content persists
			const reloadedWindow = vault.electronApp.windows().at(-1)!;
			const reloadedHotSandbox = new HotSandboxPage(
				reloadedWindow,
				await getPluginHandleMap(
					reloadedWindow,
					vaultOptions.plugins || []
				)
			);
			await expect(
				vault.window.locator(reloadedHotSandbox.activeSandboxView)
			).toBeVisible();
			expect(await reloadedHotSandbox.getActiveEditorContent()).toBe(
				persistentContent
			);
			await reloadedHotSandbox.expectActiveTitle("*Hot Sandbox-1");
		});
	});
});
