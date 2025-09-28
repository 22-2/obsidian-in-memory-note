// ===================================================================
// vault-manager.mts - Vault操作の管理
// ===================================================================

import type { ElectronApplication, Page } from "playwright";
import { IPCBridge } from "./ipc-bridge.mts";
import { PageManager } from "./page-manager.mts";
import { PluginManager } from "./plugin-manager.mts";
import path from "path";
import { rmSync, existsSync } from "fs";
import { SANDBOX_VAULT_NAME } from "../config.mts";

export interface VaultOptions {
	name?: string;
	path?: string;
	createNew?: boolean;
	useSandbox?: boolean;
	clearSandbox?: boolean;
	plugins?: string[];
	enablePlugins?: boolean;
}

export class VaultManager {
	private ipc: IPCBridge;
	private pageManager: PageManager;

	constructor(app: ElectronApplication) {
		this.pageManager = new PageManager(app);
		this.ipc = new IPCBridge(this.pageManager);
	}

	async openVault(options: VaultOptions = {}): Promise<Page> {
		let vaultPath: string;

		// Sandbox使用の場合
		if (options.useSandbox) {
			console.log("use sandbox");
			if (options.clearSandbox) {
				console.log("clear sandbox vault");
				await this.clearSandbox();
				console.log("done");
			}
			return this.openSandboxVault(options);
		}

		// 通常のVault
		if (options.path) {
			vaultPath = options.path;
		} else if (options.name) {
			vaultPath = await this.getVaultPath(options.name);
		} else {
			throw new Error("Either name or path must be specified");
		}

		// 新規作成の場合、既存を削除
		if (options.createNew && existsSync(vaultPath)) {
			rmSync(vaultPath, { recursive: true });
		}

		// プラグインのインストール
		if (options.plugins && options.plugins.length > 0) {
			const pluginManager = new PluginManager();
			await pluginManager.installPlugins(vaultPath, options.plugins);
		}

		// Vault を開く
		const newPage = await this.pageManager.executeActionAndWaitForNewWindow(
			async () => {
				const result = await this.ipc.openVault(
					vaultPath,
					options.createNew
				);
				if (result !== true) {
					throw new Error(`Failed to open vault: ${result}`);
				}
			}
		);

		await this.pageManager.waitForVaultReady(newPage);

		// プラグインの有効化
		if (options.enablePlugins && options.plugins) {
			await this.enablePlugins(newPage, options.plugins);
		}

		return newPage;
	}

	private async openSandboxVault(options: VaultOptions): Promise<Page> {
		// Sandboxパスを取得してプラグインをインストール
		const sandboxPath = await this.ipc.getSandboxPath();

		if (options.plugins && options.plugins.length > 0) {
			const pluginManager = new PluginManager();
			await pluginManager.installPlugins(sandboxPath, options.plugins);
		}

		// Sandbox を開く
		const newPage = await this.pageManager.executeActionAndWaitForNewWindow(
			async () => {
				await this.ipc.openSandbox();
			}
		);

		await this.pageManager.waitForVaultReady(newPage);

		// プラグインの有効化
		if (options.enablePlugins && options.plugins) {
			await this.enablePlugins(newPage, options.plugins);
		}

		return newPage;
	}

	private async clearSandbox(): Promise<void> {
		const currentVaultName = await this.getCurrentVaultName();

		if (currentVaultName !== SANDBOX_VAULT_NAME) {
			// 既にSandbox以外のVaultが開いている場合はそのまま進む
			return;
		}

		// 一時的なVaultを作成して切り替え
		const tempName = `temp-${Date.now()}`;
		const tempPath = await this.getVaultPath(tempName);

		const tempPage =
			await this.pageManager.executeActionAndWaitForNewWindow(
				async () => {
					await this.ipc.openVault(tempPath, true);
				}
			);

		await this.pageManager.waitForVaultReady(tempPage);

		// Sandboxを削除するためにstarterに戻る
		const starterPage = await this.openStarter();

		// Sandboxを削除
		const sandboxPath = await this.ipc.getSandboxPath();
		if (existsSync(sandboxPath)) {
			rmSync(sandboxPath, { recursive: true });
		}

		// 一時Vaultも削除
		if (existsSync(tempPath)) {
			rmSync(tempPath, { recursive: true });
		}
		const vaultIndex = path.join(
			await this.getUserDataPath(),
			"obsidian.json"
		);
		rmSync(vaultIndex);
		console.log("vault index deleted");
		const page = await this.pageManager.ensureSingleWindow();
		await page.evaluate(() => localStorage.clear());
		console.log("localstorage cleared");
	}

	async openStarter(): Promise<Page> {
		const newPage = await this.pageManager.executeActionAndWaitForNewWindow(
			async () => {
				await this.ipc.openStarter();
			}
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
		await pluginManager.disableRestrictedMode(page);

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
		console.log("userDataDir", userDataDir);

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
