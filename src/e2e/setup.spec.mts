import { PLUGIN_ID } from "./e2e.config.mts";
import { test as setup, expect, SANDBOX_VIEW_SELECTOR } from "./test-base.mts";

setup(
	"disable restricted mode and enable plugin",
	async ({ obsidianFixture }) => {
		const { window, electronApp, appHandle } = obsidianFixture;

		appHandle.evaluate((app) => app);

		// --- 代替案: Vaultが既に開かれている前提で操作を進める ---

		// 3. 設定画面を開く
		console.log("3. Navigating to Settings...");
		// 設定ボタンのセレクターを適切に調整してください
		await window.keyboard.press("Ctrl+,");

		// 4. コミュニティプラグイン設定へ移動
		await window.getByText("Community plugins").click();

		// 5. 制限モード（Restricted mode）をオフにする
		console.log("4. Disabling Restricted Mode...");

		// スイッチのセレクターを特定します (例: .setting-item-control .checkbox-container)
		await window.getByText("Turn on community plugins").click();

		// 6. プラグインを有効化する
		console.log(`5. Enabling Plugin: ${PLUGIN_ID}...`);
		// プラグイン一覧からIDで特定し、トグルを操作
		const pluginToggle = window.locator(
			`.installed-plugins-container .checkbox-container`
		);
		await pluginToggle.check();

		// 7. 設定を保存し、Obsidianを終了する
		console.log("6. Setup complete. Closing Obsidian.");
		await electronApp.close();

		// (オプション) Playwrightの認証状態を保存
		// await mainWindow.context().storageState({ path: storageState as string });
	}
);

// // e2e/global-setup.ts
// import {
// 	type ElectronApplication,
// 	type FullConfig,
// 	type JSHandle,
// 	type Page,
// 	_electron as electron,
// } from "@playwright/test";
// import type { App } from "electron";
// import path from "path";
// import type SandboxNotePlugin from "src/main";
// import { ELECTRON_ARGS, PLUGIN_ID, VAULT_NAME } from "./e2e.config";

// let electronApp: ElectronApplication;
// export let window: Page;
// export let appHandle: JSHandle<App>; // API操作のために維持

// export let pluginHandle: JSHandle<SandboxNotePlugin>; // API操作のため

// async function globalSetup(config: FullConfig) {
// 	electronApp = await electron.launch({
// 		args: ELECTRON_ARGS,
// 	});
// 	window = await electronApp.firstWindow();

// 	// --- 代替案: Vaultが既に開かれている前提で操作を進める ---

// 	// 3. 設定画面を開く
// 	console.log("3. Navigating to Settings...");
// 	// 設定ボタンのセレクターを適切に調整してください
// 	await window.click(".setting-gear-icon");

// 	// 4. コミュニティプラグイン設定へ移動
// 	await window.getByText("Community plugins").click();

// 	// 5. 制限モード（Restricted mode）をオフにする
// 	console.log("4. Disabling Restricted Mode...");
// 	// スイッチのセレクターを特定します (例: .setting-item-control .checkbox-container)
// 	// 「Turn off Restricted mode」ボタンをクリックするパターンが多い
// 	await window
// 		.getByRole("button", { name: "Turn off Restricted mode" })
// 		.click();

// 	// 6. プラグインを有効化する
// 	console.log(`5. Enabling Plugin: ${PLUGIN_ID}...`);
// 	// プラグイン一覧からIDで特定し、トグルを操作
// 	const pluginToggle = window.locator(
// 		`[data-plugin-id="${PLUGIN_ID}"] .setting-item-control input[type="checkbox"]`
// 	);
// 	await pluginToggle.check();

// 	// 7. 設定を保存し、Obsidianを終了する
// 	console.log("6. Setup complete. Closing Obsidian.");
// 	await electronApp.close();

// 	// (オプション) Playwrightの認証状態を保存
// 	// await mainWindow.context().storageState({ path: storageState as string });
// }

// export default globalSetup;
