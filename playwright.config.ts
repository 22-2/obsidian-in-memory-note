import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    timeout: 120 * 1000,
    testDir: "./e2e",
    // コンテナ内の絶対パスに変更
    outputDir: "/app/test-results",
    reporter: [["html", { outputFolder: "/app/playwright-report" }]],
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
