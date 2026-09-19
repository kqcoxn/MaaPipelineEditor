[CmdletBinding()]
param(
    [string]$ReferenceRoot,
    [switch]$WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "sync-reference-projects.mjs"
$nodeArgs = @($scriptPath)
if ($ReferenceRoot) {
    $nodeArgs += @("-ReferenceRoot", $ReferenceRoot)
}
if ($WhatIf) {
    $nodeArgs += "-WhatIf"
}

& node @nodeArgs
exit $LASTEXITCODE
