// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\obsidian-setup\launch.mts
import type { App } from "obsidian";
import type { ElectronApplication, TestInfo } from "playwright/test";
import { _electron as electron } from "playwright/test";
import {
	APP_MAIN_JS_PATH,
	PLUGIN_ID,
	SANDBOX_VAULT_NAME,
	TEST_VAULT_NAME,
} from "../config.mts";
import { delay } from "../obsidian-commands/run-command.mts";
import { clearSandboxVault, getOrCreateVault } from "./helpers.mts";
import { disableRestrictedModeAndEnablePlugins } from "./operations.mts";
import { clearObsidianJSON, copyCommunityPlugins } from "./initializers.mts";
import { clearWorkspaceJSONSync } from "./initializers.mts";
import { getStarter, getVault, getVaultPathByPage } from "./getters.mts";
import { getSandboxWindow } from "./getters.mts";
import { getAppWindow } from "./getters.mts";
import type {
	LaunchStarterWindowOptions,
	LaunchVaultWindowOptions,
	ObsidianStarterFixture,
	ObsidianVaultFixture,
} from "./types.mts";

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
	// clearWorkspaceJSONSync();
	await clearObsidianJSON();

	await delay(1000);

	// 2. Electronアプリを起動
	let { electronApp, window } = await getAppWindow();

	let currentWindow = window;

	console.log(
		`[Setup] Initial window URL: ${await currentWindow.evaluate(
			() => document.URL
		)}`
	);

	if (vaultName === SANDBOX_VAULT_NAME) {
		currentWindow = await clearSandboxVault(electronApp, currentWindow);
	}

	// 3. IPCで保管庫を開く
	currentWindow =
		vaultName === SANDBOX_VAULT_NAME
			? await getSandboxWindow(electronApp, currentWindow)
			: await getOrCreateVault(
					electronApp,
					currentWindow,
					vaultName,
					createNewVault
			  );

	if (options.pluginPaths) {
		await copyCommunityPlugins(
			options.pluginPaths,
			await getVaultPathByPage(currentWindow)
		);
	}

	if (doDisableRestrictedMode) {
		currentWindow = await disableRestrictedModeAndEnablePlugins(
			electronApp,
			currentWindow,
			[PLUGIN_ID]
		);
	}

	console.log(
		`[Setup] Final window URL: ${await currentWindow.evaluate(
			() => document.URL
		)}`
	);

	// 5. Appオブジェクトのハンドルを取得
	const appHandle = await currentWindow.evaluateHandle(
		() => window.app as App
	);

	return {
		electronApp,
		window: currentWindow,
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
	clearWorkspaceJSONSync();

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
