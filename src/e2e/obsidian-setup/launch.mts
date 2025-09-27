// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\setup.mts
import type { ElectronApplication, TestInfo } from "playwright/test";
import { _electron as electron } from "playwright/test";
import type { App } from "obsidian";
import { APP_MAIN_JS_PATH, PLUGIN_ID, SANDBOX_VAULT_NAME } from "../config.mts";
import type {
	CommonSetupOptions,
	ObsidianStarterFixture,
	ObsidianVaultFixture,
	SetupFixture,
} from "./types.mts";
import {
	disableRestrictedModeAndEnablePlugins,
	ensureStarterPage,
	ensureVaultOpen,
	initializeObsidianJSON,
	initializeWorkspaceJSON,
} from "./helpers.mts";
import { focusRootWorkspace, waitForWorkspace } from "../helpers.mts";

// --- 共通ヘルパー関数 ---

/**
 * テスト実行前に、Obsidianの設定ファイル（obsidian.json, workspace.json）を初期化します。
 * @param isRestorationStep 復元ステップのテストかどうか
 * @returns Electronアプリケーションの起動オプション
 */
const initializeFileSystemAndGetAppOptions = async (
	isRestorationStep: boolean
) => {
	if (!isRestorationStep) {
		initializeWorkspaceJSON();
	}

	const appOptions = {
		args: [APP_MAIN_JS_PATH, "--no-sandbox", "--disable-setuid-sandbox"],
		env: {
			...process.env,
			NODE_ENV: "development",
		},
	};
	// obsidian.jsonを初期化するために一時的なアプリインスタンスを使用
	const dummyApp = await electron.launch(appOptions);
	await initializeObsidianJSON(dummyApp);
	await dummyApp.close();

	return appOptions;
};

// --- 新しいセットアップ関数 ---

export interface LaunchVaultWindowOptions {
	/**
	 * サンドボックスボールトを開くかどうかを指定します。
	 * trueの場合、`SANDBOX_VAULT_NAME`で定義されたボールトを開きます。
	 * falseの場合、最後に開かれたボールト（またはデフォルト）を開きます。
	 * @default true
	 */
	openSandboxVault?: boolean;
	/**
	 * 制限モード（セーフモード）を無効にし、テスト対象のプラグインを有効にするかどうかを指定します。
	 * @default true
	 */
	doDisableRestrictedMode?: boolean;
}

/**
 * Obsidianを起動し、指定されたボールトを開いた状態でセットアップします。
 * この関数は、プラグインの機能テストなど、ボールトが開いていることを前提とするテストに使用します。
 * @param testInfo Playwrightのテスト情報オブジェクト
 * @param options セットアップのオプション
 * @returns セットアップされた環境のフィクスチャ
 */
export const launchVaultWindow = async (
	testInfo: TestInfo,
	options: LaunchVaultWindowOptions = {}
): Promise<ObsidianVaultFixture> => {
	// オプションにデフォルト値を設定
	const {
		openSandboxVault = true,
		doDisableRestrictedMode: disableRestrictedMode = true,
	} = options;

	const isRestorationStep = testInfo.title.includes(
		"restore note content after an application restart"
	);
	console.log(
		`\n--------------- Setup (Vault): ${testInfo.title} ---------------`
	);
	console.log("[Setup Options]", { openSandboxVault, disableRestrictedMode });

	// 1. ファイルシステムを初期化し、アプリ起動オプションを取得
	const appOptions = await initializeFileSystemAndGetAppOptions(
		isRestorationStep
	);

	// 2. アプリケーションを起動
	const electronApp = await electron.launch(appOptions);
	let window = await electronApp.firstWindow();
	console.log(
		`[Setup] Initial window URL: ${await window.evaluate(
			() => document.URL
		)}`
	);

	// 3. ボールトが開いた状態を保証
	console.log("[Setup] Ensuring state: Vault Open");
	window = await ensureVaultOpen(
		electronApp,
		window,
		openSandboxVault ? SANDBOX_VAULT_NAME : undefined
	);

	// 4. ボールト内の設定
	if (disableRestrictedMode) {
		await disableRestrictedModeAndEnablePlugins(electronApp, window, [
			PLUGIN_ID,
		]);
	} else {
		// 制限モードを無効にしない場合でも、ワークスペースの準備は待つ
		await waitForWorkspace(window);
		await focusRootWorkspace(window);
	}

	console.log(
		`[Setup] Final window URL: ${await window.evaluate(() => document.URL)}`
	);

	// 5. Appオブジェクトのハンドルを取得
	const appHandle = await window.evaluateHandle(
		// @ts-expect-error app is available on the window
		() => window.app as App
	);

	return {
		electronApp,
		window,
		appHandle,
		pluginId: PLUGIN_ID,
	};
};

/**
 * Obsidianを起動し、スターターページ（ボールト選択画面）を表示した状態でセットアップします。
 * ボールトの作成や選択などのUIテストに使用します。
 * @param testInfo Playwrightのテスト情報オブジェクト
 * @returns セットアップされた環境のフィクスチャ（appHandleは常にnull）
 */
export const launchStarterWindow = async (
	testInfo: TestInfo
): Promise<ObsidianStarterFixture> => {
	const isRestorationStep = testInfo.title.includes(
		"restore note content after an application restart"
	);
	console.log(
		`\n--------------- Setup (Starter): ${testInfo.title} ---------------`
	);

	// 1. ファイルシステムを初期化し、アプリ起動オプションを取得
	const appOptions = await initializeFileSystemAndGetAppOptions(
		isRestorationStep
	);

	// 2. アプリケーションを起動
	const electronApp = await electron.launch(appOptions);
	let window = await electronApp.firstWindow();
	console.log(
		`[Setup] Initial window URL: ${await window.evaluate(
			() => document.URL
		)}`
	);

	// 3. スターターページが表示される状態を保証
	console.log("[Setup] Ensuring state: Starter Page");
	window = await ensureStarterPage(electronApp, window);

	// スターターページの要素が表示されるのを待つ
	await window.waitForSelector(".mod-change-language");

	console.log(
		`[Setup] Final window URL: ${await window.evaluate(() => document.URL)}`
	);

	return {
		electronApp,
		window,
	};
};

/**
 * @deprecated この関数は `launchVaultWindow` と `launchStarterWindow` に分割されました。
 * テストの目的に応じて、いずれかの新しい関数を使用してください。
 *
 * - ボールトを開いた状態でテストを開始する場合: `launchVaultWindow(testInfo, options)`
 * - スターターページからテストを開始する場合: `launchStarterWindow(testInfo)`
 */
export const commonSetup = async (
	testInfo: TestInfo,
	options: CommonSetupOptions = {}
): Promise<SetupFixture> => {
	// ログに非推奨であることを明記
	console.warn(
		`[DEPRECATION] 'commonSetup' is deprecated. Use 'launchVaultWindow' or 'launchStarterWindow' instead.`
	);
	console.log(
		`\n--------------- Setup (DEPRECATED): ${testInfo.title} ---------------`
	);

	// オプションに基づいて新しい関数に処理を委譲
	if (options.startOnStarterPage) {
		// @ts-expect-error
		return launchStarterWindow(testInfo);
	}

	// CommonSetupOptions を LaunchVaultWindowOptions に変換
	// 元の関数の挙動（オプション未指定時はfalse）を維持するため、undefinedをfalseに変換
	const vaultOptions: LaunchVaultWindowOptions = {
		openSandboxVault: options.openSandboxVault ?? false,
		doDisableRestrictedMode: options.disableRestrictedMode ?? false,
	};
	// @ts-expect-error
	return launchVaultWindow(testInfo, vaultOptions);
};

export const commonTeardown = async (
	electronApp: ElectronApplication,
	testInfo: TestInfo
) => {
	await electronApp?.close();
	console.log(`--------------- Teardown: ${testInfo.title} ---------------`);
};
