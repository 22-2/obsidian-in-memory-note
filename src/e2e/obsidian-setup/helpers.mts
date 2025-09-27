// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\obsidian-setup\helpers.mts
import { copyFileSync, rmSync, writeFileSync } from "fs";
import path from "path";
import type { ElectronApplication, Page } from "playwright";
import { expect } from "playwright/test";

import {
	COMMUNITY_PLUGINS_PATH,
	PLUGIN_ID,
	SANDBOX_VAULT_NAME,
	TEST_VAULT_NAME,
	VAULT_PATH,
} from "../config.mts";
import {
	focusRootWorkspace,
	noopAsync,
	runCommand,
	waitForWorkspace,
} from "../helpers.mts";
import { OPEN_SANDBOX_VAULT } from "../obsidian-commands/run-command.mts";
import type { ObsidianVaultEntry } from "./types.mts";
import {
	getSandboxPath,
	openStarter,
	openVault,
	removeVault,
} from "./ipc-helpers.mts";

/**
 * IPCを使用して保管庫リストを取得
 */
async function getVaultList(page: Page): Promise<ObsidianVaultEntry> {
	return page.evaluate(() => {
		return window.electron.ipcRenderer.sendSync("vault-list");
	});
}

// --- ファイルシステム操作ヘルパー ---

export function setCommunityPlugins(enabledPlugins: string[]) {
	writeFileSync(
		COMMUNITY_PLUGINS_PATH,
		JSON.stringify(enabledPlugins),
		"utf-8"
	);
	const pluginList =
		enabledPlugins.length > 0 ? enabledPlugins.join(", ") : "none";
	console.log(`[Plugin Config] Set enabled plugins: ${pluginList}`);
}

export function setPluginInstalled() {
	console.log(`[Plugin Config] Installing plugin: ${PLUGIN_ID}`);
	setCommunityPlugins([PLUGIN_ID]);
}

export function setPluginDisabled() {
	setCommunityPlugins([]);
}

export function initializeWorkspaceJSON() {
	copyFileSync(
		path.join(VAULT_PATH, "/.obsidian/workspace.initial.json"),
		path.join(VAULT_PATH, "/.obsidian/workspace.json")
	);
	console.log("copied workspace.initial.json to workspace.json");
}

// --- アプリ状態操作ヘルパー ---

/**
 * IPCを使用して新しいウィンドウを待ち、古いウィンドウを閉じる
 */
export async function waitForNewWindow(
	electronApp: ElectronApplication,
	closeOldWindows = true
): Promise<Page> {
	const newWindow = await electronApp.waitForEvent("window");

	console.log(
		`[Setup Step] New window opened: ${newWindow.url()} ${await newWindow.title()}`
	);

	if (closeOldWindows) {
		console.log("[Setup Step] Closing old windows...");
		for (const window of electronApp.windows()) {
			if (window !== newWindow && !window.isClosed()) {
				await window.close();
			}
		}
	}

	return newWindow;
}

/**
 * IPCを使用して保管庫を開く（簡素化版）
 */
export async function getVault(
	electronApp: ElectronApplication,
	page: Page,
	vaultPath: string,
	createNew = false
): Promise<Page> {
	console.log(`[Setup Action] Opening vault: ${vaultPath}...`);

	const result = await openVault(page, vaultPath, createNew);
	if (result !== true && typeof result === "string") {
		throw new Error(`Failed to open vault: ${result}`);
	}

	const newWindow = await waitForNewWindow(electronApp);
	await waitForWorkspace(newWindow);
	await focusRootWorkspace(newWindow);

	return newWindow;
}

/**
 * IPCを使用してスターターページに戻る
 */
export async function getStarter(
	electronApp: ElectronApplication,
	page: Page
): Promise<Page> {
	console.log("[Setup Action] Opening starter page...");

	await openStarter(page);
	const newWindow = await waitForNewWindow(electronApp);

	await expect(newWindow.getByText("Create", { exact: true })).toBeVisible();
	await newWindow.waitForSelector(".mod-change-language", {
		state: "visible",
	});

	return newWindow;
}

/**
 * UI操作でRestricted Modeを無効化し、指定のプラグインを有効にする
 */
export async function disableRestrictedModeAndEnablePlugins(
	electronApp: ElectronApplication,
	page: Page,
	pluginsToEnable: string[]
): Promise<Page> {
	console.log("[Setup Step] Disabling Restricted Mode...");
	await page.keyboard.press("Control+,");
	await page
		.locator(".vertical-tab-header-group-items")
		.getByText("Community plugins")
		.click();

	// "Turn on community plugins" ボタンが表示されているか確認
	const turnOnButton = page.getByRole("button", {
		name: "Turn on community plugins",
	});
	if (await turnOnButton.isVisible()) {
		// Restricted Modeを無効化（再起動が発生）
		await turnOnButton.click();
		let newPage = await waitForNewWindow(electronApp);
		await waitForWorkspace(newPage);
		await focusRootWorkspace(newPage);

		// 設定画面を再度開く
		await newPage.keyboard.press("Control+,");
		await newPage
			.locator(".vertical-tab-header-group-items")
			.getByText("Community plugins")
			.click();

		// プラグインを有効化
		for (const pluginId of pluginsToEnable) {
			console.log(`[Setup Step] Enabling plugin: ${pluginId}...`);
			const pluginRow = newPage.locator(".community-plugin-item", {
				hasText: pluginId,
			});
			const toggle = pluginRow.locator(".checkbox-container");
			if (!(await toggle.isChecked())) {
				await toggle.click();
			}
		}

		await newPage.keyboard.press("Escape");
		return newPage;
	} else {
		// すでに無効化されている場合
		console.log("[Setup Step] Restricted Mode is already disabled.");
		for (const pluginId of pluginsToEnable) {
			console.log(`[Setup Step] Enabling plugin: ${pluginId}...`);
			const pluginRow = page.locator(".community-plugin-item", {
				hasText: pluginId,
			});
			const toggle = pluginRow.locator(".checkbox-container");
			if (!(await toggle.isChecked())) {
				await toggle.click();
			}
		}
		await page.keyboard.press("Escape");
		return page;
	}
}

// --- 状態保証ヘルパー ---

export function checkIsStarter(window: Page): boolean {
	return window.url().includes("starter");
}

/**
 * アプリケーションがスターターページを表示している状態を保証する（IPC版）
 */
export async function ensureStarterPage(
	electronApp: ElectronApplication,
	window: Page
): Promise<Page> {
	console.log("[Setup] Ensuring application is on the starter page.");

	if (await checkIsStarter(window)) {
		console.log("[Setup] Already on starter page.");
		await window.waitForSelector(".mod-change-language", {
			state: "visible",
		});
		return window;
	}

	console.log(
		"[Setup] Vault is currently open. Returning to starter page..."
	);
	return getStarter(electronApp, window);
}

/**
 * デフォルトのテストVaultが開かれている状態を保証する（IPC版）
 */
export async function ensureVaultOpen(
	electronApp: ElectronApplication,
	window: Page,
	vaultName = TEST_VAULT_NAME
): Promise<Page> {
	console.log(`[Setup] Ensuring vault '${vaultName}' is open.`);

	if (checkIsStarter(window)) {
		console.log("[Setup] Currently on starter. Opening vault...");

		// 保管庫リストから指定された保管庫を探す
		const vaultList = await getVaultList(window);
		const vaultEntry = Object.values(vaultList).find((v: any) =>
			v.path.includes(vaultName)
		);

		if (!vaultEntry) {
			throw new Error(`Vault "${vaultName}" not found in vault list`);
		}

		return getVault(electronApp, window, vaultEntry.path);
	}

	console.log(
		"[Setup] Vault is already open. Checking if it's the correct one..."
	);
	await waitForWorkspace(window);
	await focusRootWorkspace(window);

	const currentVaultName = await window.evaluate(() =>
		// @ts-expect-error
		window.app.vault.getName()
	);

	if (currentVaultName === vaultName) {
		console.log("[Setup] Correct vault is already open.");
		return window;
	}

	// 違う保管庫が開いているので、正しいものを開く
	const vaultList = await getVaultList(window);
	const vaultEntry = Object.values(vaultList).find((v: any) =>
		v.path.includes(vaultName)
	);

	if (!vaultEntry) {
		throw new Error(`Vault "${vaultName}" not found in vault list`);
	}

	return getVault(electronApp, window, vaultEntry.path);
}

/**
 * IPCを使用してサンドボックス保管庫を開く
 */
export async function openSandboxVault(page: Page): Promise<void> {
	console.log(`[Setup Step] Opening sandbox vault: ${SANDBOX_VAULT_NAME}...`);
	return page.evaluate((path) => {
		return window.electron.ipcRenderer.sendSync("sandbox", path);
	});
}

/**
 * サンドボックス保管庫を初期化（削除して再作成）
 */
export async function initializeSandboxVault(
	electronApp: ElectronApplication,
	window: Page
) {
	const vaultPath = await getSandboxPath(window);
	if (vaultPath) {
		console.log(`[Setup] Removing existing sandbox vault at: ${vaultPath}`);
		// 保管庫リストから削除
		await removeVault(window, vaultPath);
		// ファイルシステムから削除
		rmSync(vaultPath, { recursive: true, force: true });
	}
	// 新規作成して開く
	return openSandboxVault(window);
}

// 後方互換性のためエクスポート（非推奨）
export const initializeObsidianJSON = async () => {
	console.warn(
		"[DEPRECATED] initializeObsidianJSON is no longer needed with IPC approach"
	);
};

export const ensureVault = async (
	electronApp: ElectronApplication,
	vaultWindow: Page,
	vaultName: string
) => {
	return ensureVaultOpen(electronApp, vaultWindow, vaultName);
};

// 以下の関数は削除（IPC版で置き換え済み）
// - performActionAndReload
// - reopenVaultWith
// - reopenStarterPageWith
// - openDefaultVaultFromStarter

export function ensureLoadPage(window: Page) {
	return window.waitForLoadState("domcontentloaded");
}

export function getCurrentVaultName(window: Page) {
	return window.evaluate(() => app.vault.getName());
}
