// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\base.mts
import { existsSync } from "fs";
import test, { expect } from "playwright/test";
import invariant from "tiny-invariant";
import manifest from "../../manifest.json" with { type: "json" };
import type SandboxPlugin from "../main";
import { APP_PATH, VAULT_PATH } from "./config.mts";
import { commonSetup, commonTeardown, countTabs, setPluginInstalled } from "./helpers.mts";
import type { BaseObsidianFixture, PluginInstalledFixture } from "./types.mts";

// --- Pre-flight checks ---
invariant(
	existsSync(APP_PATH),
	`Obsidian app not found at: ${APP_PATH}. Did you run 'pnpm build:e2e' and 'e2e-setup' script?`
);
invariant(
	existsSync(VAULT_PATH),
	`E2E vault not found at: ${VAULT_PATH}. Did you run 'e2e-setup' script?`
);

// --- Common Setup/Teardown Logic ---
const pluginId = manifest.id;

export const testInitial = test.extend<{
	initialStateFixture: BaseObsidianFixture;
}>({
	initialStateFixture: [
		async ({}, use, testInfo) => {
			console.log("[Test Layer] Running with: Initial State");
			// 設定ファイルを変更せずに起動
			const setup = await commonSetup(testInfo);
			await use({ ...setup });
			await commonTeardown(setup.electronApp, testInfo);
		},
		{ scope: "test" },
	],
});

export const testPluginInstalled = test.extend<{
	pluginInstalledFixture: PluginInstalledFixture;
}>({
	pluginInstalledFixture: [
		async ({}, use, testInfo) => {
			console.log("[Test Layer] Running with: Plugin Installed");
			setPluginInstalled();
			const { electronApp, window, appHandle, pluginId, isRestorationStep } =
			await commonSetup(testInfo, {sandboxVault: true, disableRestricMode: true});

			const pluginHandle = await appHandle.evaluateHandle(
				(app, id) => app.plugins.getPlugin(id) as SandboxPlugin,
				pluginId
			);

			if (!isRestorationStep) {
				// 例: データベースクリア
				// await pluginHandle.evaluate((plugin) => plugin.databaseManager.clearAllNotes());
			}
			expect(await countTabs(appHandle)).toBe(1);

			await use({ electronApp, window, appHandle, pluginHandle, pluginId });
			await commonTeardown(electronApp, testInfo);
		},
		{ scope: "test" },
	],
});

// --- Exports for Tests ---
export { expect, VAULT_PATH as vaultPath };

// 後方互換性のためのエイリアス
export const obsidianTest = testPluginInstalled.extend<{
	obsidianFixture: PluginInstalledFixture;
}>({
	obsidianFixture: ({ pluginInstalledFixture }, use) =>
		use(pluginInstalledFixture),
});
