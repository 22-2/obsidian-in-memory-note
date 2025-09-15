import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { readJsonFile } from "./utils.mjs";

// Load environment variables from .env file
dotenv.config();

const obsidianPluginsPath = process.env.OBSIDIAN_PLUGINS_PATH;

if (!obsidianPluginsPath) {
	console.log(
		"OBSIDIAN_PLUGINS_PATH is not defined in your .env file. Skipping symlink creation."
	);
	process.exit(0);
}

const packageJson = readJsonFile("package.json");
const pluginName = packageJson.name;

if (!pluginName) {
	console.error(
		'Could not find "name" in package.json. Cannot create symlink.'
	);
	process.exit(1);
}

const symlinkPath = path.join(obsidianPluginsPath, pluginName);

if (fs.existsSync(symlinkPath)) {
	console.log(`Symlink already exists at ${symlinkPath}. Skipping creation.`);
	process.exit(0);
}

try {
	fs.symlinkSync(process.cwd(), symlinkPath, "dir");
	console.log(
		`Successfully created symlink for ${pluginName} at ${symlinkPath}`
	);
} catch (error) {
	console.error(`Failed to create symlink: ${error.message}`);
	if (error.code === "EPERM") {
		console.error(
			"You may need to run this script with administrator privileges."
		);
	}
	process.exit(1);
}
