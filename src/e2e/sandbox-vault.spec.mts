import { expect } from "@playwright/test";
import { testWithVaultOpen } from "./base.mts";
import { SANDBOX_VAULT_NAME } from "./config.mts";

testWithVaultOpen("should open in the sandbox vault", async ({ obsidian }) => {
	const { appHandle } = obsidian;
	const vaultName = await appHandle.evaluate((app) => app.vault.getName());
	expect(vaultName).toBe(SANDBOX_VAULT_NAME);
});
