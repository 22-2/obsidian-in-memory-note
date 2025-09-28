import "../../log-setup.mts";
import type SandboxPlugin from "../../../main";
import * as constants from "../../../utils/constants";
const { VIEW_TYPE_HOT_SANDBOX } = constants;
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
	const pluginHandle = await vault.window.evaluateHandle(
		(pluginId) => {
			return app.plugins.plugins[pluginId as any] as SandboxPlugin;
		},
		[PLUGIN_ID]
	);

	expect(pluginHandle.asElement() !== null).toBeTruthy();
	await pluginHandle.evaluate((plugin) => plugin.activateNewHotSandboxView());
	expect(
		vault.window.locator(`[data-type="${VIEW_TYPE_HOT_SANDBOX}]`)
	).toBeVisible();
});

// カスタム設定
test.use({
	vaultOptions: {
		useSandbox: true,
		plugins: [DIST_DIR],
		enablePlugins: true,
	},
});
