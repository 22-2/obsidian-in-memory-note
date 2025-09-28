// ===================================================================
// setup.mts - メインのセットアップクラス
// ===================================================================

import { _electron as electron } from "playwright/test";
import type { ElectronApplication, Page } from "playwright";
import { VaultManager, type VaultOptions } from "./vault-manager.mts";
import { PageManager } from "./page-manager.mts";
import { APP_MAIN_JS_PATH } from "../config.mts";

export interface TestContext {
	electronApp: ElectronApplication;
	window: Page;
	vaultName?: string;
}

export class ObsidianTestSetup {
	private electronApp?: ElectronApplication;
	// private currentPage?: Page;
	private vaultManager?: VaultManager;
	private pageManager?: PageManager;

	async launch(): Promise<void> {
		this.electronApp = await electron.launch({
			args: [
				APP_MAIN_JS_PATH,
				"--no-sandbox",
				"--disable-setuid-sandbox",
			],
			env: {
				...process.env,
				NODE_ENV: "development",
			},
		});

		this.pageManager = new PageManager(this.electronApp);

		const currentPage = await this.pageManager.ensureSingleWindow();
		await currentPage.waitForLoadState("domcontentloaded");

		this.vaultManager = new VaultManager(this.electronApp);
	}

	async openVault(options: VaultOptions = {}): Promise<TestContext> {
		if (!this.electronApp || !this.vaultManager) {
			throw new Error("Setup not initialized. Call launch() first.");
		}

		const page = await this.vaultManager.openVault(options);

		const vaultName = await page.evaluate(() =>
			(window as any).app?.vault?.getName()
		);

		return {
			electronApp: this.electronApp,
			window: page,
			vaultName,
		};
	}

	async openSandbox(options: VaultOptions = {}): Promise<TestContext> {
		return this.openVault({
			...options,
			useSandbox: true,
		});
	}

	async openStarter(): Promise<TestContext> {
		if (!this.electronApp || !this.vaultManager) {
			throw new Error("Setup not initialized. Call launch() first.");
		}

		const page = await this.vaultManager.openStarter();

		return {
			electronApp: this.electronApp,
			window: page,
		};
	}

	async cleanup(): Promise<void> {
		await this.electronApp?.close();
	}
}
