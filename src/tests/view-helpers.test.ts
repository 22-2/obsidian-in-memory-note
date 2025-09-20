import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDisplayText, updateActionButtons } from "src/view-helpers";
import type { SandboxNoteView } from "src/SandboxNoteView";

describe("View Helpers", () => {
	let mockView: SandboxNoteView;
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
					enableSaveNoteContent: true,
				},
			},
			hasUnsavedChanges: false,
			saveActionEl: mockSaveActionEl,
			addAction: vi.fn().mockReturnValue(mockSaveActionEl),
			save: vi.fn(),
		} as unknown as SandboxNoteView;
	});

	describe("getDisplayText", () => {
		it("should return the base title when there are no unsaved changes", () => {
			mockView.hasUnsavedChanges = false;
			expect(getDisplayText(mockView)).toBe("Sandbox note");
		});

		it("should return the title with an asterisk when there are unsaved changes", () => {
			mockView.hasUnsavedChanges = true;
			expect(getDisplayText(mockView)).toBe("*Sandbox note");
		});

		it("should return the base title if saving is disabled, even with unsaved changes", () => {
			mockView.plugin.settings.enableSaveNoteContent = false;
			mockView.hasUnsavedChanges = true;
			expect(getDisplayText(mockView)).toBe("Sandbox note");
		});
	});

	describe("updateActionButtons", () => {
		it("should hide the save button if saving is disabled", () => {
			mockView.plugin.settings.enableSaveNoteContent = false;
			updateActionButtons(mockView);
			expect(mockSaveActionEl.hide).toHaveBeenCalledOnce();
		});

		it("should create and show the save button if it doesn't exist and saving is enabled", () => {
			mockView.saveActionEl = undefined as any;
			updateActionButtons(mockView);
			expect(mockView.addAction).toHaveBeenCalledWith(
				"save",
				"Save",
				mockView.save
			);
			expect(mockSaveActionEl.show).toHaveBeenCalledOnce();
		});

		it("should disable the save button when there are no unsaved changes", () => {
			mockView.hasUnsavedChanges = false;
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
			mockView.hasUnsavedChanges = true;
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
