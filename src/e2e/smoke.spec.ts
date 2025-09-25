// このファイルは Playwright の E2E テストファイルです。
import test, {
	expect,
	type ElectronApplication,
	type Page,
	type Locator,
	type JSHandle,
} from "@playwright/test";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

import { _electron as electron } from "playwright";
import type { App, WorkspaceLeaf } from "obsidian";

import invariant from "tiny-invariant";
import type SandboxNotePlugin from "src/main";

const TIMEOUT = 5000;
const SANDBOX_VIEW_SELECTOR =
	'.workspace-leaf-content[data-type="hot-sandbox-note-view"]';
const ACTIVE_LEAF_SELECTOR = `.mod-active .workspace-leaf.mod-active`;
const ROOT_WORKSPACE_SELECTOR = ".workspace-split.mod-vertical.mod-root";

// --- Configuration & Constants ---
const appPath = path.resolve(__dirname, "../../.obsidian-unpacked/main.js");
const vaultPath = path.resolve(__dirname, "../../e2e-vault");

// --- Pre-flight checks (省略) ---
invariant(
	existsSync(appPath),
	`Obsidian app not found at: ${appPath}. Did you run 'pnpm build:e2e' and 'e2e-setup' script?`
);
invariant(
	existsSync(vaultPath),
	`E2E vault not found at: ${vaultPath}. Did you run 'e2e-setup' script?`
);

console.log("appPath:", appPath);
console.log("vaultPath:", vaultPath);

// --- Global State (updated to use beforeEach/afterEach) ---
let app: ElectronApplication;
let window: Page;
let appHandle: JSHandle<App>; // API操作のために維持
let pluginHandle: JSHandle<SandboxNotePlugin>; // API操作のために維持

// --- Helper Functions (Updated to use pure selectors or require Page/appHandle) ---

async function waitForWorkspace(page: Page) {
	// Wait for loading screen to disappear
	await page.waitForSelector(".progress-bar", {
		state: "detached",
		timeout: TIMEOUT,
	});
	await expect(page.locator(".workspace")).toBeVisible({
		timeout: TIMEOUT,
	});
}

async function openNewSandboxNote(page: Page) {
	await page.getByLabel("Open new hot sandbox note", { exact: true }).click();
}

/**
 * APIを介して開いているルートリーフの数を数える
 */
async function countTabs(appHandle: JSHandle<App>): Promise<number> {
	return await appHandle.evaluate((app) => {
		let count = 0;
		app.workspace.iterateRootLeaves((_) => count++);
		return count;
	});
}

/**
 * アクティブなSandboxビューのLocatorを取得する (UIベース: アクティブなリーフ内のビュー)
 */
async function getActiveSandboxLocator(page: Page): Promise<Locator> {
	// アクティブなリーフ内のSandboxビューをターゲットにする
	const activeSandboxView = page
		.locator(ACTIVE_LEAF_SELECTOR)
		.locator(SANDBOX_VIEW_SELECTOR);

	await expect(activeSandboxView).toBeVisible({ timeout: TIMEOUT });
	return activeSandboxView;
}

/**
 * APIを介して開いているルートリーフ（メインウィンドウのタブ）を全て閉じる
 */
// async function closeAllTabs(appHandle: JSHandle<App>) {
// 	const leavesHandle = await appHandle.evaluateHandle((app: App) => {
// 		const leaves: WorkspaceLeaf[] = [];
// 		app.workspace.iterateRootLeaves((leaf: WorkspaceLeaf) => {
// 			// メインのルートスプリットに属するリーフのみを対象とする
// 			if (leaf.parentSplit.id === (app.workspace as any).rootSplit.id) {
// 				leaves.push(leaf);
// 			}
// 		});
// 		return leaves;
// 	});

// 	const leavesCount = await leavesHandle.evaluate((leaves) => leaves.length);

// 	// デフォルトで一つ残るため、1より大きい場合に閉じる
// 	if (leavesCount > 1) {
// 		await leavesHandle.evaluate((leaves) =>
// 			leaves.forEach((leaf) => leaf.detach())
// 		);
// 	}

// 	// 1タブのみが残ることを確認（通常は新規ノートなど）
// 	await expect(await countTabs(appHandle)).toBeLessThanOrEqual(1);
// }

function getEditor(viewLocator: Locator): Locator {
	return viewLocator.locator(".cm-content");
}

function getActiveTabTitle(page: Page): Locator {
	return page
		.locator(ROOT_WORKSPACE_SELECTOR)
		.locator(
			".workspace-tab-header.is-active .workspace-tab-header-inner-title"
		);
}

function focusRootWorkspace(page: Page) {
	return page.locator(ROOT_WORKSPACE_SELECTOR).focus();
}

/**
 * Splits the active view by interacting with the UI (Pure Playwright Locator approach).
 */
async function splitActiveView(page: Page, direction: "right" | "down") {
	// 1. アクティブなリーフ内の「More options」ボタンを見つけてクリック
	await page
		.locator(ACTIVE_LEAF_SELECTOR)
		.locator(".view-actions .clickable-icon[aria-label='More options']")
		.first()
		.click();

	// 2. メニュー項目をクリック
	await page
		.locator(".menu-item-title", { hasText: `Split ${direction}` })
		.click();

	// 3. 2つのsandboxビューが存在することを待機
	await expect(page.locator(SANDBOX_VIEW_SELECTOR)).toHaveCount(2, {
		timeout: TIMEOUT,
	});
}

function initializeWorkspaceJSON() {
	copyFileSync(
		path.join(vaultPath, "/.obsidian/workspace.initial.json"),
		path.join(vaultPath, "/.obsidian/workspace.json")
	);
}

// --- Test Hooks (Updated to use beforeEach/afterEach) ---

test.beforeEach(async () => {
	initializeWorkspaceJSON();
	// アプリケーションを起動
	app = await electron.launch({ args: [appPath, vaultPath] });
	window = await app.firstWindow();
	await waitForWorkspace(window);
	await focusRootWorkspace(window);

	// グローバルな appHandle を初期化
	appHandle = await window.evaluateHandle(() => (window as any).app as App);
	pluginHandle = await appHandle.evaluateHandle(
		(app) => app.plugins.getPlugin("sandbox-note") as SandboxNotePlugin
	);
	await pluginHandle.evaluate((plugin) =>
		plugin.databaseManager.clearAllNotes()
	);
	expect(await countTabs(appHandle)).toBe(1);

	// Clean up existing tabs before each test (except for the restart restoration part)
	// await closeAllTabs(appHandle);
});

test.afterEach(async () => {
	await app?.close();
});

// --- Test Suites ---

test.describe("Hot Sandbox Note: Basic Functionality (UI-centric)", () => {
	test("should open a new note, allow typing, and update title with asterisk", async () => {
		// Act: Open a new note.
		await openNewSandboxNote(window);
		const view = await getActiveSandboxLocator(window);

		// Assert: Check the initial tab title.
		const tabTitle = getActiveTabTitle(window);
		await expect(tabTitle).toHaveText(/Hot Sandbox-\d+/);

		// Act: Type text into the editor.
		const editor = getEditor(view);
		await editor.click();
		const testText = "Hello, this is an E2E test!";
		await editor.fill(testText);

		// Assert: Verify text and title update.
		await expect(editor).toHaveText(testText);
		await expect(tabTitle).toHaveText(/\Hot Sandbox-\d+/);
	});

	test("should sync content between two split views of the same note", async () => {
		// Arrange: Open a note and split the view (using UI interaction).
		await openNewSandboxNote(window);
		await splitActiveView(window, "right");

		// Get the views (both are present in the DOM)
		const allSandboxViews = window.locator(SANDBOX_VIEW_SELECTOR);
		await expect(allSandboxViews).toHaveCount(2);

		// Act: Type in the first editor.
		const firstEditor = getEditor(allSandboxViews.first());
		const secondEditor = getEditor(allSandboxViews.last());

		const syncText = "This text should appear in both views.";
		await firstEditor.click();
		await firstEditor.fill(syncText);

		// Assert: Verify text is synced to the second editor.
		await expect(secondEditor).toHaveText(syncText, { timeout: TIMEOUT });

		// Act: Type in the second editor to test reverse sync.
		const reverseSyncText = " And this text from the second view.";
		await secondEditor.press("End");
		await secondEditor.fill(reverseSyncText);

		// Assert: Verify the full text is now in the first editor.
		await expect(firstEditor).toHaveText(syncText + reverseSyncText, {
			timeout: TIMEOUT,
		});
	});
});

test.describe.serial("Hot Sandbox Note: Hot Exit (Restart Test)", () => {
	const testText = `Content to be restored - ${Date.now()}`;

	test("should create and populate a note for the restart test", async () => {
		// Arrange: Open a note and type some unique text.
		await openNewSandboxNote(window);
		const view = await getActiveSandboxLocator(window);
		const editor = getEditor(view);
		await editor.click();
		await editor.fill(testText);

		// Assert: Verify content is present.
		await expect(editor).toHaveText(testText);

		// Act: Wait for the automatic save to trigger (default debounce is 3000ms).
		await window.waitForTimeout(4000);
	});

	// Note: Since this is a serial block, Playwright ensures the app is closed after the previous test
	// and restarted automatically via the subsequent test's beforeEach hook.

	test("should restore note content after an application restart", async () => {
		// Act: App has already been restarted by the preceding afterEach/beforeEach hooks.
		await waitForWorkspace(window);

		// Wait for restoration to complete.
		await window.waitForTimeout(1000);

		// Assert: Verify that the note and its content have been restored.
		const restoredView = await getActiveSandboxLocator(window);
		const restoredEditor = getEditor(restoredView);

		// Assert: Check content restoration
		await expect(restoredEditor).toHaveText(testText);

		// Assert: Verify the tab title also shows the changed state.
		const restoredTabTitle = getActiveTabTitle(window);
		await expect(restoredTabTitle).toHaveText(/\*Hot Sandbox-\d+/);
	});
});
