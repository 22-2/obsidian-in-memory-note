// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\obsidian-setup\vault-manager.mts
// ===================================================================
// vault-manager.mts - Vault操作の管理
// ===================================================================

import chalk from "chalk";
import { existsSync, readFileSync, rmSync } from "fs";
import log from "loglevel";
import path from "path";
import type { ElectronApplication, Page } from "playwright";
import { SANDBOX_VAULT_NAME } from "../config";
import { IPCBridge } from "./ipc-bridge";
import { PageManager } from "./page-manager";
import { PluginManager } from "./plugin-manager";
import type { BrowserWindow, WebContents } from "electron";

export interface VaultOptions {
	name?: string;
	path?: string;
	createNew?: boolean;
	useSandbox?: boolean;
	plugins?: string[];
	enablePlugins?: boolean;
}

const logger = log.getLogger("VaultManager");

export class VaultManager {
	private ipc: IPCBridge;
	private pluginManager: PluginManager;

	constructor(
		private app: ElectronApplication,
		private pageManager: PageManager
	) {
		this.ipc = new IPCBridge(this.pageManager);
		this.pluginManager = new PluginManager();
	}

	async openVault(options: VaultOptions = {}): Promise<Page> {
		logger.debug("open vault", options);

		let vaultPath: string;
		let newPage: Page;
		let shouldReload = false;

		// --- Step 1: Open Vault (Sandbox or Normal) ---
		if (options.useSandbox) {
			logger.debug(chalk.green("Opening sandbox vault..."));
			newPage = await this.pageManager.executeActionAndWaitForNewWindow(
				() => this.ipc.openSandbox(),
				this.pageManager.waitForVaultReady
			);
			vaultPath = await this.ipc.getSandboxPath();
			logger.debug(chalk.green("Sandbox vault opened at:", vaultPath));
		} else {
			logger.debug("Opening normal vault...");
			if (options.path) {
				vaultPath = options.path;
			} else if (options.name) {
				vaultPath = await this.getVaultPath(options.name);
			} else {
				throw new Error(
					"Either 'name' or 'path' must be specified for a normal vault."
				);
			}

			if (options.createNew && existsSync(vaultPath)) {
				rmSync(vaultPath, { recursive: true });
			}

			newPage = await this.pageManager.executeActionAndWaitForNewWindow(
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
			logger.debug("Normal vault opened:", vaultPath);
		}

		await this.pageManager.waitForVaultReady(newPage);

		// --- Step 2: Install Plugins (if specified) ---
		if (options.plugins && options.plugins.length > 0) {
			logger.debug("Installing plugins...");
			await this.pluginManager.installPlugins(vaultPath, options.plugins);
			shouldReload = true; // Reload is needed after installing
			logger.debug("Plugins installed.");
		}

		// --- Step 3: Enable Plugins (if specified) ---
		if (options.enablePlugins && options.plugins) {
			logger.debug("Enabling plugins...");
			await this.pluginManager.enablePlugins(
				this.app,
				newPage,
				options.plugins
			);
			shouldReload = true; // Reload is needed after enabling
			logger.debug("Plugins enabled.");
		}

		// --- Step 4: Reload Vault if plugins were modified ---
		if (shouldReload) {
			logger.debug(
				chalk.blue("Reloading vault to apply plugin changes...")
			);
			await newPage.reload();
			await this.pageManager.waitForVaultReady(newPage);
			logger.debug(chalk.blue("Vault reloaded."));
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

		const windows = electronApp.windows();
		if (windows.length > 0) {
			await windows[0].evaluate(() => window.localStorage.clear());
			await windows[0].evaluate(async () => {
				const webContents =
					// @ts-expect-error
					window.electron.remote.BrowserWindow.getFocusedWindow()
						.webContents as WebContents;
				webContents.session.flushStorageData();
				await webContents.session.clearStorageData();
			});
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

	private async getUserDataPath() {
		const page = await this.pageManager.ensureSingleWindow();
		const userDataDir = await page.evaluate(() => {
			const app = (window as any).app;
			if (app?.vault?.adapter?.basePath) {
				const currentPath = app.vault.adapter.basePath;
				return currentPath;
			}
			throw new Error("failed to get user data path");
		});
		return path.dirname(userDataDir);
	}

	private async getVaultPath(name: string): Promise<string> {
		const userDataDir = await this.getUserDataPath();
		logger.debug("userDataDir", userDataDir);

		if (userDataDir) {
			return path.join(userDataDir, name);
		}

		return path.join(
			process.env.USERPROFILE || process.env.HOME || "",
			"ObsidianVaults",
			name
		);
	}
}
