// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\base.mts
import type { App } from "obsidian";
import {
	type ElectronApplication,
	type JSHandle,
	type Page,
} from "playwright";
import manifest from "../../manifest.json" with { type: "json" };
import type SandboxPlugin from "../main";


// --- Fixture Interfaces ---
export interface BaseObsidianFixture {
	electronApp: ElectronApplication;
	window: Page;
	appHandle: JSHandle<App>;
	pluginId: (typeof manifest)["id"];
}
export interface PluginInstalledFixture extends BaseObsidianFixture {
	pluginHandle: JSHandle<SandboxPlugin>;
}

export interface SetupFixuture extends BaseObsidianFixture {
	isRestorationStep: boolean;
}
