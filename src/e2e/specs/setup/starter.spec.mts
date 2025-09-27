import { expect } from "@playwright/test";
import { testWithStarterPage, test } from "../../test-fixtures.mts";
import { TEST_VAULT_NAME } from "../../config.mts";

test("test", async ({ starter }) => {
	expect(starter.window.url()).toContain("starter");
});

const INJECT_VAULT_NAME = "test-vault" + Math.floor(Math.random() * 10000);
test.use({
	starterOptions: { injectVaults: [INJECT_VAULT_NAME] },
});

test("inject vault", async ({ starter }) => {
	const vaultNames = await starter.window
		.locator(".recent-vaults-list-item")
		.allTextContents();
	console.log("vaultNames", vaultNames);
	console.log(
		await starter.window.evaluate(() => {
			Object.values(electron.ipcRenderer.sendSync("vault-list")).find(
				(v) => v.path.includes("Sandbox")
			);
		})
	);
	expect(vaultNames).toContain(INJECT_VAULT_NAME);
});
