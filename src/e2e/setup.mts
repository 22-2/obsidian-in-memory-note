// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\setup.mts
import { copyFileSync, writeFileSync } from "fs";
import path from "path";
import type { App } from "obsidian";
import type { ElectronApplication, TestInfo } from "playwright/test";
import { _electron as electron } from "playwright/test";

import { APP_MAIN_JS_PATH, PLUGIN_ID, VAULT_PATH } from "./config.mts";
import {
	disableRestrictedModeAndEnablePlugins,
	focusRootWorkspace,
	openAnotherVault,
	waitForWorkspace,
} from "./helpers.mts";
import type { CommonSetupOptions, SetupFixture } from "./types.mts";

const COMMUNITY_PLUGINS_PATH = path.join(
	VAULT_PATH,
	"/.obsidian/community-plugins.json"
);

export function initializeWorkspaceJSON() {
	copyFileSync(
		path.join(VAULT_PATH, "/.obsidian/workspace.initial.json"),
		path.join(VAULT_PATH, "/.obsidian/workspace.json")
	);
}

export function setCommunityPlugins(enabledPlugins: string[]) {
	writeFileSync(
		COMMUNITY_PLUGINS_PATH,
		JSON.stringify(enabledPlugins),
		"utf-8"
	);
	const pluginList =
		enabledPlugins.length > 0 ? enabledPlugins.join(", ") : "none";
	console.log(`[Plugin Config] Set enabled plugins: ${pluginList}`);
}

export function setPluginInstalled() {
	setCommunityPlugins([PLUGIN_ID]);
}

export function setPluginDisabled() {
	setCommunityPlugins([]);
}

export const commonSetup = async (
	testInfo: TestInfo,
	options: CommonSetupOptions = {}
): Promise<SetupFixture> => {
	const isRestorationStep = testInfo.title.includes(
		"restore note content after an application restart"
	);
	console.log(`\n--------------- Setup: ${testInfo.title} ---------------`);
	console.log("[Setup Options]", options);

	if (!isRestorationStep) {
		initializeWorkspaceJSON();
	}

	const electronApp = await electron.launch({
		args: [
			APP_MAIN_JS_PATH,
			"open",
			`obsidian://open?path=${encodeURIComponent(VAULT_PATH)}`,
		],
	});

	let window = await electronApp.firstWindow();
	await waitForWorkspace(window);
	await focusRootWorkspace(window);

	if (options.disableRestrictedMode) {
		window = await disableRestrictedModeAndEnablePlugins(
			electronApp,
			window,
			[PLUGIN_ID]
		);
	}

	if (options.openVault) {
		window = await openAnotherVault(electronApp, window, options.openVault);
	}

	const appHandle = await window.evaluateHandle(
		() => (window as any).app as App
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
