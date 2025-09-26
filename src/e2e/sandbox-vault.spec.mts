import { expect } from "@playwright/test";
import { test } from "./base.mts";
import { SANDBOX_VAULT_NAME } from "./config.mts";

test.describe("Minimal test", async () => {
	test.use({ setupOptions: { openSandboxVault: true } });
	test("should open in the sandbox vault", async ({ obsidian }) => {
		const { appHandle } = obsidian;
		const vaultName = await appHandle.evaluate((app) =>
			app.vault.getName()
		);
		expect(vaultName).toBe(SANDBOX_VAULT_NAME);
	});
});
