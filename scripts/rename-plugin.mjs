import { readJsonFile, writeJsonFile } from "./utils.mjs";

const newName = process.argv[2];

if (!newName) {
	console.error("Please provide a new name for the plugin.");
	console.log("Usage: pnpm rename-plugin <new-name>");
	process.exit(1);
}

// Update package.json
const packageJson = readJsonFile("package.json");
packageJson.name = `obsidian-${newName}`;
writeJsonFile("package.json", packageJson);
console.log(`Updated name in package.json to: ${packageJson.name}`);

// Update manifest.json
const manifestJson = readJsonFile("manifest.json");
manifestJson.id = newName;
const titleCaseName = newName
	.split("-")
	.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
	.join(" ");
manifestJson.name = titleCaseName;
writeJsonFile("manifest.json", manifestJson);
console.log(
	`Updated id to ${newName} and name to ${titleCaseName} in manifest.json`
);
