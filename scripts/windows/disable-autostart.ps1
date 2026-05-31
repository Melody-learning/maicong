[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$DryRun,
  [string]$TaskName = "K20GT Remote Receiver"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

Push-Location $ProjectRoot
try {
  if ($DryRun -or $WhatIfPreference) {
    & node scripts/windows/receiver-runtime-cli.js autostart-plan
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    return
  }

  if ($PSCmdlet.ShouldProcess($TaskName, "remove receiver autostart task")) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed receiver autostart task if it existed: $TaskName"
  }
} finally {
  Pop-Location
}
