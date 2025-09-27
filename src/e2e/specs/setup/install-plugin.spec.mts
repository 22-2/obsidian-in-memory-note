import { ensureLoadPage } from "../../obsidian-setup/helpers.mts";
import { getCurrentVaultName } from "src/e2e/obsidian-setup/getters.mts";
import { test, expect } from "../../test-fixtures.mts";
import { DIST_DIR, PLUGIN_ID, SANDBOX_VAULT_NAME } from "../../config.mts";
import { delay } from "src/e2e/obsidian-commands/run-command.mts";

test.use({
	vaultOptions: {
		doDisableRestrictedMode: true,
		pluginPaths: [DIST_DIR],
	},
});

test("should launch app", async ({ vault }) => {
	await ensureLoadPage(vault.window);
	expect(await getCurrentVaultName(vault.window)).toBe(SANDBOX_VAULT_NAME);
	// await vault.window.pause();
	expect(
		await vault.appHandle.evaluate(async (pluginId) => {
			console.log("[Test] Checking for plugin ID:", pluginId);
			const plugin = app.plugins.plugins[pluginId];
			console.log("[Test] Plugin instance:", plugin);
			await new Promise((resolve) => setTimeout(resolve, 1000 * 60));
			return plugin;
		}, PLUGIN_ID)
	).toBeTruthy();
});
