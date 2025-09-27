// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\helpers.mts
import type { App } from "obsidian";
import type { ElectronApplication, JSHandle, Locator, Page } from "playwright";
import { type App as ElectronApp } from "electron";
import { expect } from "playwright/test";
import {
	ACTIVE_LEAF_SELECTOR,
	ROOT_WORKSPACE_SELECTOR,
	SANDBOX_VIEW_SELECTOR,
} from "./config.mts";
import path from "path";
import { getSandboxPath } from "./obsidian-setup/ipc-helpers.mts";

// --- IPCヘルパー ---

/**
 * IPCを使用してアプリケーション情報を取得
 */
export async function getAppInfo(page: Page) {
	return page.evaluate(() => ({
		version: window.electron.ipcRenderer.sendSync("version"),
		isDev: window.electron.ipcRenderer.sendSync("is-dev"),
		resourcesPath: window.electron.ipcRenderer.sendSync("resources"),
	}));
}

/**
 * IPCを使用してファイルをゴミ箱に移動
 */
export async function trashFile(page: Page, filePath: string) {
	return page.evaluate(async (path) => {
		return window.electron.ipcRenderer.invoke("trash", path);
	}, filePath);
}

/**
 * IPCを使用して外部URLを開く
 */
export async function openExternalUrl(page: Page, url: string) {
	return page.evaluate((url) => {
		window.electron.ipcRenderer.send("open-url", url);
	}, url);
}

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

/**
 * 設定画面を開く（IPCメニュー操作の代替）
 */
export async function openSettings(page: Page) {
	// Ctrl+, または Command+, で設定を開く
	const modifier = process.platform === "darwin" ? "Meta" : "Control";
	await page.keyboard.press(`${modifier}+,`);
	await expect(page.locator(".modal-container")).toBeVisible();
}

/**
 * PDFとして印刷（IPC版）
 */
export async function printToPDF(page: Page, options: any = {}) {
	return new Promise((resolve, reject) => {
		// 結果を受け取るリスナーを設定
		page.once("console", (msg) => {
			if (msg.text().includes("PDF_SAVED:")) {
				const result = msg.text().replace("PDF_SAVED:", "");
				resolve(result);
			} else if (msg.text().includes("PDF_ERROR:")) {
				reject(new Error(msg.text().replace("PDF_ERROR:", "")));
			}
		});

		// IPCでPDF印刷を実行
		page.evaluate((opts) => {
			window.electron.ipcRenderer.send("print-to-pdf", opts);
			window.electron.ipcRenderer.once(
				"print-to-pdf",
				(event, result) => {
					if (result.success) {
						console.log("PDF_SAVED:" + result.path);
					} else {
						console.log("PDF_ERROR:" + result.error);
					}
				}
			);
		}, options);
	});
}

// --- APIベースヘルパー ---

export async function countTabs(appHandle: JSHandle<App>): Promise<number> {
	return appHandle.evaluate((app) => {
		let count = 0;
		app.workspace.iterateRootLeaves((_) => count++);
		return count;
	});
}

/**
 * 現在の保管庫情報を取得（IPC版）
 */
export async function getCurrentVault(page: Page) {
	return page.evaluate(() => {
		return window.electron.ipcRenderer.sendSync("vault");
	});
}

/**
 * アプリケーションを再起動（IPC版）
 */
export async function relaunchApp(page: Page) {
	return page.evaluate(() => {
		window.electron.ipcRenderer.send("relaunch");
	});
}

// ユーティリティ関数
export const noop = () => {};
export const noopAsync = async () => {};

export async function getElectronAppPath(window: Page) {
	return path.dirname(await getSandboxPath(window));
}
