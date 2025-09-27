import { expect } from "@playwright/test";
import { SANDBOX_VAULT_NAME } from "../../config.mts";
import { test } from "../../test-fixtures.mts";
import { getCurrentVaultName } from "src/e2e/obsidian-setup/getters.mts";
import { reopenVaultWith } from "../../obsidian-setup/launch.mts";
import { openSandboxVault } from "../../obsidian-setup/ipc-helpers.mts";

const newVaultName = "new-vault" + Math.random().toString(36).substring(7);

test.use({
	vaultOptions: {
		doDisableRestrictedMode: false,
		createNewVault: true,
		vaultName: newVaultName,
	},
});
test("should open in the new vault", async ({ vault }) => {
	expect(await getCurrentVaultName(vault.window)).toBe(newVaultName);
});

test("should open sandbox vault", async ({ starter }) => {
	const window = await reopenVaultWith(starter.electronApp, () =>
		openSandboxVault(starter.window)
	);
	expect(await getCurrentVaultName(window)).toBe(SANDBOX_VAULT_NAME);
});
