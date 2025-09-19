import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorManager } from "src/managers/editorManager";
import type InMemoryNotePlugin from "src/main";
import type { InMemoryNoteView } from "src/view";
import { watchEditorPlugin } from "src/watchEditorPlugin";

describe("EditorManager", () => {
	let mockPlugin: InMemoryNotePlugin;
	let editorManager: EditorManager;

	beforeEach(() => {
		vi.clearAllMocks();

		mockPlugin = {
			registerEditorExtension: vi.fn(),
		} as unknown as InMemoryNotePlugin;

		editorManager = new EditorManager(mockPlugin);
	});

	it("should be defined", () => {
		expect(editorManager).toBeDefined();
	});

	describe("setupEditorExtension", () => {
		it("should register the watchEditorPlugin", () => {
			editorManager.setupEditorExtension();

			expect(mockPlugin.registerEditorExtension).toHaveBeenCalledOnce();
			expect(mockPlugin.registerEditorExtension).toHaveBeenCalledWith(
				watchEditorPlugin,
			);
		});
	});

	describe("connectEditorPluginToView", () => {
		let mockView: InMemoryNoteView;
		let mockCmPlugin: { connectToPlugin: ReturnType<typeof vi.fn> };

		beforeEach(() => {
			mockCmPlugin = {
				connectToPlugin: vi.fn(),
			};

			mockView = {
				inlineEditor: {
					inlineView: {
						editor: {
							cm: {
								plugin: vi.fn().mockReturnValue(mockCmPlugin),
							},
						},
					},
				},
			} as unknown as InMemoryNoteView;
		});

		it("should get the plugin instance and connect it to the view", () => {
			editorManager.connectEditorPluginToView(mockView);

			// Check that we tried to get the correct plugin
			expect(mockView.inlineEditor.inlineView.editor.cm.plugin).toHaveBeenCalledOnce();
			expect(mockView.inlineEditor.inlineView.editor.cm.plugin).toHaveBeenCalledWith(
				watchEditorPlugin,
			);

			// Check that we connected the plugin to the view
			expect(mockCmPlugin.connectToPlugin).toHaveBeenCalledOnce();
			expect(mockCmPlugin.connectToPlugin).toHaveBeenCalledWith(
				mockPlugin,
				mockView,
			);
		});

		it("should not throw if the editor plugin is not found", () => {
			// Arrange: mock the cm.plugin to return null
			(mockView.inlineEditor.inlineView.editor.cm.plugin as ReturnType<typeof vi.fn>).mockReturnValue(null);

			// Act & Assert
			expect(() => {
				editorManager.connectEditorPluginToView(mockView);
			}).not.toThrow();

			// Assert that connectToPlugin was not called
			expect(mockCmPlugin.connectToPlugin).not.toHaveBeenCalled();
		});
	});
});
