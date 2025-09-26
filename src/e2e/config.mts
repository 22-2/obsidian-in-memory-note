// e2e/e2e-config.ts
import { existsSync } from "fs";
import path from "path";
import invariant from "tiny-invariant";
import { fileURLToPath } from "url";

// ES Module環境で __dirname を安全に取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MonoRepoのルートにあるものとしてパスを定義
// test-base.ts や global-setup.ts から相対的にルートを定義
const ROOT_DIR = path.resolve(__dirname, "..", "..");

export const PLUGIN_ID = "sandbox-note"; // 🚨 実際のプラグインID
export const VAULT_NAME = "e2e-vault";

export const VAULT_PATH = path.join(ROOT_DIR, VAULT_NAME);
export const UNPACKED_APP_PATH = path.join(
	ROOT_DIR,
	".obsidian-unpacked",
	"main.js"
);

invariant(
	existsSync(UNPACKED_APP_PATH),
	`Obsidian app not found at: ${UNPACKED_APP_PATH}. Did you run 'pnpm build:e2e' and 'e2e-setup' script?`
);
invariant(
	existsSync(VAULT_PATH),
	`E2E vault not found at: ${VAULT_PATH}. Did you run 'e2e-setup' script?`
);

// Electron起動に必要なパス
// npx electron /path/to/.obsidian-unpacked/main.js
export const ELECTRON_PATH = "npx";
export const ELECTRON_ARGS = [
	UNPACKED_APP_PATH,
	"open",
	`obsidian://open?path=${encodeURIComponent(VAULT_PATH)}`,
];
