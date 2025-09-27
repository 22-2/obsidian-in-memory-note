// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\obsidian-setup\helpers.mts
import type { ElectronApplication, Page } from "playwright";

import {
	focusRootWorkspace,
	getElectronAppPath,
	noopAsync,
	waitForLayoutReady,
} from "../helpers.mts";
import { navigateToComminutyPlugins } from "./operations.mts";
import { delay } from "../obsidian-commands/run-command.mts";
import {
	getCurrentVaultName,
	getSandboxWindow,
	getCurrentVaultName as getVaultNameByPage,
	getVaultPathByPage,
} from "./getters.mts";
import { rmSync } from "fs";
import { SANDBOX_VAULT_NAME } from "../config.mts";
import path from "path";
import { openVault } from "./ipc-helpers.mts";

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
export async function performActionAndReload(
	electronApp: ElectronApplication,
	beforeAction: () => Promise<void>,
	opts: {
		closeOldWindows?: boolean;
		waitFor?: (newWindow: Page) => Promise<void>;
		focus?: (newWindow: Page) => Promise<void>;
	} = {
		closeOldWindows: true,
		waitFor: waitForLayoutReady,
		focus: focusRootWorkspace,
	}
): Promise<Page> {
	console.log("[Setup] Performing action to open new window...");
	await beforeAction();
	console.log("[Setup] Action performed.");
	console.log("[Setup] Waiting for new window to open...");
	const newWindow = await electronApp.waitForEvent("window");
	console.log("[Setup] New window event detected.");

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

	if (opts.waitFor)
		console.log("[Setup] Waiting for new window to be ready...");
	opts.waitFor && (await opts.waitFor(newWindow));
	if (opts.waitFor) console.log("[Setup] New window is ready.");

	if (opts.focus) console.log("[Setup] Focusing new window...");
	opts.focus && (await opts.focus(newWindow));
	if (opts.focus) console.log("[Setup] New window focused.");
	return newWindow;
}
/**
 * ✨【NEW】アクションを実行し、新しいVaultウィンドウが開かれて準備完了になるのを待つ
 * @param electronApp - ElectronApplicationのインスタンス
 * @param action - Vaultを開くトリガーとなるアクション
 * @returns 新しいVaultのPageオブジェクト
 */

export async function reopenVaultWith(
	electronApp: ElectronApplication,
	action: () => Promise<any>
): Promise<Page> {
	console.log("[Setup Action] Opening a vault...");
	return performActionAndReload(electronApp, action, {
		closeOldWindows: true,
		waitFor: ensureLoadPage,
		focus: focusRootWorkspace,
	});
}
/**
 * ✨【NEW】アクションを実行し、スターターページが開かれるのを待つ
 * @param electronApp - ElectronApplicationのインスタンス
 * @param action - スターターページを開くトリガーとなるアクション
 * @returns 新しいスターターページのPageオブジェクト
 */

export async function reopenStarterPageWith(
	electronApp: ElectronApplication,
	action: () => Promise<void>
): Promise<Page> {
	console.log("[Setup Action] Opening the starter page...");
	return performActionAndReload(electronApp, action, {
		closeOldWindows: true,
		// スターターページにはワークスペースがないため、専用の待機処理を行う
		waitFor: async (win) => {
			await win.waitForSelector(".mod-change-language", {
				state: "visible",
			});
		},
		// スターターページでは特定の要素へのフォーカスは不要
		focus: noopAsync,
	});
}

export function checkIsStarter(window: Page): boolean {
	return window.url().includes("starter");
}
export async function clearSandboxVault(
	electoronApp: ElectronApplication,
	window: Page
) {
	if ((await getCurrentVaultName(window)) !== SANDBOX_VAULT_NAME) {
		return getSandboxWindow(electoronApp, window);
	}
	const tempWin = await getOrCreateVault(
		electoronApp,
		window,
		"temp-" + Date.now(),
		true
	);
	const tempVaultPath = await getVaultPathByPage(tempWin);
	console.log("tempVaultPath", tempVaultPath);
	await closeWindowWithOut(tempWin, electoronApp);
	const sandbox = await getSandboxWindow(electoronApp, tempWin);
	console.log("Cleared sandbox vault");
	await closeWindowWithOut(sandbox, electoronApp);
	rmSync(tempVaultPath, { recursive: true });
	console.log("removed temp vault");
	return sandbox;
}
/**
 * IPCを使用して保管庫をセットアップ
 */

export async function getOrCreateVault(
	electronApp: ElectronApplication,
	firstWindow: Page,
	vaultName: string,
	create = false
): Promise<Page> {
	// ユーザーデータディレクトリを取得
	const userDataDir = await getElectronAppPath(firstWindow);
	const vaultPath = path.join(userDataDir, vaultName);

	console.log("vaultPath", vaultPath);

	// IPCで保管庫を開く（存在しない場合は作成）
	const vaultWindow = await reopenVaultWith(electronApp, () =>
		openVault(firstWindow, vaultPath, create)
	);
	return vaultWindow;
}

export async function closeWindowWithOut(
	vaultWindow: Page,
	electronApp: ElectronApplication
) {
	// 古いウィンドウを閉じる
	for (const window of electronApp.windows()) {
		if (window !== vaultWindow && !window.isClosed()) {
			await window.close();
		}
	}
}
