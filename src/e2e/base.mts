// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\test-base.mts
// e2e/test-base.ts
import { existsSync } from "fs";
import type { App } from "obsidian";
import path from "path";
import {
	_electron as electron,
	type ElectronApplication,
	type JSHandle,
	type Page,
} from "playwright";
import test, { expect, type TestInfo } from "playwright/test";
import invariant from "tiny-invariant";
import { fileURLToPath } from "url";
import manifest from "../../manifest.json" with { type: "json" };
import type SandboxPlugin from "../main";
import {
	countTabs,
	focusRootWorkspace,
	initializeWorkspaceJSON, // 追加
	setPluginDisabled, // 追加
	setPluginInstalled,
	setRestrictedMode,
	waitForWorkspace
} from "./helpers.mts";
// 📝 必要に応じて実際のプラグインの型定義をインポート
// import type SandboxNotePlugin from "src/main";
// 🚨 注: 実際のプラグインの型に置き換えてください
type GenericPlugin = SandboxPlugin;

// --- Configuration & Constants ---
// スクリプトの実行ディレクトリを基準にパスを解決
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MonoRepoのルートにあるものとしてパスを定義
const APP_PATH = path.resolve(__dirname, "../../.obsidian-unpacked/main.js");
const VAULT_PATH = path.resolve(__dirname, "../../e2e-vault");

// 汎用セレクター (必要に応じて使用)
export const SANDBOX_VIEW_SELECTOR =
	'.workspace-leaf-content[data-type="hot-sandbox-note-view"]';
export const ACTIVE_LEAF_SELECTOR = `.mod-active .workspace-leaf.mod-active`;
export const ROOT_WORKSPACE_SELECTOR = ".workspace-split.mod-vertical.mod-root";

// --- Pre-flight checks ---
invariant(
	existsSync(APP_PATH),
	`Obsidian app not found at: ${APP_PATH}. Did you run 'pnpm build:e2e' and 'e2e-setup' script?`
);
invariant(
	existsSync(VAULT_PATH),
	`E2E vault not found at: ${VAULT_PATH}. Did you run 'e2e-setup' script?`
);
console.log("✅️ APP_PATH:", APP_PATH);
console.log("✅️ VAULT_PATH:", VAULT_PATH);

// --- State Variables ---

/** Obsidian E2Eテストに必要な情報を格納したオブジェクト (Base) */
export interface BaseObsidianFixture {
	electronApp: ElectronApplication;
	window: Page;
	appHandle: JSHandle<App>;
	/** プラグインID (Obsidian APIの `app.plugins.getPlugin()` に使用) */
	pluginId: (typeof manifest)["id"];
}

/** プラグインが有効化されているテストに必要な情報 (Plugin Installed) */
export interface PluginInstalledFixture extends BaseObsidianFixture {
	pluginHandle: JSHandle<SandboxPlugin>; // 🚨 GenericPluginを実際の型に置き換える
}

// ----------------------------------------------------------------------
// --- 拡張した Playwright Test オブジェクト ---
// ----------------------------------------------------------------------

const pluginId = manifest.id; // "sandbox-note"
const commonSetup = async (testInfo: TestInfo) => {
	const isRestorationStep = testInfo.title.includes("restore note content");
	console.log(`---------------Setup: ${testInfo.title}---------------`);
	console.log("isRestorationStep:", isRestorationStep);

	if (isRestorationStep === false) {
		await initializeWorkspaceJSON();
	}

	// 1. アプリケーションを起動
	const electronApp = await electron.launch({
		args: [
			APP_PATH,
			"open",
			`obsidian://open?path=${encodeURIComponent(VAULT_PATH)}`,
		],
	});
	const window = await electronApp.firstWindow();

	await waitForWorkspace(window);
	await focusRootWorkspace(window);

	// 2. グローバルなハンドルを初期化
	const appHandle = await window.evaluateHandle(
		() => (window as any).app as App
	);

	return { electronApp, window, appHandle, pluginId, isRestorationStep };
};

const commonTeardown = async (
	electronApp: ElectronApplication,
	testInfo: TestInfo
) => {
	console.log(`---------------Teardown: ${testInfo.title}---------------`);
	await electronApp?.close();
};

// --- 1. Base Fixture (コア起動) ---

const baseTest = test.extend<{ baseObsidianFixture: BaseObsidianFixture }>({
	baseObsidianFixture: [
		async ({}, use, testInfo) => {
			// **注意**: Baseフィクスチャではプラグインの状態を変更しない（初期設定のまま）

			const { electronApp, window, appHandle, pluginId } =
				await commonSetup(testInfo);

			// Fixtureオブジェクトを渡す
			await use({
				electronApp,
				window,
				appHandle,
				pluginId,
			});

			await commonTeardown(electronApp, testInfo);
		},
		{ scope: "test" },
	],
});

// --- 2. Restricted Fixture (全てのプラグインを無効化) ---

const restrictedTest = baseTest.extend<{
	restrictedFixture: BaseObsidianFixture;
}>({
	restrictedFixture: [
		async ({}, use, testInfo) => {
			// テスト開始前にプラグインを全て無効化する設定を注入
			setRestrictedMode();

			const { electronApp, window, appHandle, pluginId } =
				await commonSetup(testInfo);

			// Fixtureオブジェクトを渡す
			await use({
				electronApp,
				window,
				appHandle,
				pluginId,
			});

			await commonTeardown(electronApp, testInfo);
		},
		{ scope: "test" },
	],
});

// --- 3. Plugin Installed Fixture (テスト対象プラグインを有効化) ---

const pluginInstalledTest = baseTest.extend<{
	pluginInstalledFixture: PluginInstalledFixture;
}>({
	pluginInstalledFixture: [
		async ({}, use, testInfo) => {
			// テスト開始前にテスト対象プラグインを有効化する設定を注入
			setPluginInstalled();

			const {
				electronApp,
				window,
				appHandle,
				pluginId,
				isRestorationStep,
			} = await commonSetup(testInfo);

			// 3. プラグインハンドルを取得
			const pluginHandle = await appHandle.evaluateHandle(
				(app, id) => app.plugins.getPlugin(id) as GenericPlugin, // 🚨 型アサーション注意
				pluginId
			);

			// 4. 初期化後のクリーンアップ (Restoration test以外)
			if (!isRestorationStep) {
				// 例: データベースクリア。
				console.log(`Cleanup: Clearing plugin state for ${pluginId}`);
			}

			// 5. 初期タブ数の検証 (例: 1つの空のタブがあることを確認)
			// 注意: プラグイン起動時の挙動によってはタブ数が変わる可能性あり
			expect(await countTabs(appHandle)).toBe(1);

			// Fixtureオブジェクトを渡す
			await use({
				electronApp,
				window,
				appHandle,
				pluginHandle,
				pluginId,
			});

			await commonTeardown(electronApp, testInfo);
		},
		{ scope: "test" },
	],
});

// --- 4. Plugin Disabled Fixture (Restricted Modeではないが、テスト対象プラグインは無効) ---

const pluginDisabledTest = baseTest.extend<{
	pluginDisabledFixture: BaseObsidianFixture;
}>({
	pluginDisabledFixture: [
		async ({}, use, testInfo) => {
			// テスト開始前にテスト対象プラグインを無効化する設定を注入
			setPluginDisabled();

			const { electronApp, window, appHandle, pluginId } =
				await commonSetup(testInfo);

			// Fixtureオブジェクトを渡す
			await use({
				electronApp,
				window,
				appHandle,
				pluginId,
			});

			await commonTeardown(electronApp, testInfo);
		},
		{ scope: "test" },
	],
});

// ----------------------------------------------------------------------
// --- 公開するオブジェクト ---
// ----------------------------------------------------------------------

export { expect, VAULT_PATH as vaultPath };

// 従来の `obsidianTest` は `pluginInstalledTest` に置き換える
// ただし、以前のコードとの互換性のために、`obsidianFixture` のエイリアスを提供

/**
 * 従来のテスト関数 (`pluginInstalledTest`)。
 * pluginInstalledFixture を使用。
 */
export const obsidianTest = pluginInstalledTest.extend<{
	obsidianFixture: PluginInstalledFixture;
}>({
	obsidianFixture: ({ pluginInstalledFixture }, use) =>
		use(pluginInstalledFixture),
});

// レイヤー化されたテスト関数を export
export { pluginDisabledTest as testPluginDisabled, pluginInstalledTest as testPluginInstalled, restrictedTest as testRestricted };

