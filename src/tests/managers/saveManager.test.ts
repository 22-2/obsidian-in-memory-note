import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "obsidian";
import type SandboxNotePlugin from "src/main";
import { AutoSaveHandler } from "src/managers/SaveManager";
import type { SandboxNoteView } from "src/views/SandboxNoteView";

const createMockView = (content: string): SandboxNoteView =>
	({
		wrapper: {
			getContent: vi.fn().mockReturnValue(content),
		},
		markAsSaved: vi.fn(),
		getViewType: vi.fn().mockReturnValue("sandbox-note"),
	} as unknown as SandboxNoteView);

describe("SaveManager", () => {
	let mockPlugin: SandboxNotePlugin;
	let mockApp: App;
	let saveManager: AutoSaveHandler;

	beforeEach(() => {
		vi.clearAllMocks();

		mockApp = {
			workspace: {
				getActiveViewOfType: vi.fn(),
			},
		} as unknown as App;

		mockPlugin = {
			app: mockApp,
			settings: {
				enableSaveNoteContent: true,
			},
			saveData: vi.fn().mockResolvedValue(undefined),
		} as unknown as SandboxNotePlugin;

		saveManager = new AutoSaveHandler(mockPlugin);
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

			expect(view.markAsSaved).toHaveBeenCalledOnce();
		});

		it("should save content if it is empty", async () => {
			const view = createMockView("");
			await saveManager.saveNoteContentToFile(view);

			expect(mockPlugin.saveData).toHaveBeenCalledOnce();
			expect(view.markAsSaved).toHaveBeenCalledOnce();
		});

		it("should save content if it is only whitespace", async () => {
			const view = createMockView("   \t\n   ");
			await saveManager.saveNoteContentToFile(view);

			expect(mockPlugin.saveData).toHaveBeenCalledOnce();
			expect(view.markAsSaved).toHaveBeenCalledOnce();
		});

		it("should log an error if saving fails", async () => {
			const error = new Error("Failed to write to disk");
			(mockPlugin.saveData as ReturnType<typeof vi.fn>).mockRejectedValue(
				error
			);
			const view = createMockView("Some content");

			await saveManager.saveNoteContentToFile(view);

			expect(view.markAsSaved).not.toHaveBeenCalled();
		});
	});

	describe("handleActiveLeafChange", () => {
		it("should not save if there was no previous view", () => {
			const viewA = createMockView("View A content");
			(
				mockApp.workspace.getActiveViewOfType as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue(viewA);

			saveManager.handleActiveLeafChange();

			expect(mockPlugin.saveData).not.toHaveBeenCalled();
			expect(saveManager["previousActiveView"]).toBe(viewA);
		});

		it("should save previous view's content when switching views and auto-save is on", () => {
			const viewA = createMockView("View A content");
			mockPlugin.settings.enableAutoSave = true;

			// 1. Open View A
			(
				mockApp.workspace.getActiveViewOfType as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue(viewA);
			saveManager.handleActiveLeafChange();
			expect(mockPlugin.saveData).not.toHaveBeenCalled(); // No previous view

			// 2. Switch to View B
			const viewB = createMockView("View B content");
			(
				mockApp.workspace.getActiveViewOfType as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue(viewB);
			saveManager.handleActiveLeafChange();

			// Should save the content of the previous view (View A)
			expect(mockPlugin.saveData).toHaveBeenCalledOnce();
			const savedData = (mockPlugin.saveData as ReturnType<typeof vi.fn>)
				.mock.calls[0][0];
			expect(savedData.noteContent).toBe("View A content");

			// Previous view should now be View B
			expect(saveManager["previousActiveView"]).toBe(viewB);
		});

		it("should not save previous view's content if auto-save is off", () => {
			const viewA = createMockView("View A content");
			mockPlugin.settings.enableAutoSave = false; // Auto-save disabled

			// 1. Open View A
			(
				mockApp.workspace.getActiveViewOfType as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue(viewA);
			saveManager.handleActiveLeafChange();

			// 2. Switch to View B
			const viewB = createMockView("View B content");
			(
				mockApp.workspace.getActiveViewOfType as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue(viewB);
			saveManager.handleActiveLeafChange();

			expect(mockPlugin.saveData).not.toHaveBeenCalled();
		});

		it("should save when closing the last view", () => {
			const viewA = createMockView("View A content");

			// 1. Open View A
			(
				mockApp.workspace.getActiveViewOfType as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue(viewA);
			saveManager.handleActiveLeafChange();

			// 2. Close the view (active view is now null)
			(
				mockApp.workspace.getActiveViewOfType as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue(null);
			saveManager.handleActiveLeafChange();

			expect(mockPlugin.saveData).toHaveBeenCalledOnce();
			const savedData = (mockPlugin.saveData as ReturnType<typeof vi.fn>)
				.mock.calls[0][0];
			expect(savedData.noteContent).toBe("View A content");
			expect(saveManager["previousActiveView"]).toBe(null);
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
