$ErrorActionPreference = 'Stop'

function Test-PriceRuntime($Runtime) {
  if ($Runtime.version -ne 1) { throw 'TASK_RUNTIME_INVALID' }
  foreach ($name in @('powershell','node','npm','python','git')) {
    $path = $Runtime.$name
    if (-not ($path -is [string]) -or -not [IO.Path]::IsPathRooted($path) -or -not [IO.File]::Exists($path) -or
        $path.StartsWith('\\') -or $path -match '\\WindowsApps\\') { throw 'TASK_RUNTIME_UNAVAILABLE' }
  }
}

function Get-PriceTaskRuntime {
  param([Parameter(Mandatory=$true)][string]$RepoRoot)
  $configPath = Join-Path $RepoRoot 'ops\private\task-runtime.local.json'
  if (Test-Path -LiteralPath $configPath) {
    $runtime = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
  } else {
    $nodePath = (Get-Command node -CommandType Application -ErrorAction Stop | Where-Object { $_.Source -notmatch '\\WindowsApps\\' } | Select-Object -First 1).Source
    $runtime = [PSCustomObject]@{
      version=1
      powershell=(Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
      node=$nodePath
      npm=(Join-Path (Split-Path -Parent $nodePath) 'npm.cmd')
      python=(Get-Command python -CommandType Application -ErrorAction Stop | Where-Object { $_.Source -notmatch '\\WindowsApps\\' } | Select-Object -First 1).Source
      git=(Get-Command git -CommandType Application -ErrorAction Stop | Where-Object { $_.Source -notmatch '\\WindowsApps\\' } | Select-Object -First 1).Source
    }
  }
  Test-PriceRuntime $runtime
  return $runtime
}

function Save-PriceTaskRuntime {
  param([Parameter(Mandatory=$true)][string]$RepoRoot, [Parameter(Mandatory=$true)]$Runtime)
  Test-PriceRuntime $Runtime
  $directory = Join-Path $RepoRoot 'ops\private'
  [void][IO.Directory]::CreateDirectory($directory)
  $path = Join-Path $directory 'task-runtime.local.json'
  if (Test-Path -LiteralPath $path) { return }
  $temp = Join-Path $directory ([Guid]::NewGuid().ToString('N') + '.tmp')
  try {
    [IO.File]::WriteAllText($temp, ($Runtime | ConvertTo-Json -Depth 3), (New-Object Text.UTF8Encoding($false)))
    [IO.File]::Move($temp, $path)
  } finally { if ([IO.File]::Exists($temp)) { [IO.File]::Delete($temp) } }
}

function Get-PriceRuntimePath {
  param([Parameter(Mandatory=$true)]$Runtime, [string]$PreviousPath)
  Test-PriceRuntime $Runtime
  $directories = @('node','python','git') | ForEach-Object { Split-Path -Parent $Runtime.$_ } | Select-Object -Unique
  return ((@($directories) + @($PreviousPath)) -join ';')
}

function Test-PriceTaskActivation {
  param([Parameter(Mandatory=$true)][string]$RepoRoot)
  $reportPath = Join-Path $RepoRoot 'ops\collector\state\last-successful-publish.json'
  $deploymentPath = Join-Path $RepoRoot 'ops\collector\state\last-deployment-check.json'
  if (-not (Test-Path -LiteralPath $reportPath) -or -not (Test-Path -LiteralPath $deploymentPath)) { throw 'TASK_MANUAL_VERIFICATION_REQUIRED' }
  $report = Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $deployment = Get-Content -LiteralPath $deploymentPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $runtime = Get-PriceTaskRuntime -RepoRoot $RepoRoot
  $head = (& $runtime.git -C $RepoRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -notmatch '^[a-f0-9]{40}$') { throw 'TASK_MANUAL_VERIFICATION_REQUIRED' }
  $verifiedAt = [DateTimeOffset]::Parse($report.verifiedAt)
  $age = [DateTimeOffset]::UtcNow - $verifiedAt.ToUniversalTime()
  if ($report.status -ne 'verified' -or $report.mode -ne 'feed' -or -not $report.sourceValidated -or -not $report.deploymentVerified -or
      $report.priceCommit -cne $head -or $deployment.status -ne 'verified' -or $deployment.expectedCommit -cne $head -or
      $deployment.observedCommit -cne $head -or -not $deployment.expectedSnapshotHash -or
      $deployment.expectedSnapshotHash -cne $deployment.observedSnapshotHash -or $age.TotalHours -gt 26 -or $age.TotalSeconds -lt -60) {
    throw 'TASK_MANUAL_VERIFICATION_REQUIRED'
  }
  return $true
}

Export-ModuleMember -Function Get-PriceTaskRuntime, Save-PriceTaskRuntime, Get-PriceRuntimePath, Test-PriceTaskActivation
