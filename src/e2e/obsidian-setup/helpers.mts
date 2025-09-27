// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\obsidian-setup\helpers.mts
import { copyFileSync, existsSync, rmSync, writeFileSync } from "fs";
import path from "path";
import type { ElectronApplication, Page } from "playwright";
import { expect } from "playwright/test";

import {
	COMMUNITY_PLUGINS_PATH,
	PLUGIN_ID,
	SANDBOX_VAULT_NAME,
	VAULT_PATH,
} from "../config.mts";
import {
	focusRootWorkspace,
	getAppInfo,
	getElectronAppPath,
	waitForVaultLoaded,
} from "../helpers.mts";
import { openSandboxVault, openStarter, openVault } from "./ipc-helpers.mts";
import { launchElectronApp, reopenVaultWith } from "./launch.mts";
import type { ObsidianVaultEntry } from "./types.mts";

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
	await ensureLoadPage(newWindow);
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
	window: Page,
	pluginsToEnable: string[]
): Promise<Page> {
	console.log("[Setup Step] Disabling Restricted Mode...");
	let currentWindow = window;
	// const newWindow = await reopenVaultWith(electronApp, async () => {
	// });

	console.log(
		"[BUTTON-1]",
		await currentWindow.evaluate(async () => {
			app.setting.openTabById("community-plugins");
			await new Promise((r) => setTimeout(r, 1000));
			const button = app.setting.settingTabs
				.find((tab) => tab.id.includes("com"))
				.setting.contentEl.querySelector("button");
			button.click();
			return button.textContent;
		})
	);
	console.log("disable Restricted Mode dialog should be open now.");
	await ensureLoadPage(currentWindow);
	await new Promise((r) => setTimeout(r, 1000));

	console.log(
		"[BUTTON-2]",
		await currentWindow.evaluate(async () => {
			app.setting.openTabById("community-plugins");
			await new Promise((r) => setTimeout(r, 1000));
			const button = app.setting.settingTabs
				.find((tab) => tab.id.includes("com"))
				.setting.contentEl.querySelector("button");
			button.click();
			return button.textContent;
		})
	);
	console.log("enable community plugins dialog should be open now.");
	await ensureLoadPage(currentWindow);
	await currentWindow.pause();

	for (const pluginId of pluginsToEnable) {
		await currentWindow.evaluate(
			(pluginId) => app.plugins.enablePluginAndSave(pluginId),
			pluginId
		);
	}
	return currentWindow;
}
export async function navigateToComminutyPlugins(window: Page) {
	await window.keyboard.press("Control+,");
	await window
		.locator(".vertical-tab-header-group-items")
		.getByText("Community plugins")
		.click();
}

export async function checkIsRestrictedMode(window: Page) {
	await navigateToComminutyPlugins(window);
}

// --- 状態保証ヘルパー ---

export function checkIsStarterSync(window: Page): boolean {
	return window.url().includes("starter");
}

export async function getSandboxWindow(
	electronApp: ElectronApplication,
	window: Page
) {
	if ((await getCurrentVaultName(window)) === SANDBOX_VAULT_NAME) {
		return window;
	}
	return reopenVaultWith(electronApp, () => openSandboxVault(window));
}

export async function ensureLoadPage(window: Page) {
	console.log("[Setup] Ensuring page is fully loaded...");
	await window.waitForLoadState("domcontentloaded");
	console.log("[Setup] Page DOM content loaded.");
	if (checkIsStarterSync(window)) {
		console.log("[Setup] Detected starter page, no vault to wait for.");
		return;
	}
	console.log("[Setup] Detected vault page, waiting for vault to load...");
	await waitForVaultLoaded(window);
	console.log("[Setup] Vault loaded.");
}

export function getCurrentVaultName(window: Page) {
	return window.evaluate(async () => {
		if (typeof app === "undefined") {
			console.trace("undefined");
			console.log("title", await window.title);
			console.log("url", window.location.href);
			return;
		}
		return app.vault.getName();
	});
}

export async function clearObsidianJSON() {
	const { window: dummyWindow } = await getAppWindow();
	const appPath = await getElectronAppPath(dummyWindow);
	const indexPath = path.join(appPath, ".obsidian.json");
	if (existsSync(indexPath)) {
		console.log("Found .obsidian.json, removing...");
		rmSync(indexPath);
		console.log("Removed .obsidian.json");
	} else {
		console.log("No .obsidian.json found, nothing to remove.");
	}
	await dummyWindow.close();
}

export async function getAppWindow(
	{ wait }: { wait: boolean } = { wait: true }
) {
	const electronApp = await launchElectronApp();
	const window = await electronApp.firstWindow();
	if (wait) await ensureLoadPage(window);
	return { electronApp, window };
}
