// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\base.mts
import { test as baseTest, expect } from "playwright/test";
import type SandboxPlugin from "../main";
import { PLUGIN_ID } from "./config.mts";
import { commonSetup, commonTeardown } from "./setup.mts";
import type {
	BaseObsidianFixture,
	CommonSetupOptions,
	PluginInstalledFixture,
} from "./types.mts";
import { setPluginInstalled } from "./setup-helpers.mts";

type TestFixtures = {
	obsidian: PluginInstalledFixture;
	setupOptions: CommonSetupOptions;
};

export const test = baseTest.extend<TestFixtures>({
	// デフォルトのセットアップオプションを定義
	setupOptions: [{}, { option: true }],

	obsidian: [
		async ({ setupOptions }, use, testInfo) => {
			console.log("[Test Layer] Running with: Plugin Installed");
			setPluginInstalled();
			const { electronApp, window, appHandle, isRestorationStep } =
				await commonSetup(testInfo, setupOptions);

			const pluginHandle = await appHandle.evaluateHandle(
				(app, id) => app?.plugins?.getPlugin?.(id) as SandboxPlugin,
				PLUGIN_ID
			);

			if (!isRestorationStep) {
				// 必要に応じてプラグインの状態をリセット
			}

			await use({
				electronApp,
				window,
				appHandle,
				pluginHandle,
				pluginId: PLUGIN_ID,
			});
			await commonTeardown(electronApp, testInfo);
		},
		{ scope: "test" },
	],
});

// Vault Open Fixure: 最初の状態に関わらず、確実にSandbox Vaultが開いている状態
export const testWithVaultOpen = test.extend<TestFixtures>({
	setupOptions: { openSandboxVault: true, startOnStarterPage: false },
});

// Starter Page Fixure: 最初の状態に関わらず、確実にStarter Pageが開いている状態
export const testWithStarterPage = test.extend<TestFixtures>({
	setupOptions: { openSandboxVault: false, startOnStarterPage: true },
});

export { expect };
