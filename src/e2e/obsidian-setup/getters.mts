import type { ElectronApplication, Page } from "playwright";
import { ensureLoadPage, waitForNewWindow } from "./helpers.mts";
import { launchElectronApp } from "./launch.mts";
import { reopenVaultWith } from "./helpers.mts";
import { SANDBOX_VAULT_NAME } from "../config.mts";
import { openSandboxVault, openStarter, openVault } from "./ipc-helpers.mts";
import { expect } from "playwright/test";
import { focusRootWorkspace } from "../helpers.mts";
import type { ObsidianVaultEntry } from "./types.mts";

export async function getAppWindow(
	{ wait }: { wait: boolean } = { wait: true }
) {
	const electronApp = await launchElectronApp();
	const window = await electronApp.firstWindow();
	if (wait) await ensureLoadPage(window);
	return { electronApp, window };
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
export async function getSandboxWindow(
	electronApp: ElectronApplication,
	window: Page
) {
	if ((await getCurrentVaultName(window)) === SANDBOX_VAULT_NAME) {
		return window;
	}
	return reopenVaultWith(electronApp, () => openSandboxVault(window));
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

export function getVaultPathByPage(window: Page) {
	return window.evaluate(() => app.vault.adapter.basePath);
}
