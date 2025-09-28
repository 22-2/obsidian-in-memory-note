// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\obsidian-setup\vault-manager.mts
// ===================================================================
// vault-manager.mts - Vault操作の管理
// ===================================================================

import type { ElectronApplication, Page } from "playwright";
import { IPCBridge } from "./ipc-bridge.mts";
import { PageManager } from "./page-manager.mts";
import { PluginManager } from "./plugin-manager.mts";
import path from "path";
import { rmSync, existsSync } from "fs";
import { LAUNCH_OPTIONS, SANDBOX_VAULT_NAME } from "../config.mts";
import log from "loglevel";
import chalk from "chalk";

export interface VaultOptions {
	name?: string;
	path?: string;
	createNew?: boolean;
	useSandbox?: boolean;
	// clearSandbox?: boolean;
	plugins?: string[];
	enablePlugins?: boolean;
}

const logger = log.getLogger("VaultManager");

export class VaultManager {
	private ipc: IPCBridge;

	constructor(
		private app: ElectronApplication,
		private pageManager: PageManager
	) {
		this.ipc = new IPCBridge(this.pageManager);
	}

	async openVault(options: VaultOptions = {}): Promise<Page> {
		let vaultPath: string;
		logger.debug("open vault", options);

		// Sandbox使用の場合
		if (options.useSandbox) {
			logger.debug("use sandbox");
			return this.openSandboxVault(options);
		}

		logger.debug("open normal vault");

		// 通常のVault
		if (options.path) {
			vaultPath = options.path;
		} else if (options.name) {
			vaultPath = await this.getVaultPath(options.name);
		} else {
			throw new Error("Either name or path must be specified");
		}

		if (options.createNew && existsSync(vaultPath)) {
			rmSync(vaultPath, { recursive: true });
		}

		// プラグインのインストール
		if (options.plugins && options.plugins.length > 0) {
			logger.debug("install plugins");
			const pluginManager = new PluginManager();
			await pluginManager.installPlugins(vaultPath, options.plugins);
			logger.debug("done");
		}

		// Vault を開く

		logger.debug("open new page");
		const newPage = await this.pageManager.executeActionAndWaitForNewWindow(
			async () => {
				const result = await this.ipc.openVault(
					vaultPath,
					options.createNew
				);
				if (result !== true) {
					throw new Error(`Failed to open vault: ${result}`);
				}
			},
			this.pageManager.waitForVaultReady
		);
		logger.debug("done");
		await this.pageManager.waitForVaultReady(newPage);
		logger.debug("new page initialized");

		// プラグインの有効化
		if (options.enablePlugins && options.plugins) {
			logger.debug("enable plugins");
			await this.enablePlugins(newPage, options.plugins);
			logger.debug("plugin enabled");
		}

		return newPage;
	}

	private async openSandboxVault(options: VaultOptions): Promise<Page> {
		logger.debug(chalk.green("open sandbox!"));
		const newPage = await this.pageManager.executeActionAndWaitForNewWindow(
			async () => {
				await this.ipc.openSandbox();
			},
			this.pageManager.waitForVaultReady
		);
		logger.debug(chalk.green("opend!", newPage.url()));
		logger.debug(`
/* ========================================================================== */
//
//  ${newPage.url()}
//
/* ========================================================================== */

			`);
		logger.debug(newPage.url());

		// Sandboxパスを取得してプラグインをインストール
		const sandboxPath = await this.ipc.getSandboxPath();

		if (options.plugins && options.plugins.length > 0) {
			const pluginManager = new PluginManager();
			await pluginManager.installPlugins(sandboxPath, options.plugins);
		}

		// プラグインの有効化
		if (options.enablePlugins && options.plugins) {
			await this.enablePlugins(newPage, options.plugins);
		}

		return newPage;
	}

	static async clearData(electronApp: ElectronApplication): Promise<void> {
		const userDataDir = await electronApp.evaluate(({ app }) =>
			app.getPath("userData")
		);
		[
			path.join(userDataDir, "obsidian.json"),
			path.join(userDataDir, SANDBOX_VAULT_NAME),
		].forEach((path) => {
			logger.debug("delete", path);
			rmSync(path, { force: true, recursive: true });
		});

		// localStorageをクリアするために、最初のウィンドウを取得します。
		// このメソッドはアプリ起動直後に呼ばれるため、ウィンドウは1つのはずです。
		const windows = electronApp.windows();
		if (windows.length > 0) {
			await windows[0].evaluate(() => window.localStorage.clear());
			logger.debug("localStorage cleared.");
		}
	}

	async openStarter(): Promise<Page> {
		const newPage = await this.pageManager.executeActionAndWaitForNewWindow(
			async () => {
				await this.ipc.openStarter();
			},
			this.pageManager.waitForStarterReady
		);

		await this.pageManager.waitForStarterReady(newPage);
		return newPage;
	}

	private async enablePlugins(
		page: Page,
		pluginPaths: string[]
	): Promise<void> {
		const pluginManager = new PluginManager();

		// Restricted Mode を無効化
		await pluginManager.disableRestrictedMode(page, this.app);

		// プラグインIDを取得して有効化
		const pluginIds = pluginPaths.map((p) => path.basename(p));
		await pluginManager.enablePlugins(page, pluginIds);
	}

	private async getCurrentVaultName(): Promise<string | undefined> {
		const page = await this.pageManager.ensureSingleWindow();
		if (this.pageManager.isStarterPage(page)) {
			return undefined;
		}

		return page.evaluate(() => {
			const app = (window as any).app;
			return app?.vault?.getName();
		});
	}

	private async getUserDataPath() {
		const page = await this.pageManager.ensureSingleWindow();
		const userDataDir = await page.evaluate(() => {
			const app = (window as any).app;
			if (app?.vault?.adapter?.basePath) {
				// 現在のVaultのベースパスから親ディレクトリを取得
				const currentPath = app.vault.adapter.basePath;
				return currentPath;
			}
			throw new Error("failed to get user data path");
		});
		return path.dirname(userDataDir);
	}

	private async getVaultPath(name: string): Promise<string> {
		// 元のコードのgetElectronAppPathメソッドを参考に
		const userDataDir = await this.getUserDataPath();
		logger.debug("userDataDir", userDataDir);

		if (userDataDir) {
			return path.join(userDataDir, name);
		}

		// フォールバック
		return path.join(
			process.env.USERPROFILE || process.env.HOME || "",
			"ObsidianVaults",
			name
		);
	}
}
