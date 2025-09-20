import type SandboxNotePlugin from "src/main";
import { EditorManager } from "src/managers/editorManager";
import type { SandboxNoteView } from "src/views/SandboxNoteView";
import { syncEditorPlugin } from "src/views/syncEditorPlugin";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("EditorManager", () => {
	let mockPlugin: SandboxNotePlugin;
	let editorManager: EditorManager;

	beforeEach(() => {
		vi.clearAllMocks();

		mockPlugin = {
			registerEditorExtension: vi.fn(),
		} as unknown as SandboxNotePlugin;

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
				syncEditorPlugin
			);
		});
	});

	describe("connectEditorPluginToView", () => {
		let mockView: SandboxNoteView;
		let mockCmPlugin: { connectToPlugin: ReturnType<typeof vi.fn> };

		beforeEach(() => {
			mockCmPlugin = {
				connectToPlugin: vi.fn(),
			};

			mockView = {
				wrapper: {
					virtualEditor: {
						editor: {
							cm: {
								plugin: vi.fn().mockReturnValue(mockCmPlugin),
							},
						},
					},
				},
			} as unknown as SandboxNoteView;
		});

		it("should get the plugin instance and connect it to the view", () => {
			editorManager.connectEditorPluginToView(mockView);

			// Check that we tried to get the correct plugin
			expect(
				mockView.wrapper.virtualEditor.editor.cm.plugin
			).toHaveBeenCalledOnce();
			expect(
				mockView.wrapper.virtualEditor.editor.cm.plugin
			).toHaveBeenCalledWith(syncEditorPlugin);

			// Check that we connected the plugin to the view
			expect(mockCmPlugin.connectToPlugin).toHaveBeenCalledOnce();
			expect(mockCmPlugin.connectToPlugin).toHaveBeenCalledWith(
				mockPlugin,
				mockView
			);
		});

		it("should not throw if the editor plugin is not found", () => {
			// Arrange: mock the cm.plugin to return null
			(
				mockView.wrapper.virtualEditor.editor.cm.plugin as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue(null);

			// Act & Assert
			expect(() => {
				editorManager.connectEditorPluginToView(mockView);
			}).not.toThrow();

			// Assert that connectToPlugin was not called
			expect(mockCmPlugin.connectToPlugin).not.toHaveBeenCalled();
		});
	});
});
