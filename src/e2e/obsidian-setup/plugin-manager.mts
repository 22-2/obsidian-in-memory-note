// ===================================================================
// plugin-manager.mts - プラグイン管理
// ===================================================================

import {
	copyFileSync,
	mkdirSync,
	existsSync,
	readdirSync,
	writeFileSync,
} from "fs";
import path from "path";
import type { Page } from "playwright";
import { expect } from "@playwright/test";

export class PluginManager {
	async installPlugins(
		vaultPath: string,
		pluginPaths: string[]
	): Promise<void> {
		const obsidianDir = path.join(vaultPath, ".obsidian");
		const pluginsDir = path.join(obsidianDir, "plugins");

		// .obsidian ディレクトリを作成
		if (!existsSync(obsidianDir)) {
			mkdirSync(obsidianDir, { recursive: true });
		}

		if (!existsSync(pluginsDir)) {
			mkdirSync(pluginsDir, { recursive: true });
		}

		const installedIds: string[] = [];

		for (const pluginPath of pluginPaths) {
			if (!existsSync(pluginPath)) {
				console.warn(`Plugin path not found: ${pluginPath}`);
				continue;
			}

			const pluginId = path.basename(pluginPath);
			const destDir = path.join(pluginsDir, pluginId);

			if (!existsSync(destDir)) {
				mkdirSync(destDir, { recursive: true });
			}

			// プラグインファイルをコピー
			for (const file of readdirSync(pluginPath)) {
				const srcFile = path.join(pluginPath, file);
				const destFile = path.join(destDir, file);
				copyFileSync(srcFile, destFile);
				console.log(`Copied: ${file} to ${destDir}`);
			}

			installedIds.push(pluginId);
			console.log(`Installed plugin: ${pluginId}`);
		}

		// community-plugins.json を書き込み
		const pluginsJsonPath = path.join(
			obsidianDir,
			"community-plugins.json"
		);
		writeFileSync(pluginsJsonPath, JSON.stringify(installedIds));
		console.log(`Enabled plugins: ${installedIds.join(", ")}`);
	}

	async disableRestrictedMode(page: Page): Promise<void> {
		if (await this.checkIsCommunityPluginEnabled(page)) {
			console.log("Already disabled");
			return;
		}

		console.log("Disabling Restricted Mode...");

		// 最初のボタンをクリック（Restricted Modeの無効化）
		console.log("[STEP1]");
		await page.pause();
		expect(await this.clickSettingsButton(page)).toBe("Turn on and reload");
		await page.waitForTimeout(1000);

		// 2番目のボタンをクリック（コミュニティプラグインの有効化）
		console.log("[STEP2]");
		expect(await this.clickSettingsButton(page)).toBe(
			"Turn on community plugins"
		);
		await page.waitForTimeout(1000);

		// 設定を閉じる
		await page.keyboard.press("Escape");
		console.log("Restricted Mode disabled");
	}

	private async clickSettingsButton(page: Page): Promise<string | null> {
		return page.evaluate(() => {
			(window as any).app.setting.open();
			(window as any).app.setting.openTabById("community-plugins");
			const app = (window as any).app;
			const button =
				app.setting.activeTab?.setting?.contentEl?.querySelector(
					"button"
				) as HTMLElement | null;
			if (button) {
				const text = button.textContent as string;
				button.click();
				return text;
			}
			return null;
		});
	}

	async enablePlugins(page: Page, pluginIds: string[]): Promise<void> {
		const enabledIds = await page.evaluate(async (ids) => {
			const app = (window as any).app;
			const enabled: string[] = [];

			for (const id of ids) {
				await app.plugins.enablePluginAndSave(id);
				enabled.push(id);
			}

			return enabled;
		}, pluginIds);

		console.log(`Enabled plugins: ${enabledIds.join(", ")}`);
	}

	checkIsCommunityPluginEnabled(page: Page): Promise<boolean> {
		return page.evaluate(() => app.plugins.isEnabled());
	}
}
