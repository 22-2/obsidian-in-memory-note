// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\types.mts
import type { App } from "obsidian";
import type { ElectronApplication, JSHandle, Page } from "playwright";
import type SandboxPlugin from "../main";
import type { PLUGIN_ID } from "./config.mts";

export interface BaseObsidianFixture {
	electronApp: ElectronApplication;
	window: Page;
	appHandle: JSHandle<App>;
	pluginId: typeof PLUGIN_ID;
}

export interface PluginInstalledFixture extends BaseObsidianFixture {
	pluginHandle: JSHandle<SandboxPlugin>;
}

export interface SetupFixture extends BaseObsidianFixture {
	isRestorationStep: boolean;
}

/** commonSetupに渡すオプションの型 */
export interface CommonSetupOptions {
	/** trueの場合、UI操作でRestricted Modeを無効化する */
	disableRestrictedMode?: boolean;
	/** 指定した名前のVaultをテスト開始時に開く */
	openSandboxVault?: boolean;
	startOnStarterPage?: boolean;
}
