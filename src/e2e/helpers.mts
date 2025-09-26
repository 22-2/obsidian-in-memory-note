// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\helpers.mts
import { copyFileSync, writeFileSync } from "fs"; // writeFileSyncを追加
import type { App } from "obsidian";
import path from "path";
import type { ElectronApplication, JSHandle, Locator, Page } from "playwright";
import { _electron as electron, expect, type TestInfo } from "playwright/test";
import {
	ACTIVE_LEAF_SELECTOR,
	APP_PATH,
	ROOT_WORKSPACE_SELECTOR,
	SANDBOX_VIEW_SELECTOR,
	VAULT_PATH,
} from "./config.mts";
import { PLUGIN_ID } from "./config.mts"; // PLUGIN_IDをインポート
import {
	delay,
	OPEN_SANDBOX_VAULT,
	runCommand,
} from "./obsidian-commands/run-command.mts";
import type { SetupFixuture } from "./types.mts";

// --- Constants ---
const COMMUNITY_PLUGINS_PATH = path.join(
	VAULT_PATH,
	"/.obsidian/community-plugins.json"
);

// --- Helper Functions ---
export async function waitForWorkspace(page: Page) {
	// Wait for loading screen to disappear
	await page.waitForSelector(".progress-bar", {
		state: "detached",
	});
	await expect(page.locator(".workspace")).toBeVisible();
}
export async function openNewSandboxNote(page: Page) {
	await page.getByLabel("Open new hot sandbox note", { exact: true }).click();
}
/**
 * APIを介して開いているルートリーフの数を数える
 */
export async function countTabs(appHandle: JSHandle<App>): Promise<number> {
	return await appHandle.evaluate((app) => {
		let count = 0;
		app.workspace.iterateRootLeaves((_) => count++);
		return count;
	});
}
/**
 * アクティブなSandboxビューのLocatorを取得する (UIベース: アクティブなリーフ内のビュー)
 */
export async function getActiveSandboxLocator(page: Page): Promise<Locator> {
	// アクティブなリーフ内のSandboxビューをターゲットにする
	const activeSandboxView = page
		.locator(ACTIVE_LEAF_SELECTOR)
		.locator(SANDBOX_VIEW_SELECTOR);

	await expect(activeSandboxView).toBeVisible();
	return activeSandboxView;
}
export function getEditor(viewLocator: Locator): Locator {
	return viewLocator.locator(".cm-content");
}
export function getActiveTabTitle(page: Page): Locator {
	return page
		.locator(ROOT_WORKSPACE_SELECTOR)
		.locator(
			".workspace-tab-header.is-active .workspace-tab-header-inner-title"
		);
}
export function focusRootWorkspace(page: Page) {
	return page.locator(ROOT_WORKSPACE_SELECTOR).focus();
}
/**
 * Splits the active view by interacting with the UI (Pure Playwright Locator approach).
 */
export async function splitActiveView(page: Page, direction: "right" | "down") {
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
	await expect(page.locator(SANDBOX_VIEW_SELECTOR)).toHaveCount(2);
}
/**
 * ワークスペース設定を初期状態 (空のワークスペース) に戻す
 */
export function initializeWorkspaceJSON() {
	copyFileSync(
		path.join(VAULT_PATH, "/.obsidian/workspace.initial.json"),
		path.join(VAULT_PATH, "/.obsidian/workspace.json")
	);
}

/**
 * コミュニティプラグインの設定を書き換える。
 * @param enabledPlugins 有効化するプラグインのIDリスト
 */
export function setCommunityPlugins(enabledPlugins: string[]) {
	// 修正: Obsidianの正しいJSONフォーマット { "plugins": [...] } に合わせる
	writeFileSync(
		COMMUNITY_PLUGINS_PATH,
		JSON.stringify(enabledPlugins, null, 2),
		"utf-8"
	);
	const pluginList =
		enabledPlugins.length > 0 ? enabledPlugins.join(", ") : "none";
	console.log(`[Plugin Config] Set enabled plugins: ${pluginList}`);
}

/**
 * テスト対象プラグインを有効化する
 */
export function setPluginInstalled() {
	setCommunityPlugins([PLUGIN_ID]);
}

/**
 * コミュニティプラグインを許可するが、テスト対象プラグインは無効化する
 */
export function setPluginDisabled() {
	// 他のプラグインがインストールされていないe2e-vaultでは、RestrictedModeと同じ動作になるが、
	// 意図を明確にするために別関数として定義する。
	setCommunityPlugins([]);
}
const openSandboxVault = async ({
	window: firstWindow,
	electronApp,
}: {
	window: Page;
	electronApp: ElectronApplication;
}) => {
	const windowRef = { current: firstWindow };
	await runCommand(firstWindow, OPEN_SANDBOX_VAULT, true);
	await delay(500);
	windowRef.current = electronApp.windows().pop()!;
	await waitForWorkspace(windowRef.current);
	await focusRootWorkspace(windowRef.current);
	await firstWindow.close();
	return windowRef.current;
};
export const commonSetup = async (
	testInfo: TestInfo,
	{
		sandboxVault,
		disableRestricMode,
	}: { sandboxVault?: boolean; disableRestricMode?: boolean } = {
		sandboxVault: false,
		disableRestricMode: false,
	}
): Promise<SetupFixuture> => {
	const isRestorationStep = testInfo.title.includes("restore note content");
	console.log(`\n--------------- Setup: ${testInfo.title} ---------------`);

	if (isRestorationStep === false) {
		initializeWorkspaceJSON();
	}

	const electronApp = await electron.launch({
		args: [
			APP_PATH,
			"open",
			`obsidian://open?path=${encodeURIComponent(VAULT_PATH)}`,
		],
	});
	let window = await electronApp.firstWindow();
	const windowRef = { current: window };
	await waitForWorkspace(window);
	await focusRootWorkspace(window);
	if (sandboxVault) {
		windowRef.current = await openSandboxVault({ window, electronApp });
		if (disableRestricMode) {
			windowRef.current = await commonDisableRestrictedMode({
				electronApp,
				pluginId: PLUGIN_ID,
				window: windowRef.current,
			});
		}
	}

	const appHandle = await windowRef.current.evaluateHandle(
		() => (window as any).app as App
	);

	return {
		electronApp,
		window: windowRef.current,
		appHandle,
		pluginId: PLUGIN_ID,
		isRestorationStep,
	};
};

export const commonDisableRestrictedMode = async ({
	electronApp,
	window,
	pluginId,
}: {
	electronApp: ElectronApplication;
	window: Page;
	pluginId: string;
}) => {
	const windowRef = { current: window };
	// --- 代替案: Vaultが既に開かれている前提で操作を進める ---
	console.log("3. Navigating to Settings...");
	// 設定ボタンのセレクターを適切に調整してください
	await windowRef.current.keyboard.press("Control+,");

	await windowRef.current
		.locator(".vertical-tab-header-group-items")
		.getByText("Community plugins")
		.click();

	// 5. 制限モード（Restricted mode）をオフにする
	console.log("4. Disabling Restricted Mode...");
	// スイッチのセレクターを特定します (例: .setting-item-control .checkbox-container)
	// 「Turn off Restricted mode」ボタンをクリックするパターンが多い
	await windowRef.current
		.getByText(/Turn on and reload|Turn on community plugins/)
		.click();
	windowRef.current = electronApp.windows().pop()!;

	await waitForWorkspace(windowRef.current);
	await focusRootWorkspace(windowRef.current);

	// 設定ボタンのセレクターを適切に調整してください
	await windowRef.current.keyboard.press("Control+,");

	await windowRef.current
		.locator(".vertical-tab-header-group-items")
		.getByText("Community plugins")
		.click();

	await windowRef.current.getByText("Turn on community plugins").click();

	await windowRef.current.keyboard.press("Esc");
	await windowRef.current.keyboard.press("Control+,");

	console.log(`5. Enabling Plugin: ${pluginId}...`);
	const pluginToggle = windowRef.current.locator(
		`.installed-plugins-container .checkbox-container`
	);
	await pluginToggle.check();
	return windowRef.current;
};
export const commonTeardown = async (
	electronApp: ElectronApplication,
	testInfo: TestInfo
) => {
	await electronApp?.close();
	console.log(`--------------- Teardown: ${testInfo.title} ---------------`);
};
