param(
  [Parameter(Mandatory=$true)][string]$Node,
  [Parameter(Mandatory=$true)][ValidateSet('publish','collect')][string]$Mode
)
$ErrorActionPreference = 'Stop'
if (-not [IO.Path]::IsPathRooted($Node) -or -not [IO.File]::Exists($Node) -or $Node.StartsWith('\\') -or $Node -match '\\WindowsApps\\') { throw 'NODE_RUNTIME_INVALID' }
$Publisher = Join-Path $PSScriptRoot 'publish-reviewed.mjs'
& $Node $Publisher ('--' + $Mode)
$DealStatus = $LASTEXITCODE
if ($Mode -eq 'collect') { exit $DealStatus }

& $Node $Publisher --news --publish
$NewsStatus = $LASTEXITCODE
if ($DealStatus -ne 0) { exit $DealStatus }
exit $NewsStatus
