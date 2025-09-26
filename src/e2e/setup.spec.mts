// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\setup.spec.mts
import { expect, testPluginInstalled } from "./base.mts";

// このテストは、フィクスチャによってプラグイン有効化がファイル操作で実行されるようになったため、
// 実際には不要ですが、プロジェクト内に残す場合は以下のようにシンプルにすることができます。
// このテストは、プラグインが有効化されていることを確認する統合テストとして機能します。

testPluginInstalled(
	"verify plugin is installed and activated",
	async ({ pluginInstalledFixture }) => {
		const { appHandle, pluginHandle, pluginId } = pluginInstalledFixture;

		// プラグインが有効化されているか確認
		const isEnabled = await appHandle.evaluate(
			(app, id) => app.plugins.enabledPlugins.has(id),
			pluginId
		);
		expect(isEnabled).toBe(true);

		// プラグインハンドルが有効か確認
		expect(pluginHandle).toBeTruthy();
		const isLoaded = await pluginHandle.evaluate(
			(plugin) => plugin._loaded
		);
		expect(isLoaded).toBe(true);
	}
);
