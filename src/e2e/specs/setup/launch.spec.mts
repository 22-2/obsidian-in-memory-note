import { launchElectronApp } from "../../obsidian-setup/launch.mts";
import { test, expect } from "../../test-fixtures.mts";

test("should launch app", async () => {
	const app = await launchElectronApp();
	const win = await app.firstWindow();
	expect(win.url()).toContain("obsidian");
	await app.close();
});
