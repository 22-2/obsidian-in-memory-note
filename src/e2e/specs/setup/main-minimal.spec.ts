// src/e2e/specs/main-features.spec.ts

import type { Page } from "@playwright/test";
import { expect, test } from "../../test-fixtures";
import { runCommand } from "../../obsidian-commands/run-command";
import { DIST_DIR } from "../../config";
import { VIEW_TYPE_HOT_SANDBOX } from "../../../utils/constants";

// --- Constants Definition ---
const SANDBOX_VIEW_SELECTOR = `.workspace-leaf-content[data-type="${VIEW_TYPE_HOT_SANDBOX}"]`;
const ACTIVE_LEAF_SELECTOR = ".workspace-leaf.mod-active";
const ACTIVE_EDITOR_SELECTOR = `${ACTIVE_LEAF_SELECTOR} .cm-content`;
const ACTIVE_TITLE_SELECTOR = `${ACTIVE_LEAF_SELECTOR} .view-header-title`;

// --- Test Configuration ---
// For this test suite, we use a sandbox Vault with the plugin enabled.
test.use({
	vaultOptions: {
		useSandbox: true,
		plugins: [DIST_DIR], // Path to the built plugin
		enablePlugins: true,
	},
});

// --- Helper Functions ---

/**
 * Executes the command to create a new Hot Sandbox Note and optionally inputs text.
 * @param page Playwright Page object
 * @param content The text to input (optional)
 */
async function createNewSandboxNote(page: Page, content?: string) {
	await runCommand(page, "Open new hot sandbox note");
	await expect(page.locator(SANDBOX_VIEW_SELECTOR).last()).toBeVisible();
	if (content) {
		await page.locator(ACTIVE_EDITOR_SELECTOR).focus();
		await page.keyboard.type(content);
		await expect(page.locator(ACTIVE_EDITOR_SELECTOR)).toHaveText(content);
	}
}

/**
 * Retrieves the content of the currently active editor.
 * @param page Playwright Page object
 * @returns The editor content string
 */
async function getActiveEditorContent(page: Page): Promise<string> {
	return await page.evaluate(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const activeView = (window as any).app.workspace.activeLeaf.view;
		if (activeView.getViewType() === VIEW_TYPE_HOT_SANDBOX) {
			return activeView.editor.getValue();
		}
		return "";
	});
}

// --- Test Suite ---

test.describe("HotSandboxNoteView Main Features", () => {
	test("1. Note Creation and Input", async ({ vault }) => {
		const { window: page } = vault;
		const testContent = "Hello, Sandbox!";

		// 1. Create a new sandbox note and input text
		await createNewSandboxNote(page, testContent);

		// 2. Verify the input text exists in the editor
		expect(await getActiveEditorContent(page)).toBe(testContent);

		// 3. Verify that "*" appears in the tab title because the content is not empty (unsaved state)
		await expect(page.locator(ACTIVE_TITLE_SELECTOR)).toHaveText(
			"*Hot Sandbox-1"
		);
	});

	test("2. Content Synchronization Across Multiple Views", async ({
		vault,
	}) => {
		const { window: page } = vault;
		const initialContent = "Initial content.";
		const updatedContent = "Updated and synced!";

		// 1. Create the initial note
		await createNewSandboxNote(page, initialContent);

		// 2. Split the screen vertically
		await page
			.locator(
				`${ACTIVE_LEAF_SELECTOR} .view-actions [aria-label="Split vertically"]`
			)
			.click();
		await expect(page.locator(SANDBOX_VIEW_SELECTOR)).toHaveCount(2);

		// 3. Verify the new (right) pane after splitting has the same content
		const rightPaneEditor = page.locator(ACTIVE_EDITOR_SELECTOR);
		await expect(rightPaneEditor).toHaveText(initialContent);

		// 4. Update the content of the right pane
		await rightPaneEditor.focus();
		await page.keyboard.press("Control+A"); // Select all
		await page.keyboard.type(updatedContent);

		// 5. Verify the content of the left pane is also synchronized and updated
		const leftPaneEditor = page.locator(
			".workspace-leaf:not(.mod-active) .cm-content"
		);
		await expect(leftPaneEditor).toHaveText(updatedContent);
	});

	test("3. Multiple Independent Note Groups", async ({ vault }) => {
		const { window: page } = vault;
		const note1Content = "This is the first note.";
		const note2Content = "This is the second, separate note.";

		// 1. Create the first note group
		await createNewSandboxNote(page, note1Content);
		await expect(page.locator(ACTIVE_TITLE_SELECTOR)).toHaveText(
			"*Hot Sandbox-1"
		);

		// 2. Create a second, independent note group
		await createNewSandboxNote(page, note2Content);
		await expect(page.locator(ACTIVE_TITLE_SELECTOR)).toHaveText(
			"*Hot Sandbox-2"
		);
		await expect(page.locator(SANDBOX_VIEW_SELECTOR)).toHaveCount(2);

		// 3. Verify the content of the second note is correct (currently active)
		expect(await getActiveEditorContent(page)).toBe(note2Content);

		// 4. Verify the content of the first note has not changed (inactive leaf)
		const firstNoteContent = await page
			.locator(".workspace-leaf:not(.mod-active) .cm-content")
			.textContent();
		expect(firstNoteContent).toBe(note1Content);
	});

	test("4. Converting Note to File", async ({ vault }) => {
		const { window: page } = vault;
		const noteContent = "This note will be converted to a file.";
		const expectedFileName = "Hot Sandbox-1.md";

		// 1. Create the note to be converted
		await createNewSandboxNote(page, noteContent);

		// 2. Execute the "Convert to file" command
		await runCommand(page, "Convert to file");

		// 3. Verify the sandbox note view is closed
		await expect(page.locator(SANDBOX_VIEW_SELECTOR)).not.toBeVisible();

		// 4. Verify a new Markdown file tab is opened
		await expect(
			page.locator(`${ACTIVE_LEAF_SELECTOR}[data-type="markdown"]`)
		).toBeVisible();

		// 5. Verify the newly opened file name and content are correct
		await expect(page.locator(ACTIVE_TITLE_SELECTOR)).toHaveText(
			expectedFileName.replace(".md", "")
		);
		// Assuming the active view is now a standard Markdown editor
		const fileContent = await page.evaluate(() =>
			(window as any).app.workspace.activeEditor.editor.getValue()
		);
		expect(fileContent).toBe(noteContent);
	});

	/*
    // --- Feature specified but not yet implemented ---
    test.skip("5. Confirmation before closing the last tab", async () => {
        // This feature is mentioned in the specifications, but the current codebase
        // does not implement the logic to show a confirmation dialog when closing
        // the last tab of a Hot Sandbox group.
        // Therefore, this test is skipped.
    });
    */
});
