[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$DryRun,
  [string]$TaskName = "K20GT Remote Receiver"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$StartScript = Join-Path $PSScriptRoot "start-receiver.ps1"
$ActionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`""

Push-Location $ProjectRoot
try {
  & node scripts/windows/receiver-runtime-cli.js check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if ($DryRun -or $WhatIfPreference) {
    & node scripts/windows/receiver-runtime-cli.js autostart-plan
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    return
  }

  if ($PSCmdlet.ShouldProcess($TaskName, "register receiver autostart task")) {
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $ActionArgs
    $Trigger = New-ScheduledTaskTrigger -AtLogOn
    Register-ScheduledTask `
      -TaskName $TaskName `
      -Action $Action `
      -Trigger $Trigger `
      -Description "Starts the K20 GT remote receiver at user logon." `
      -Force | Out-Null
    Write-Host "Registered receiver autostart task: $TaskName"
  }
} finally {
  Pop-Location
}
