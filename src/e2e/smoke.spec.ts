import test, { expect, type ElectronApplication } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { _electron as electron } from "playwright";
import invariant from "tiny-invariant";

const appPath = path.join(__dirname, "../../.obsidian-unpacked/main.js");
const vaultPath = path.join(__dirname, "../../e2e-vault");

invariant(existsSync(appPath), "appPath does not exist");
invariant(existsSync(vaultPath), "vaultPath does not exist");

let app: ElectronApplication;

test.beforeEach(async () => {
	// Restore .trash folder from template
	// await fs.cp(
	//     path.join(vaultPath, "Trash template"),
	//     path.join(vaultPath, ".trash"),
	//     { recursive: true, force: true }
	// );
	// await fs.rm(path.join(vaultPath, "Recipes"), {
	//     recursive: true,
	//     force: true,
	// });

	app = await electron.launch({
		args: [
			appPath,
			"open",
			`obsidian://open?path=${encodeURIComponent(vaultPath)}`,
		],
	});
});

test.describe("Smoke test inside Docker with custom fixtures", () => {
	// 各テストの前に実行される処理
	// test.beforeEach(async ({ page }) => {
	//     // 他のタブを閉じるコマンドを実行
	//     await page.keyboard.press("Control+P");
	//     await page.locator(".prompt-input").fill("Close all other tabs");
	//     // 候補が表示されるのを待つ
	//     await page.waitForSelector(".suggestion-item.is-selected");
	//     await page.locator(".suggestion-item.is-selected").click();
	// });

	test.afterEach(async () => {
		await app?.close();
	});

	test("can open trash explorer view from ribbon", async () => {
		const window = await app.firstWindow();
		const trashExplorerLeaf = window.locator(
			".workspace-leaf-content[data-type=trash-explorer]"
		);

		await window.getByLabel("Files", { exact: true }).click();
		await expect(trashExplorerLeaf).not.toBeVisible();

		// await window.getByLabel("Open trash explorer", { exact: true }).click();
		// await expect(trashExplorerLeaf).toBeVisible();
	});
});
