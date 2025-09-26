// このファイルは Playwright の E2E テストファイルです。
import {
	getActiveSandboxLocator,
	getActiveTabTitle,
	getEditor,
	openNewSandboxNote,
	splitActiveView,
	waitForWorkspace,
} from "./helpers.mts";
// import { pluginHandle, SANDBOX_VIEW_SELECTOR, window } from "./test-base";
import { test, expect, SANDBOX_VIEW_SELECTOR } from "./test-base.mts";

// --- Test Suites ---

test.describe("Hot Sandbox Note: Basic Functionality (UI-centric)", () => {
	test("should open a new note, allow typing, and update title with asterisk", async ({
		obsidianFixture,
	}) => {
		const { window } = obsidianFixture;
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
		await expect(tabTitle).toHaveText(/\Hot Sandbox-\d+/);
	});

	test("should sync content between two split views of the same note", async ({
		obsidianFixture,
	}) => {
		const { window } = obsidianFixture;
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
		await secondEditor.fill(reverseSyncText);

		// Assert: Verify the full text is now in the first editor.
		await expect(firstEditor).toHaveText(syncText + reverseSyncText);
	});
});

test.describe.serial("Hot Sandbox Note: Hot Exit (Restart Test)", () => {
	const testText = `Content to be restored - ${Date.now()}`;

	test("should create and populate a note for the restart test", async ({
		obsidianFixture,
	}) => {
		const { window, pluginHandle } = obsidianFixture;
		// Arrange: Open a note and type some unique text.
		await openNewSandboxNote(window);
		const view = await getActiveSandboxLocator(window);
		const editor = getEditor(view);
		await editor.click();
		await editor.fill(testText);

		// Assert: Verify content is present.
		await expect(editor).toHaveText(testText);

		// Act: Wait for the automatic save to trigger (default debounce is 3000ms).
		await window.waitForTimeout(4000);
	});

	// Note: Since this is a serial block, Playwright ensures the app is closed after the previous test
	// and restarted automatically via the subsequent test's beforeEach hook.

	test("should restore note content after an application restart", async ({
		obsidianFixture,
	}) => {
		const { window, pluginHandle } = obsidianFixture;
		// Act: App has already been restarted by the preceding afterEach/beforeEach hooks.
		await waitForWorkspace(window);

		// Wait for restoration to complete.
		await window.waitForTimeout(1000);

		const count = await pluginHandle.evaluate((plugin) =>
			plugin.databaseManager.getAllNotes().then((notes) => notes.length)
		);

		expect(count).toBe(1);

		// Assert: Verify that the note and its content have been restored.
		const restoredView = await getActiveSandboxLocator(window);
		const restoredEditor = getEditor(restoredView);

		// Assert: Check content restoration
		await expect(restoredEditor).toHaveText(testText);

		// Assert: Verify the tab title also shows the changed state.
		const restoredTabTitle = getActiveTabTitle(window);
		await expect(restoredTabTitle).toHaveText(/\*Hot Sandbox-\d+/);
	});
});
