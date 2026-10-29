# Deploy google_apps_script.js to the existing Apps Script web app in ONE command.
#
# One-time setup (run once):
#   1) npm i -g @google/clasp@2
#   2) clasp login            (sign in with the Google account that owns the Apps Script project)
#   3) Copy tools/gas_deploy.local.json.example to tools/gas_deploy.local.json and fill in:
#        scriptId     = Apps Script editor > Project Settings > Script ID
#        deploymentId = Apps Script editor > Deploy > Manage deployments > Deployment ID (the one used by the /exec URL)
#
# Every deploy after that:
#   powershell -ExecutionPolicy Bypass -File tools/deploy_gas.ps1 -Message "what changed"
#
# The deployment ID is kept, so the /exec URL in the app does not change.

param(
  [string]$Message = "deploy " + (Get-Date -Format "yyyy-MM-dd HH:mm"),
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$cfgPath = Join-Path $PSScriptRoot "gas_deploy.local.json"
$src = Join-Path $root "google_apps_script.js"
$build = Join-Path $root "gas_build"

if (-not (Test-Path $cfgPath)) { throw "Missing $cfgPath. Copy gas_deploy.local.json.example and fill in scriptId and deploymentId." }
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
if (-not $cfg.scriptId -or -not $cfg.deploymentId) { throw "gas_deploy.local.json must contain scriptId and deploymentId." }
if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) { throw "clasp not found. Run: npm i -g @google/clasp@2" }

$version = (Select-String -Path $src -Pattern "var GAS_VERSION = '([^']+)'").Matches[0].Groups[1].Value
Write-Host "GAS_VERSION in source: $version"

# Prepare a build folder: Code.js = the source file, appsscript.json = the manifest from the live project.
New-Item -ItemType Directory -Force -Path $build | Out-Null
@{ scriptId = $cfg.scriptId; rootDir = "." } | ConvertTo-Json | Set-Content (Join-Path $build ".clasp.json") -Encoding UTF8

if ($DryRun) {
  Copy-Item $src (Join-Path $build "Code.js") -Force
  Write-Host "Dry run: build folder prepared at $build (nothing pushed)."; exit 0
}

Push-Location $build
try {
  if (-not (Test-Path "appsscript.json")) {
    # First run: pull the live manifest (timezone / scopes / web app settings). Must run BEFORE copying Code.js,
    # because pull overwrites Code.js with the live copy.
    clasp pull | Out-Host
  }
  Copy-Item $src (Join-Path $build "Code.js") -Force
  clasp push --force | Out-Host
  clasp deploy --deploymentId $cfg.deploymentId --description $Message | Out-Host
} finally {
  Pop-Location
}
Write-Host "Done. Deployed $version to deployment $($cfg.deploymentId)."
