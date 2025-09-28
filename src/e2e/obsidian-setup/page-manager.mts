// ===================================================================
// page-manager.mts - ページ遷移の管理
// ===================================================================

import type { ElectronApplication, Page } from "playwright";
import invariant from "tiny-invariant";

export class PageManager {
	constructor(private app: ElectronApplication) {}

	async ensureSingleWindow() {
		console.log("ensureSingleWindow");
		const windows = this.app.windows();
		console.log(`${windows.length} opend`);
		if (windows.length === 0) {
			const page = await this.app.firstWindow();
			await page.waitForLoadState("domcontentloaded");
			console.log("first window");
			return page;
		}

		const page = windows.find(
			async (win) => await win.evaluate(() => document.body.isShown())
		);
		invariant(page, "failed to get page");
		await this.closeAllExcept(page);
		console.log(`closed all except ${await page.title()}`);
		return page;
	}

	async executeActionAndWaitForNewWindow(
		action: () => Promise<void>,
		closeOthers = true
	): Promise<Page> {
		await action();

		const newPage = await this.ensureSingleWindow();

		if (closeOthers) {
			await this.closeAllExcept(newPage);
		}

		return newPage;
	}

	private async closeAllExcept(keepPage: Page): Promise<void> {
		for (const window of this.app.windows()) {
			if (window !== keepPage && !window.isClosed()) {
				console.log(`close ${await window.title()}`);
				await window.close();
			}
		}
	}

	async waitForVaultReady(page: Page): Promise<void> {
		await page.waitForLoadState("domcontentloaded");

		// Wait for app object
		await page.waitForFunction(
			() => typeof (window as any).app !== "undefined",
			{ timeout: 10000 }
		);

		// Wait for vault and workspace
		await page.waitForFunction(
			() => {
				const app = (window as any).app;
				return (
					app?.vault && app?.workspace && app?.workspace.layoutReady
				);
			},
			{ timeout: 10000 }
		);

		// Wait for UI elements
		await page.waitForSelector(".workspace", {
			state: "visible",
			timeout: 5000,
		});

		// 追加の安定化待機
		await page.waitForTimeout(500);
	}

	async waitForStarterReady(page: Page): Promise<void> {
		await page.getByRole("combobox").isVisible();
	}

	isStarterPage(page: Page): boolean {
		return page.url().includes("starter");
	}
}
