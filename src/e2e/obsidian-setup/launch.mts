// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\obsidian-setup\launch.mts
import type { App } from "obsidian";
import path from "path";
import type { ElectronApplication, Page, TestInfo } from "playwright/test";
import { _electron as electron } from "playwright/test";
import {
	APP_MAIN_JS_PATH,
	PLUGIN_ID,
	SANDBOX_VAULT_NAME,
	TEST_VAULT_NAME,
} from "../config.mts";
import {
	focusRootWorkspace,
	getElectronAppPath,
	noopAsync,
	waitForVaultLoaded,
} from "../helpers.mts";
import { delay } from "../obsidian-commands/run-command.mts";
import {
	clearObsidianJSON,
	copyCommunityPlugins,
	disableRestrictedModeAndEnablePlugins,
	ensureLoadPage,
	getAppWindow,
	getSandboxWindow,
	getStarter,
	initializeWorkspaceJSON as initializeWorkspaceJSONSync,
	setPluginInstalled,
} from "./helpers.mts";
import { openVault } from "./ipc-helpers.mts";
import type { ObsidianStarterFixture, ObsidianVaultFixture } from "./types.mts";

// --- Electronアプリ起動 ---

/**
 * Electronアプリを起動する（シンプル版）
 */
export const launchElectronApp = async (): Promise<ElectronApplication> => {
	const appOptions = {
		args: [APP_MAIN_JS_PATH, "--no-sandbox", "--disable-setuid-sandbox"],
		env: {
			...process.env,
			NODE_ENV: "development",
		},
	};

	return electron.launch(appOptions);
};

/**
 * IPCを使用して保管庫をセットアップ
 */
const getOrCreateVault = async (
	electronApp: ElectronApplication,
	firstWindow: Page,
	vaultName: string,
	create = false
): Promise<Page> => {
	// ユーザーデータディレクトリを取得
	const userDataDir = await getElectronAppPath(firstWindow);
	const vaultPath = path.join(userDataDir, vaultName);

	console.log("vaultPath", vaultPath);

	// IPCで保管庫を開く（存在しない場合は作成）
	const vaultWindow = await reopenVaultWith(electronApp, () =>
		openVault(firstWindow, vaultPath, create)
	);

	// 古いウィンドウを閉じる
	for (const window of electronApp.windows()) {
		if (window !== vaultWindow && !window.isClosed()) {
			await window.close();
		}
	}

	await ensureLoadPage(vaultWindow);
	await focusRootWorkspace(vaultWindow);

	return vaultWindow;
};

// --- 新しいセットアップ関数 ---

export interface LaunchVaultWindowOptions {
	/**
	 * 開く保管庫名
	 * @default SANDBOX_VAULT_NAME
	 */
	vaultName?: string;
	/**
	 * 制限モード（セーフモード）を無効にし、テスト対象のプラグインを有効にするかどうか
	 * @default true
	 */
	doDisableRestrictedMode?: boolean;

	createNewVault?: boolean;
	pluginPaths?: string[];
}

export interface LaunchStarterWindowOptions {
	// 将来の拡張用
}

/**
 * Obsidianを起動し、指定された保管庫を開いた状態でセットアップ（IPC簡素化版）
 */
export const launchVaultWindow = async (
	testInfo: TestInfo,
	options: LaunchVaultWindowOptions = {}
): Promise<ObsidianVaultFixture> => {
	// オプションのデフォルト値
	const {
		vaultName = SANDBOX_VAULT_NAME,
		doDisableRestrictedMode = true,
		createNewVault,
	} = options;

	console.log(
		`\n--------------- Setup (Vault): ${testInfo.title} ---------------`
	);
	console.log("[Setup Options]", { vaultName, doDisableRestrictedMode });

	// 1. workspace.jsonを初期化
	initializeWorkspaceJSONSync();
	await clearObsidianJSON();
	if (options.pluginPaths) {
		await copyCommunityPlugins(options.pluginPaths);
	}

	await delay(1000);

	// 2. Electronアプリを起動
	const { electronApp, window: firstWindow } = await getAppWindow();

	console.log(
		`[Setup] Initial window URL: ${await firstWindow.evaluate(
			() => document.URL
		)}`
	);

	// 3. IPCで保管庫を開く
	const vaultWindow =
		vaultName === SANDBOX_VAULT_NAME
			? await getSandboxWindow(electronApp, firstWindow)
			: await getOrCreateVault(
					electronApp,
					firstWindow,
					vaultName,
					createNewVault
			  );

	// 4. 必要に応じて制限モードを無効化
	let finalWindow = vaultWindow;
	if (doDisableRestrictedMode) {
		finalWindow = await disableRestrictedModeAndEnablePlugins(
			electronApp,
			vaultWindow,
			[PLUGIN_ID]
		);
	}

	console.log(
		`[Setup] Final window URL: ${await finalWindow.evaluate(
			() => document.URL
		)}`
	);

	// 5. Appオブジェクトのハンドルを取得
	const appHandle = await finalWindow.evaluateHandle(() => window.app as App);

	return {
		electronApp,
		window: finalWindow,
		appHandle,
		pluginId: PLUGIN_ID,
	};
};

/**
 * Obsidianを起動し、スターターページを表示（IPC簡素化版）
 */
export const launchStarterWindow = async (
	testInfo: TestInfo,
	options: LaunchStarterWindowOptions = {}
): Promise<ObsidianStarterFixture> => {
	console.log(
		`\n--------------- Setup (Starter): ${testInfo.title} ---------------`
	);

	// 1. workspace.jsonを初期化
	initializeWorkspaceJSONSync();

	await delay(1000);

	// 2. Electronアプリを起動
	const electronApp = await launchElectronApp();
	let window = await electronApp.firstWindow();

	console.log(
		`[Setup] Initial window URL: ${await window.evaluate(
			() => document.URL
		)}`
	);

	window = await getStarter(electronApp, window);

	console.log(
		`[Setup] Final window URL: ${await window.evaluate(() => document.URL)}`
	);

	return {
		electronApp,
		window,
	};
};

/**
 * テスト後のクリーンアップ
 */
export const commonTeardown = async (
	electronApp: ElectronApplication,
	testInfo: TestInfo
) => {
	await electronApp?.close();
	console.log(`--------------- Teardown: ${testInfo.title} ---------------`);
};

// --- 後方互換性のため残す（非推奨） ---

/**
 * @deprecated launchVaultWindow または launchStarterWindow を使用してください
 */
export const commonSetup = async (
	testInfo: TestInfo,
	options: any = {}
): Promise<any> => {
	console.warn(
		`[DEPRECATION] 'commonSetup' is deprecated. Use 'launchVaultWindow' or 'launchStarterWindow' instead.`
	);

	if (options.startOnStarterPage) {
		return launchStarterWindow(testInfo);
	}

	return launchVaultWindow(testInfo, {
		vaultName: options.openSandboxVault
			? SANDBOX_VAULT_NAME
			: TEST_VAULT_NAME,
		doDisableRestrictedMode: options.disableRestrictedMode ?? false,
	});
};

export async function performActionAndReload(
	electronApp: ElectronApplication,
	beforeAction: () => Promise<void>,
	opts: {
		closeOldWindows?: boolean;
		waitFor?: (newWindow: Page) => Promise<void>;
		focus?: (newWindow: Page) => Promise<void>;
	} = {
		closeOldWindows: true,
		waitFor: waitForVaultLoaded,
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
