param([switch]$Install)
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
if ((Get-TimeZone).Id -ne 'Korea Standard Time') { throw 'KST_TIMEZONE_REQUIRED' }
$Runtime = [ordered]@{
  powershell=(Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
  python=(Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe')
  git=(Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1 -ExpandProperty Source)
}
foreach ($value in $Runtime.Values) {
  if (-not [IO.Path]::IsPathRooted($value) -or -not [IO.File]::Exists($value) -or $value.StartsWith('\\') -or $value -match '\\WindowsApps\\') { throw 'MAINTENANCE_RUNTIME_UNAVAILABLE' }
}
$Modes = @('health','collect','backup')
if (-not $Install) {
  [PSCustomObject]@{mode='plan';tasks=$Modes;health='every 30 minutes';collect='09:00,17:00 KST';backup='02:00 KST';aiCalls=0;runLevel='Limited';logon='Interactive'} | ConvertTo-Json
  exit 0
}
foreach ($mode in $Modes) {
  if (Get-ScheduledTask -TaskPath '\' -TaskName ('BLUEDEAL-Maintenance-' + $mode) -ErrorAction SilentlyContinue) { throw 'MAINTENANCE_TASK_ALREADY_EXISTS_REVIEW_REQUIRED' }
}
& $Runtime.python -c 'import bs4,sqlite3'
if ($LASTEXITCODE -ne 0) { throw 'MAINTENANCE_DEPENDENCY_MISSING' }
$directory = Join-Path $RepoRoot 'ops\private\maintenance'
[void][IO.Directory]::CreateDirectory($directory)
$RuntimePath = Join-Path $directory 'scheduled-runtime.local.json'
[IO.File]::WriteAllText($RuntimePath, ($Runtime | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
$Runner = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'run_scheduled.ps1')).Path
$UserId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$Principal = New-ScheduledTaskPrincipal -UserId $UserId -LogonType Interactive -RunLevel Limited
$installed = @()
try {
  foreach ($mode in $Modes) {
    $name = 'BLUEDEAL-Maintenance-' + $mode
    $arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $Runner + '" -Mode ' + $mode
    $Action = New-ScheduledTaskAction -Execute $Runtime.powershell -Argument $arguments -WorkingDirectory $RepoRoot
    if ($mode -eq 'collect') { $Triggers = @((New-ScheduledTaskTrigger -Daily -At '09:00'), (New-ScheduledTaskTrigger -Daily -At '17:00')) }
    elseif ($mode -eq 'backup') { $Triggers = @((New-ScheduledTaskTrigger -Daily -At '02:00')) }
    else { $Triggers = @((New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(30)) -RepetitionInterval (New-TimeSpan -Minutes 30))) }
    $Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    if ($mode -ne 'backup') { $Settings.RunOnlyIfNetworkAvailable = $true }
    $Task = New-ScheduledTask -Action $Action -Trigger $Triggers -Principal $Principal -Settings $Settings -Description ('BLUEDEAL standalone maintenance v1: ' + $mode + '; no AI or publishing; ' + $RepoRoot)
    Register-ScheduledTask -TaskPath '\' -TaskName $name -InputObject $Task | Out-Null
    $installed += $name
  }
} catch {
  foreach ($name in $installed) { Disable-ScheduledTask -TaskName $name -TaskPath '\' -ErrorAction SilentlyContinue | Out-Null }
  throw
}
Get-ScheduledTask -TaskName 'BLUEDEAL-Maintenance-*' | Select-Object TaskName,State | ConvertTo-Json
