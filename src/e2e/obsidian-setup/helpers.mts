// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\obsidian-setup\helpers.mts
import type { ElectronApplication, Page } from "playwright";

import { waitForVaultLoaded } from "../helpers.mts";
import { navigateToComminutyPlugins } from "./operations.mts";

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

export async function checkIsRestrictedMode(window: Page) {
	await navigateToComminutyPlugins(window);
}

// --- 状態保証ヘルパー ---

export function checkIsStarterSync(window: Page): boolean {
	return window.url().includes("starter");
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
