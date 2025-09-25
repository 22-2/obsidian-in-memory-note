# e2e-setup.ps1
# This script prepares the Obsidian E2E testing environment for Windows.
# It unpacks Obsidian, builds the plugin, links it to the test vault,
# and prompts the user to manually set up the vault in the unpacked Obsidian.

# Strict mode for error handling
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- Configuration ---
# You might need to adjust these paths based on your Obsidian installation
$ObsidianAppExePath = "C:\Users\17890\AppData\Local\Programs\obsidian\Obsidian.exe" # Full path to Obsidian.exe
$VaultName = "e2e-vault" # Name for the test vault
# --- End Configuration ---

# Resolve script directory (assumed to be the monorepo root)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# --- 1. Get Plugin Info from manifest.json ---
Write-Host "Reading plugin info from manifest.json..." -ForegroundColor Green
$ManifestPath = Join-Path $ScriptDir "apps\obsidian-plugin\manifest.json"
if (-not (Test-Path $ManifestPath)) {
    Write-Host "Error: manifest.json not found at '$ManifestPath'." -ForegroundColor Red
    exit 1
}
$Manifest = Get-Content -Raw -Path $ManifestPath | ConvertFrom-Json
$PluginId = $Manifest.id
$PluginName = $Manifest.name

if ([string]::IsNullOrEmpty($PluginId)) {
    Write-Host "Error: Could not read plugin 'id' from '$ManifestPath'." -ForegroundColor Red
    exit 1
}

Write-Host "  - Plugin ID: $PluginId"
Write-Host "  - Plugin Name: $PluginName"
Write-Host "Done." -ForegroundColor Green


# --- Resolve Paths (after getting plugin ID) ---
$VaultPath = Join-Path $ScriptDir $VaultName
$ObsidianUnpackedPath = Join-Path $ScriptDir ".obsidian-unpacked"
$PluginPath = Join-Path $VaultPath ".obsidian\plugins\$PluginId" # Dynamically set path


# --- Path Validation ---
if (-not (Test-Path $ObsidianAppExePath)) {
    Write-Host "Error: Obsidian.exe not found at '$ObsidianAppExePath'. Please update the script with the correct path." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $VaultPath -PathType Container)) {
    Write-Host "Creating test vault directory: $VaultPath"
    New-Item -Path $VaultPath -ItemType Directory | Out-Null
}

# --- 2. Unpack Obsidian ---
Write-Host "`nUnpacking Obsidian from '$ObsidianAppExePath' to '$ObsidianUnpackedPath'..." -ForegroundColor Green
Remove-Item -Path $ObsidianUnpackedPath -Recurse -Force -ErrorAction SilentlyContinue

$ObsidianBaseDir = Split-Path $ObsidianAppExePath -Parent
$AsarPath = Join-Path $ObsidianBaseDir "resources\app.asar"
$ObsidianAsarPath = Join-Path $ObsidianBaseDir "resources\obsidian.asar"

if (-not (Test-Path $AsarPath)) {
    Write-Host "Error: app.asar not found for Obsidian at expected paths. Please verify your Obsidian installation." -ForegroundColor Red
    exit 1
}

# Use npx to run the @electron/asar tool
npx @electron/asar extract "$AsarPath" "$ObsidianUnpackedPath"
Copy-Item -Path $ObsidianAsarPath -Destination $ObsidianUnpackedPath -Force | Out-Null
Write-Host "Done." -ForegroundColor Green

# --- 3. Build Plugin ---
Write-Host "`nBuilding plugin..." -ForegroundColor Green
& { Push-Location $ScriptDir; pnpm build; Pop-Location } | Out-Null # Execute `pnpm build` at the repo root
Write-Host "Done." -ForegroundColor Green

# --- 4. Link Built Plugin ---
Write-Host "`nLinking built plugin to '$PluginPath'..." -ForegroundColor Green
New-Item -Path (Split-Path $PluginPath -Parent) -ItemType Directory -Force | Out-Null
New-Item -ItemType SymbolicLink -Path $PluginPath -Target (Join-Path $ScriptDir "apps\obsidian-plugin\dist") -Force | Out-Null
Write-Host "Done." -ForegroundColor Green

# --- 5. Launch Unpacked Obsidian and Manual Setup Prompt ---
Write-Host "`nObsidian will now start. Please:" -ForegroundColor Yellow
Write-Host "  - Open '$VaultPath' as a vault," -ForegroundColor Yellow
Write-Host "  - Go to 'Settings -> Community plugins'," -ForegroundColor Yellow
Write-Host "  - Turn 'Restricted mode' OFF," -ForegroundColor Yellow
Write-Host "  - Enable the '$PluginName' plugin," -ForegroundColor Yellow # Use plugin name from manifest
Write-Host "  - Then close Obsidian." -ForegroundColor Yellow
Write-Host "Press [ENTER] to continue..." -ForegroundColor Cyan

$null = Read-Host

Write-Host "`nLaunching unpacked Obsidian for manual setup..." -ForegroundColor Green
# Using npx.cmd to ensure it works correctly in various PowerShell environments
Start-Process -FilePath "npx.cmd" -ArgumentList "electron", (Join-Path $ObsidianUnpackedPath "main.js") -NoNewWindow

Write-Host "`nManual setup completed. You can now run your Playwright tests." -ForegroundColor Green
