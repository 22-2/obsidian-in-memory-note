// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\obsidian-setup\helpers.mts
import type { ElectronApplication, Page } from "playwright";

import { waitForLayoutReady } from "../helpers.mts";
import { navigateToComminutyPlugins } from "./operations.mts";
import { delay } from "../obsidian-commands/run-command.mts";
import {
	getCurrentVaultName as getVaultNameByPage,
	getVaultPathByPage,
} from "./getters.mts";

// --- アプリ状態操作ヘルパー ---

/**
 * IPCを使用して新しいウィンドウを待ち、古いウィンドウを閉じる
 * @deprecated
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

// export async function checkIsRestrictedMode(window: Page) {
// 	// await navigateToComminutyPlugins(window);
// 	throw new Error("not implemented");
// }

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
	await waitForLayoutReady(window);
	await delay(500);
	console.log(
		`[Setup] Detected ${await getVaultNameByPage(
			window
		)} vault page in ${await getVaultPathByPage(
			window
		)}, waiting for vault to load...`
	);
	console.log("[Setup] Vault loaded.");
}
