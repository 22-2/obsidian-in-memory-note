// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\setup.mts
import { copyFileSync, rmSync, writeFileSync } from "fs";
import path from "path";
import type { App } from "obsidian";
import type { ElectronApplication, Page, TestInfo } from "playwright/test";
import { _electron as electron } from "playwright/test";

import {
	APP_MAIN_JS_PATH,
	PLUGIN_ID,
	SANDBOX_VAULT_NAME,
	VAULT_PATH,
} from "./config.mts";
import {
	disableRestrictedModeAndEnablePlugins,
	focusRootWorkspace,
	openSandboxVault,
	performActionAndReload,
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

export async function initializeSandboxVault(
	electronApp: ElectronApplication,
	window: Page
) {
	const path = await getSandboxVaultPath(window);
	if (path) rmSync(path as string, { recursive: true, force: true });
	await ensureSandboxVault(electronApp, window);
}

export function getSandboxVaultPath(window: Page) {
	return window.evaluate(() =>
		Object.values(
			// @ts-expect-error
			window.electron.ipcRenderer.sendSync("vault-list")
		).find((v: any) => v.path.includes(SANDBOX_VAULT_NAME).path as string)
	);
}

export async function ensureSandboxVault(
	electronApp: ElectronApplication,
	window: Page
) {
	await performActionAndReload(
		electronApp,
		async () => {
			openSandboxVault(electronApp, window);
		},
		{
			closeOldWindows: false,
		}
	).then((win) => win.close());
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
			// "open",
			// `obsidian://open?path=${encodeURIComponent(VAULT_PATH)}`,
			// "--no-sandbox",
			// "--disable-setuid-sandbox",
		],
		env: {
			...process.env,
			NODE_ENV: "development",
		},
	});
	console.log("launched electron app");

	let window = await electronApp.firstWindow();
	console.log("get window");
	console.log(await window.evaluate(() => document.URL));

	const isStarterPage = await window.evaluate(() =>
		document.URL.includes("starter")
	);
	console.log("isStarterPage", isStarterPage);

	if (isStarterPage) {
		await window.getByText("Create").click();
		await window.locator("input").fill("test");
		await window.getByText("Browse").click();
		await window.waitForEvent("filechooser");
		await window.getByText("Select Folder").click();
		window = await performActionAndReload(
			electronApp,
			async () => await window.getByText("Create").click()
		);
	}

	await waitForWorkspace(window);
	await focusRootWorkspace(window);

	if (options.disableRestrictedMode) {
		await initializeSandboxVault(electronApp, window);
		window = await disableRestrictedModeAndEnablePlugins(
			electronApp,
			window,
			[PLUGIN_ID]
		);
	}

	if (options.openSandboxVault) {
		window = await openSandboxVault(electronApp, window);
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
