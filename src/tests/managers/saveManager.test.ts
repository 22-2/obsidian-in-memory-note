import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "obsidian";
import type SandboxNotePlugin from "src/main";
import { SaveManager } from "src/managers/SaveManager";
import type { SandboxNoteView } from "src/views/SandboxNoteView";
import type { EditorSyncManager } from "src/managers/EditorSyncManager";

const createMockView = (content: string): SandboxNoteView =>
	({
		wrapper: {
			getContent: vi.fn().mockReturnValue(content),
		},
		getViewType: vi.fn().mockReturnValue("sandbox-note"),
	} as unknown as SandboxNoteView);

describe("SaveManager", () => {
	let mockPlugin: SandboxNotePlugin;
	let mockApp: App;
	let saveManager: SaveManager;
	let mockEditorSyncManager: EditorSyncManager;

	beforeEach(() => {
		vi.clearAllMocks();

		mockApp = {
			workspace: {
				getActiveViewOfType: vi.fn(),
			},
		} as unknown as App;

		mockEditorSyncManager = {
			markAsSaved: vi.fn(),
		} as unknown as EditorSyncManager;

		mockPlugin = {
			app: mockApp,
			settings: {
				enableSaveNoteContent: true,
			},
			saveData: vi.fn().mockResolvedValue(undefined),
			editorSyncManager: mockEditorSyncManager,
		} as unknown as SandboxNotePlugin;

		saveManager = new SaveManager(mockPlugin);
	});

	it("should be defined", () => {
		expect(saveManager).toBeDefined();
	});

	describe("saveNoteContentToFile", () => {
		it("should save non-empty content and mark view as saved", async () => {
			const view = createMockView("Some note content");
			await saveManager.saveNoteContentToFile(view);

			expect(mockPlugin.saveData).toHaveBeenCalledOnce();
			const savedData = (mockPlugin.saveData as ReturnType<typeof vi.fn>)
				.mock.calls[0][0];
			expect(savedData.noteContent).toBe("Some note content");
			expect(savedData.lastSaved).toBeDefined();

			expect(mockEditorSyncManager.markAsSaved).toHaveBeenCalledOnce();
		});

		it("should save content if it is empty", async () => {
			const view = createMockView("");
			await saveManager.saveNoteContentToFile(view);

			expect(mockPlugin.saveData).toHaveBeenCalledOnce();
			expect(mockEditorSyncManager.markAsSaved).toHaveBeenCalledOnce();
		});

		it("should save content if it is only whitespace", async () => {
			const view = createMockView("   \t\n   ");
			await saveManager.saveNoteContentToFile(view);

			expect(mockPlugin.saveData).toHaveBeenCalledOnce();
			expect(mockEditorSyncManager.markAsSaved).toHaveBeenCalledOnce();
		});

		it("should log an error if saving fails", async () => {
			const error = new Error("Failed to write to disk");
			(mockPlugin.saveData as ReturnType<typeof vi.fn>).mockRejectedValue(
				error
			);
			const view = createMockView("Some content");

			await saveManager.saveNoteContentToFile(view);

			expect(mockEditorSyncManager.markAsSaved).not.toHaveBeenCalled();
		});
	});

	describe("debouncedSave", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should not save immediately when called", () => {
			const view = createMockView("Debounced content");
			saveManager.debouncedSave(view);
			expect(mockPlugin.saveData).not.toHaveBeenCalled();
		});

		it("should save after the delay", async () => {
			const view = createMockView("Debounced content");
			saveManager.debouncedSave(view);

			// Fast-forward time
			await vi.advanceTimersByTimeAsync(1000);

			expect(mockPlugin.saveData).toHaveBeenCalledOnce();
			const savedData = (mockPlugin.saveData as ReturnType<typeof vi.fn>)
				.mock.calls[0][0];
			expect(savedData.noteContent).toBe("Debounced content");
		});

		it("should only save once if called multiple times within the delay", async () => {
			const view = createMockView("Final content");
			saveManager.debouncedSave(createMockView("First call"));
			saveManager.debouncedSave(createMockView("Second call"));
			saveManager.debouncedSave(view);

			// Fast-forward time
			await vi.advanceTimersByTimeAsync(1000);

			expect(mockPlugin.saveData).toHaveBeenCalledOnce();
			const savedData = (mockPlugin.saveData as ReturnType<typeof vi.fn>)
				.mock.calls[0][0];
			expect(savedData.noteContent).toBe("Final content");
		});

		it("should reset the timer if called again", async () => {
			const view1 = createMockView("Content 1");
			const view2 = createMockView("Content 2");
			saveManager.debouncedSave(view1);

			// Fast-forward some time, but not enough to trigger save
			await vi.advanceTimersByTimeAsync(500);
			expect(mockPlugin.saveData).not.toHaveBeenCalled();

			// Call again
			saveManager.debouncedSave(view2);

			// Fast-forward again
			await vi.advanceTimersByTimeAsync(1000);

			expect(mockPlugin.saveData).toHaveBeenCalledOnce();
			const savedData = (mockPlugin.saveData as ReturnType<typeof vi.fn>)
				.mock.calls[0][0];
			expect(savedData.noteContent).toBe("Content 2");
		});

		it("should cancel debounced save if a direct save is triggered", async () => {
			const view1 = createMockView("Debounced call");
			const view2 = createMockView("Direct call");

			// Start a debounced save
			saveManager.debouncedSave(view1);
			expect(mockPlugin.saveData).not.toHaveBeenCalled();

			// Trigger a direct save before the debounce timer fires
			await saveManager.saveNoteContentToFile(view2);

			// The direct save should have been executed
			expect(mockPlugin.saveData).toHaveBeenCalledOnce();
			const savedData = (mockPlugin.saveData as ReturnType<typeof vi.fn>)
				.mock.calls[0][0];
			expect(savedData.noteContent).toBe("Direct call");

			// Fast-forward time to see if the debounced save also fires
			await vi.advanceTimersByTimeAsync(1000);

			// Should not have been called again
			expect(mockPlugin.saveData).toHaveBeenCalledOnce();
		});
	});
});
