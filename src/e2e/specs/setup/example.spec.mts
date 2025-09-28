import "../../log-setup.mts";
// ===================================================================
// 8. Example Test (example.test.mts)
// ===================================================================

import { DIST_DIR, PLUGIN_ID, SANDBOX_VAULT_NAME } from "../../config.mts";
import { expect, test } from "../../test-fixtures.mts";
import log from "loglevel";

const logger = log.getLogger("example.spec");

// Sandboxを使用（デフォルト）
test("sandbox test", async ({ vault }) => {
	const vaultName = await vault.window.evaluate(() => app.vault.getName());
	expect(vaultName).toBe(SANDBOX_VAULT_NAME);
	expect(await vault.window.evaluate(() => app.plugins.isEnabled())).toBe(
		true
	);
	expect(
		await vault.window.evaluate(
			(pluginId) => app.plugins.plugins[pluginId],
			PLUGIN_ID
		)
	).toBeTruthy();
});

// カスタム設定
test.use({
	vaultOptions: {
		useSandbox: true,
		plugins: [DIST_DIR],
		enablePlugins: true,
	},
});
