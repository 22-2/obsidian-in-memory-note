#!/usr/bin/env bash

# e2e-setup.sh
# This script prepares the Obsidian E2E testing environment for Unix-like systems.

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# ご自身の環境に合わせてこれらのパスを調整してください
# Windows (Git Bash): "/c/Users/YourUser/AppData/Local/Programs/obsidian/Obsidian.exe"
# macOS: "/Applications/Obsidian.app"
# Linux: "/path/to/Obsidian.AppImage"
OBSIDIAN_PATH="/c/Users/17890/AppData/Local/Programs/obsidian/Obsidian.exe"
VAULT_NAME="e2e-vault"
# モノレポのルートディレクトリからの、プラグインソースディレクトリへの相対パス
PLUGIN_SOURCE_DIR="./"
# --- End Configuration ---

# --- Helper for colored output ---
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[0;33m'
COLOR_CYAN='\033[0;36m'
COLOR_RED='\033[0;31m'
COLOR_NC='\033[0m' # No Color

# --- Prerequisite Check ---
if ! command -v jq &> /dev/null; then
    echo -e "${COLOR_RED}Error: 'jq' is not installed. Please install it to proceed.${COLOR_NC}"
    exit 1
fi

# --- Derived Paths and Variables ---
# スクリプトの場所（= モノレポのルート）を基準に各パスを解決
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
PLUGIN_SOURCE_FULL_PATH="${SCRIPT_DIR}/${PLUGIN_SOURCE_DIR}"
PLUGIN_MANIFEST_PATH="${PLUGIN_SOURCE_FULL_PATH}/manifest.json"

# --- 1. Read Plugin Manifest ---
echo -e "${COLOR_CYAN}Reading plugin info from ${PLUGIN_MANIFEST_PATH}...${COLOR_NC}"
if [ ! -f "$PLUGIN_MANIFEST_PATH" ]; then
    echo -e "${COLOR_RED}Error: Plugin manifest not found at '${PLUGIN_MANIFEST_PATH}'. Please check the 'PLUGIN_SOURCE_DIR' configuration.${COLOR_NC}"
    exit 1
fi
PLUGIN_ID=$(jq -r '.id' "$PLUGIN_MANIFEST_PATH")
PLUGIN_NAME=$(jq -r '.name' "$PLUGIN_MANIFEST_PATH")

if [ -z "$PLUGIN_ID" ] || [ "$PLUGIN_ID" == "null" ]; then
    echo -e "${COLOR_RED}Error: Could not read 'id' from '${PLUGIN_MANIFEST_PATH}'.${COLOR_NC}"
    exit 1
fi
echo "  - Plugin ID: ${PLUGIN_ID}"
echo "  - Plugin Name: ${PLUGIN_NAME}"

# --- Resolve remaining paths using plugin info ---
VAULT_PATH="${SCRIPT_DIR}/${VAULT_NAME}"
OBSIDIAN_UNPACKED_PATH="${SCRIPT_DIR}/.obsidian-unpacked"
PLUGIN_BUILD_DIR="${PLUGIN_SOURCE_FULL_PATH}/dist"
PLUGIN_LINK_PATH="${VAULT_PATH}/.obsidian/plugins/${PLUGIN_ID}"

# --- Path Validation ---
if [ ! -d "$VAULT_PATH" ]; then
    echo "Creating test vault directory: $VAULT_PATH"
    mkdir -p "$VAULT_PATH"
fi

# --- 2. Unpack Obsidian ---
echo -e "\n${COLOR_GREEN}Unpacking Obsidian...${COLOR_NC}"
rm -rf "$OBSIDIAN_UNPACKED_PATH"

# OSごとにasarファイルの場所を特定
if [[ "$OSTYPE" == "darwin"* ]]; then # macOS
    ASAR_PATH="${OBSIDIAN_PATH}/Contents/Resources/app.asar"
else # Windows or Linux
    OBSIDIAN_BASE_DIR=$(dirname "$OBSIDIAN_PATH")
    ASAR_PATH="${OBSIDIAN_BASE_DIR}/resources/app.asar"
fi

if [ ! -f "$ASAR_PATH" ]; then
    echo -e "${COLOR_RED}Error: app.asar not found at '${ASAR_PATH}'. Please verify your Obsidian installation path.${COLOR_NC}"
    exit 1
fi
OBSIDIAN_ASAR_PATH=$(dirname "$ASAR_PATH")/obsidian.asar

npx @electron/asar extract "$ASAR_PATH" "$OBSIDIAN_UNPACKED_PATH"
cp "$OBSIDIAN_ASAR_PATH" "$OBSIDIAN_UNPACKED_PATH/"
echo -e "${COLOR_GREEN}Done.${COLOR_NC}"

# --- 3. Build Plugin ---
echo -e "\n${COLOR_GREEN}Building plugin...${COLOR_NC}"
(cd "$SCRIPT_DIR" && pnpm build)
echo -e "${COLOR_GREEN}Done.${COLOR_NC}"

# --- 4. Link Built Plugin ---
echo -e "\n${COLOR_GREEN}Linking built plugin to ${PLUGIN_LINK_PATH}...${COLOR_NC}"
mkdir -p "$(dirname "$PLUGIN_LINK_PATH")"
ln -sfn "$PLUGIN_BUILD_DIR" "$PLUGIN_LINK_PATH"
echo -e "${COLOR_GREEN}Done.${COLOR_NC}"

# --- 5. Launch Unpacked Obsidian and Manual Setup Prompt ---
echo -e "\n${COLOR_YELLOW}Obsidian will now start. Please perform the following manual setup:${COLOR_NC}"
echo -e "${COLOR_YELLOW}  1. Open '${VAULT_PATH}' as a vault.${COLOR_NC}"
echo -e "${COLOR_YELLOW}  2. Go to 'Settings -> Community plugins'.${COLOR_NC}"
echo -e "${COLOR_YELLOW}  3. Turn 'Restricted mode' OFF.${COLOR_NC}"
echo -e "${COLOR_YELLOW}  4. Enable the '${PLUGIN_NAME}' plugin.${COLOR_NC}"
echo -e "${COLOR_YELLOW}  5. Close Obsidian to continue.${COLOR_NC}"
read -p "$(echo -e ${COLOR_CYAN}Press [ENTER] to launch Obsidian...${COLOR_NC})"

echo -e "\n${COLOR_GREEN}Launching unpacked Obsidian for manual setup...${COLOR_NC}"
npx electron "${OBSIDIAN_UNPACKED_PATH}/main.js"

echo -e "\n${COLOR_GREEN}Setup process finished. You can now run your Playwright tests.${COLOR_NC}"
