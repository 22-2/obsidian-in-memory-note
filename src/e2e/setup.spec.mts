// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\setup.spec.mts
// test-base.mts から test をインポートしますが、これは pluginInstalledTest を指します。
import { expect, testPluginInstalled as test } from "./base.mts";

// このテストは、フィクスチャによってプラグイン有効化がファイル操作で実行されるようになったため、
// 実際には不要ですが、プロジェクト内に残す場合は以下のようにシンプルにすることができます。
// このテストは、プラグインが有効化されていることを確認する統合テストとして機能します。

test("verify plugin is installed and activated", async ({
	pluginInstalledFixture,
}) => {
	const { appHandle, pluginHandle, pluginId } = pluginInstalledFixture;

	// プラグインが有効化されているか確認
	const isEnabled = await appHandle.evaluate(
		(app, id) => app.plugins.enabledPlugins.has(id),
		pluginId
	);
	expect(isEnabled).toBe(true);

	// プラグインハンドルが有効か確認
	expect(pluginHandle).toBeTruthy();
});

// 🚨 元の setup.spec.mts は設定画面のUI操作を伴うものでしたが、
// 今後はファイル操作でセットアップが完了するため、
// このファイルは削除するか、↑のように単純な検証テストに置き換えることを推奨します。
