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

# --- 2. Unpack Obsidian ---
echo -e "\n${COLOR_GREEN}Unpacking Obsidian for E2E tests...${COLOR_NC}"

if [ -z "$OBSIDIAN_APP_PATH" ]; then
    echo -e "${COLOR_RED}Error: OBSIDIAN_APP_PATH environment variable is not set.${COLOR_NC}"
    echo -e "${COLOR_YELLOW}This script expects the path to the Obsidian application (Obsidian.exe or Obsidian.app) to be provided via this variable in a CI environment.${COLOR_NC}"
    exit 1
fi

OBSIDIAN_UNPACKED_PATH="${SCRIPT_DIR}/.obsidian-unpacked"
rm -rf "$OBSIDIAN_UNPACKED_PATH"

# GitHub Actions sets RUNNER_OS. Fallback to uname for local execution.
CURRENT_OS=${RUNNER_OS:-}
if [ -z "$CURRENT_OS" ]; then
    if [[ "$(uname)" == "Darwin" ]]; then
        CURRENT_OS="macOS"
    elif [[ "$(uname -o)" == "Msys" || "$(uname -o)" == "Cygwin" ]]; then
        CURRENT_OS="Windows"
    else
        CURRENT_OS="Linux"
    fi
fi

echo "  - Detected OS: ${CURRENT_OS}"

if [[ "$CURRENT_OS" == "Windows" ]]; then
    # Windows: OBSIDIAN_APP_PATH is the path to Obsidian.exe
    OBSIDIAN_BASE_DIR=$(dirname "$OBSIDIAN_APP_PATH")
    ASAR_PATH="${OBSIDIAN_BASE_DIR}/resources/app.asar"
    OBSIDIAN_ASAR_PATH="${OBSIDIAN_BASE_DIR}/resources/obsidian.asar"
elif [[ "$CURRENT_OS" == "macOS" ]]; then
    # macOS: OBSIDIAN_APP_PATH is the path to Obsidian.app
    ASAR_PATH="${OBSIDIAN_APP_PATH}/Contents/Resources/app.asar"
    OBSIDIAN_ASAR_PATH="${OBSIDIAN_APP_PATH}/Contents/Resources/obsidian.asar"
else
    echo -e "${COLOR_RED}Error: Unsupported OS for Obsidian unpacking: $CURRENT_OS${COLOR_NC}"
    exit 1
fi

if [ ! -f "$ASAR_PATH" ]; then
    echo -e "${COLOR_RED}Error: app.asar not found at '${ASAR_PATH}'. Please verify the OBSIDIAN_APP_PATH and the Obsidian installation.${COLOR_NC}"
    exit 1
fi

echo "  - Extracting from: ${ASAR_PATH}"
echo "  - Destination:     ${OBSIDIAN_UNPACKED_PATH}"

npx @electron/asar extract "$ASAR_PATH" "$OBSIDIAN_UNPACKED_PATH"

if [ -f "$OBSIDIAN_ASAR_PATH" ]; then
    echo "  - Copying obsidian.asar..."
    cp "$OBSIDIAN_ASAR_PATH" "$OBSIDIAN_UNPACKED_PATH/"
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
# Assuming the build command is in the root package.json
(cd "$SCRIPT_DIR" && pnpm build:e2e)
echo -e "${COLOR_GREEN}Done.${COLOR_NC}"

# --- 5. Link Built Plugin ---
echo -e "\n${COLOR_GREEN}Linking built plugin to ${PLUGIN_LINK_PATH}...${COLOR_NC}"
mkdir -p "$(dirname "$PLUGIN_LINK_PATH")"
# Use absolute path for the target of the symbolic link for robustness
ln -sfn "$PLUGIN_BUILD_DIR" "$PLUGIN_LINK_PATH"
echo -e "${COLOR_GREEN}Done.${COLOR_NC}"

echo -e "\n${COLOR_GREEN}E2E setup process finished successfully.${COLOR_NC}"
