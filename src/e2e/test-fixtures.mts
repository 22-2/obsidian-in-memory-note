// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\base.mts
import { test as baseTest, expect } from "playwright/test";
import { setPluginInstalled } from "./obsidian-setup/initializers.mts";
import {
	commonTeardown,
	launchStarterWindow,
	launchVaultWindow,
	type LaunchStarterWindowOptions,
} from "./obsidian-setup/launch.mts";
import type {
	// 非推奨の型
	CommonSetupOptions,
	LaunchVaultWindowOptions,
	// 新しい型
	ObsidianStarterFixture,
	ObsidianVaultFixture,
	PluginInstalledFixture,
} from "./obsidian-setup/types.mts";

// --- フィクスチャの型定義 ---

type NewFixtures = {
	/** スターターページ（ボールト選択画面）のフィクスチャ */
	starter: ObsidianStarterFixture;

	starterOptions: LaunchStarterWindowOptions;

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
	starterOptions: [{}, { option: true }],

	starter: [
		async ({ starterOptions }, use, testInfo) => {
			console.log("[Fixture] Setting up: Starter Window", starterOptions);
			setPluginInstalled(); // ボールト作成後にプラグインが有効になるよう事前準備
			const setup = await launchStarterWindow(testInfo, starterOptions);
			await use(setup);
			await commonTeardown(setup.electronApp, testInfo);
		},
		{ scope: "test" },
	],

	vault: [
		async ({ vaultOptions }, use, testInfo) => {
			console.log("[Fixture] Setting up: Vault Window");
			const setup = await launchVaultWindow(testInfo, vaultOptions);
			console.log(
				`
/* ========================================================================== */
//
//  ${testInfo.title}
//
/* ========================================================================== */`.trim()
			);
			await use(setup);
			await commonTeardown(setup.electronApp, testInfo);
		},
		{ scope: "test" },
	],

	/* ======================================================================== */
	// 非推奨のフィクスチャ (後方互換性のため)
	/* ======================================================================== */

	setupOptions: [{}, { option: true }],
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
