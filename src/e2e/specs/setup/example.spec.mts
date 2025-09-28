// ===================================================================
// 8. Example Test (example.test.mts)
// ===================================================================

import { DIST_DIR, PLUGIN_ID, SANDBOX_VAULT_NAME } from "../../config.mts";
import { expect, test } from "../../test-fixtures.mts";

// Sandboxを使用（デフォルト）
test("sandbox test", async ({ vault }) => {
	const vaultName = await vault.window.evaluate(() => app.vault.getName());
	expect(vaultName).toBe(SANDBOX_VAULT_NAME);
	await vault.window.pause();
	expect(await vault.window.evaluate(() => app.plugins.isEnabled())).toBe(
		true
	);
	console.log(
		await vault.window.evaluate(
			(pluginId) => app.plugins.plugins[pluginId],
			PLUGIN_ID
		)
	);
});

// カスタム設定
test.use({
	vaultOptions: {
		useSandbox: true,
		clearSandbox: true,
		plugins: [DIST_DIR],
		enablePlugins: true,
	},
});
