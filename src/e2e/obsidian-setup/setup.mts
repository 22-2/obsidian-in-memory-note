// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\setup.mts
import type { ElectronApplication, TestInfo } from "playwright/test";
import { _electron as electron } from "playwright/test";
import type { App } from "obsidian";
import { APP_MAIN_JS_PATH, PLUGIN_ID, SANDBOX_VAULT_NAME } from "../config.mts";
import type { CommonSetupOptions, SetupFixture } from "../types.mts";
import {
	disableRestrictedModeAndEnablePlugins,
	ensureStarterPage,
	ensureVaultOpen,
	initializeObsidianJSON,
	initializeWorkspaceJSON,
} from "./setup-helpers.mts";
import { focusRootWorkspace, waitForWorkspace } from "../helpers.mts";

export const commonSetup = async (
	testInfo: TestInfo,
	options: CommonSetupOptions = {}
): Promise<SetupFixture> => {
	const isRestorationStep = testInfo.title.includes(
		"restore note content after an application restart"
	);
	console.log(`\n--------------- Setup: ${testInfo.title} ---------------`);
	console.log("[Setup Options]", options);

	// --- 1. ファイルシステムレベルのセットアップ ---
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

	// --- 2. アプリケーションの起動 ---
	const electronApp = await electron.launch(appOptions);
	let window = await electronApp.firstWindow();
	console.log(
		`[Setup] Initial window URL: ${await window.evaluate(
			() => document.URL
		)}`
	);

	const isStarter = window.url().includes("starter");

	if (isStarter) {
		await window.waitForSelector(".mod-change-language");
	}

	if (options.startOnStarterPage) {
		console.log("[Setup] Ensuring state: Starter Page");
		return {
			electronApp,
			window: isStarter
				? window
				: await ensureStarterPage(electronApp, window),
			appHandle: null,
			pluginId: PLUGIN_ID,
			isRestorationStep,
		};
	}
	console.log("[Setup] Ensuring state: Vault Open");
	window = await ensureVaultOpen(
		electronApp,
		window,
		options.openSandboxVault ? SANDBOX_VAULT_NAME : undefined
	);

	if (options.disableRestrictedMode) {
		await disableRestrictedModeAndEnablePlugins(electronApp, window, [
			PLUGIN_ID,
		]);
	} else if (options.openSandboxVault) {
	} else {
		// オプション指定なしの場合、起動時の初期状態をそのまま利用
		console.log("[Setup] Using initial state on launch");
		await waitForWorkspace(window);
		await focusRootWorkspace(window);
	}

	console.log(
		`[Setup] Final window URL: ${await window.evaluate(() => document.URL)}`
	);

	// --- 4. 共通の後処理 ---
	const appHandle = await window.evaluateHandle(
		// @ts-expect-error app is available
		() => window.app as App
	);

	return {
		electronApp,
		window,
		appHandle,
		pluginId: PLUGIN_ID,
		isRestorationStep,
	};
};

export const commonTeardown = async (
	electronApp: ElectronApplication,
	testInfo: TestInfo
) => {
	await electronApp?.close();
	console.log(`--------------- Teardown: ${testInfo.title} ---------------`);
};
