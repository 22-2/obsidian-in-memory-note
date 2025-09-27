import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "fs";
import path from "path";
import invariant from "tiny-invariant";
import {
	COMMUNITY_PLUGINS_DIR,
	COMMUNITY_PLUGINS_FULL_PATH,
	COMMUNITY_PLUGINS_JSON_PATH,
	PLUGIN_ID,
	VAULT_PATH,
} from "../config.mts";
import { getElectronAppPath } from "../helpers.mts";
import { getAppWindow } from "./getters.mts";

export function clearWorkspaceJSONSync() {
	copyFileSync(
		path.join(VAULT_PATH, "/.obsidian/workspace.initial.json"),
		path.join(VAULT_PATH, "/.obsidian/workspace.json")
	);
	console.log("copied workspace.initial.json to workspace.json");
}
export async function clearObsidianJSON() {
	const { window: dummyWindow } = await getAppWindow();
	const appPath = await getElectronAppPath(dummyWindow);
	const indexPath = path.join(appPath, ".obsidian.json");
	if (existsSync(indexPath)) {
		console.log("Found .obsidian.json, removing...");
		rmSync(indexPath);
		console.log("Removed .obsidian.json");
	} else {
		console.log("No .obsidian.json found, nothing to remove.");
	}
	await dummyWindow.close();
}
export async function copyCommunityPlugins(
	pluginPaths: string[],
	vaultPath: string
) {
	console.log(`Vault path: ${vaultPath}`);
	const pluginBasePath = path.join(vaultPath, COMMUNITY_PLUGINS_DIR);

	for (const pluginPath of pluginPaths) {
		invariant(
			existsSync(pluginPath),
			`Plugin file not found: ${pluginPath}`
		);
		console.log(`[Plugin Install] Installing plugin: ${pluginPath}`);

		const pluginFolderName = path.basename(pluginPath);
		const destDir = path.join(pluginBasePath, pluginFolderName);
		// これで destDir は `.../.obsidian/plugins/dist` になります

		if (!existsSync(destDir)) {
			mkdirSync(destDir, { recursive: true });
			console.log(`[Plugin Install] Created directory: ${destDir}`);
		}

		for (const filename of readdirSync(pluginPath)) {
			const fullFilePath = path.join(pluginPath, filename);
			if (existsSync(fullFilePath)) {
				// destDirが正しいので、コピー先も正しくなります
				copyFileSync(fullFilePath, path.join(destDir, filename));
				console.log(
					`[Plugin Install] Copied file: ${fullFilePath} to ${path.join(
						destDir,
						filename
					)}`
				);
			} else {
				console.warn(
					`[Plugin Install] File not found, skipping: ${fullFilePath}`
				);
			}
		}

		// path.joinに絶対パスを渡すと意図通りに動かないため、destDirを使います
		console.log(`[Plugin Install] Copied plugin to: ${destDir}`);
	}

	writeCommunityPluginsJSON(
		// 注意: ここはプラグインのIDを渡す必要があります
		pluginPaths.map((p) => path.basename(p)),
		path.join(vaultPath, COMMUNITY_PLUGINS_JSON_PATH)
	);
}

export function writeCommunityPluginsJSON(
	enabledPlugins: string[],
	installPath: string
) {
	writeFileSync(installPath, JSON.stringify(enabledPlugins), "utf-8");
	const pluginList =
		enabledPlugins.length > 0 ? enabledPlugins.join(", ") : "none";
	console.log(`[Plugin Config] Set enabled plugins: ${pluginList}`);
}

export function setPluginInstalled(installPath = COMMUNITY_PLUGINS_FULL_PATH) {
	console.log(`[Plugin Config] Installing plugin: ${PLUGIN_ID}`);
	writeCommunityPluginsJSON([PLUGIN_ID], installPath);
}

export function setPluginDisabled(installPath = COMMUNITY_PLUGINS_FULL_PATH) {
	writeCommunityPluginsJSON([], installPath);
}
