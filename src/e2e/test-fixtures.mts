// ===================================================================
// test-fixtures.mts - Playwrightテストフィクスチャ
// ===================================================================

import {
	ObsidianTestSetup,
	type TestContext,
} from "./obsidian-setup/setup.mts";
import type { VaultOptions } from "./obsidian-setup/vault-manager.mts";
import { test as base } from "@playwright/test";
import log from "loglevel";

type TestFixtures = {
	obsidianSetup: ObsidianTestSetup;
	vault: TestContext;
	vaultOptions: VaultOptions;
};
const logger = log.getLogger("obsidianSetup");

export const test = base.extend<TestFixtures>({
	vaultOptions: {
		useSandbox: true,
		enablePlugins: false,
		plugins: [],
	},

	obsidianSetup: async ({}, use) => {
		const setup = new ObsidianTestSetup();
		try {
			logger.debug("launch");
			await setup.launch();
			logger.debug("done");
			logger.debug("enter tests");
			await use(setup);
			logger.debug("done");
		} catch (err: any) {
			logger.error("failed to test");
			logger.error(err);
			throw new Error(err);
		} finally {
			logger.debug("clean up app");
			await setup.cleanup();
			logger.debug("ok");
		}
	},

	vault: async ({ obsidianSetup, vaultOptions }, use) => {
		logger.debug("vaultOptions", vaultOptions);
		const context = vaultOptions.useSandbox
			? await obsidianSetup.openSandbox(vaultOptions)
			: await obsidianSetup.openVault(vaultOptions);
		logger.debug("enter test");
		await use(context);
		logger.debug("done");
	},
});

export { expect } from "@playwright/test";
