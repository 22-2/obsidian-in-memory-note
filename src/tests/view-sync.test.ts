import { describe, it, expect, vi, beforeEach } from "vitest";
import { setContent, synchronizeWithExistingViews } from "src/view-sync";
import type { SandboxNoteView } from "src/SandboxNoteView";
import type { Editor } from "obsidian";

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
			updateUnsavedState: vi.fn(),
			plugin: {
				contentManager: {
					activeViews: new Set(),
					sharedNoteContent: "",
				},
			},
			initialContent: "",
			sandboxEditor: {
				getEditor: () => mockEditor as unknown as Editor,
			},
		} as unknown as SandboxNoteView;
	});

	describe("setContent", () => {
		it("should not do anything if the editor is not available", () => {
			vi.spyOn(mockView.sandboxEditor, "getEditor").mockReturnValue(
				undefined as any
			);
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
		it("should not do anything if there are no other active views", () => {
			mockView.plugin.contentManager.activeViews.add(mockView);
			synchronizeWithExistingViews(mockView);
			expect(mockView.plugin.contentManager.sharedNoteContent).toBe("");
		});

		it("should synchronize content from another view", () => {
			const mockOtherView = {
				editor: {
					getValue: vi
						.fn()
						.mockReturnValue("content from other view"),
				},
				initialContent: "other initial content",
			} as unknown as SandboxNoteView;

			mockView.plugin.contentManager.activeViews.add(mockView);
			mockView.plugin.contentManager.activeViews.add(mockOtherView);

			synchronizeWithExistingViews(mockView);

			expect(mockView.plugin.contentManager.sharedNoteContent).toBe(
				"content from other view"
			);
			expect(mockView.initialContent).toBe("other initial content");
		});

		it("should not synchronize if the other view has no editor", () => {
			const mockOtherView = {
				editor: undefined,
			} as unknown as SandboxNoteView;

			mockView.plugin.contentManager.activeViews.add(mockView);
			mockView.plugin.contentManager.activeViews.add(mockOtherView);

			synchronizeWithExistingViews(mockView);

			expect(mockView.plugin.contentManager.sharedNoteContent).toBe("");
		});
	});
});
