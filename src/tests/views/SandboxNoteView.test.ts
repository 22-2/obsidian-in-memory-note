import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SandboxNoteView } from "src/views/SandboxNoteView";
import type { WorkspaceLeaf, App } from "obsidian";
import type SandboxNotePlugin from "src/main";

// Mock 'monkey-around' to avoid errors in test environment
vi.mock("monkey-around", () => ({
	around: vi.fn(() => () => {}), // Return a dummy unregister function
}));

// Mock parts of 'obsidian' to allow view instantiation and operation
vi.mock("obsidian", async () => {
	const actual = await vi.importActual("obsidian");
	// Dynamically import JSDOM inside the factory to avoid hoisting issues
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM();
	const { document } = dom.window;

	class MockItemView {
		leaf: any;
		app: any;
		contentEl: HTMLElement & {
			empty: () => void;
			createEl: (tag: string, options?: any) => HTMLElement;
		};
		constructor(leaf: any) {
			this.leaf = leaf;
			this.app = leaf.app;
			const contentEl = document.createElement("div") as any;
			contentEl.empty = vi.fn();
			contentEl.createEl = vi.fn((tag: string, options?: any) => {
				return document.createElement(tag);
			});
			this.contentEl = contentEl;
		}
		register = vi.fn();
		registerDomEvent = vi.fn();
		async onOpen() {}
		async onClose() {}
	}

	return {
		...actual,
		ItemView: MockItemView,
		Notice: vi.fn(),
	};
});

describe("SandboxNoteView", () => {
	let leaf: WorkspaceLeaf;
	let plugin: SandboxNotePlugin;
	let app: App;
	let view: SandboxNoteView;

	beforeEach(() => {
		app = {
			workspace: {
				on: vi.fn(),
				getLeavesOfType: vi.fn().mockReturnValue([]),
			},
			commands: {
				executeCommandById: vi.fn(),
			},
		} as unknown as App;

		leaf = {
			id: "test-leaf",
			app: app,
			setViewState: vi.fn(),
			updateHeader: vi.fn(),
		} as unknown as WorkspaceLeaf;

		plugin = {
			app: app,
			registerEvent: vi.fn(),
			contentManager: {
				sharedNoteContent: "Initial Content From Plugin",
				addActiveView: vi.fn(),
				removeActiveView: vi.fn(),
				updateNoteContent: vi.fn(),
			},
			settings: {
				enableSaveNoteContent: true,
				enableCtrlS: true,
			},
			editorManager: {
				watchEditorPlugin: vi.fn(),
			},
			saveManager: {
				debouncedSave: vi.fn(),
			},
		} as unknown as SandboxNotePlugin;

		view = new SandboxNoteView(leaf, plugin);
		view.addAction = vi.fn();

		const mockEditor = {
			getValue: vi.fn().mockReturnValue(""),
			setValue: vi.fn(),
			cm: {
				plugin: vi.fn().mockReturnValue({
					connectToPlugin: vi.fn((plugin, view) => {
						// Simulate the connection that happens in the real plugin
						// This is where the view gets linked to the update mechanism
					}),
				}),
				dispatch: vi.fn(),
				state: { doc: { toString: () => mockEditor.getValue() } },
			},
			getCursor: vi.fn(),
			setCursor: vi.fn(),
		};

		mockEditor.setValue.mockImplementation((content: string) => {
			mockEditor.getValue.mockReturnValue(content);
			// In the real app, this would trigger the SyncEditorPlugin's update method.
			// We can simulate that call here.
			view.updateUnsavedState(content);
			view.onContentChanged(content);
		});

		view.wrapper = {
			onload: vi.fn().mockResolvedValue(undefined),
			load: vi.fn(),
			unload: vi.fn(),
			virtualEditor: {
				editor: mockEditor,
				load: vi.fn(),
				unload: vi.fn(),
				setState: vi.fn().mockResolvedValue(undefined),
				editMode: {
					cm: mockEditor.cm,
				},
			},
			content: "",
		} as any;

		Object.defineProperty(view, "editor", {
			get: () => mockEditor,
			configurable: true,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should not display an asterisk in the title on initial load", async () => {
		await view.onOpen();

		// After onOpen, the view should be in a "saved" state.
		// The bug causes this to fail. The fix will make it pass.
		expect(view.hasUnsavedChanges).toBe(false);
		expect(view.getDisplayText()).toBe("Sandbox Note");
	});
});
