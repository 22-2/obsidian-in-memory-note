import type { ElectronApplication, Page } from "playwright";
import { ensureLoadPage } from "./helpers.mts";

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
			app.setting.openTabById("community-plugins");
			await new Promise((r) => setTimeout(r, 1000));
			const button = app.setting.settingTabs
				.find((tab) => tab.id.includes("com"))
				.setting.contentEl.querySelector("button");
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
			app.setting.openTabById("community-plugins");
			await new Promise((r) => setTimeout(r, 1000));
			const button = app.setting.settingTabs
				.find((tab) => tab.id.includes("com"))
				.setting.contentEl.querySelector("button");
			button.click();
			return button.textContent;
		})
	);
	console.log("enable community plugins dialog should be open now.");
	await ensureLoadPage(currentWindow);
	await currentWindow.pause();

	for (const pluginId of pluginsToEnable) {
		await currentWindow.evaluate(
			(pluginId) => app.plugins.enablePluginAndSave(pluginId),
			pluginId
		);
	}
	return currentWindow;
}

export async function navigateToComminutyPlugins(window: Page) {
	await window.keyboard.press("Control+,");
	await window
		.locator(".vertical-tab-header-group-items")
		.getByText("Community plugins")
		.click();
}
