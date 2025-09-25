#!/bin/bash
# e2e-setup.sh
# This script prepares the Obsidian E2E testing environment for macOS and Linux.
# It unpacks Obsidian, builds the plugin, links it to the test vault,
# and prompts the user to manually set up the vault in the unpacked Obsidian.

# Strict mode for error handling
set -euo pipefail

# --- Configuration ---
# You might need to adjust this path based on your Obsidian installation
# macOS example:
OBSIDIAN_APP_PATH="/Applications/Obsidian.app/Contents/MacOS/Obsidian"
# Linux AppImage example (run `./Obsidian-x.x.x.AppImage --appimage-extract` first, then point to the extracted executable):
# OBSIDIAN_APP_PATH="/path/to/squashfs-root/obsidian"
# Linux deb/rpm example:
# OBSIDIAN_APP_PATH="/opt/Obsidian/obsidian"

VAULT_NAME="e2e-vault" # Name for the test vault
# --- End Configuration ---

# --- Helper Functions for colored output ---
info() { echo -e "\033[0;32m$1\033[0m"; }
warn() { echo -e "\033[0;33m$1\033[0m"; }
error() { echo -e "\033[0;31mError: $1\033[0m" >&2; exit 1; }
prompt() { echo -e "\033[0;36m$1\033[0m"; }

# Resolve script directory (assumed to be the monorepo root)
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)

# --- 1. Get Plugin Info from manifest.json ---
info "Reading plugin info from manifest.json..."
MANIFEST_PATH="$SCRIPT_DIR/apps/obsidian-plugin/manifest.json"

if ! command -v jq &> /dev/null; then
    error "jq is not installed. Please install it to parse manifest.json (e.g., 'brew install jq' or 'sudo apt-get install jq')."
fi
if [ ! -f "$MANIFEST_PATH" ]; then
    error "manifest.json not found at '$MANIFEST_PATH'."
fi

PLUGIN_ID=$(jq -r '.id' "$MANIFEST_PATH")
PLUGIN_NAME=$(jq -r '.name' "$MANIFEST_PATH")

if [ -z "$PLUGIN_ID" ] || [ "$PLUGIN_ID" == "null" ]; then
    error "Could not read plugin 'id' from '$MANIFEST_PATH'."
fi

echo "  - Plugin ID: $PLUGIN_ID"
echo "  - Plugin Name: $PLUGIN_NAME"
info "Done."

# --- Resolve Paths (after getting plugin ID) ---
VAULT_PATH="$SCRIPT_DIR/$VAULT_NAME"
OBSIDIAN_UNPACKED_PATH="$SCRIPT_DIR/.obsidian-unpacked"
PLUGIN_PATH="$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID" # Dynamically set path

# --- Path Validation ---
if [ ! -x "$OBSIDIAN_APP_PATH" ]; then
    error "Obsidian executable not found or not executable at '$OBSIDIAN_APP_PATH'. Please update the script with the correct path."
fi
if [ ! -d "$VAULT_PATH" ]; then
    echo "Creating test vault directory: $VAULT_PATH"
    mkdir -p "$VAULT_PATH"
fi

# --- 2. Unpack Obsidian ---
info "\nUnpacking Obsidian from '$OBSIDIAN_APP_PATH' to '$OBSIDIAN_UNPACKED_PATH'..."
rm -rf "$OBSIDIAN_UNPACKED_PATH"

# Determine the path to asar files. This logic works for macOS and some Linux installations.
OBSIDIAN_BASE_DIR=$(dirname "$OBSIDIAN_APP_PATH")
# On macOS, it's typically in ../Resources
ASAR_PATH="$OBSIDIAN_BASE_DIR/../Resources/app.asar"
OBSIDIAN_ASAR_PATH="$OBSIDIAN_BASE_DIR/../Resources/obsidian.asar"
# A fallback for some Linux structures
if [ ! -f "$ASAR_PATH" ]; then
    ASAR_PATH="$OBSIDIAN_BASE_DIR/resources/app.asar"
    OBSIDIAN_ASAR_PATH="$OBSIDIAN_BASE_DIR/resources/obsidian.asar"
fi
if [ ! -f "$ASAR_PATH" ]; then
    error "app.asar not found at expected paths. For AppImage, you need to extract it first with --appimage-extract."
fi

npx @electron/asar extract "$ASAR_PATH" "$OBSIDIAN_UNPACKED_PATH"
cp "$OBSIDIAN_ASAR_PATH" "$OBSIDIAN_UNPACKED_PATH/"
info "Done."

# --- 3. Build Plugin ---
info "\nBuilding plugin..."
(cd "$SCRIPT_DIR" && pnpm build)
info "Done."

# --- 4. Link Built Plugin ---
info "\nLinking built plugin to '$PLUGIN_PATH'..."
mkdir -p "$(dirname "$PLUGIN_PATH")"
# Use ln -sf to create/update the symbolic link
ln -sf "$SCRIPT_DIR/apps/obsidian-plugin/dist" "$PLUGIN_PATH"
info "Done."

# --- 5. Launch Unpacked Obsidian and Manual Setup Prompt ---
warn "\nObsidian will now start. Please:"
warn "  - Open '$VAULT_PATH' as a vault,"
warn "  - Go to 'Settings -> Community plugins',"
warn "  - Turn 'Restricted mode' OFF,"
warn "  - Enable the '$PLUGIN_NAME' plugin," # Use plugin name from manifest
warn "  - Then close Obsidian."
prompt "Press [ENTER] to continue..."

read -r

info "\nLaunching unpacked Obsidian for manual setup..."
npx electron "$OBSIDIAN_UNPACKED_PATH/main.js"

info "\nManual setup completed. You can now run your Playwright tests."
