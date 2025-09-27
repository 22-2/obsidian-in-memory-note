import { getCurrentVaultName } from "../../obsidian-setup/getters.mts";
import { DIST_DIR, PLUGIN_ID, SANDBOX_VAULT_NAME } from "../../config.mts";
import { ensureLoadPage } from "../../obsidian-setup/helpers.mts";
import { expect, test } from "../../test-fixtures.mts";

test.use({
	vaultOptions: {
		doDisableRestrictedMode: true,
		pluginPaths: [DIST_DIR],
	},
});

test("should launch app", async ({ vault }) => {
	await ensureLoadPage(vault.window);
	console.log(await getCurrentVaultName(vault.window));
	expect(await getCurrentVaultName(vault.window)).toBe(SANDBOX_VAULT_NAME);
	await vault.window.evaluate(() => {
		new Notice("test");
	});

	await vault.window.evaluate(async (pluginId) => {
		new Notice("[Test] Checking for plugin ID:", pluginId);
		const plugin = app.plugins.plugins[pluginId];
		new Notice("[Test] Plugin instance:", plugin);
		return plugin;
	}, PLUGIN_ID);
});
