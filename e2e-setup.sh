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

# --- Resolve remaining paths ---
VAULT_PATH="${SCRIPT_DIR}/${VAULT_NAME}"
PLUGIN_BUILD_DIR="${PLUGIN_SOURCE_FULL_PATH}/dist"
PLUGIN_LINK_PATH="${VAULT_PATH}/.obsidian/plugins/${PLUGIN_ID}"

# --- Create Vault Directory ---
if [ ! -d "$VAULT_PATH" ]; then
    echo "Creating test vault directory: $VAULT_PATH"
    mkdir -p "$VAULT_PATH"
fi

# --- 2. Build Plugin ---
echo -e "\n${COLOR_GREEN}Building plugin for E2E tests...${COLOR_NC}"
# Assuming the build command is in the root package.json
(cd "$SCRIPT_DIR" && pnpm build:e2e)
echo -e "${COLOR_GREEN}Done.${COLOR_NC}"

# --- 3. Link Built Plugin ---
echo -e "\n${COLOR_GREEN}Linking built plugin to ${PLUGIN_LINK_PATH}...${COLOR_NC}"
mkdir -p "$(dirname "$PLUGIN_LINK_PATH")"
# Use absolute path for the target of the symbolic link for robustness
ln -sfn "$PLUGIN_BUILD_DIR" "$PLUGIN_LINK_PATH"
echo -e "${COLOR_GREEN}Done.${COLOR_NC}"

echo -e "\n${COLOR_GREEN}E2E setup process finished successfully.${COLOR_NC}"
