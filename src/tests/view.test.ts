import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SandboxNoteView } from "src/view";
import type { WorkspaceLeaf } from "obsidian";
import type SandboxNotePlugin from "src/main";
import type { InlineEditor } from "src/inlineEditor";

describe("SandboxNoteView", () => {
	let mockLeaf: WorkspaceLeaf;
	let mockPlugin: SandboxNotePlugin;
	let mockContentEl: {
		empty: ReturnType<typeof vi.fn>;
		createEl: ReturnType<typeof vi.fn>;
	};
	let mockInlineEditor: {
		onload: ReturnType<typeof vi.fn>;
		load: ReturnType<typeof vi.fn>;
		content: string;
	};
	let view: SandboxNoteView;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock the content element of the view
		mockContentEl = {
			empty: vi.fn(),
			createEl: vi.fn().mockReturnValue(document.createElement("div")), // Return a dummy element
			addEventListener: vi.fn(),
		};

		// Mock the inline editor
		mockInlineEditor = {
			onload: vi.fn().mockResolvedValue(undefined),
			load: vi.fn(),
			content: "",
			getEditor: vi.fn(() => ({
				cm: {
					plugin: vi.fn(() => ({
						connectToPlugin: vi.fn(),
					})),
				},
				getValue: vi.fn(),
				setValue: vi.fn(),
			})),
			inlineView: {
				editMode: {},
			},
		};

		// Mock the plugin and its dependencies
		mockPlugin = {
			contentManager: {
				addActiveView: vi.fn(),
				sharedNoteContent: "shared content",
				activeViews: new Set(),
			},
			editorManager: {
				watchEditorPlugin: {} as any,
			},
			settings: {
				enableSaveNoteContent: true,
			},
		} as unknown as SandboxNotePlugin;

		// Mock the workspace leaf
		mockLeaf = {
			app: {
				commands: {},
			},
		} as unknown as WorkspaceLeaf;

		// Create an instance of the view
		view = new SandboxNoteView(mockLeaf, mockPlugin);

		// Manually assign the mocked contentEl and inlineEditor
		view.contentEl = mockContentEl as any;
		view.inlineEditor = mockInlineEditor as unknown as InlineEditor;

		// Spy on console.error
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should display an error message if inlineEditor.onload fails", async () => {
		// Arrange
		const testError = new Error("Failed to load editor");
		mockInlineEditor.onload.mockRejectedValue(testError);

		// Act
		await view.onOpen();

		// Assert
		expect(mockInlineEditor.onload).toHaveBeenCalledOnce();
		expect(console.error).toHaveBeenCalledWith(
			"Sandbox Note: Failed to initialize inline editor.",
			testError
		);
		expect(mockContentEl.empty).toHaveBeenCalledOnce();
		expect(mockContentEl.createEl).toHaveBeenCalledOnce();
		expect(mockContentEl.createEl).toHaveBeenCalledWith("div", {
			text: "Error: Could not initialize editor. This might be due to an Obsidian update.",
			cls: "sandbox-error-message",
		});
		// Ensure that the successful load path was not taken
		expect(mockInlineEditor.load).not.toHaveBeenCalled();
	});

	it("should load the editor successfully if inlineEditor.onload succeeds", async () => {
		// Arrange (already done in beforeEach)

		// Act
		await view.onOpen();

		// Assert
		expect(mockInlineEditor.onload).toHaveBeenCalledOnce();
		expect(console.error).not.toHaveBeenCalled();
		expect(mockContentEl.empty).not.toHaveBeenCalled();
		// It's called once to create the container
		expect(mockContentEl.createEl).toHaveBeenCalledOnce();
		expect(mockContentEl.createEl).toHaveBeenCalledWith("div", {
			cls: "sandbox-note-container",
		});
		expect(mockInlineEditor.load).toHaveBeenCalledOnce();
	});
});
