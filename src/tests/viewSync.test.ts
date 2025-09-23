import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SandboxNoteView } from "../views/SandboxNoteView";
import type { Editor } from "obsidian";
import { setContent, synchronizeWithExistingViews } from "src/helpers/viewSync";

describe("View Sync Helpers", () => {
	let mockView: SandboxNoteView;
	let mockEditor: {
		getValue: ReturnType<typeof vi.fn>;
		setValue: ReturnType<typeof vi.fn>;
	};
	let mockLeaf: {
		updateHeader: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		mockEditor = {
			getValue: vi.fn(),
			setValue: vi.fn(),
		};
		mockLeaf = {
			updateHeader: vi.fn(),
		};

		mockView = {
			editor: mockEditor as unknown as Editor,
			leaf: mockLeaf,
			containerEl: {
				isShown: vi.fn().mockReturnValue(true),
			},
			updateUnsavedState: vi.fn(),
			setContent: vi.fn(),
			plugin: {
				editorSyncManager: {
					activeViews: new Set(),
					sharedNoteContent: "",
				},
			},
			initialContent: "",
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

		it("should set the value, update unsaved state, and refresh header if content is different", () => {
			mockEditor.getValue.mockReturnValue("old content");
			setContent(mockView, "new content");
			expect(mockEditor.setValue).toHaveBeenCalledWith("new content");
			expect(mockView.updateUnsavedState).toHaveBeenCalledWith(
				"new content"
			);
			expect(mockLeaf.updateHeader).toHaveBeenCalledOnce();
		});
	});

	describe("synchronizeWithExistingViews", () => {
		it("should set content from shared content if no other views are open", () => {
			mockView.plugin.editorSyncManager.sharedNoteContent =
				"initial content from plugin";
			mockView.plugin.editorSyncManager.activeViews.add(mockView);

			synchronizeWithExistingViews(mockView);

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
				initialContent: "other initial content",
			} as unknown as SandboxNoteView;

			mockView.plugin.editorSyncManager.activeViews.add(mockView);
			mockView.plugin.editorSyncManager.activeViews.add(mockOtherView);

			synchronizeWithExistingViews(mockView);

			expect(mockView.plugin.editorSyncManager.sharedNoteContent).toBe(
				"content from other view"
			);
			expect(mockView.initialContent).toBe("other initial content");
			expect(mockView.setContent).toHaveBeenCalledWith(
				"content from other view"
			);
		});

		it("should not synchronize if the other view has no editor", () => {
			const mockOtherView = {
				editor: undefined,
			} as unknown as SandboxNoteView;

			mockView.plugin.editorSyncManager.activeViews.add(mockView);
			mockView.plugin.editorSyncManager.activeViews.add(mockOtherView);

			synchronizeWithExistingViews(mockView);

			expect(mockView.plugin.editorSyncManager.sharedNoteContent).toBe(
				""
			);
			expect(mockView.setContent).not.toHaveBeenCalled();
		});

		it("should do nothing if no other views and no initial content", () => {
			mockView.plugin.editorSyncManager.activeViews.add(mockView);
			synchronizeWithExistingViews(mockView);
			expect(mockView.setContent).not.toHaveBeenCalled();
		});
	});
});
