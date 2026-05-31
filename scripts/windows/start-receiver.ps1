[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ArgsList = @("scripts/windows/receiver-runtime-cli.js", "start")
if ($DryRun -or $WhatIfPreference) {
  $ArgsList += "--dry-run"
}

if ($PSCmdlet.ShouldProcess($ProjectRoot, "start K20 GT receiver")) {
  Push-Location $ProjectRoot
  try {
    & node @ArgsList
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
}
