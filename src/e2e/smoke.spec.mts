// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\smoke.spec.mts
import { test, expect } from "./base.mts";
import { SANDBOX_VAULT_NAME, SANDBOX_VIEW_SELECTOR } from "./config.mts";
import {
	getActiveSandboxLocator,
	getActiveTabTitle,
	getEditor,
	openNewSandboxNote,
	splitActiveView,
} from "./helpers.mts";

// --- 通常のVaultでのテスト ---
test.describe("Hot Sandbox Note: Basic Functionality", () => {
	test("should open a new note, allow typing, and update title", async ({
		obsidian,
	}) => {
		const { window } = obsidian;
		await openNewSandboxNote(window);
		const view = await getActiveSandboxLocator(window);

		const tabTitle = getActiveTabTitle(window);
		await expect(tabTitle).toHaveText(/Hot Sandbox-\d+/);

		const editor = getEditor(view);
		await editor.click();
		const testText = "Hello, this is an E2E test!";
		await editor.fill(testText);

		await expect(editor).toHaveText(testText);
		await expect(tabTitle).toHaveText(/\*Hot Sandbox-\d+/);
	});

	// 他のテスト...
});

// --- Sandbox Vaultでのテスト ---
test.describe("Hot Sandbox Note: In Sandbox Vault", () => {
	// このdescribeブロック内のすべてのテストでSandbox Vaultが開かれる
	test.use({ setupOptions: { openVault: SANDBOX_VAULT_NAME } });

	test("should open a new note in the sandbox vault", async ({
		obsidian,
	}) => {
		const { window, appHandle } = obsidian;

		// Vault名が正しいことを確認
		const vaultName = await appHandle.evaluate((app) =>
			app.vault.getName()
		);
		expect(vaultName).toBe(SANDBOX_VAULT_NAME);

		// 通常のテストと同様の操作を実行
		await openNewSandboxNote(window);
		const view = await getActiveSandboxLocator(window);
		const editor = getEditor(view);
		await editor.click();
		await editor.fill("Testing in the sandbox vault.");
		await expect(editor).toHaveText("Testing in the sandbox vault.");
	});
});

// --- Hot Exitのテスト ---
test.describe.serial("Hot Sandbox Note: Hot Exit (Restart Test)", () => {
	const testText = `Content to be restored - ${Date.now()}`;

	test("should create and populate a note for the restart test", async ({
		obsidian,
	}) => {
		const { window } = obsidian;
		await openNewSandboxNote(window);
		const view = await getActiveSandboxLocator(window);
		const editor = getEditor(view);
		await editor.click();
		await editor.fill(testText);

		await expect(editor).toHaveText(testText);
		await window.waitForTimeout(3000); // 保存を待機
	});

	test("should restore note content after an application restart", async ({
		obsidian,
	}) => {
		const { window } = obsidian;
		await window.waitForTimeout(1000); // 復元を待機

		const restoredView = await getActiveSandboxLocator(window);
		const restoredEditor = getEditor(restoredView);
		await expect(restoredEditor).toHaveText(testText);

		const restoredTabTitle = getActiveTabTitle(window);
		await expect(restoredTabTitle).toHaveText(/\*Hot Sandbox-\d+/);
	});
});
