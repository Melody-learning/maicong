[CmdletBinding()]
param(
  [switch]$Cloud
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

Push-Location $ProjectRoot
try {
  & node scripts/windows/receiver-runtime-cli.js status
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if ($Cloud) {
    & node k20gt-receiver-control.js status
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
} finally {
  Pop-Location
}
