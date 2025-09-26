import { testPluginInstalled } from "./base.mts";

testPluginInstalled(
	"verify plugin is installed and activated",
	async ({ pluginInstalledFixture }) => {
		const { appHandle, pluginHandle, pluginId } = pluginInstalledFixture;

		// プラグインが有効化されているか確認
		const vaultName = await appHandle.evaluate((app) =>
			app.vault.getName()
		);
		expect(vaultName).toBe("Obsidian Sandbox");
	}
);
