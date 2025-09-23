import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateActionButtons } from "src/helpers/viewHelpers";
import type { AbstractNoteView } from "src/views/helpers/AbstractNoteView";

describe("View Helpers", () => {
	let mockView: AbstractNoteView;
	let mockSaveActionEl: {
		show: ReturnType<typeof vi.fn>;
		hide: ReturnType<typeof vi.fn>;
		toggleClass: ReturnType<typeof vi.fn>;
		setAttribute: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		mockSaveActionEl = {
			show: vi.fn(),
			hide: vi.fn(),
			toggleClass: vi.fn(),
			setAttribute: vi.fn(),
		};

		mockView = {
			plugin: {
				settings: {
					enableAutoSave: true,
				},
			},
			hasUnsavedChanges: false,
			saveActionEl: mockSaveActionEl,
			addAction: vi.fn().mockReturnValue(mockSaveActionEl),
			save: vi.fn(),
		} as unknown as AbstractNoteView;
	});

	describe("updateActionButtons", () => {
		it("should hide the save button if saving is disabled", () => {
			mockView.plugin.settings.enableAutoSave = false;
			updateActionButtons(mockView);
			expect(mockSaveActionEl.hide).toHaveBeenCalledOnce();
		});

		it("should create and show the save button if it doesn't exist and saving is enabled", () => {
			mockView.saveActionEl = undefined as any;
			updateActionButtons(mockView);
			expect(mockView.addAction).toHaveBeenCalledWith(
				"save",
				"Save",
				expect.any(Function)
			);
			expect(mockSaveActionEl.show).toHaveBeenCalledOnce();
		});

		it("should disable the save button when there are no unsaved changes", () => {
			(mockView as any).hasUnsavedChanges = false;
			updateActionButtons(mockView);
			expect(mockSaveActionEl.toggleClass).toHaveBeenCalledWith(
				"is-disabled",
				true
			);
			expect(mockSaveActionEl.setAttribute).toHaveBeenCalledWith(
				"aria-disabled",
				"true"
			);
		});

		it("should enable the save button when there are unsaved changes", () => {
			(mockView as any).hasUnsavedChanges = true;
			updateActionButtons(mockView);
			expect(mockSaveActionEl.toggleClass).toHaveBeenCalledWith(
				"is-disabled",
				false
			);
			expect(mockSaveActionEl.setAttribute).toHaveBeenCalledWith(
				"aria-disabled",
				"false"
			);
		});
	});
});
