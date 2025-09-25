import { existsSync } from "fs";
import type { App } from "obsidian";
import path from "path";
import {
	type ElectronApplication,
	type Page,
	type JSHandle,
	_electron as electron,
} from "playwright";
import test, { expect } from "playwright/test";
import type SandboxNotePlugin from "src/main";
import invariant from "tiny-invariant";
import {
	initializeWorkspaceJSON,
	waitForWorkspace,
	focusRootWorkspace,
	countTabs,
} from "./helpers";

export const TIMEOUT = 5000;
export const SANDBOX_VIEW_SELECTOR =
	'.workspace-leaf-content[data-type="hot-sandbox-note-view"]';
export const ACTIVE_LEAF_SELECTOR = `.mod-active .workspace-leaf.mod-active`;
export const ROOT_WORKSPACE_SELECTOR = ".workspace-split.mod-vertical.mod-root";
// --- Configuration & Constants ---
const appPath = path.resolve(__dirname, "../../.obsidian-unpacked/main.js");
export const vaultPath = path.resolve(__dirname, "../../e2e-vault");
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
export let window: Page;
let appHandle: JSHandle<App>; // API操作のために維持

let pluginHandle: JSHandle<SandboxNotePlugin>; // API操作のために維持

// --- Test Hooks (Updated to use beforeEach/afterEach) ---
test.beforeEach(async ({}, testInfo) => {
	const isRestorationStep = testInfo.title.includes("restore note content");

	if (!isRestorationStep) {
		initializeWorkspaceJSON();
	}

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
	if (!isRestorationStep) {
		await pluginHandle.evaluate((plugin) =>
			plugin.databaseManager.clearAllNotes()
		);
	}
	expect(await countTabs(appHandle)).toBe(1);

	// Clean up existing tabs before each test (except for the restart restoration part)
	// await closeAllTabs(appHandle);
});
test.afterEach(async () => {
	await app?.close();
});
