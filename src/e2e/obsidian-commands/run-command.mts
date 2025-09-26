import type { Page } from "playwright";
import invariant from "tiny-invariant";

export const delay = async (milliseconds: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const SEL_PALETTE_RESULTS = ".prompt-results";
const SEL_PALETTE_ITEM = ".suggestion-item";

export const CMD_CREATE_FILE = "Lineage Dev: Create new document";
export const CMD_CLOSE_OTHER_TABS = "Close all other tabs";
export const CMD_CLOSE_THIS_TAB_GROUP = "Close this tab group";
export const CMD_CLOSE_CURRENT_TAB = "Close current tab";
export const CMD_UNDO_CLOSE_TAB = "Undo close tab";
export const CMD_GO_TO_PREVIOUS_TAB = "Go to previous tab";
export const CMD_GO_TO_NEXT_TAB = "Go to next tab";
export const OPEN_SANDBOX_VAULT = "Open sandbox vault";

export const PROMPT_INPUT = ".prompt-input";
export const runCommand = async (
	__obsidian__: Page,
	commandName: string,
	required = true
) => {
	console.log("runCommand", commandName);
	await __obsidian__.waitForSelector(".workspace-tabs");
	await __obsidian__.keyboard.press("Control+P");
	await __obsidian__.waitForSelector(PROMPT_INPUT);
	await __obsidian__.keyboard.type(commandName);
	await delay(500);

	// find matching command
	const results = await __obsidian__.$(SEL_PALETTE_RESULTS);
	invariant(results);
	const items = await results.$$(SEL_PALETTE_ITEM);
	const item = items[0];

	let content: string | null = null;
	if (item) content = await item.textContent();
	await __obsidian__.keyboard.press("Enter");
	if (content && content.includes(commandName.replace(": ", ""))) {
	} else {
		if (required) {
			throw new Error("could not find command");
		} else {
			await __obsidian__.keyboard.press("Escape");
		}
	}
	await delay(1000);
};
