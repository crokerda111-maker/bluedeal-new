param([switch]$Install, [switch]$Run)
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$TaskName = 'BLUEDEAL-EditorialReview'
$Python = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'

if ($Run) {
  $App = Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
  if (!$App) { throw 'BLUEDEAL_CODEX_NOT_INSTALLED' }
  $Codex = Join-Path $App.InstallLocation 'app\resources\codex.exe'
  if (!(Test-Path -LiteralPath $Python) -or !(Test-Path -LiteralPath $Codex)) { throw 'BLUEDEAL_REVIEW_RUNTIME_MISSING' }
  Set-Location -LiteralPath $RepoRoot
  $env:PYTHONIOENCODING = 'utf-8'
  & $Python -m ops.maintenance.review_inbox --codex $Codex
  exit $LASTEXITCODE
}

if (!$Install) {
  [pscustomobject]@{ task = $TaskName; interval = '5 minutes'; ai = 'only on new material changes' } | ConvertTo-Json
  exit 0
}
if (!(Test-Path -LiteralPath $Python) -or !(Get-AppxPackage -Name OpenAI.Codex)) { throw 'BLUEDEAL_REVIEW_RUNTIME_MISSING' }
if (Get-ScheduledTask -TaskName $TaskName -TaskPath '\' -ErrorAction SilentlyContinue) { throw 'BLUEDEAL_REVIEW_TASK_ALREADY_EXISTS' }

$Runner = (Resolve-Path -LiteralPath $PSCommandPath).Path
$PowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$Action = New-ScheduledTaskAction -Execute $PowerShell -WorkingDirectory $RepoRoot -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $Runner + '" -Run')
$Principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$Trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(5)) -RepetitionInterval (New-TimeSpan -Minutes 5)
$Settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 4)
$Task = New-ScheduledTask -Action $Action -Principal $Principal -Trigger $Trigger -Settings $Settings -Description 'BlueDeal public feeds and conditional Codex editorial drafts'
Register-ScheduledTask -TaskName $TaskName -TaskPath '\' -InputObject $Task | Select-Object TaskName,State
