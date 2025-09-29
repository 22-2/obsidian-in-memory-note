// ===================================================================
// setup.mts - メインのセットアップクラス
// ===================================================================

import { _electron as electron } from "playwright/test";
import type { ElectronApplication, Page } from "playwright";
import { VaultManager, type VaultOptions } from "./vault-manager";
import { PageManager } from "./page-manager";
import log from "loglevel";
import { LAUNCH_OPTIONS } from "../config";
import fs from "fs/promises";
import path from "path";
import os from "os";

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
	private tempUserDataDir?: string;

	async launch(): Promise<void> {
		this.tempUserDataDir = await fs.mkdtemp(
			path.join(os.tmpdir(), "obsidian-e2e-")
		);
		logger.debug(`Using temporary user data dir: ${this.tempUserDataDir}`);
		const launchOptions = {
			...LAUNCH_OPTIONS,
			// Electronアプリの起動引数に --user-data-dir を追加
			args: [
				...LAUNCH_OPTIONS.args,
				`--user-data-dir=${this.tempUserDataDir}`,
			],
		};
		this.electronApp = await electron.launch(launchOptions);
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
		if (this.tempUserDataDir) {
			logger.debug(
				`Removing temp user data dir: ${this.tempUserDataDir}`
			);
			// recursive: true (再帰的削除), force: true (ロックされていても強制削除)
			await fs.rm(this.tempUserDataDir, { recursive: true, force: true });
		}
		logger.debug("[ObsidianTestSetup] cleaned All");
	}
}
