#!/usr/bin/env bash

# e2e-setup.sh
# This script prepares the Obsidian E2E testing environment by unpacking
# asar files included in the repository.

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
if ! command -v pnpm &> /dev/null; then
    echo -e "${COLOR_RED}Error: 'pnpm' is not installed. Please make sure it is available in the environment.${COLOR_NC}"
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

# --- 2. Unpack Obsidian ASARs from repository ---
echo -e "\n${COLOR_GREEN}Unpacking Obsidian ASAR archives from e2e-assets/...${COLOR_NC}"

OBSIDIAN_UNPACKED_PATH="${SCRIPT_DIR}/.obsidian-unpacked"
APP_ASAR_PATH="${SCRIPT_DIR}/e2e-assets/app.asar"
OBSIDIAN_ASAR_PATH="${SCRIPT_DIR}/e2e-assets/obsidian.asar"

if [ ! -f "$APP_ASAR_PATH" ]; then
    echo -e "${COLOR_RED}Error: app.asar not found at '${APP_ASAR_PATH}'. Make sure the file is present in the repository.${COLOR_NC}"
    exit 1
fi

# Clean up previous unpack directory
rm -rf "$OBSIDIAN_UNPACKED_PATH"
mkdir -p "$OBSIDIAN_UNPACKED_PATH"

# Manually extract app.asar to avoid various cross-platform issues.
echo "Extracting ${APP_ASAR_PATH} to ${OBSIDIAN_UNPACKED_PATH}"

# Generate a temporary file with the asar content list as JSON
ASAR_CONTENT_JSON=$(mktemp)
trap 'rm -f -- "$ASAR_CONTENT_JSON"' EXIT
pnpm exec asar list --is-pack "${APP_ASAR_PATH}" > "$ASAR_CONTENT_JSON"

# Create all directories first
jq -r '.[] | select(.type == "directory") | .path' "$ASAR_CONTENT_JSON" | sed 's/\\/\//g' | while IFS= read -r dirpath; do
    # Skip empty lines or root directory entries
    if [ -z "$dirpath" ] || [ "$dirpath" == "/" ]; then
        continue
    fi
    mkdir -p "${OBSIDIAN_UNPACKED_PATH}/${dirpath}"
done

# Extract all files
jq -r '.[] | select(.type == "file") | .path' "$ASAR_CONTENT_JSON" | sed 's/\\/\//g' | while IFS= read -r filepath; do
    # Skip empty lines
    if [ -z "$filepath" ]; then
        continue
    fi
    dest_path="${OBSIDIAN_UNPACKED_PATH}/${filepath}"
    # Ensure the parent directory exists, just in case
    mkdir -p "$(dirname "$dest_path")"
    pnpm exec asar extract-file "${APP_ASAR_PATH}" "$filepath" > "$dest_path"
done

# Copy obsidian.asar if it exists
if [ -f "$OBSIDIAN_ASAR_PATH" ]; then
    echo "Copying ${OBSIDIAN_ASAR_PATH} to ${OBSIDIAN_UNPACKED_PATH}/"
    cp "$OBSIDIAN_ASAR_PATH" "$OBSIDIAN_UNPACKED_PATH/"
else
    echo -e "${COLOR_YELLOW}Warning: obsidian.asar not found at '${OBSIDIAN_ASAR_PATH}'. Skipping.${COLOR_NC}"
fi

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
