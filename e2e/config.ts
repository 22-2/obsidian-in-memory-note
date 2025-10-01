import { existsSync } from "fs";
import path from "path";
import invariant from "tiny-invariant";
import { fileURLToPath } from "url";
import manifest from "../manifest.json" with { type: "json" };
import paths from "./paths.json" with { type: "json" };

// --- Project Structure ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const E2E_ROOT_DIR = __dirname;
const PROJECT_ROOT_DIR = path.resolve(E2E_ROOT_DIR, paths.pluginSourceDir);
export const DIST_DIR = path.join(PROJECT_ROOT_DIR, paths.distDir);

console.log("PROJECT_ROOT_DIR", PROJECT_ROOT_DIR);
console.log("DIST_DIR", DIST_DIR);

// --- Plugin Information ---
export const PLUGIN_ID = manifest.id;

// --- Vault & App Paths ---
export const TEST_VAULT_NAME = paths.vaultName;
export const SANDBOX_VAULT_NAME = "Obsidian Sandbox";

/**
 * @deprecated
 */
export const TEST_VAULT_PATH = path.join(E2E_ROOT_DIR, TEST_VAULT_NAME);
export const APP_MAIN_JS_PATH = path.join(
	E2E_ROOT_DIR,
	paths.obsidianUnpackedDir,
	paths.appMainFile
);

console.log("E2E_ROOT_DIR", E2E_ROOT_DIR);
console.log("TEST_VAULT_PATH", TEST_VAULT_PATH);
console.log("APP_MAIN_JS_PATH", APP_MAIN_JS_PATH);

// --- Pre-flight checks ---
invariant(
	existsSync(E2E_ROOT_DIR),
	`E2E root not found at: ${E2E_ROOT_DIR}.`
);
invariant(
	existsSync(APP_MAIN_JS_PATH),
	`Obsidian app not found at: ${APP_MAIN_JS_PATH}. Did you run 'pnpm build:e2e' and 'e2e-setup' script?`
);
invariant(
	existsSync(TEST_VAULT_PATH),
	`E2E vault not found at: ${TEST_VAULT_PATH}. Did you run 'e2e-setup' script?`
);


export const LAUNCH_OPTIONS = {
	args: [APP_MAIN_JS_PATH, "--no-sandbox", "--disable-setuid-sandbox", "--unsafely-disable-devtools-self-xss-warnings"],
	env: {
		...process.env,
		NODE_ENV: "development",
	},
};
