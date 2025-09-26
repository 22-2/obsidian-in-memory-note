// e2e/test-base.ts
import { existsSync } from "fs";
import path from "path";
import {
	type ElectronApplication,
	type Page,
	type JSHandle,
	_electron as electron,
} from "playwright";
import test, { expect } from "playwright/test";
import invariant from "tiny-invariant";
import type { App } from "obsidian";
import {
	initializeWorkspaceJSON,
	waitForWorkspace,
	focusRootWorkspace,
	countTabs,
} from "./helpers.mts";
import type SandboxPlugin from "../main";
import manifest from "../../manifest.json";
import { fileURLToPath } from "url";
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

/** Obsidian E2Eテストに必要な情報を格納したオブジェクト */
export interface ObsidianFixture {
	electronApp: ElectronApplication;
	window: Page;
	appHandle: JSHandle<App>;
	pluginHandle: JSHandle<SandboxPlugin>; // 🚨 GenericPluginを実際の型に置き換える
	/** プラグインID (Obsidian APIの `app.plugins.getPlugin()` に使用) */
	pluginId: (typeof manifest)["id"];
}

// ----------------------------------------------------------------------
// --- 拡張した Playwright Test オブジェクト ---
// ----------------------------------------------------------------------

// 依存性注入されたFixtureを定義
const obsidianTest = test.extend<{ obsidianFixture: ObsidianFixture }>({
	// Fixtureを定義。各テスト開始時に実行される
	obsidianFixture: [
		async ({}, use, testInfo) => {
			const pluginId = "sandbox-note"; // 🚨 実際のプラグインIDに置き換えてください
			const isRestorationStep = testInfo.title.includes(
				"restore note content"
			);

			console.log(
				`---------------Setup: ${testInfo.title}---------------`
			);
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

			// 3. プラグインハンドルを取得
			const pluginHandle = await appHandle.evaluateHandle(
				(app, id) => app.plugins.getPlugin(id) as GenericPlugin, // 🚨 型アサーション注意
				pluginId
			);

			// 4. 初期化後のクリーンアップ
			// (例: データベースクリア。 restoration test以外でのみ実行)
			if (!isRestorationStep) {
				// pluginHandle.evaluate(...) を使ってクリーンアップ処理を実行
				// await pluginHandle.evaluate((plugin) => plugin.databaseManager.clearAllNotes());
				console.log(`Cleanup: Clearing plugin state for ${pluginId}`);
			}

			// 5. 初期タブ数の検証 (例: 1つの空のタブがあることを確認)
			expect(await countTabs(appHandle)).toBe(1);

			// Fixtureオブジェクトを渡す
			await use({
				electronApp,
				window,
				appHandle,
				pluginHandle,
				pluginId,
			});

			// Cleanup: テスト終了後にアプリを閉じる
			console.log(
				`---------------Teardown: ${testInfo.title}---------------`
			);
			await electronApp?.close();
		},
		{ scope: "test" },
	], // 各テストごとに実行
});

// ----------------------------------------------------------------------
// --- 公開するオブジェクト ---
// ----------------------------------------------------------------------

export { expect };
export { VAULT_PATH as vaultPath };

// 拡張した test 関数を export
export { obsidianTest as test };
