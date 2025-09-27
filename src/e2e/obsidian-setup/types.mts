// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\types.mts
import type { App } from "obsidian";
import type { ElectronApplication, JSHandle, Page } from "playwright";
import type SandboxPlugin from "../../main";
import type { PLUGIN_ID } from "../config.mts";
// setup.mtsからオプションの型をインポート
import type { LaunchVaultWindowOptions } from "./launch.mts";

/* ========================================================================== */
//
//  新しい型定義
//
/* ========================================================================== */

export interface ElectronAppFixture {
	electronApp: ElectronApplication;
	window: Page;
}

/**
 * スターターページ（ボールト選択画面）の状態を表すフィクスチャ。
 * appHandleは存在しないため常にnullです。
 */
export interface ObsidianStarterFixture extends ElectronAppFixture {}

/**
 * ボールトが開いている状態を表すフィクスチャ。
 * appHandleとpluginHandleが利用可能です。
 */
export interface ObsidianVaultFixture extends ElectronAppFixture {
	appHandle: JSHandle<App>; // not null
	pluginId: typeof PLUGIN_ID;
}

// launchVaultWindowのオプション型を再エクスポート
export type { LaunchVaultWindowOptions };

export interface ObsidianJSON {
	vault: {
		[id: string]: ObsidianVaultEntry;
	};
}

export interface ObsidianVaultEntry {
	path: string;
}

/* ========================================================================== */
//
//  非推奨の型定義
//
/* ========================================================================== */

/**
 * @deprecated `ObsidianStarterFixture` または `ObsidianVaultFixture` を使用してください。
 */
export interface BaseObsidianFixture extends ElectronAppFixture {
	appHandle: JSHandle<App> | null;
}

/**
 * @deprecated `ObsidianVaultFixture` を使用してください。`pluginHandle` はそちらに含まれます。
 */
export interface PluginInstalledFixture extends BaseObsidianFixture {
	pluginHandle: JSHandle<SandboxPlugin>;
}

/**
 * @deprecated これはセットアップ関数の内部的な戻り値の型です。テストのフィクスチャとしては `ObsidianStarterFixture` または `ObsidianVaultFixture` を使用してください。
 */
export interface SetupFixture extends BaseObsidianFixture {
	pluginId: typeof PLUGIN_ID;
	isRestorationStep: boolean;
}

/**
 * @deprecated `LaunchVaultWindowOptions` を使用してください。
 */
export interface CommonSetupOptions {
	/** trueの場合、UI操作でRestricted Modeを無効化する */
	disableRestrictedMode?: boolean;
	/** 指定した名前のVaultをテスト開始時に開く */
	openSandboxVault?: boolean;
	startOnStarterPage?: boolean;
}
// --- 型定義 ---
/** `vault-list` IPCイベントが返すVault情報の型 */

export interface VaultInfo {
	path: string;
	ts: number;
	open?: boolean;
}
