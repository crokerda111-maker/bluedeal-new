param([switch]$Install)
$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
if ((Get-TimeZone).Id -ne 'Korea Standard Time') { throw 'KST_TIMEZONE_REQUIRED' }
$Runtime = Get-Command node.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Source
if (-not ([IO.File]::Exists($Runtime)) -or $Runtime.StartsWith('\\') -or $Runtime -match '\\WindowsApps\\') { throw 'NODE_RUNTIME_UNAVAILABLE' }
if (-not $Install) {
  [pscustomobject]@{name='BLUEDEAL-Hotdeal-Publisher';interval='30 minutes';collect='09:00 / 17:00 KST';runLevel='Limited'} | ConvertTo-Json
  exit
}

$Principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 12) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$PublisherTrigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 30)
$CollectorTriggers = @((New-ScheduledTaskTrigger -Daily -At '09:00'), (New-ScheduledTaskTrigger -Daily -At '17:00'))
$Tasks = @(
  @{Name='BLUEDEAL-Hotdeal-Publisher'; Mode='publish'; Triggers=@($PublisherTrigger)},
  @{Name='BLUEDEAL-Hotdeal-Candidates'; Mode='collect'; Triggers=$CollectorTriggers}
)
foreach ($Item in $Tasks) {
  if (Get-ScheduledTask -TaskName $Item.Name -TaskPath '\' -ErrorAction SilentlyContinue) { continue }
  $PowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + (Join-Path $PSScriptRoot 'run_publisher.ps1') + '" -Node "' + $Runtime + '" -Mode ' + $Item.Mode
  $Action = New-ScheduledTaskAction -Execute $PowerShell -Argument $Arguments -WorkingDirectory $Repo
  $Task = New-ScheduledTask -Action $Action -Trigger $Item.Triggers -Principal $Principal -Settings $Settings
  Register-ScheduledTask -TaskName $Item.Name -TaskPath '\' -InputObject $Task | Out-Null
}
Get-ScheduledTask -TaskName 'BLUEDEAL-Hotdeal-*' -TaskPath '\' | Select-Object TaskName,State | ConvertTo-Json
