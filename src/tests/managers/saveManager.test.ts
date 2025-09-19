import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaveManager } from "src/managers/saveManager";
import type SandboxNotePlugin from "src/main";
import { SandboxNoteView } from "src/view";
import type { DirectLogger } from "src/utils/logging";
import { App } from "obsidian";

const createMockView = (content: string): SandboxNoteView =>
	({
		inlineEditor: {
			getContent: vi.fn().mockReturnValue(content),
		},
		markAsSaved: vi.fn(),
	} as unknown as SandboxNoteView);

describe("SaveManager", () => {
	let mockPlugin: SandboxNotePlugin;
	let mockApp: App;
	let mockLogger: DirectLogger;
	let saveManager: SaveManager;

	beforeEach(() => {
		vi.clearAllMocks();

		mockApp = {
			workspace: {
				getActiveViewOfType: vi.fn(),
			},
		} as unknown as App;

		mockLogger = {
			debug: vi.fn(),
			error: vi.fn(),
		} as unknown as DirectLogger;

		mockPlugin = {
			app: mockApp,
			settings: {
				enableSaveNoteContent: true,
			},
			saveData: vi.fn().mockResolvedValue(undefined),
		} as unknown as SandboxNotePlugin;

		saveManager = new SaveManager(mockPlugin, mockLogger);
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
			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Auto-saved note content to data.json using Obsidian API"
			);
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

			expect(mockLogger.error).toHaveBeenCalledWith(
				`Failed to auto-save note content: ${error}`
			);
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
			mockPlugin.settings.enableSaveNoteContent = true;

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
			mockPlugin.settings.enableSaveNoteContent = false; // Auto-save disabled

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
});
