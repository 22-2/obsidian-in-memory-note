#!/usr/bin/env node

/**
 * A modular Node.js script to automate version updates in package.json, manifest.json, and versions.json files,
 * create Git tags, and push them to origin.
 *
 * Usage:
 * npm run version:update - Update version in files only
 * npm run version:commit - Update version and commit changes
 * npm run version:tag - Update version, commit changes, and create a tag
 * npm run version:push - Update version, commit changes, create a tag, and push to origin
 * npm run version:all - (Alias for push) Execute all steps
 * node version-bump.ts interactive - Run in interactive mode
 */

import { execSync } from "child_process";
import fs from "fs";
import readline from "readline";
import semver, { ReleaseType } from "semver";

// =========== 型定義 (TypeScript) ===========

interface JsonFile {
	version: string;
	[key: string]: any;
}

interface ManifestJson extends JsonFile {
	minAppVersion: string;
}

type VersionsJson = Record<string, string>;

// =========== Configuration ===========

const CONFIG = {
	files: {
		package: {
			path: "package.json",
			space: "\t",
		},
		manifest: {
			path: "manifest.json",
			space: "\t",
		},
		versions: {
			path: "versions.json",
			space: "\t",
		},
	},
	git: {
		tagPrefix: "",
	},
};

// =========== File Operations ===========

class FileManager {
	/**
	 * Reads and parses a JSON file.
	 * @param filePath - The path to the JSON file
	 * @returns The parsed JSON object
	 * @throws If the file cannot be read or parsed
	 */
	static readJsonFile<T>(filePath: string): T {
		try {
			const fileContent = fs.readFileSync(filePath, "utf8");
			return JSON.parse(fileContent) as T;
		} catch (error) {
			console.error(`Error reading or parsing ${filePath}:`, error);
			throw new Error(`Failed to read or parse ${filePath}`);
		}
	}

	/**
	 * Writes a JSON object to a file.
	 * @param filePath - The path to the JSON file
	 * @param jsonData - The JSON object to write
	 * @param space - Optional spacing for formatting
	 * @throws If the file cannot be written
	 */
	static writeJsonFile(
		filePath: string,
		jsonData: object,
		space?: string | number
	): void {
		try {
			const formattedJson = JSON.stringify(jsonData, null, space) + "\n";
			fs.writeFileSync(filePath, formattedJson);
		} catch (error) {
			console.error(`Error writing to ${filePath}:`, error);
			throw new Error(`Failed to write to ${filePath}`);
		}
	}
}

// =========== Version Management ===========

class VersionManager {
	/**
	 * Gets the current version from package.json.
	 */
	static getCurrentVersion(): string {
		const pkg = FileManager.readJsonFile<JsonFile>(
			CONFIG.files.package.path
		);
		return pkg.version;
	}

	/**
	 * Updates the version in a JSON file.
	 * @returns True if updated successfully, false otherwise
	 */
	private static updateVersionInFile(
		filePath: string,
		newVersion: string,
		space?: string | number
	): boolean {
		try {
			const jsonData = FileManager.readJsonFile<JsonFile>(filePath);
			jsonData.version = newVersion;
			FileManager.writeJsonFile(filePath, jsonData, space);
			console.log(`✅ ${filePath} updated to version ${newVersion}.`);
			return true;
		} catch (error) {
			// Don't log error here as it's already logged in FileManager
			return false;
		}
	}

	/**
	 * Updates the versions.json file with a new version entry.
	 * @returns True if updated successfully, false otherwise
	 */
	private static updateVersionsJson(newVersion: string): boolean {
		try {
			const versionsFile = CONFIG.files.versions.path;
			const manifestFile = CONFIG.files.manifest.path;

			const versions =
				FileManager.readJsonFile<VersionsJson>(versionsFile);
			const manifest =
				FileManager.readJsonFile<ManifestJson>(manifestFile);

			versions[newVersion] = manifest.minAppVersion;

			FileManager.writeJsonFile(
				versionsFile,
				versions,
				CONFIG.files.versions.space
			);
			console.log(
				`✅ ${versionsFile} updated with version ${newVersion}.`
			);
			return true;
		} catch (error) {
			console.error(`Error updating versions.json:`, error);
			return false;
		}
	}

	/**
	 * Updates all version files with the new version.
	 * @returns True if all files were updated successfully
	 */
	static updateAllVersionFiles(newVersion: string): boolean {
		const packageUpdated = this.updateVersionInFile(
			CONFIG.files.package.path,
			newVersion,
			CONFIG.files.package.space
		);

		const manifestUpdated = this.updateVersionInFile(
			CONFIG.files.manifest.path,
			newVersion,
			CONFIG.files.manifest.space
		);

		// versions.jsonの更新は、manifest.jsonが更新された後に行う
		const versionsUpdated = this.updateVersionsJson(newVersion);

		return packageUpdated && manifestUpdated && versionsUpdated;
	}
}

// =========== Git Operations ===========

class GitManager {
	/**
	 * Executes a Git command.
	 * @returns True if command execution is successful
	 */
	private static executeCommand(
		command: string,
		successMessage: string
	): boolean {
		try {
			execSync(command, { stdio: "inherit" }); // stdio: 'inherit' for better output
			console.log(`✅ ${successMessage}`);
			return true;
		} catch (error) {
			console.error(`❌ Error executing command "${command}":`, error);
			return false;
		}
	}

	/**
	 * Stages specified files.
	 * @returns True if staging is successful
	 */
	static stageFiles(files: string[]): boolean {
		const fileList = files.join(" ");
		return this.executeCommand(
			`git add ${fileList}`,
			`Staged files: ${fileList}`
		);
	}

	/**
	 * Commits staged changes.
	 * @returns True if commit is successful
	 */
	static commit(message: string): boolean {
		return this.executeCommand(
			`git commit -m "${message}"`,
			`Committed: ${message}`
		);
	}

	/**
	 * Creates a Git tag.
	 * @returns True if tag creation is successful
	 */
	static createTag(version: string): boolean {
		const tagName = `${CONFIG.git.tagPrefix}${version}`;
		return this.executeCommand(
			`git tag ${tagName}`,
			`Git tag ${tagName} created locally.`
		);
	}

	/**
	 * Pushes a Git tag to the remote origin.
	 * @returns True if push is successful
	 */
	static pushTag(version: string): boolean {
		const tagName = `${CONFIG.git.tagPrefix}${version}`;
		return this.executeCommand(
			`git push origin ${tagName}`,
			`Git tag ${tagName} pushed to origin.`
		);
	}
}

// =========== User Interaction ===========

class UserInteraction {
	private rl: readline.Interface;

	constructor() {
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
	}

	/**
	 * Closes the readline interface.
	 */
	close(): void {
		this.rl.close();
	}

	/**
	 * Asks the user for the type of version update.
	 */
	askUpdateType(currentVersion: string): Promise<ReleaseType | null> {
		return new Promise((resolve) => {
			this.rl.question(
				`\nCurrent version is ${currentVersion}. What type of update? (major, minor, patch, ma, mi, pa): `,
				(updateTypeInput) => {
					const updateType = updateTypeInput.trim().toLowerCase();
					let normalizedUpdateType: ReleaseType;

					switch (updateType) {
						case "ma":
						case "major":
							normalizedUpdateType = "major";
							break;
						case "mi":
						case "minor":
							normalizedUpdateType = "minor";
							break;
						case "pa":
						case "patch":
							normalizedUpdateType = "patch";
							break;
						default:
							console.log(
								"❌ Invalid update type. Please choose major, minor, patch, ma, mi, or pa."
							);
							resolve(null);
							return;
					}

					resolve(normalizedUpdateType);
				}
			);
		});
	}

	/**
	 * Asks a yes/no question to the user.
	 */
	askYesNo(question: string): Promise<boolean> {
		return new Promise((resolve) => {
			this.rl.question(`${question} (yes/no): `, (answer) => {
				const normalizedAnswer = answer.trim().toLowerCase();
				resolve(normalizedAnswer.startsWith("y"));
			});
		});
	}
}

// =========== Command Modules ===========

class VersionCommands {
	/**
	 * Updates version in all files.
	 * @returns The new version or null if failed
	 */
	static async updateVersion(
		updateType: ReleaseType
	): Promise<string | null> {
		const currentVersion = VersionManager.getCurrentVersion();
		const newVersion = semver.inc(currentVersion, updateType);

		if (!newVersion) {
			console.error("❌ Failed to increment version.");
			return null;
		}

		if (!VersionManager.updateAllVersionFiles(newVersion)) {
			console.error("❌ Failed to update one or more version files.");
			return null;
		}

		console.log(
			`\n🎉 Version successfully updated from ${currentVersion} to ${newVersion}.`
		);
		return newVersion;
	}

	/**
	 * Commits version changes.
	 */
	static async commitVersion(version: string): Promise<boolean> {
		const filesToStage = [
			CONFIG.files.package.path,
			CONFIG.files.manifest.path,
			CONFIG.files.versions.path,
		];

		if (!GitManager.stageFiles(filesToStage)) return false;

		const commitMessage = `bump version to ${version}`;
		return GitManager.commit(commitMessage);
	}

	/**
	 * Creates a tag for the version.
	 */
	static async createVersionTag(version: string): Promise<boolean> {
		return GitManager.createTag(version);
	}

	/**
	 * Pushes the version tag to remote.
	 */
	static async pushVersionTag(version: string): Promise<boolean> {
		return GitManager.pushTag(version);
	}
}

// =========== Main Command Handlers ===========

class CommandHandler {
	private userInteraction = new UserInteraction();

	/**
	 * Cleanup and exit.
	 */
	finish(): void {
		this.userInteraction.close();
	}

	/**
	 * Gets the version update type from the user.
	 */
	private async getUpdateType(): Promise<ReleaseType | null> {
		const currentVersion = VersionManager.getCurrentVersion();
		return this.userInteraction.askUpdateType(currentVersion);
	}

	/**
	 * Command: update version only.
	 */
	async updateCommand(): Promise<void> {
		const updateType = await this.getUpdateType();
		if (!updateType) return;
		await VersionCommands.updateVersion(updateType);
	}

	/**
	 * Command: update version and commit.
	 */
	async commitCommand(): Promise<void> {
		const updateType = await this.getUpdateType();
		if (!updateType) return;

		const newVersion = await VersionCommands.updateVersion(updateType);
		if (!newVersion) return;

		await VersionCommands.commitVersion(newVersion);
	}

	/**
	 * Command: update version, commit, and create tag.
	 */
	async tagCommand(): Promise<void> {
		const updateType = await this.getUpdateType();
		if (!updateType) return;

		const newVersion = await VersionCommands.updateVersion(updateType);
		if (!newVersion) return;

		const isCommitted = await VersionCommands.commitVersion(newVersion);
		if (!isCommitted) return;

		await VersionCommands.createVersionTag(newVersion);
	}

	/**
	 * Command: update version, commit, create tag, and push to origin.
	 */
	async pushCommand(): Promise<void> {
		const updateType = await this.getUpdateType();
		if (!updateType) return;

		const newVersion = await VersionCommands.updateVersion(updateType);
		if (!newVersion) return;

		const isCommitted = await VersionCommands.commitVersion(newVersion);
		if (!isCommitted) return;

		const isTagged = await VersionCommands.createVersionTag(newVersion);
		if (!isTagged) return;

		await VersionCommands.pushVersionTag(newVersion);
	}

	/**
	 * Command: Ask for each step and execute all steps based on user input.
	 */
	async interactiveCommand(): Promise<void> {
		const updateType = await this.getUpdateType();
		if (!updateType) return;

		const newVersion = await VersionCommands.updateVersion(updateType);
		if (!newVersion) return;

		// Ask for commit
		const shouldCommit = await this.userInteraction.askYesNo(
			"\nDo you want to commit the version changes?"
		);
		if (!shouldCommit) return;

		const isCommitted = await VersionCommands.commitVersion(newVersion);
		if (!isCommitted) return;

		// Ask for tag
		const shouldTag = await this.userInteraction.askYesNo(
			`Do you want to create a tag ${CONFIG.git.tagPrefix}${newVersion}?`
		);
		if (!shouldTag) return;

		const isTagged = await VersionCommands.createVersionTag(newVersion);
		if (!isTagged) return;

		// Ask for push
		const shouldPush = await this.userInteraction.askYesNo(
			"Do you want to push the tag to origin?"
		);
		if (!shouldPush) return;

		await VersionCommands.pushVersionTag(newVersion);

		console.log("\n🚀 All operations completed successfully.");
	}
}

// =========== Command Execution ===========

/**
 * Determines which command to run based on arguments.
 */
async function main() {
	const commandHandler = new CommandHandler();
	try {
		const command = process.argv[2] || "interactive";
		console.log(`Running command: ${command}`);

		switch (command) {
			case "update":
				await commandHandler.updateCommand();
				break;
			case "commit":
				await commandHandler.commitCommand();
				break;
			case "tag":
				await commandHandler.tagCommand();
				break;
			case "push":
			case "all": // 'all' acts as an alias for 'push'.
				await commandHandler.pushCommand();
				break;
			case "interactive":
			default:
				await commandHandler.interactiveCommand();
				break;
		}
	} catch (error) {
		console.error("\n💥 An unexpected error occurred:", error);
		process.exit(1);
	} finally {
		// Close readline once at the end of all processing.
		commandHandler.finish();
	}
}

// Execute the script
main();
