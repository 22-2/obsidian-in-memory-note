// ===================================================================
// test-fixtures.mts - Playwrightテストフィクスチャ
// ===================================================================

import {
	ObsidianTestSetup,
	type TestContext,
} from "./obsidian-setup/setup.mts";
import type { VaultOptions } from "./obsidian-setup/vault-manager.mts";
import { test as base } from "@playwright/test";

type TestFixtures = {
	obsidianSetup: ObsidianTestSetup;
	vault: TestContext;
	vaultOptions: VaultOptions;
};

export const test = base.extend<TestFixtures>({
	vaultOptions: {
		useSandbox: true,
		clearSandbox: true,
		enablePlugins: false,
		plugins: [],
	},

	obsidianSetup: async ({}, use) => {
		const setup = new ObsidianTestSetup();
		await setup.launch();
		await use(setup);
		await setup.cleanup();
	},

	vault: async ({ obsidianSetup, vaultOptions }, use) => {
		const context = vaultOptions.useSandbox
			? await obsidianSetup.openSandbox(vaultOptions)
			: await obsidianSetup.openVault(vaultOptions);
		await use(context);
	},
});

export { expect } from "@playwright/test";
