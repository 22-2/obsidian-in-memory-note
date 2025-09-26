// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\helpers.mts
import { copyFileSync, writeFileSync } from "fs"; // writeFileSyncを追加
import type { App } from "obsidian";
import path from "path";
import type { JSHandle, Locator, Page } from "playwright";
import { expect } from "playwright/test";
import {
	ACTIVE_LEAF_SELECTOR,
	ROOT_WORKSPACE_SELECTOR,
	SANDBOX_VIEW_SELECTOR,
} from "./base.mts";
import { PLUGIN_ID, VAULT_PATH } from "./config.mts"; // PLUGIN_IDをインポート

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
	writeFileSync(
		COMMUNITY_PLUGINS_PATH,
		JSON.stringify(enabledPlugins, null, 2),
		"utf-8"
	);
	console.log(
		`[Plugin Config] Set enabled plugins: ${enabledPlugins.join(", ")}`
	);
}

/**
 * テスト対象プラグインを有効化する
 */
export function setPluginInstalled() {
	setCommunityPlugins([PLUGIN_ID]);
}

/**
 * コミュニティプラグインをすべて無効化する (Restricted Mode相当)
 */
export function setRestrictedMode() {
	setCommunityPlugins([]);
}

/**
 * コミュニティプラグインを許可するが、テスト対象プラグインは無効化する
 */
export function setPluginDisabled() {
	// 実際には e2e-vault の設定に依存するため、ここでは空の配列を設定（ただし、他のテストで使われる可能性のあるプラグインは含めない）
	// 他のプラグインがインストールされていない前提であれば RestrictedMode と同じ動作になるが、意図を明確にするために別関数とする
	setCommunityPlugins([]);
}
