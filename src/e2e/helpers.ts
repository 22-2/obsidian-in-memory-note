import { copyFileSync } from "fs";
import type { App } from "obsidian";
import type { Page, JSHandle, Locator } from "playwright";
import { expect } from "playwright/test";
import {
	TIMEOUT,
	ACTIVE_LEAF_SELECTOR,
	SANDBOX_VIEW_SELECTOR,
	ROOT_WORKSPACE_SELECTOR,
	vaultPath,
} from "./test-base";
import path from "path";

// --- Helper Functions (Updated to use pure selectors or require Page/appHandle) ---
export async function waitForWorkspace(page: Page) {
	// Wait for loading screen to disappear
	await page.waitForSelector(".progress-bar", {
		state: "detached",
		timeout: TIMEOUT,
	});
	await expect(page.locator(".workspace")).toBeVisible({
		timeout: TIMEOUT,
	});
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

	await expect(activeSandboxView).toBeVisible({ timeout: TIMEOUT });
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
	await expect(page.locator(SANDBOX_VIEW_SELECTOR)).toHaveCount(2, {
		timeout: TIMEOUT,
	});
}
export function initializeWorkspaceJSON() {
	copyFileSync(
		path.join(vaultPath, "/.obsidian/workspace.initial.json"),
		path.join(vaultPath, "/.obsidian/workspace.json")
	);
}
