[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ArgsList = @("scripts/windows/receiver-runtime-cli.js", "check")
if ($DryRun -or $WhatIfPreference) {
  $ArgsList += "--dry-run"
}

if ($PSCmdlet.ShouldProcess($ProjectRoot, "check receiver configuration")) {
  Push-Location $ProjectRoot
  try {
    & node @ArgsList
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
}
