import { expect } from "@playwright/test";
import { testWithVaultOpen, test } from "../base.mts";
import { SANDBOX_VAULT_NAME } from "../config.mts";

test.use({
	vaultOptions: {
		openSandboxVault: true,
		doDisableRestrictedMode: false,
	},
});
test("should open in the sandbox vault", async ({ vault }) => {
	const vaultName = await vault.appHandle!.evaluate((app) =>
		app.vault.getName()
	);
	expect(vaultName).toBe(SANDBOX_VAULT_NAME);
});
