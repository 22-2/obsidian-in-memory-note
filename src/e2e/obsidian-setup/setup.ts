// ===================================================================
// setup.mts - メインのセットアップクラス
// ===================================================================

import { _electron as electron } from "playwright/test";
import type { ElectronApplication, Page } from "playwright";
import { VaultManager, type VaultOptions } from "./vault-manager";
import { PageManager } from "./page-manager";
import log from "loglevel";
import { LAUNCH_OPTIONS } from "../config";

export interface TestContext {
	electronApp: ElectronApplication;
	window: Page;
	vaultName?: string;
}

const logger = log.getLogger("ObsidianTestSetup");

export class ObsidianTestSetup {
	private electronApp?: ElectronApplication;
	// private currentPage?: Page;
	private vaultManager?: VaultManager;
	private pageManager?: PageManager;

	async launch(): Promise<void> {
		this.electronApp = await electron.launch(LAUNCH_OPTIONS);
		const page = await this.electronApp.waitForEvent("window");
		this.pageManager = new PageManager(this.electronApp);
		logger.debug("page manager");
		await this.pageManager.waitForPage(page);
		logger.debug("starter ready");
		await VaultManager.clearData(this.electronApp);
		await page.reload({ waitUntil: "domcontentloaded" });

		const currentPage = await this.pageManager.ensureSingleWindow();

		await this.pageManager.waitForStarterReady(currentPage);
		logger.debug("init start page");

		this.vaultManager = new VaultManager(
			this.electronApp,
			this.pageManager
		);
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
		if (this.electronApp) {
			await this.electronApp.close();
		}
		logger.debug("[ObsidianTestSetup] cleaned All");
	}
}
