// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\config.mts
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import invariant from "tiny-invariant";
import manifest from "../../manifest.json" with { type: "json" };

// --- Project Structure ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
export const DIST_DIR = path.join(ROOT_DIR, "dist");

// --- Plugin Information ---
export const PLUGIN_ID = manifest.id;

// --- Vault & App Paths ---
export const TEST_VAULT_NAME = "e2e-vault";
export const SANDBOX_VAULT_NAME = "Obsidian Sandbox"; // Sandbox Vaultの名前

/**
 * @deprecated
*/
export const VAULT_PATH = path.join(ROOT_DIR, TEST_VAULT_NAME);
export const APP_MAIN_JS_PATH = path.join(ROOT_DIR, ".obsidian-unpacked", "main.js");

// --- Pre-flight checks ---
invariant(
	existsSync(APP_MAIN_JS_PATH),
	`Obsidian app not found at: ${APP_MAIN_JS_PATH}. Did you run 'pnpm build:e2e' and 'e2e-setup' script?`
);
invariant(
	existsSync(VAULT_PATH),
	`E2E vault not found at: ${VAULT_PATH}. Did you run 'e2e-setup' script?`
);

// --- UI Selectors ---
export const SANDBOX_VIEW_SELECTOR =
	'.workspace-leaf-content[data-type="hot-sandbox-note-view"]';
export const ACTIVE_LEAF_SELECTOR = `.mod-active .workspace-leaf.mod-active`;
export const ROOT_WORKSPACE_SELECTOR = ".workspace-split.mod-vertical.mod-root";

export const COMMUNITY_PLUGINS_DIR = ".obsidian/plugins";
export const COMMUNITY_PLUGINS_JSON_PATH = ".obsidian/community-plugins.json";

/**
 * @deprecated
  */
export const COMMUNITY_PLUGINS_FULL_PATH = path.join(
	VAULT_PATH,
	COMMUNITY_PLUGINS_JSON_PATH,
);
export const LAUNCH_OPTIONS = {
	args: [APP_MAIN_JS_PATH, "--no-sandbox", "--disable-setuid-sandbox"],
	env: {
		...process.env,
		NODE_ENV: "development",
	},
};
