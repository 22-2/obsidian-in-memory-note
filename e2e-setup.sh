#!/usr/bin/env bash

# e2e-setup.sh
# This script prepares the Obsidian E2E testing environment.
# Modified to be compatible with Windows, macOS, and Linux.

set -e

# --- Configuration ---
VAULT_NAME="e2e-vault"
PLUGIN_SOURCE_DIR="./"
# --- End Configuration ---

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[0;33m'
COLOR_CYAN='\033[0;36m'
COLOR_RED='\033[0;31m'
COLOR_NC='\033[0m'

# --- Prerequisite Check ---
if ! command -v jq &> /dev/null; then
    echo -e "${COLOR_RED}Error: 'jq' is not installed. Please install it to proceed.${COLOR_NC}"
    exit 1
fi
if ! command -v npx &> /dev/null; then
    echo -e "${COLOR_RED}Error: 'npx' is not installed. Please make sure Node.js and npm/pnpm are installed.${COLOR_NC}"
    exit 1
fi

# --- Derived Paths and Variables ---
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
PLUGIN_SOURCE_FULL_PATH="${SCRIPT_DIR}/${PLUGIN_SOURCE_DIR}"
PLUGIN_MANIFEST_PATH="${PLUGIN_SOURCE_FULL_PATH}/manifest.json"

# --- 1. Read Plugin Manifest ---
echo -e "${COLOR_CYAN}Reading plugin info from ${PLUGIN_MANIFEST_PATH}...${COLOR_NC}"
if [ ! -f "$PLUGIN_MANIFEST_PATH" ]; then
    echo -e "${COLOR_RED}Error: Plugin manifest not found at '${PLUGIN_MANIFEST_PATH}'.${COLOR_NC}"
    exit 1
fi
PLUGIN_ID=$(jq -r '.id' "$PLUGIN_MANIFEST_PATH")
if [ -z "$PLUGIN_ID" ] || [ "$PLUGIN_ID" == "null" ]; then
    echo -e "${COLOR_RED}Error: Could not read 'id' from '${PLUGIN_MANIFEST_PATH}'.${COLOR_NC}"
    exit 1
fi
echo "  - Plugin ID: ${PLUGIN_ID}"

# --- 2. Download and Unpack Obsidian ASAR ---
echo -e "\n${COLOR_GREEN}Downloading and unpacking Obsidian v${OBSIDIAN_VERSION} ASAR archive...${COLOR_NC}"

OBSIDIAN_UNPACKED_PATH="${SCRIPT_DIR}/.obsidian-unpacked"
TEMP_DIR=$(mktemp -d)

# Cleanup temp dir on exit
trap 'rm -rf -- "$TEMP_DIR"' EXIT

APP_ASAR_GZ_URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/obsidian-${OBSIDIAN_VERSION}.asar.gz"

# Download and extract app.asar
echo "Downloading app.asar from ${APP_ASAR_GZ_URL}"
curl -L "$APP_ASAR_GZ_URL" | gzip -d > "${TEMP_DIR}/app.asar"

# Manually extract app.asar to avoid absolute path issues on Windows
echo "Extracting app.asar to ${OBSIDIAN_UNPACKED_PATH}"
rm -rf "$OBSIDIAN_UNPACKED_PATH"
mkdir -p "$OBSIDIAN_UNPACKED_PATH"

# List all files in the asar archive and extract them one by one
# Use a while loop to handle filenames with spaces correctly
npx @electron/asar list "${TEMP_DIR}/app.asar" | while IFS= read -r filepath; do
    # On Windows, the path might start with a slash which we need to remove
    filepath_clean="${filepath#/}"

    # Skip empty lines
    if [ -z "$filepath_clean" ]; then
        continue
    fi

    dest_path="${OBSIDIAN_UNPACKED_PATH}/${filepath_clean}"

    # Check if it's a directory (ends with /) or a file
    if [[ "$filepath_clean" == */ ]]; then
        mkdir -p "$dest_path"
    else
        mkdir -p "$(dirname "$dest_path")"
        npx @electron/asar extract-file "${TEMP_DIR}/app.asar" "$filepath_clean" > "$dest_path"
    fi
done

echo -e "${COLOR_GREEN}Done.${COLOR_NC}"


# --- 3. Resolve remaining paths & Create Vault ---
VAULT_PATH="${SCRIPT_DIR}/${VAULT_NAME}"
PLUGIN_BUILD_DIR="${PLUGIN_SOURCE_FULL_PATH}/dist"
PLUGIN_LINK_PATH="${VAULT_PATH}/.obsidian/plugins/${PLUGIN_ID}"

if [ ! -d "$VAULT_PATH" ]; then
    echo "Creating test vault directory: $VAULT_PATH"
    mkdir -p "$VAULT_PATH"
fi

# --- 4. Build Plugin ---
echo -e "\n${COLOR_GREEN}Building plugin for E2E tests...${COLOR_NC}"
(cd "$SCRIPT_DIR" && pnpm build:e2e)
echo -e "${COLOR_GREEN}Done.${COLOR_NC}"

# --- 5. Link Built Plugin ---
echo -e "\n${COLOR_GREEN}Linking built plugin to ${PLUGIN_LINK_PATH}...${COLOR_NC}"
mkdir -p "$(dirname "$PLUGIN_LINK_PATH")"
ln -sfn "$PLUGIN_BUILD_DIR" "$PLUGIN_LINK_PATH"
echo -e "${COLOR_GREEN}Done.${COLOR_NC}"

echo -e "\n${COLOR_GREEN}E2E setup process finished successfully.${COLOR_NC}"
