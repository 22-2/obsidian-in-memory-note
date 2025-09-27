import { SANDBOX_VAULT_NAME } from "../../config.mts";
import {
	getVaultList as getVaultListObj,
	openSandboxVault,
	openVault,
} from "../../obsidian-setup/ipc-helpers.mts";
import {
	checkIsStarter,
	reopenVaultWith,
} from "src/e2e/obsidian-setup/helpers.mts";
import { expect, test } from "../../test-fixtures.mts";
import path from "path";
import { getElectronAppPath } from "../../helpers.mts";

test("should get vault list via IPC", async ({ starter }) => {
	const vaultList = await getVaultListObj(starter.window);
	const names = Object.values(vaultList)
		.map((v) => v.path)
		.at(0);
	expect(names).toContain(SANDBOX_VAULT_NAME);
});

test("openVault from vault", async ({ vault }) => {
	expect(checkIsStarter(vault.window)).toBe(false);
	const vaultWindow = await reopenVaultWith(vault.electronApp, () =>
		openVault(vault.window, SANDBOX_VAULT_NAME)
	);
	expect(checkIsStarter(vaultWindow)).toBe(false);
});

test("openVault from starter", async ({ starter }) => {
	expect(checkIsStarter(starter.window)).toBe(true);
	const vaultFullPath = path.join(
		await getElectronAppPath(starter.window),
		SANDBOX_VAULT_NAME
	);
	const vault = await reopenVaultWith(starter.electronApp, () =>
		openVault(starter.window, vaultFullPath)
	);
	expect(checkIsStarter(vault)).toBe(false);
});

test("create vault from by penVault from starter", async ({ starter }) => {
	expect(checkIsStarter(starter.window)).toBe(true);
	const testVaultName = "test-vault-" + (Math.random() * 10000).toFixed(0);
	const vaultFullPath = path.join(
		await getElectronAppPath(starter.window),
		testVaultName
	);
	const vault = await reopenVaultWith(starter.electronApp, () =>
		openVault(starter.window, vaultFullPath, true)
	);
	expect(checkIsStarter(vault)).toBe(false);
});

test("openSandboxVault", async ({ starter }) => {
	expect(checkIsStarter(starter.window)).toBe(true);
	const window = await reopenVaultWith(starter.electronApp, () =>
		openSandboxVault(starter.window)
	);
	expect(checkIsStarter(window)).toBe(false);
	expect(await window.title()).toContain(SANDBOX_VAULT_NAME);
});
