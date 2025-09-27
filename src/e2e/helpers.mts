// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\helpers.mts
import type { App } from "obsidian";
import type { ElectronApplication, JSHandle, Locator, Page } from "playwright";
import { expect } from "playwright/test";
import {
	ACTIVE_LEAF_SELECTOR,
	PLUGIN_ID,
	ROOT_WORKSPACE_SELECTOR,
	SANDBOX_VAULT_NAME,
	SANDBOX_VIEW_SELECTOR,
	VAULT_PATH,
} from "./config.mts";
import { OPEN_SANDBOX_VAULT } from "./obsidian-commands/run-command.mts";
import { copyFileSync, readFileSync, rmSync, writeFileSync } from "fs";
import { ensureSandboxVault } from "./setup.mts";
import { COMMUNITY_PLUGINS_PATH } from "./config.mts";
import path from "path";
import invariant from "tiny-invariant";

// --- 基本ヘルパー ---

export async function waitForWorkspace(page: Page) {
	await page.waitForSelector(".progress-bar", { state: "detached" });
	await expect(page.locator(".workspace")).toBeVisible();
}

export function focusRootWorkspace(page: Page) {
	return page.locator(ROOT_WORKSPACE_SELECTOR).focus();
}

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
		// 新しいウィンドウ以外の古いウィンドウをすべて閉じる
		for (const window of electronApp.windows()) {
			if (window !== newWindow && !window.isClosed()) {
				console.log(await window.title());
				await window.close();
			}
		}
	}

	opts.waitFor && (await opts.waitFor(newWindow));
	opts.focus && (await opts.focus(newWindow));
	return newWindow;
}

// --- UI操作ヘルパー ---

export async function openNewSandboxNote(page: Page) {
	await page.getByLabel("Open new hot sandbox note", { exact: true }).click();
}

export async function getActiveSandboxLocator(page: Page): Promise<Locator> {
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
	return page.locator(
		`${ROOT_WORKSPACE_SELECTOR} .workspace-tab-header.is-active .workspace-tab-header-inner-title`
	);
}

export async function splitActiveView(page: Page, direction: "right" | "down") {
	await page
		.locator(
			`${ACTIVE_LEAF_SELECTOR} .view-actions .clickable-icon[aria-label='More options']`
		)
		.first()
		.click();
	await page
		.locator(".menu-item-title", { hasText: `Split ${direction}` })
		.click();
	await expect(page.locator(SANDBOX_VIEW_SELECTOR)).toHaveCount(2);
}

/**
 * コマンドパレットを開いて指定のコマンドを実行する
 */
export async function runCommand(page: Page, command: string) {
	await page.keyboard.press("Control+P");
	const commandPalette = page.locator(".prompt-input");
	await expect(commandPalette).toBeVisible();
	await commandPalette.fill(command);
	await page.locator(".suggestion-item.is-selected").click();
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

	let newPage = await performActionAndReload(electronApp, async () =>
		page
			.getByRole("button", {
				name: "Turn on and reload",
			})
			.click()
	);
	await newPage.keyboard.press("Control+,");
	await newPage
		.locator(".vertical-tab-header-group-items")
		.getByText("Community plugins")
		.click();

	const turnOnButton = page.getByRole("button", {
		name: "Turn on community plugins",
	});
	turnOnButton.click();

	await newPage.keyboard.press("Escape");
	await newPage.keyboard.press("Control+,");

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
}

// --- APIベースヘルパー ---

export async function countTabs(appHandle: JSHandle<App>): Promise<number> {
	return appHandle.evaluate((app) => {
		let count = 0;
		app.workspace.iterateRootLeaves((_) => count++);
		return count;
	});
}
const noop = () => {};
export const noopAsync = async () => {};
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
export async function initializeSandboxVault(
	electronApp: ElectronApplication,
	window: Page
) {
	const path = await getSandboxVaultPath(window);
	if (path) rmSync(path as string, { recursive: true, force: true });
	await ensureSandboxVault(electronApp, window);
}

export function getSandboxVaultPath(window: Page) {
	return window.evaluate(() =>
		Object.values(
			// @ts-expect-error
			window.electron.ipcRenderer.sendSync("vault-list")
		).find((v: any) => v.path.includes(SANDBOX_VAULT_NAME).path as string)
	);
}
