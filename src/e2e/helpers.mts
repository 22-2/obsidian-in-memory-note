// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\helpers.mts
import type { App } from "obsidian";
import type { JSHandle, Locator, Page } from "playwright";
import { expect } from "playwright/test";
import {
	ACTIVE_LEAF_SELECTOR,
	ROOT_WORKSPACE_SELECTOR,
	SANDBOX_VIEW_SELECTOR,
} from "./config.mts";

// --- 基本ヘルパー ---

export async function waitForWorkspace(page: Page) {
	await page.waitForSelector(".progress-bar", { state: "detached" });
	await expect(page.locator(".workspace")).toBeVisible();
}

export function focusRootWorkspace(page: Page) {
	return page.locator(ROOT_WORKSPACE_SELECTOR).focus();
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

// --- APIベースヘルパー ---

export async function countTabs(appHandle: JSHandle<App>): Promise<number> {
	return appHandle.evaluate((app) => {
		let count = 0;
		app.workspace.iterateRootLeaves((_) => count++);
		return count;
	});
}
export const noop = () => {};
export const noopAsync = async () => {};
