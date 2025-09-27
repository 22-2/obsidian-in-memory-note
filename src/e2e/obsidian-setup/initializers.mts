import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import {
	COMMUNITY_PLUGINS_DIR,
	COMMUNITY_PLUGINS_FULL_PATH,
	COMMUNITY_PLUGINS_JSON_PATH,
	PLUGIN_ID,
	VAULT_PATH,
} from "../config.mts";
import invariant from "tiny-invariant";
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

export async function copyCommunityPlugins(pluginPaths: string[]) {
	const { window: dummyWindow } = await getAppWindow();
	const appPath = await getElectronAppPath(dummyWindow);
	await dummyWindow.close();
	console.log(`App path: ${appPath}`);
	console.log(`Vault path: ${VAULT_PATH}`);
	const pluginBasePath = path.join(appPath, COMMUNITY_PLUGINS_DIR);
	for (const pluginPath of pluginPaths) {
		invariant(
			existsSync(pluginPath),
			`Plugin file not found: ${pluginPath}`
		);
		console.log(`[Plugin Install] Installing plugin: ${pluginPath}`);
		const pluginDirname = path.basename(pluginPath);
		const destDir = path.dirname(path.join(pluginBasePath, pluginDirname));
		if (!existsSync(destDir)) {
			mkdirSync(destDir, { recursive: true });
			console.log(`[Plugin Install] Created directory: ${destDir}`);
		}
		copyFileSync(pluginPath, path.join(pluginBasePath, pluginDirname));
		console.log(
			`[Plugin Install] Copied plugin file to: ${path.join(
				pluginBasePath,
				pluginPath
			)}`
		);
	}
	writeCommunityPluginsJSON(
		pluginPaths.map((p) => path.basename(p)),
		path.join(appPath, COMMUNITY_PLUGINS_JSON_PATH)
	);
} // --- ファイルシステム操作ヘルパー ---

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
