param(
  [Parameter(Mandatory=$true)][string]$Node,
  [Parameter(Mandatory=$true)][ValidateSet('publish','collect')][string]$Mode
)
$ErrorActionPreference = 'Stop'
if (-not [IO.Path]::IsPathRooted($Node) -or -not [IO.File]::Exists($Node) -or $Node.StartsWith('\\') -or $Node -match '\\WindowsApps\\') { throw 'NODE_RUNTIME_INVALID' }
& $Node (Join-Path $PSScriptRoot 'publish-reviewed.mjs') ('--' + $Mode)
exit $LASTEXITCODE
