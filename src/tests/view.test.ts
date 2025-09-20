import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SandboxNoteView } from "src/view";
import type { WorkspaceLeaf } from "obsidian";
import type SandboxNotePlugin from "src/main";
import { SandboxEditor } from "src/sandboxEditor";

describe("SandboxNoteView", () => {
	let mockLeaf: WorkspaceLeaf;
	let mockPlugin: SandboxNotePlugin;
	let mockContentEl: {
		empty: ReturnType<typeof vi.fn>;
		createEl: ReturnType<typeof vi.fn>;
		addEventListener: ReturnType<typeof vi.fn>;
	};
	let mockSandboxEditor: {
		onload: ReturnType<typeof vi.fn>;
		load: ReturnType<typeof vi.fn>;
		content: string;
		leaf: {
			updateHeader: ReturnType<typeof vi.fn>;
		};
		getEditor: ReturnType<typeof vi.fn>;
		inlineView: { editMode: {} };
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

		// Mock the sandbox editor
		mockSandboxEditor = {
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
			leaf: {
				updateHeader: vi.fn(),
			},
			inlineView: {
				editMode: {},
			},
		};

		// Mock the plugin and its dependencies
		mockPlugin = {
			app: {
				workspace: {
					on: vi.fn(),
				},
			},
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
			registerEvent: vi.fn(),
		} as unknown as SandboxNotePlugin;

		// Mock the workspace leaf
		mockLeaf = {
			app: {
				commands: {},
			},
			updateHeader: vi.fn(),
		} as unknown as WorkspaceLeaf;

		// Create an instance of the view
		view = new SandboxNoteView(mockLeaf, mockPlugin);

		// Manually assign the mocked contentEl and sandboxEditor
		view.contentEl = mockContentEl as any;
		view.sandboxEditor = mockSandboxEditor as unknown as SandboxEditor;

		// Mock the addAction method to return a mock HTMLElement
		const mockSaveActionEl = {
			show: vi.fn(),
			hide: vi.fn(),
			toggleClass: vi.fn(),
			setAttribute: vi.fn(),
		};
		view.addAction = vi.fn().mockReturnValue(mockSaveActionEl);

		// Spy on console.error
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should display an error message if sandboxEditor.onload fails", async () => {
		// Arrange
		const testError = new Error("Failed to load editor");
		mockSandboxEditor.onload.mockRejectedValue(testError);

		// Act
		await view.onOpen();

		// Assert
		expect(mockSandboxEditor.onload).toHaveBeenCalledOnce();
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
		expect(mockSandboxEditor.load).not.toHaveBeenCalled();
	});

	it("should load the editor successfully if sandboxEditor.onload succeeds", async () => {
		// Arrange (already done in beforeEach)

		// Act
		await view.onOpen();

		// Assert
		expect(mockSandboxEditor.onload).toHaveBeenCalledOnce();
		expect(console.error).not.toHaveBeenCalled();
		expect(mockContentEl.empty).not.toHaveBeenCalled();
		// It's called once to create the container
		expect(mockContentEl.createEl).toHaveBeenCalledOnce();
		expect(mockContentEl.createEl).toHaveBeenCalledWith("div", {
			cls: "sandbox-note-container",
		});
		expect(mockSandboxEditor.load).toHaveBeenCalledOnce();
	});
});
