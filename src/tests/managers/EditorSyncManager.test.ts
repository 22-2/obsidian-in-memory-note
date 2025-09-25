import { EditorSyncManager } from "src/managers/EditorSyncManager";
import type { SandboxNoteView } from "src/views/SandboxNoteView";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { HotSandboxNoteView } from "src/views/HotSandboxNoteView";

// Helper to create a mock view
const createMockView = (): SandboxNoteView =>
	({
		setContent: vi.fn(),
		leaf: {
			updateHeader: vi.fn(),
		},
		getViewType: vi.fn().mockReturnValue("sandbox-note"),
		updateActionButtons: vi.fn(),
		// Add other properties and methods as needed for tests
	} as unknown as SandboxNoteView);

const createMockHotView = (noteGroupId: string): HotSandboxNoteView =>
	({
		noteGroupId,
		leaf: {
			updateHeader: vi.fn(),
		},
	} as unknown as HotSandboxNoteView);

describe("EditorSyncManager", () => {
	let editorSyncManager: EditorSyncManager;
	let mockEmitter: EventEmitter<AppEvents>;
	let view1: SandboxNoteView;
	let view2: SandboxNoteView;
	let view3: SandboxNoteView;

	beforeEach(() => {
		// Reset mocks and create new instances for each test
		vi.clearAllMocks();
		mockEmitter = new EventEmitter<AppEvents>();
		mockEmitter.emit = vi.fn();
		editorSyncManager = new EditorSyncManager(mockEmitter);
		view1 = createMockView();
		view2 = createMockView();
		view3 = createMockView();
	});

	it("should be defined", () => {
		expect(editorSyncManager).toBeDefined();
	});

	describe("View Management", () => {
		it("should add an active view", () => {
			editorSyncManager.addActiveView(view1);
			expect(editorSyncManager.activeViews.has(view1)).toBe(true);
			expect(editorSyncManager.activeViews.size).toBe(1);
		});

		it("should remove an active view", () => {
			editorSyncManager.addActiveView(view1);
			editorSyncManager.addActiveView(view2);
			editorSyncManager.removeActiveView(view1);
			expect(editorSyncManager.activeViews.has(view1)).toBe(false);
			expect(editorSyncManager.activeViews.has(view2)).toBe(true);
			expect(editorSyncManager.activeViews.size).toBe(1);
		});
	});

	describe("updateNoteContent", () => {
		beforeEach(() => {
			editorSyncManager.addActiveView(view1);
			editorSyncManager.addActiveView(view2);
			editorSyncManager.addActiveView(view3);
		});

		it("should update the shared content and emit event", () => {
			const newContent = "This is the new shared content.";
			editorSyncManager.syncAll(newContent, view1);
			expect(editorSyncManager.currentSharedNoteContent).toBe(newContent);
			expect(mockEmitter.emit).toHaveBeenCalledWith(
				"unsaved-state-changed",
				{ hasUnsavedChanges: true }
			);
		});

		it("should synchronize content to all other views", () => {
			const newContent = "Sync this content!";
			editorSyncManager.syncAll(newContent, view1);

			// The source view should not be updated
			expect(view1.setContent).not.toHaveBeenCalled();

			// Other views should be updated
			expect(view2.setContent).toHaveBeenCalledTimes(1);
			expect(view2.setContent).toHaveBeenCalledWith(newContent);
			expect(view3.setContent).toHaveBeenCalledTimes(1);
			expect(view3.setContent).toHaveBeenCalledWith(newContent);
		});

		it("should not fail if there are no other views", () => {
			// Only one view is active
			editorSyncManager.removeActiveView(view2);
			editorSyncManager.removeActiveView(view3);

			const newContent = "Content for a single view.";
			expect(() =>
				editorSyncManager.syncAll(newContent, view1)
			).not.toThrow();
			expect(editorSyncManager.currentSharedNoteContent).toBe(newContent);
		});
	});

	describe("refreshAllViewTitles", () => {
		it("should call updateHeader on all active views", () => {
			editorSyncManager.addActiveView(view1);
			editorSyncManager.addActiveView(view2);

			editorSyncManager.refreshAllViewTitles();

			expect(view1.leaf.updateHeader).toHaveBeenCalledTimes(1);
			expect(view2.leaf.updateHeader).toHaveBeenCalledTimes(1);
		});

		it("should not fail if there are no active views", () => {
			expect(() =>
				editorSyncManager.refreshAllViewTitles()
			).not.toThrow();
		});
	});

	describe("getGroupNumber", () => {
		it("Group number should not be changed when view is re-created.", () => {
			const viewA = createMockHotView("a");
			const viewB = createMockHotView("b");

			// Add two views
			editorSyncManager.addHotActiveView(viewA);
			editorSyncManager.addHotActiveView(viewB);

			// Check group numbers
			expect(editorSyncManager.getGroupNumber("a")).toBe(1);
			expect(editorSyncManager.getGroupNumber("b")).toBe(2);

			// Remove view A
			editorSyncManager.removeHotActiveView(viewA);

			// Re-add view A
			editorSyncManager.addHotActiveView(viewA);

			// Check group numbers again
			// Before fix, getGroupNumber("a") will be 2.
			expect(editorSyncManager.getGroupNumber("a")).toBe(1);
			expect(editorSyncManager.getGroupNumber("b")).toBe(2);
		});
	});
});
