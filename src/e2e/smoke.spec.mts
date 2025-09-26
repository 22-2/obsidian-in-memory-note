// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\smoke.spec.mts
// このファイルは Playwright の E2E テストファイルです。
import {
	expect,
	testPluginInstalled as test, // testのエイリアスとして使用
} from "./base.mts";
import { SANDBOX_VIEW_SELECTOR } from "./config.mts";
import {
	getActiveSandboxLocator,
	getActiveTabTitle,
	getEditor,
	openNewSandboxNote,
	splitActiveView,
	waitForWorkspace,
} from "./helpers.mts";

// --- Test Suites ---

test.describe("Hot Sandbox Note: Basic Functionality (UI-centric)", () => {
	test("should open a new note, allow typing, and update title", async ({
		pluginInstalledFixture,
	}) => {
		const { window } = pluginInstalledFixture;
		// Act: Open a new note.
		await openNewSandboxNote(window);
		const view = await getActiveSandboxLocator(window);

		// Assert: Check the initial tab title.
		const tabTitle = getActiveTabTitle(window);
		await expect(tabTitle).toHaveText(/Hot Sandbox-\d+/);

		// Act: Type text into the editor.
		const editor = getEditor(view);
		await editor.click();
		const testText = "Hello, this is an E2E test!";
		await editor.fill(testText);

		// Assert: Verify text and title update.
		await expect(editor).toHaveText(testText);
		await expect(tabTitle).toHaveText(/\*Hot Sandbox-\d+/);
	});

	test("should sync content between two split views of the same note", async ({
		pluginInstalledFixture,
	}) => {
		const { window } = pluginInstalledFixture;
		// Arrange: Open a note and split the view (using UI interaction).
		await openNewSandboxNote(window);
		await splitActiveView(window, "right");

		// Get the views (both are present in the DOM)
		const allSandboxViews = window.locator(SANDBOX_VIEW_SELECTOR);
		await expect(allSandboxViews).toHaveCount(2);

		// Act: Type in the first editor.
		const firstEditor = getEditor(allSandboxViews.first());
		const secondEditor = getEditor(allSandboxViews.last());

		const syncText = "This text should appear in both views.";
		await firstEditor.click();
		await firstEditor.fill(syncText);

		// Assert: Verify text is synced to the second editor.
		await expect(secondEditor).toHaveText(syncText);

		// Act: Type in the second editor to test reverse sync.
		const reverseSyncText = " And this text from the second view.";
		await secondEditor.press("End");
		await secondEditor.type(reverseSyncText);

		// Assert: Verify the full text is now in the first editor.
		await expect(firstEditor).toHaveText(syncText + reverseSyncText);
	});
});

test.describe.serial("Hot Sandbox Note: Hot Exit (Restart Test)", () => {
	const testText = `Content to be restored - ${Date.now()}`;

	test("should create and populate a note for the restart test", async ({
		pluginInstalledFixture,
	}) => {
		const { window } = pluginInstalledFixture;
		// Arrange: Open a note and type some unique text.
		await openNewSandboxNote(window);
		const view = await getActiveSandboxLocator(window);
		const editor = getEditor(view);
		await editor.click();
		await editor.fill(testText);

		// Assert: Verify content is present.
		await expect(editor).toHaveText(testText);

		// Act: Wait for the automatic save to trigger (default debounce is 2000ms).
		await window.waitForTimeout(3000);
	});

	test("should restore note content after an application restart", async ({
		pluginInstalledFixture,
	}) => {
		const { window } = pluginInstalledFixture;
		await waitForWorkspace(window);
		await window.waitForTimeout(1000); // Wait for restoration to complete.

		const restoredView = await getActiveSandboxLocator(window);
		const restoredEditor = getEditor(restoredView);
		await expect(restoredEditor).toHaveText(testText);

		const restoredTabTitle = getActiveTabTitle(window);
		await expect(restoredTabTitle).toHaveText(/\*Hot Sandbox-\d+/);
	});
});
