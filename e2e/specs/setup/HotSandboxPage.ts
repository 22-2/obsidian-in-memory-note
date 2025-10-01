import { PLUGIN_ID } from "e2e/config";
import { runCommandById } from "e2e/obsidian-commands/run-command";
import { getPluginHandleMap } from "e2e/obsidian-setup/helpers";
import type { VaultPageTextContext } from "e2e/obsidian-setup/setup";
import type { VaultOptions } from "e2e/obsidian-setup/vault-manager";
import type { Page } from "playwright";
import { expect } from "playwright/test";
import type SandboxNotePlugin from "src/main";
import { VIEW_TYPE_HOT_SANDBOX } from "src/utils/constants";
import {
	CMD_ID_CLOSE_TAB,
	CMD_ID_CONVERT_TO_FILE,
	CMD_ID_OPEN_HOT_SANDBOX,
	CMD_ID_UNDO_CLOSE_TAB,
} from "./constants";

type ViewType = "markdown" | typeof VIEW_TYPE_HOT_SANDBOX;
// --- Page Object ---
export class HotSandboxPage {
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
		await runCommandById(this.page, CMD_ID_OPEN_HOT_SANDBOX);
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
		await runCommandById(this.page, CMD_ID_CONVERT_TO_FILE);

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
		await runCommandById(this.page, CMD_ID_CLOSE_TAB);
	}

	async undoCloseTab() {
		await runCommandById(this.page, CMD_ID_UNDO_CLOSE_TAB);
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
