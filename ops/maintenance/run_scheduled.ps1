param([Parameter(Mandatory=$true)][ValidateSet('health','collect','backup')][string]$Mode)
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$RuntimePath = Join-Path $RepoRoot 'ops\private\maintenance\scheduled-runtime.local.json'
$Runtime = Get-Content -LiteralPath $RuntimePath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($name in @('python','git')) {
  $value = $Runtime.$name
  if (-not [IO.Path]::IsPathRooted($value) -or -not [IO.File]::Exists($value) -or $value.StartsWith('\\') -or $value -match '\\WindowsApps\\') { throw 'MAINTENANCE_RUNTIME_INVALID' }
}
$env:PYTHONIOENCODING = 'utf-8'
$env:GIT_TERMINAL_PROMPT = '0'
$env:PATH = (Split-Path -Parent $Runtime.git) + ';' + $env:PATH
Set-Location -LiteralPath $RepoRoot
& $Runtime.python (Join-Path $PSScriptRoot 'scheduled.py') $Mode
exit $LASTEXITCODE
