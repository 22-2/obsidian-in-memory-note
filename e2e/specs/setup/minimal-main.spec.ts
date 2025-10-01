import "../../log-setup";

import type { Page } from "@playwright/test";
import { DIST_DIR, PLUGIN_ID } from "e2e/config";
import { getPluginHandleMap } from "e2e/obsidian-setup/helpers";
import type { VaultPageTextContext } from "e2e/obsidian-setup/setup";
import type { VaultOptions } from "e2e/obsidian-setup/vault-manager";
import SandboxNotePlugin from "src/main";
import { VIEW_TYPE_HOT_SANDBOX } from "src/utils/constants";
import {
	CMD_CLOSE_CURRENT_TAB,
	CMD_UNDO_CLOSE_TAB,
	CONVERT_HOT_SANDBOX_TO_FILE,
	OPEN_HOT_SANDBOX,
	delay,
	runCommand,
	runCommandById,
} from "../../obsidian-commands/run-command";
import { expect, test } from "../../test-fixtures";

// --- Test Configuration ---
test.use({
	vaultOptions: {
		useSandbox: true,
		plugins: [{ pluginId: PLUGIN_ID, path: DIST_DIR }],
	},
});

type ViewType = "markdown" | typeof VIEW_TYPE_HOT_SANDBOX;

// --- Page Object ---
class HotSandboxPage {
	private readonly ACTIVE_LEAF = ".workspace-leaf.mod-active";
	private readonly ACTIVE_TAB_HEADER =
		".workspace-tab-header.mod-active.is-active";

	constructor(
		private page: Page,
		private pluginHandleMap: VaultPageTextContext["pluginHandleMap"]
	) {}

	// Selector Helpers
	private getDatatype(viewType: string) {
		return `[data-type="${viewType}"]`;
	}

	private getActiveView(type: ViewType) {
		return `${this.ACTIVE_LEAF} > .workspace-leaf-content${this.getDatatype(
			type
		)}`;
	}

	private getActiveTitle(type: ViewType) {
		return `${this.ACTIVE_TAB_HEADER}${this.getDatatype(type)}`;
	}

	// Selectors
	get activeSandboxView() {
		return this.getActiveView(VIEW_TYPE_HOT_SANDBOX);
	}

	get activeMarkdownView() {
		return this.getActiveView("markdown");
	}

	get activeEditor() {
		return `${this.ACTIVE_LEAF} .cm-content`;
	}

	get activeSandboxTitle() {
		return this.getActiveTitle(VIEW_TYPE_HOT_SANDBOX);
	}

	get activeMarkdownTitle() {
		return this.getActiveTitle("markdown");
	}

	get allSandboxViews() {
		return this.activeSandboxView.replace(".mod-active", "");
	}

	async rebuildReferences(vaultOptions: VaultOptions) {
		this.pluginHandleMap = await getPluginHandleMap(
			this.page,
			vaultOptions.plugins || []
		);
	}

	// Actions
	async createNewSandboxNote(content?: string) {
		await runCommand(this.page, OPEN_HOT_SANDBOX);
		await expect(
			this.page.locator(this.activeSandboxView).last()
		).toBeVisible();

		if (content) {
			await this.typeInActiveEditor(content);
		}
	}

	async typeInActiveEditor(content: string) {
		const editor = this.page.locator(this.activeEditor);
		await editor.focus();
		await this.page.keyboard.type(content);
		await expect(editor).toHaveText(content);
	}

	async getActiveEditorContent(): Promise<string> {
		const pluginHandle = await this.getSandboxPlugin();
		return pluginHandle.evaluate((plugin) => {
			const activeView = plugin.orchestrator.getActiveView();
			if (!activeView) throw new Error("No active editor found");
			return activeView.getContent();
		});
	}

	async setActiveEditorContent(content: string) {
		await this.pluginHandleMap.evaluate(
			(map, [content, id]) => {
				const plugin = map.get(id) as SandboxNotePlugin;
				plugin.orchestrator.getActiveView()?.setContent(content);
			},
			[content, PLUGIN_ID]
		);
	}

	async splitVertically() {
		await this.page.evaluate(() =>
			app.workspace.duplicateLeaf(app.workspace.activeLeaf!, "vertical")
		);
	}

	async convertToFile(fileName: string, folderPath: string) {
		await runCommand(this.page, CONVERT_HOT_SANDBOX_TO_FILE);

		await this.page
			.getByPlaceholder("e.g., My Scratchpad", { exact: true })
			.fill(fileName);

		const folderInput = this.page.getByPlaceholder("e.g., Notes/Daily", {
			exact: true,
		});
		await folderInput.fill(folderPath);
		await folderInput.blur();

		await this.page.getByText("Save", { exact: true }).click();
	}

	async closeTab() {
		await runCommand(this.page, CMD_CLOSE_CURRENT_TAB);
	}

	async undoCloseTab() {
		await runCommand(this.page, CMD_UNDO_CLOSE_TAB);
	}

	async goBackInHistory() {
		await this.page.evaluate(async () => {
			await app.workspace.activeLeaf?.history.back();
		});
	}

	async fileExists(path: string): Promise<boolean> {
		return this.page.evaluate((p) => app.vault.adapter.exists(p), path);
	}

	async getActiveFileContent(): Promise<string | undefined> {
		return this.page.evaluate(() =>
			app.workspace.activeEditor?.editor?.getValue()
		);
	}

	async getTabInnerTitle(): Promise<string | null | undefined> {
		return this.page.evaluate(
			() => app.workspace.activeLeaf?.tabHeaderInnerTitleEl.textContent
		);
	}

	// Assertions
	async expectSandboxViewCount(count: number) {
		await expect(this.page.locator(this.allSandboxViews)).toHaveCount(
			count
		);
	}

	async expectActiveTitle(title: string) {
		await expect(this.page.locator(this.activeSandboxTitle)).toHaveText(
			title
		);
	}

	async expectActiveTitleToContain(text: string) {
		await expect(this.page.locator(this.activeMarkdownTitle)).toContainText(
			text
		);
	}

	async expectActiveTabType(type: string) {
		await expect(this.page.locator(this.ACTIVE_TAB_HEADER)).toHaveAttribute(
			"data-type",
			type
		);
	}

	async expectTabCount(count: number) {
		await expect(
			this.page.locator(".mod-root .workspace-tab-header-container-inner")
		).toHaveCount(count);
	}

	async expectSourceMode(isLivePreview: boolean) {
		const sourceView = this.page.locator(
			`${this.activeSandboxView} ${this.getDatatype(
				"markdown"
			)} > .view-content > .markdown-source-view`
		);

		if (isLivePreview) {
			await expect(sourceView).toHaveClass(/is-live-preview/);
		} else {
			await expect(sourceView).not.toHaveClass(/is-live-preview/);
		}
	}

	// Private helpers
	private async getSandboxPlugin() {
		return this.pluginHandleMap.evaluateHandle(
			(pluginHandleMap, [PLUGIN_ID]) => {
				return pluginHandleMap.get(PLUGIN_ID) as SandboxNotePlugin;
			},
			[PLUGIN_ID]
		);
	}

	public waitForLayoutReady() {
		return this.page.waitForFunction(() => app.workspace.layoutReady);
	}
}

// --- Test Suite ---
test.describe("HotSandboxNoteView Main Features", () => {
	test("1. Note Creation and Input", async ({ vault }) => {
		const hotSandbox = new HotSandboxPage(
			vault.window,
			vault.pluginHandleMap
		);
		const testContent = "Hello, Sandbox!";

		await hotSandbox.createNewSandboxNote(testContent);
		await hotSandbox.expectActiveTitle("*Hot Sandbox-1");
	});

	test("2. Content Synchronization Across Multiple Views", async ({
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

		const rightPaneEditor = vault.window.locator(hotSandbox.activeEditor);
		await expect(rightPaneEditor).toHaveText(initialContent);

		await rightPaneEditor.focus();
		await hotSandbox.setActiveEditorContent(updatedContent);

		const leftPaneEditor = vault.window.locator(
			`.workspace-leaf.mod-active [data-type="${VIEW_TYPE_HOT_SANDBOX}"] [data-type="markdown"] .cm-content`
		);
		await expect(leftPaneEditor).toHaveText(updatedContent);
	});

	test("3. Multiple Independent Note Groups", async ({ vault }) => {
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

		expect(await hotSandbox.getActiveEditorContent()).toBe(note2Content);

		const firstNoteContent = await vault.window
			.locator(`${hotSandbox.allSandboxViews} .cm-content`)
			.first()
			.textContent();
		expect(firstNoteContent).toBe(note1Content);
	});

	test("4. Converting Note to File", async ({ vault }) => {
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

	test("5. Confirmation before closing the last tab", async ({ vault }) => {
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

	test("6. Toggle Source Mode", async ({ vault }) => {
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

	test.use({
		vaultOptions: {
			useSandbox: false,
			plugins: [{ pluginId: PLUGIN_ID, path: DIST_DIR }],
		},
	});

	test("7. Data Persistence After Reload", async ({
		vault,
		vaultOptions,
	}) => {
		const hotSandbox = new HotSandboxPage(
			vault.window,
			vault.pluginHandleMap
		);
		const persistentContent = "This content should persist after reload.";

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
			await getPluginHandleMap(reloadedWindow, vaultOptions.plugins || [])
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
