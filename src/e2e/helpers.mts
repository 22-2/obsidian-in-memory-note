// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\helpers.mts
import type { App } from "obsidian";
import type { ElectronApplication, JSHandle, Locator, Page } from "playwright";
import { expect } from "playwright/test";
import {
	ACTIVE_LEAF_SELECTOR,
	ROOT_WORKSPACE_SELECTOR,
	SANDBOX_VAULT_NAME,
	SANDBOX_VIEW_SELECTOR,
} from "./config.mts";
import { OPEN_SANDBOX_VAULT } from "./obsidian-commands/run-command.mts";

// --- 基本ヘルパー ---

export async function waitForWorkspace(page: Page) {
	await page.waitForSelector(".progress-bar", { state: "detached" });
	await expect(page.locator(".workspace")).toBeVisible();
}

export function focusRootWorkspace(page: Page) {
	return page.locator(ROOT_WORKSPACE_SELECTOR).focus();
}

/**
 * アクション実行後にリロード/再生成された新しいウィンドウを取得し、古いウィンドウを閉じる
 * @param electronApp ElectronApplicationのインスタンス
 * @param action 新しいウィンドウをトリガーする操作を行う関数
 * @returns 新しいPageオブジェクト
 */
export async function performActionAndReload(
	electronApp: ElectronApplication,
	action: () => Promise<void>
): Promise<Page> {
	const [newWindow] = await Promise.all([
		electronApp.waitForEvent("window"),
		action(),
	]);

	// 新しいウィンドウ以外の古いウィンドウをすべて閉じる
	for (const window of electronApp.windows()) {
		if (window !== newWindow && !window.isClosed()) {
			await window.close();
		}
	}

	await waitForWorkspace(newWindow);
	await focusRootWorkspace(newWindow);
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

	const turnOnButton = page.getByRole("button", {
		name: "Turn on community plugins",
	});
	let newPage = page;
	if (await turnOnButton.isVisible()) {
		newPage = await performActionAndReload(electronApp, () =>
			turnOnButton.click()
		);
		await newPage.keyboard.press("Control+,");
		await newPage
			.locator(".vertical-tab-header-group-items")
			.getByText("Community plugins")
			.click();
	}

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
