// ===================================================================
// 1. Core Types (types.mts)
// ===================================================================

import type { App } from "obsidian";
import type { ElectronApplication, Page } from "playwright";

export interface VaultConfig {
	name: string;
	path?: string;
	isNew?: boolean;
	plugins?: string[];
	enablePlugins?: boolean;
}

export interface TestContext {
	app: ElectronApplication;
	page: Page;
	vault: VaultConfig;
	obsidianApp?: App;
}
