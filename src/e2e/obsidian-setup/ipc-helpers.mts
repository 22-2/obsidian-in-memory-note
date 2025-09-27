// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\obsidian-setup\ipc-helpers.mts
import type { Page } from "playwright";
import type { ObsidianJSON } from "./types.mts";
import { ensureLoadPage } from "./helpers.mts";

// --- 汎用IPCラッパー ---

/**
 * Obsidianのメインプロセスで同期的なIPC呼び出しを実行します。
 * この汎用ヘルパー関数は、各IPCヘルパーの定型的なコードを削減するために使用します。
 * @param page - PlaywrightのPageオブジェクト
 * @param channel - 送信するIPCチャンネル
 * @param args - IPCメッセージと共に送信する引数
 * @returns IPC呼び出しの結果で解決されるPromise
 */
async function ipcSendSync<T>(
	page: Page,
	channel: string,
	...args: unknown[]
): Promise<T> {
	await ensureLoadPage(page);
	console.log("page", page.url(), page.title());
	console.log("channel", channel);
	console.log("args", args);
	return page.evaluate(
		([ch, ...restArgs]) => {
			// Obsidianのウィンドウコンテキストでは `window.electron.ipcRenderer` が利用可能です
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return (window as any).electron.ipcRenderer.sendSync(
				ch,
				...restArgs
			);
		},
		[channel, ...args]
	);
}

// --- IPCヘルパー関数 ---

/**
 * IPCを介して、登録されているVaultのリストを取得します。
 * @param page - PlaywrightのPageオブジェクト
 * @returns Vaultのリスト
 */
export async function getVaultList(page: Page): Promise<ObsidianJSON> {
	return ipcSendSync<ObsidianJSON>(page, "vault-list");
}

/**
 * IPCを介して、指定されたパスのVaultを開きます。
 * @param page - PlaywrightのPageオブジェクト
 * @param vaultPath - 開くVaultのパス
 * @param createNew - 存在しない場合に新規作成するかどうか (デフォルト: false)
 * @returns 成功した場合は true、失敗した場合はエラーメッセージ文字列
 */
export async function openVault(
	page: Page,
	vaultPath: string,
	createNew = false
): Promise<true | string> {
	return ipcSendSync<true | string>(page, "vault-open", vaultPath, createNew);
}

/**
 * IPCを介してスターターページ（Vault選択画面）を開きます。
 * @param page - PlaywrightのPageオブジェクト
 */
export async function openStarter(page: Page): Promise<unknown> {
	return ipcSendSync(page, "starter");
}

/**
 * IPCを介して、指定されたパスのVaultをリストから削除します。
 * @param page - PlaywrightのPageオブジェクト
 * @param vaultPath - 削除するVaultのパス
 */
export async function removeVault(
	page: Page,
	vaultPath: string
): Promise<unknown> {
	return ipcSendSync(page, "vault-remove", vaultPath);
}

/**
 * IPCを介して、サンドボックスVaultのパスを取得します。
 * @param page - PlaywrightのPageオブジェクト
 * @returns サンドボックスVaultのパス文字列
 */
export async function getSandboxPath(page: Page): Promise<string> {
	return ipcSendSync<string>(page, "get-sandbox-vault-path");
}
/**
 * IPCを介して、サンドボックスVaultのパスを取得します。
 * @param page - PlaywrightのPageオブジェクト
 * @returns サンドボックスVaultのパス文字列
 */
export async function openSandboxVault(page: Page): Promise<string> {
	return ipcSendSync(page, "sandbox");
}
