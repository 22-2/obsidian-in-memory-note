import test, {
	expect,
	type ElectronApplication,
	type Page,
	type Locator,
} from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { _electron as electron } from "playwright";
import invariant from "tiny-invariant";

const TIMEOUT = 5000;

// --- Configuration & Constants ---
const appPath = path.join(__dirname, "../../.obsidian-unpacked/main.js");
const vaultPath = path.join(__dirname, "../../e2e-vault");

// --- Pre-flight checks ---
invariant(
	existsSync(appPath),
	`Obsidian app not found at: ${appPath}. Did you run 'pnpm build:e2e' and 'e2e-setup' script?`
);
invariant(
	existsSync(vaultPath),
	`E2E vault not found at: ${vaultPath}. Did you run 'e2e-setup' script?`
);

// --- Global State ---
// These are initialized once in `beforeAll` and reused across tests for efficiency.
let app: ElectronApplication;
let window: Page;

// --- Helper Functions (inspired by the provided snippets) ---

/** Waits for the Obsidian workspace to be fully loaded. */
const waitForWorkspace = async (page: Page) => {
	// Wait for the splash screen to disappear. This is a crucial step.
	await page.waitForSelector(".progress-bar", {
		state: "detached",
		timeout: TIMEOUT,
	});
	// Wait for the main workspace to be ready.
	await expect(page.locator(".workspace")).toBeVisible({
		timeout: TIMEOUT,
	});
};

/** Runs a command from the Obsidian command palette. */
const runCommand = async (command: string) => {
	// For macOS, Playwright automatically maps "Control" to "Meta".
	await window.keyboard.press("Control+P");
	await window.locator(".prompt-input").fill(command);
	const suggestion = window.locator(".suggestion-item.is-selected");
	await expect(suggestion).toBeVisible();
	await suggestion.click();
};

/** Clicks the ribbon icon to open a new Hot Sandbox Note. */
const openNewSandboxNote = async () => {
	await window
		.getByLabel("Open new hot sandbox note", { exact: true })
		.click();
};

/** Returns a locator for all visible sandbox views. */
const getSandboxViews = (): Locator => {
	return window.locator(
		'.workspace-leaf-content[data-type="hot-sandbox-note-view"]'
	);
};

/** Returns a locator for the active (currently focused) sandbox view. */
const getActiveSandboxView = (): Locator => {
	return window.locator(
		'.workspace-leaf.mod-active .workspace-leaf-content[data-type="hot-sandbox-note-view"]'
	);
};

/** Returns a locator for the CodeMirror editor within a given view. */
const getEditor = (viewLocator: Locator): Locator => {
	return viewLocator.locator(".cm-content");
};

/** Returns a locator for the title of the active tab. */
const getActiveTabTitle = (): Locator => {
	return window.locator(
		".workspace-tab-header.is-active .workspace-tab-header-inner-title"
	);
};

/** Splits the active view. */
const splitActiveView = async (direction: "vertically" | "horizontally") => {
	await window
		.locator(
			".workspace-leaf.mod-active .view-actions .clickable-icon[aria-label='More options']"
		)
		.click();
	await window
		.locator(".menu-item-title", { hasText: `Split ${direction}` })
		.click();
};

const closeAllTabs = async () => {
	while ((await countTabs()) > 1) {
		await window.keyboard.press("Control+W");
	}
};

const countTabs = () =>
	window.locator(".workspace-split.mod-root .workspace-tab-header").count();

// --- Test Hooks ---

// Launch the app once before all tests.
test.beforeAll(async () => {
	app = await electron.launch({ args: [appPath, vaultPath] });
	window = await app.firstWindow();
	await waitForWorkspace(window);
	await closeAllTabs();
});

// Close the app after all tests have run.
test.afterAll(async () => {
	await app?.close();
});

// After each test, close all tabs to ensure a clean slate for the next test.
test.afterEach(async () => {
	await closeAllTabs();
	expect(await countTabs()).toBe(1);
});

// --- Test Suites ---

test.describe("Hot Sandbox Note: Basic Functionality", () => {
	test("should open a new note, allow typing, and update title with asterisk", async () => {
		// Act: Open a new note.
		await openNewSandboxNote();
		const view = getActiveSandboxView();
		await expect(view).toBeVisible();
		await expect(getSandboxViews()).toHaveCount(1);

		// Assert: Check the initial tab title.
		const tabTitle = getActiveTabTitle();
		await expect(tabTitle).toHaveText(/Hot Sandbox-\d+/);

		// Act: Type text into the editor.
		const editor = getEditor(view);
		await editor.click(); // Focus the editor
		await editor.fill("Hello, this is an E2E test!");

		// Assert: Verify text and title update.
		await expect(editor).toHaveText("Hello, this is an E2E test!");
		await expect(tabTitle).toHaveText(/\*Hot Sandbox-\d+/);
	});

	test("should sync content between two split views of the same note", async () => {
		// Arrange: Open a note and split the view.
		await openNewSandboxNote();
		await splitActiveView("vertically");
		await expect(getSandboxViews()).toHaveCount(2);

		// Act: Type in the first editor.
		const editors = getEditor(getSandboxViews());
		const firstEditor = editors.first();
		const secondEditor = editors.last();
		const syncText = "This text should appear in both views.";
		await firstEditor.click();
		await firstEditor.fill(syncText);

		// Assert: Verify text is synced to the second editor.
		await expect(secondEditor).toHaveText(syncText);

		// Act: Type in the second editor to test reverse sync.
		const reverseSyncText = " And this text from the second view.";
		await secondEditor.press("End"); // Move cursor to the end
		await secondEditor.type(reverseSyncText);

		// Assert: Verify the full text is now in the first editor.
		await expect(firstEditor).toHaveText(syncText + reverseSyncText);
	});
});

// Use `describe.serial` to run these tests sequentially, as they depend on each other.
test.describe.serial("Hot Sandbox Note: Hot Exit (Restart Test)", () => {
	const testText = `Content to be restored - ${Date.now()}`;

	test("should create and populate a note for the restart test", async () => {
		// Arrange: Open a note and type some unique text.
		await openNewSandboxNote();
		const editor = getEditor(getActiveSandboxView());
		await editor.click();
		await editor.fill(testText);

		// Assert: Verify content is present.
		await expect(editor).toHaveText(testText);

		// Act: Wait for the automatic save to trigger (default debounce is 3000ms).
		await window.waitForTimeout(4000);
	});

	test("should restore note content after an application restart", async () => {
		// Act: Restart the application.
		await app.close();
		app = await electron.launch({ args: [appPath, vaultPath] });
		window = await app.firstWindow();
		await waitForWorkspace(window);

		// Assert: Verify that the note and its content have been restored.
		const restoredView = getActiveSandboxView();
		await expect(restoredView).toBeVisible();
		const restoredEditor = getEditor(restoredView);
		await expect(restoredEditor).toHaveText(testText);

		// Assert: Verify the tab title also shows the changed state.
		const restoredTabTitle = getActiveTabTitle();
		await expect(restoredTabTitle).toHaveText(/\*Hot Sandbox-\d+/);
	});
});
