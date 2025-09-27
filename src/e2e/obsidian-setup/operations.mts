import type { ElectronApplication, Page } from "playwright";
import { ensureLoadPage } from "./helpers.mts";
import { delay } from "../obsidian-commands/run-command.mts";

/**
 * UI操作でRestricted Modeを無効化し、指定のプラグインを有効にする
 */

export async function disableRestrictedModeAndEnablePlugins(
	electronApp: ElectronApplication,
	window: Page,
	pluginsToEnable: string[]
): Promise<Page> {
	console.log("[Setup Step] Disabling Restricted Mode...");
	let currentWindow = window;
	// const newWindow = await reopenVaultWith(electronApp, async () => {
	// });
	console.log(
		"[BUTTON-1]",
		await currentWindow.evaluate(async () => {
			app.setting.open();
			app.setting.openTabById("community-plugins");
			const button =
				app.setting.activeTab.setting.contentEl.querySelector("button");
			await new Promise((r) => setTimeout(r, 1000));
			button.click();
			return button.textContent;
		})
	);
	console.log("disable Restricted Mode dialog should be open now.");
	await ensureLoadPage(currentWindow);
	await new Promise((r) => setTimeout(r, 1000));

	console.log(
		"[BUTTON-2]",
		await currentWindow.evaluate(async () => {
			app.setting.open();
			app.setting.openTabById("community-plugins");
			const button =
				app.setting.activeTab.setting.contentEl.querySelector("button");
			await new Promise((r) => setTimeout(r, 1000));
			button.click();
			return button.textContent;
		})
	);
	console.log("enable community plugins dialog should be open now.");
	await ensureLoadPage(currentWindow);

	const enabledPlugins = await currentWindow.evaluate(
		async (pluginsToEnable) => {
			for (const pluginId of pluginsToEnable) {
				await app.plugins.enablePluginAndSave(pluginId);
			}
			return Object.keys(app.plugins.plugins);
		},
		pluginsToEnable
	);
	console.log("enabled plugins", enabledPlugins);
	return currentWindow;
}

export async function navigateToComminutyPlugins(window: Page) {
	await window.keyboard.press("Control+,");
	await window
		.locator(".vertical-tab-header-group-items")
		.getByText("Community plugins")
		.click();
}
