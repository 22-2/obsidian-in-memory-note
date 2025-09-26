#!/usr/bin/env bash

# e2e-setup.sh
# This script prepares the Obsidian E2E testing environment for CI.
# It downloads and unpacks Obsidian's asar archives directly for efficiency.

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
VAULT_NAME="e2e-vault"
PLUGIN_SOURCE_DIR="./"
# OBSIDIAN_VERSION is expected to be passed as an environment variable.
# Default to a recent version if not set.
OBSIDIAN_VERSION="${OBSIDIAN_VERSION:-1.9.12}"
# --- End Configuration ---

# --- Helper for colored output ---
COLOR_GREEN='\033[0;32m'
COLOR_CYAN='\033[0;36m'
COLOR_RED='\033[0;31m'
COLOR_NC='\033[0m' # No Color

# --- Prerequisite Check ---
if ! command -v jq &> /dev/null; then
    # On Windows runner (Git Bash), jq is usually pre-installed.
    echo -e "${COLOR_RED}Error: 'jq' is not installed. Please install it to proceed.${COLOR_NC}"
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
echo "  - Plugin ID: ${PLUGIN_ID}"

# --- Resolve remaining paths ---
VAULT_PATH="${SCRIPT_DIR}/${VAULT_NAME}"
OBSIDIAN_UNPACKED_PATH="${SCRIPT_DIR}/.obsidian-unpacked"
PLUGIN_BUILD_DIR="${PLUGIN_SOURCE_FULL_PATH}/dist"
PLUGIN_LINK_PATH="${VAULT_PATH}/.obsidian/plugins/${PLUGIN_ID}"

# --- Path Validation ---
if [ ! -d "$VAULT_PATH" ]; then
    echo "Creating test vault directory: $VAULT_PATH"
    mkdir -p "$VAULT_PATH"
fi

# --- 2. Download and Unpack Obsidian ASAR archives ---
echo -e "\n${COLOR_GREEN}Downloading and unpacking Obsidian v${OBSIDIAN_VERSION} ASAR archives...${COLOR_NC}"
rm -rf "$OBSIDIAN_UNPACKED_PATH"

# Download and extract app.asar
APP_ASAR_URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/obsidian-${OBSIDIAN_VERSION}.asar.gz"
echo "Downloading app.asar from ${APP_ASAR_URL}"
curl -sL "$APP_ASAR_URL" | gunzip > app.asar

# Download obsidian.asar (this one is not gzipped)
OBSIDIAN_ASAR_URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/obsidian.asar"
echo "Downloading obsidian.asar from ${OBSIDIAN_ASAR_URL}"
curl -sL "$OBSIDIAN_ASAR_URL" -o obsidian.asar

# Extract app.asar to the unpacked directory
echo "Extracting app.asar to ${OBSIDIAN_UNPACKED_PATH}"
npx @electron/asar extract app.asar "$OBSIDIAN_UNPACKED_PATH"

# Copy obsidian.asar to the unpacked directory
echo "Copying obsidian.asar to ${OBSIDIAN_UNPACKED_PATH}"
cp obsidian.asar "$OBSIDIAN_UNPACKED_PATH/"

# Clean up downloaded files
echo "Cleaning up downloaded files"
rm app.asar obsidian.asar

echo -e "${COLOR_GREEN}Done.${COLOR_NC}"

# --- 3. Build Plugin ---
echo -e "\n${COLOR_GREEN}Building plugin for E2E tests...${COLOR_NC}"
(cd "$SCRIPT_DIR" && pnpm build:e2e)
echo -e "${COLOR_GREEN}Done.${COLOR_NC}"

# --- 4. Link Built Plugin ---
echo -e "\n${COLOR_GREEN}Linking built plugin to ${PLUGIN_LINK_PATH}...${COLOR_NC}"
mkdir -p "$(dirname "$PLUGIN_LINK_PATH")"
ln -sfn "$PLUGIN_BUILD_DIR" "$PLUGIN_LINK_PATH"
echo -e "${COLOR_GREEN}Done.${COLOR_NC}"

echo -e "\n${COLOR_GREEN}E2E setup process finished successfully. You can now run your Playwright tests.${COLOR_NC}"
