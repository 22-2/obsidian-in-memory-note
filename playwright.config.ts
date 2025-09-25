import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	timeout: 120 * 1000,
	testDir: "./src/e2e",
	// コンテナ内の絶対パスに変更
	outputDir: "../test-results",
	reporter: [["html", { outputFolder: "../playwright-report" }]],
	fullyParallel: false,
	workers: 1,
	use: {
		trace: "on-first-retry",
		video: "on",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
