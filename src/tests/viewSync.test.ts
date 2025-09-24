import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SandboxNoteView } from "../views/SandboxNoteView";
import type { Editor } from "obsidian";
import { setContent, syncViewContent } from "src/helpers/viewSync";
import type { EditorSyncManager } from "src/managers/EditorSyncManager";

describe("View Sync Helpers", () => {
	let mockView: SandboxNoteView;
	let mockEditor: {
		getValue: ReturnType<typeof vi.fn>;
		setValue: ReturnType<typeof vi.fn>;
	};
	let mockLeaf: {
		updateHeader: ReturnType<typeof vi.fn>;
	};
	let mockEditorSyncManager: EditorSyncManager;

	beforeEach(() => {
		mockEditor = {
			getValue: vi.fn(),
			setValue: vi.fn(),
		};
		mockLeaf = {
			updateHeader: vi.fn(),
		};
		mockEditorSyncManager = {
			activeViews: new Set(),
			currentSharedNoteContent: "",
			syncAll: vi.fn(),
		} as unknown as EditorSyncManager;

		mockView = {
			editor: mockEditor as unknown as Editor,
			leaf: mockLeaf,
			containerEl: {
				isShown: vi.fn().mockReturnValue(true),
			},
			setContent: vi.fn(),
			plugin: {
				editorSyncManager: mockEditorSyncManager,
			},
			loadInitialContent: vi.fn(),
		} as unknown as SandboxNoteView;
	});

	describe("setContent", () => {
		it("should not do anything if the editor is not available", () => {
			// Simulate the editor not being available
			(mockView as any).editor = undefined;
			setContent(mockView, "new content");
			expect(mockEditor.setValue).not.toHaveBeenCalled();
		});

		it("should not do anything if the content is the same", () => {
			mockEditor.getValue.mockReturnValue("same content");
			setContent(mockView, "same content");
			expect(mockEditor.setValue).not.toHaveBeenCalled();
		});

		it("should set the value and refresh header if content is different", () => {
			mockEditor.getValue.mockReturnValue("old content");
			setContent(mockView, "new content");
			expect(mockEditor.setValue).toHaveBeenCalledWith("new content");
			expect(mockLeaf.updateHeader).toHaveBeenCalledOnce();
		});
	});

	describe("synchronizeWithExistingViews", () => {
		it("should set content from shared content if no other views are open", () => {
			mockView.plugin.editorSyncManager.currentSharedNoteContent =
				"initial content from plugin";
			mockView.plugin.editorSyncManager.activeViews.add(mockView);

			syncViewContent(mockView);

			expect(mockView.setContent).toHaveBeenCalledWith(
				"initial content from plugin"
			);
		});

		it("should synchronize content from another view and set it in the editor", () => {
			const mockOtherView = {
				editor: {
					getValue: vi
						.fn()
						.mockReturnValue("content from other view"),
				},
			} as unknown as SandboxNoteView;

			mockView.plugin.editorSyncManager.activeViews.add(mockView);
			mockView.plugin.editorSyncManager.activeViews.add(mockOtherView);
			mockView.plugin.editorSyncManager.currentSharedNoteContent = "shared content";

			syncViewContent(mockView);

			expect(mockView.setContent).toHaveBeenCalledWith(
				"shared content"
			);
		});

		it("should not synchronize if the other view has no editor", () => {
			const mockOtherView = {
				editor: undefined,
			} as unknown as SandboxNoteView;

			mockView.plugin.editorSyncManager.activeViews.add(mockView);
			mockView.plugin.editorSyncManager.activeViews.add(mockOtherView);
			mockView.plugin.editorSyncManager.currentSharedNoteContent = "";

			syncViewContent(mockView);

			expect(
				mockView.plugin.editorSyncManager.currentSharedNoteContent
			).toBe("");
			expect(mockView.setContent).not.toHaveBeenCalled();
		});

		it("should do nothing if no other views and no initial content", () => {
			mockView.plugin.editorSyncManager.activeViews.add(mockView);
			syncViewContent(mockView);
			expect(mockView.setContent).not.toHaveBeenCalled();
		});
	});
});
