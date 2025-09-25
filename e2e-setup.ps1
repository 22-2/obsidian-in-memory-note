# e2e-setup.ps1
# This script prepares the Obsidian E2E testing environment for Windows.

# Strict mode for error handling
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- Configuration ---
# ご自身の環境に合わせてこれらのパスを調整してください
$ObsidianAppExePath = "C:\Users\17890\AppData\Local\Programs\obsidian\Obsidian.exe" # Obsidian.exe のフルパス
$VaultName = "e2e-vault" # テスト用Vaultの名前
# モノレポのルートディレクトリからの、プラグインソースディレクトリへの相対パス
$PluginSourceDir = "./"
# --- End Configuration ---

# --- Derived Paths and Variables ---
# スクリプトの場所（= モノレポのルート）を基準に各パスを解決
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$PluginSourceFullPath = Join-Path $ScriptDir $PluginSourceDir
$PluginManifestPath = Join-Path $PluginSourceFullPath "manifest.json"

# --- 1. Read Plugin Manifest ---
Write-Host "Reading plugin info from $PluginManifestPath..." -ForegroundColor Cyan
if (-not (Test-Path $PluginManifestPath)) {
    Write-Host "Error: Plugin manifest not found at '$PluginManifestPath'. Please check the 'PluginSourceDir' configuration." -ForegroundColor Red
    exit 1
}
$PluginManifest = Get-Content -Path $PluginManifestPath -Raw | ConvertFrom-Json
$PluginId = $PluginManifest.id
$PluginName = $PluginManifest.name

if ([string]::IsNullOrEmpty($PluginId) -or [string]::IsNullOrEmpty($PluginName)) {
    Write-Host "Error: Could not read 'id' or 'name' from $PluginManifestPath." -ForegroundColor Red
    exit 1
}
Write-Host "  - Plugin ID: $PluginId"
Write-Host "  - Plugin Name: $PluginName"

# --- Resolve remaining paths using plugin info ---
$VaultPath = Join-Path $ScriptDir $VaultName
$ObsidianUnpackedPath = Join-Path $ScriptDir ".obsidian-unpacked"
$PluginBuildDir = Join-Path $PluginSourceFullPath "dist"
$PluginLinkPath = Join-Path $VaultPath ".obsidian\plugins\$PluginId"

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
Write-Host "`nUnpacking Obsidian from $ObsidianAppExePath to $ObsidianUnpackedPath..." -ForegroundColor Green
Remove-Item -Path $ObsidianUnpackedPath -Recurse -Force -ErrorAction SilentlyContinue

$ObsidianBaseDir = Split-Path $ObsidianAppExePath -Parent
$AsarPath = Join-Path $ObsidianBaseDir "resources\app.asar"
$ObsidianAsarPath = Join-Path $ObsidianBaseDir "resources\obsidian.asar"

if (-not (Test-Path $AsarPath)) {
    Write-Host "Error: app.asar not found at '$AsarPath'. Please verify your Obsidian installation." -ForegroundColor Red
    exit 1
}

npx @electron/asar extract "$AsarPath" "$ObsidianUnpackedPath"
Copy-Item -Path $ObsidianAsarPath -Destination $ObsidianUnpackedPath -Force | Out-Null
Write-Host "Done." -ForegroundColor Green

# --- 3. Build Plugin ---
Write-Host "`nBuilding plugin..." -ForegroundColor Green
Push-Location $ScriptDir
try {
    pnpm build:e2e
} finally {
    Pop-Location
}
Write-Host "Done." -ForegroundColor Green

# --- 4. Link Built Plugin ---
Write-Host "`nLinking built plugin to $PluginLinkPath..." -ForegroundColor Green
$null = New-Item -Path (Split-Path $PluginLinkPath -Parent) -ItemType Directory -Force
if (Test-Path $PluginLinkPath) { Remove-Item $PluginLinkPath -Force }
New-Item -ItemType SymbolicLink -Path $PluginLinkPath -Target $PluginBuildDir -Force | Out-Null
Write-Host "Done." -ForegroundColor Green

# --- 5. Launch Unpacked Obsidian and Manual Setup Prompt ---
Write-Host "`nObsidian will now start. Please perform the following manual setup:" -ForegroundColor Yellow
Write-Host "  1. Open '$VaultPath' as a vault." -ForegroundColor Yellow
Write-Host "  2. Go to 'Settings -> Community plugins'." -ForegroundColor Yellow
Write-Host "  3. Turn 'Restricted mode' OFF." -ForegroundColor Yellow
Write-Host "  4. Enable the '$PluginName' plugin." -ForegroundColor Yellow
Write-Host "  5. Close Obsidian to continue." -ForegroundColor Yellow
Write-Host "Press [ENTER] to launch Obsidian..." -ForegroundColor Cyan

$null = Read-Host

Write-Host "`nLaunching unpacked Obsidian for manual setup..." -ForegroundColor Green
npx electron (Join-Path $ObsidianUnpackedPath "main.js")

Write-Host "`nSetup process finished. You can now run your Playwright tests." -ForegroundColor Green
