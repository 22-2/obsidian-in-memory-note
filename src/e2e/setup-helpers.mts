// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\setup-helpers.mts
import type { ElectronApplication, Page } from "playwright";
import { expect } from "playwright/test";
import { copyFileSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";
import invariant from "tiny-invariant";

import {
	ACTIVE_LEAF_SELECTOR,
	COMMUNITY_PLUGINS_PATH,
	PLUGIN_ID,
	ROOT_WORKSPACE_SELECTOR,
	SANDBOX_VAULT_NAME,
	SANDBOX_VIEW_SELECTOR,
	VAULT_NAME,
	VAULT_PATH,
} from "./config.mts";
import { OPEN_SANDBOX_VAULT } from "./obsidian-commands/run-command.mts";
import {
	focusRootWorkspace,
	noopAsync,
	runCommand,
	waitForWorkspace,
} from "./helpers.mts";

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
}

export async function initializeObsidianJSON(electronApp: ElectronApplication) {
	const executablePath = await electronApp.evaluate(({ app }) => {
		return app.getAppPath();
	});
	invariant(executablePath, "failed to get executable path");

	const initialJSONPath = path.join(VAULT_PATH, "/obsidian.initial.json");
	const initialJSON = JSON.parse(
		readFileSync(initialJSONPath, { encoding: "utf-8" })
	);
	initialJSON.vaults["test-valut"].path = VAULT_PATH;
	writeFileSync(
		path.join(executablePath, "obsidian.json"),
		JSON.stringify(initialJSON),
		{
			encoding: "utf-8",
		}
	);
}

// --- アプリ状態操作ヘルパー ---

export async function performActionAndReload(
	electronApp: ElectronApplication,
	beforeAction: () => Promise<void>,
	opts: {
		closeOldWindows?: boolean;
		waitFor?: (newWindow: Page) => Promise<void>;
		focus?: (newWindow: Page) => Promise<void>;
	} = {
		closeOldWindows: true,
		waitFor: waitForWorkspace,
		focus: focusRootWorkspace,
	}
): Promise<Page> {
	await beforeAction();
	const newWindow = await electronApp.waitForEvent("window");

	console.log(
		`[Setup Step] New window opened: ${newWindow.url()} ${await newWindow.title()}`
	);

	if (opts.closeOldWindows) {
		console.log("[Setup Step] Closing old windows...");
		for (const window of electronApp.windows()) {
			if (window !== newWindow && !window.isClosed()) {
				await window.close();
			}
		}
	}

	opts.waitFor && (await opts.waitFor(newWindow));
	opts.focus && (await opts.focus(newWindow));
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
		// Restricted Modeを無効化（再起動が発生する）
		let newPage = await performActionAndReload(electronApp, async () =>
			turnOnButton.click()
		);

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
		// すでに無効化されている場合は、そのままプラグインを有効化
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

async function openDefaultVaultFromStarter(
	electronApp: ElectronApplication,
	starterPage: Page
): Promise<Page> {
	console.log(`[Setup Step] Opening default vault: ${VAULT_NAME}...`);
	return performActionAndReload(electronApp, () =>
		starterPage.getByText(VAULT_NAME, { exact: true }).click()
	);
}

/**
 * アプリケーションがスターターページを表示している状態を保証する
 * Vaultが開いている場合は閉じる
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
	await focusRootWorkspace(window);
	await window.locator(".workspace-drawer-vault-switcher").click();

	const newWindow = await performActionAndReload(
		electronApp,
		async () => {
			await window.getByText("Manage vaults...", { exact: true }).click();
		},
		{
			focus: async () => {}, // No-op
			waitFor: async (win) => {
				await expect(
					win.getByText("Create", { exact: true })
				).toBeVisible();
			},
		}
	);

	await newWindow.waitForSelector(".mod-change-language", {
		state: "visible",
		timeout: 5000,
	});

	console.log("[Setup] Successfully returned to starter page.");
	return newWindow;
}

/**
 * デフォルトのテストVaultが開かれている状態を保証する
 */
export async function ensureVaultOpen(
	electronApp: ElectronApplication,
	window: Page,
	vaultName = VAULT_NAME
): Promise<Page> {
	console.log(`[Setup] Ensuring default vault '${vaultName}' is open.`);

	if (checkIsStarter(window)) {
		console.log(
			"[Setup] Vault is currently closed. Opening default vault..."
		);
		const vaultPage = await openDefaultVaultFromStarter(
			electronApp,
			window
		);
		console.log(`[Setup] Successfully opened default vault.`);
		return vaultPage;
	}

	console.log("[Setup] Vault is already open.");
	await waitForWorkspace(window);
	await focusRootWorkspace(window);
	const currentVaultName = await window.evaluate(() =>
		// @ts-expect-error app property is available in the Obsidian window
		window.app.vault.getName()
	);
	if (currentVaultName === vaultName) {
		console.log("[Setup] Default vault is already open.");
		return window;
	}

	return ensureSelectedVault(electronApp, window, vaultName);
}

export const ensureSelectedVault = async (
	electronApp: ElectronApplication,
	vaultWindow: Page,
	vaultName: string
) => {
	await vaultWindow.locator(".workspace-drawer-vault-switcher").click();

	const starterPage = await performActionAndReload(
		electronApp,
		async () => {
			await vaultWindow
				.getByText("Manage vaults...", { exact: true })
				.click();
		},
		{
			focus: noopAsync,
			waitFor: async (win) => {
				await expect(
					win.getByText("Create", { exact: true })
				).toBeVisible();
			},
		}
	);
	if (!checkIsStarter(starterPage)) {
		throw new Error("failed to return to starter page");
	}
	const newVaultWindow = await performActionAndReload(
		electronApp,
		async () => {
			await starterPage.getByText(vaultName, { exact: true }).click();
		}
	);
	await waitForWorkspace(newVaultWindow);
	await focusRootWorkspace(newVaultWindow);
	return newVaultWindow;
};

export function getSandboxVaultPath(window: Page) {
	return window.evaluate(
		(name) =>
			Object.values(
				// @ts-expect-error
				window.electron.ipcRenderer.sendSync("vault-list")
				// @ts-expect-error
			).find((v: any) => v.path.includes(name))?.path as
				| string
				| undefined,
		SANDBOX_VAULT_NAME
	);
}

/**
 * UI操作で別のVaultを開き、新しいウィンドウオブジェクトを返す
 */
export async function openSandboxVault(
	electronApp: ElectronApplication,
	page: Page
): Promise<Page> {
	console.log(`[Setup Step] Opening vault: ${SANDBOX_VAULT_NAME}...`);
	return performActionAndReload(electronApp, async () => {
		await runCommand(page, OPEN_SANDBOX_VAULT);
	});
}

export async function initializeSandboxVault(
	electronApp: ElectronApplication,
	window: Page
) {
	const vaultPath = await getSandboxVaultPath(window);
	if (vaultPath) {
		console.log(`[Setup] Removing existing sandbox vault at: ${vaultPath}`);
		rmSync(vaultPath, { recursive: true, force: true });
	}
	// Note: This command is expected to create the vault if it doesn't exist.
	await openSandboxVault(electronApp, window);
}
