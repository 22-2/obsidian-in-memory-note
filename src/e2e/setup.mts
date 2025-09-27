// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\setup.mts
import type { App } from "obsidian";
import type { ElectronApplication, Page, TestInfo } from "playwright/test";
import { _electron as electron } from "playwright/test";

import {
	APP_MAIN_JS_PATH,
	PLUGIN_ID,
	SANDBOX_VAULT_NAME,
	VAULT_NAME,
} from "./config.mts";
import {
	disableRestrictedModeAndEnablePlugins,
	focusRootWorkspace,
	initializeObsidianJSON,
	initializeSandboxVault,
	initializeWorkspaceJSON,
	openSandboxVault as openSandboxVaultByCommand,
	performActionAndReload,
	waitForWorkspace,
} from "./helpers.mts";
import type { CommonSetupOptions, SetupFixture } from "./types.mts";

export async function ensureSandboxVault(
	electronApp: ElectronApplication,
	window: Page
) {
	if (await checkIsStarter(window)) {
		console.log("[Setup] Opening sandbox vault from starter page...");
		return performActionAndReload(electronApp, () =>
			window.getByText(VAULT_NAME, { exact: true }).click()
		);
	}

	console.log("[Setup] Opening sandbox vault from vault page...");
	return performActionAndReload(
		electronApp,
		async () => {
			openSandboxVaultByCommand(electronApp, window);
		},
		{
			closeOldWindows: false,
		}
	);
}

export function checkIsStarter(window: Page) {
	return window.evaluate(() => document.URL.includes("starter"));
}

/**
 * Ensures the application is currently displaying the starter page (vault selection screen).
 * Closes the currently open vault if necessary by mimicking the "Close vault" command.
 * @returns The Page instance, now guaranteed to be on the starter page.
 */
export async function ensureStarterPage(
	electronApp: ElectronApplication,
	window: Page
): Promise<Page> {
	console.log("[Setup] Ensuring application is on the starter page.");

	if (await checkIsStarter(window)) {
		console.log("[Setup] Already on starter page.");
		await window.waitForSelector(".mod-change-language", {
			state: "visible",
		});
		return window;
	}

	console.log(
		"[Setup] Vault is currently open. Attempting to close vault..."
	);

	await focusRootWorkspace(window);
	console.log("focued");
	await window.locator(".workspace-drawer-vault-switcher").click();
	console.log("open drawer");
	window = await performActionAndReload(
		electronApp,
		async () => {
			await window.getByText("Manage vaults...", { exact: true }).click();
		},
		{
			focus: async () => {},
			waitFor: async (win) => {
				void win.getByText("Create", { exact: true }).isVisible();
			},
		}
	);

	await window.waitForSelector(".mod-change-language", {
		state: "visible",
		timeout: 5000,
	});

	console.log("[Setup] Successfully returned to starter page.");
	return window;
}

/**
 * Ensures the sandbox vault is open, regardless of the application's starting state
 * (starter page or another open vault).
 * Requires initializeSandboxVault (or ensureSandboxVault) to be called beforehand
 * to guarantee vault existence.
 * @returns The new Page instance with the sandbox vault open.
 */
export async function ensureVaultOpen(
	electronApp: ElectronApplication,
	window: Page
): Promise<Page> {
	let winRef = window;
	console.log(
		`[Setup] Ensuring sandbox vault '${SANDBOX_VAULT_NAME}' is open.`
	);

	if (await checkIsStarter(winRef)) {
		winRef = await ensureSandboxVault(electronApp, winRef);
	} else {
		winRef = await ensureStarterPage(electronApp, winRef);
	}

	// 新しいワークスペースがロードされるのを待つ
	await waitForWorkspace(winRef);
	await focusRootWorkspace(winRef);

	console.log(`[Setup] Successfully opened sandbox vault.`);
	return winRef;
}

export const commonSetup = async (
	testInfo: TestInfo,
	options: CommonSetupOptions = {}
): Promise<SetupFixture> => {
	const isRestorationStep = testInfo.title.includes(
		"restore note content after an application restart"
	);
	console.log(`\n--------------- Setup: ${testInfo.title} ---------------`);
	console.log("[Setup Options]", options);

	if (!isRestorationStep) {
		initializeWorkspaceJSON();
	}

	const appOptions = {
		args: [APP_MAIN_JS_PATH, "--no-sandbox", "--disable-setuid-sandbox"],
		env: {
			...process.env,
			NODE_ENV: "development",
		},
	};
	const dummyApp = await electron.launch(appOptions);
	console.log("launched dummy electron app");
	await initializeObsidianJSON(dummyApp);
	console.log("initialized obsidian.json");
	await dummyApp.close();
	console.log("close dummy");

	const electronApp = await electron.launch(appOptions);
	console.log("launched electron app");

	let window = await electronApp.firstWindow();
	console.log("get window");
	console.log(await window.evaluate(() => document.URL));

	if (options.startOnStarterPage) {
		// 【要求1: 確実に Starter Page で開始する】
		// 他のオプション（disableRestrictedMode, openSandboxVault）よりも優先し、Vaultを閉じる。
		window = await ensureStarterPage(electronApp, window);
	} else if (options.openSandboxVault || options.disableRestrictedMode) {
		// 【要求2: 確実に Sandbox Vault が開いた状態で開始する】
		// disableRestrictedMode が設定されている場合も、Vaultが開いていることを保証するために実行。
		window = await ensureVaultOpen(electronApp, window);
	} else {
		// 3. どちらも指定がない場合は、起動時の状態を待つ
		const isStarterPage = await window.evaluate(() =>
			document.URL.includes("starter")
		);

		if (isStarterPage) {
			await window.waitForSelector(".mod-change-language");
		} else {
			await waitForWorkspace(window);
			await focusRootWorkspace(window);

			// 1. Restricted Mode の無効化処理 (再起動を伴い、通常はVaultが開いた状態になる)
			if (options.disableRestrictedMode) {
				// Vaultの初期化（ボールトが存在しない場合に作成し開く）
				window = await performActionAndReload(electronApp, async () => {
					await ensureSandboxVault(electronApp, window);
				});
				// disableRestrictedModeAndEnablePlugins は再起動を伴い、新しいウィンドウを返す
				window = await disableRestrictedModeAndEnablePlugins(
					electronApp,
					window,
					[PLUGIN_ID]
				);
			}
		}
	}

	const appHandle = await window.evaluateHandle(
		() => (window as any).app as App
	);

	return {
		electronApp,
		window,
		appHandle,
		pluginId: PLUGIN_ID,
		isRestorationStep,
	};
};

export const commonTeardown = async (
	electronApp: ElectronApplication,
	testInfo: TestInfo
) => {
	await electronApp?.close();
	console.log(`--------------- Teardown: ${testInfo.title} ---------------`);
};
