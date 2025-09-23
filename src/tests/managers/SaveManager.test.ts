import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveManager } from "src/managers/SaveManager";
import type { SandboxNoteView } from "src/views/SandboxNoteView";
import { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { SandboxNotePluginSettings } from "src/settings";

const createMockView = (content: string): SandboxNoteView =>
	({
		wrapper: {
			getContent: vi.fn().mockReturnValue(content),
		},
		getViewType: vi.fn().mockReturnValue("sandbox-note"),
	} as unknown as SandboxNoteView);

describe("SaveManager", () => {
	let saveManager: SaveManager;
	let mockEmitter: EventEmitter<AppEvents>;
	let mockSettings: SandboxNotePluginSettings;
	let mockSaveData: (settings: SandboxNotePluginSettings) => Promise<void>;

	beforeEach(() => {
		vi.clearAllMocks();

		mockEmitter = new EventEmitter<AppEvents>();
		mockEmitter.emit = vi.fn();

		mockSettings = {
			enableAutoSave: true,
			autoSaveDebounceMs: 1000,
		} as SandboxNotePluginSettings;

		mockSaveData = vi.fn().mockResolvedValue(undefined);

		saveManager = new SaveManager(mockEmitter, mockSettings, mockSaveData);
	});

	it("should be defined", () => {
		expect(saveManager).toBeDefined();
	});

	describe("saveNoteContentToFile", () => {
		it("should save non-empty content and mark view as saved", async () => {
			const view = createMockView("Some note content");
			await saveManager.saveNoteContentToFile(view);

			expect(mockSaveData).toHaveBeenCalledOnce();
			const savedSettings = (
				mockSaveData as ReturnType<typeof vi.fn>
			).mock.calls[0][0];
			expect(savedSettings.noteContent).toBe("Some note content");
			expect(savedSettings.lastSaved).toBeDefined();

			expect(mockEmitter.emit).toHaveBeenCalledWith("content-saved", undefined);
		});

		it("should save content if it is empty", async () => {
			const view = createMockView("");
			await saveManager.saveNoteContentToFile(view);

			expect(mockSaveData).toHaveBeenCalledOnce();
			expect(mockEmitter.emit).toHaveBeenCalledWith("content-saved", undefined);
		});

		it("should save content if it is only whitespace", async () => {
			const view = createMockView("   \t\n   ");
			await saveManager.saveNoteContentToFile(view);

			expect(mockSaveData).toHaveBeenCalledOnce();
			expect(mockEmitter.emit).toHaveBeenCalledWith("content-saved", undefined);
		});

		it("should log an error if saving fails", async () => {
			const error = new Error("Failed to write to disk");
			(mockSaveData as ReturnType<typeof vi.fn>).mockRejectedValue(
				error
			);
			const view = createMockView("Some content");

			await saveManager.saveNoteContentToFile(view);

			expect(mockEmitter.emit).not.toHaveBeenCalledWith(
				"content-saved"
			);
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
			expect(mockSaveData).not.toHaveBeenCalled();
		});

		it("should save after the delay", async () => {
			const view = createMockView("Debounced content");
			saveManager.debouncedSave(view);

			// Fast-forward time
			await vi.advanceTimersByTimeAsync(1000);

			expect(mockSaveData).toHaveBeenCalledOnce();
			const savedSettings = (
				mockSaveData as ReturnType<typeof vi.fn>
			).mock.calls[0][0];
			expect(savedSettings.noteContent).toBe("Debounced content");
		});

		it("should only save once if called multiple times within the delay", async () => {
			const view = createMockView("Final content");
			saveManager.debouncedSave(createMockView("First call"));
			saveManager.debouncedSave(createMockView("Second call"));
			saveManager.debouncedSave(view);

			// Fast-forward time
			await vi.advanceTimersByTimeAsync(1000);

			expect(mockSaveData).toHaveBeenCalledOnce();
			const savedSettings = (
				mockSaveData as ReturnType<typeof vi.fn>
			).mock.calls[0][0];
			expect(savedSettings.noteContent).toBe("Final content");
		});

		it("should reset the timer if called again", async () => {
			const view1 = createMockView("Content 1");
			const view2 = createMockView("Content 2");
			saveManager.debouncedSave(view1);

			// Fast-forward some time, but not enough to trigger save
			await vi.advanceTimersByTimeAsync(500);
			expect(mockSaveData).not.toHaveBeenCalled();

			// Call again
			saveManager.debouncedSave(view2);

			// Fast-forward again
			await vi.advanceTimersByTimeAsync(1000);

			expect(mockSaveData).toHaveBeenCalledOnce();
			const savedSettings = (
				mockSaveData as ReturnType<typeof vi.fn>
			).mock.calls[0][0];
			expect(savedSettings.noteContent).toBe("Content 2");
		});

		it("should cancel debounced save if a direct save is triggered", async () => {
			const view1 = createMockView("Debounced call");
			const view2 = createMockView("Direct call");

			// Start a debounced save
			saveManager.debouncedSave(view1);
			expect(mockSaveData).not.toHaveBeenCalled();

			// Trigger a direct save before the debounce timer fires
			await saveManager.saveNoteContentToFile(view2);

			// The direct save should have been executed
			expect(mockSaveData).toHaveBeenCalledOnce();
			const savedSettings = (
				mockSaveData as ReturnType<typeof vi.fn>
			).mock.calls[0][0];
			expect(savedSettings.noteContent).toBe("Direct call");

			// Fast-forward time to see if the debounced save also fires
			await vi.advanceTimersByTimeAsync(1000);

			// Should not have been called again
			expect(mockSaveData).toHaveBeenCalledOnce();
		});
	});
});
