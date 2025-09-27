// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\base.mts
import { test as baseTest, expect, type JSHandle } from "playwright/test";
import type SandboxPlugin from "../main";
import { PLUGIN_ID } from "./config.mts";
import type {
	// 新しい型
	ObsidianStarterFixture,
	ObsidianVaultFixture,
	LaunchVaultWindowOptions,
	// 非推奨の型
	CommonSetupOptions,
	PluginInstalledFixture,
} from "./obsidian-setup/types.mts";
import { setPluginInstalled } from "./obsidian-setup/helpers.mts";
import {
	commonSetup,
	commonTeardown,
	launchStarterWindow,
	launchVaultWindow,
} from "./obsidian-setup/launch.mts";

// --- フィクスチャの型定義 ---

type NewFixtures = {
	/** スターターページ（ボールト選択画面）のフィクスチャ */
	starter: ObsidianStarterFixture;
	/** ボールトを開いた状態のフィクスチャ */
	vault: ObsidianVaultFixture;
	/** `vault`フィクスチャの起動オプション */
	vaultOptions: LaunchVaultWindowOptions;
};

type DeprecatedFixtures = {
	/** @deprecated `starter` または `vault` を使用してください */
	obsidian: PluginInstalledFixture;
	/** @deprecated `vaultOptions` を使用してください */
	setupOptions: CommonSetupOptions;
};

// --- テストの拡張 ---

export const test = baseTest.extend<NewFixtures & DeprecatedFixtures>({
	/* ======================================================================== */
	// 新しいフィクスチャ
	/* ======================================================================== */

	vaultOptions: [{}, { option: true }],

	starter: [
		async ({}, use, testInfo) => {
			console.log("[Fixture] Setting up: Starter Window");
			setPluginInstalled(); // ボールト作成後にプラグインが有効になるよう事前準備
			const setup = await launchStarterWindow(testInfo);
			await use(setup);
			await commonTeardown(setup.electronApp, testInfo);
		},
		{ scope: "test" },
	],

	vault: [
		async ({ vaultOptions }, use, testInfo) => {
			console.log("[Fixture] Setting up: Vault Window");
			setPluginInstalled();
			const setup = await launchVaultWindow(testInfo, vaultOptions);

			if (!setup.appHandle) {
				throw new Error(
					"appHandle is not available. Vault might not be open."
				);
			}
			// const pluginHandle = await setup.appHandle.evaluateHandle(
			// 	(app, pluginId) =>
			// 		app.plugins.plugins[pluginId] as SandboxPlugin,
			// 	PLUGIN_ID
			// );

			// `SetupFixture` を `ObsidianVaultFixture` に変換
			const vaultFixture: ObsidianVaultFixture = {
				...setup,
				appHandle: setup.appHandle, // 型を non-nullable に
				// pluginHandle: pluginHandle as JSHandle<SandboxPlugin>,
			};

			await use(vaultFixture);
			await commonTeardown(setup.electronApp, testInfo);
		},
		{ scope: "test" },
	],

	/* ======================================================================== */
	// 非推奨のフィクスチャ (後方互換性のため)
	/* ======================================================================== */

	setupOptions: [{}, { option: true }],

	obsidian: [
		async ({ setupOptions }, use, testInfo) => {
			console.warn(
				"[DEPRECATION] The 'obsidian' fixture is deprecated. Please use 'starter' or 'vault' instead."
			);
			setPluginInstalled();
			const setup = await commonSetup(testInfo, setupOptions);

			let pluginHandle: JSHandle<SandboxPlugin> | null = null;
			if (setup.appHandle) {
				pluginHandle = await setup.appHandle.evaluateHandle(
					(app, pluginId) =>
						app.plugins.plugins[pluginId] as SandboxPlugin,
					PLUGIN_ID
				);
			}

			const fixture: PluginInstalledFixture = {
				...setup,
				// pluginHandleはnullになりうるためキャストが必要
				pluginHandle: pluginHandle as JSHandle<SandboxPlugin>,
			};

			await use(fixture);

			await commonTeardown(setup.electronApp, testInfo);
		},
		{ scope: "test" },
	],
});

/* ========================================================================== */
// 非推奨のテストヘルパー
/* ========================================================================== */

type DeprecatedTestFixtures = {
	obsidian: PluginInstalledFixture;
	setupOptions: CommonSetupOptions;
};

/**
 * @deprecated `test`を直接使用し、`vault`フィクスチャと`vaultOptions`でボールトの状態を制御してください。
 * 例: `test.use({ vaultOptions: { openSandboxVault: true } });`
 */
export const testWithVaultOpen = test.extend<DeprecatedTestFixtures>({
	setupOptions: { openSandboxVault: true, startOnStarterPage: false },
});

/**
 * @deprecated `test`を直接使用し、`starter`フィクスチャを使用してください。
 */
export const testWithStarterPage = test.extend<DeprecatedTestFixtures>({
	setupOptions: { openSandboxVault: false, startOnStarterPage: true },
});

export { expect };
