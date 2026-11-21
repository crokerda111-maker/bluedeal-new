$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$Directory = Join-Path $RepoRoot 'ops\private\maintenance'
$Runtime = Get-Content -LiteralPath (Join-Path $Directory 'scheduled-runtime.local.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$Runner = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'run_scheduled.ps1')).Path
$definitions = @()
foreach ($mode in @('health','collect','backup')) {
  $name = 'BLUEDEAL-Maintenance-' + $mode
  [xml]$xml = Export-ScheduledTask -TaskPath '\' -TaskName $name
  $ns = New-Object Xml.XmlNamespaceManager($xml.NameTable)
  $ns.AddNamespace('t','http://schemas.microsoft.com/windows/2004/02/mit/task')
  $command = $xml.SelectSingleNode('//t:Actions/t:Exec/t:Command',$ns).InnerText
  $arguments = $xml.SelectSingleNode('//t:Actions/t:Exec/t:Arguments',$ns).InnerText
  $expected = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $Runner + '" -Mode ' + $mode
  $registered = Get-ScheduledTask -TaskPath '\' -TaskName $name
  # Export omits schema defaults (LeastPrivilege and Enabled=true).
  if ($command -cne $Runtime.powershell -or $arguments -cne $expected -or
      [int]$registered.Principal.RunLevel -ne 0 -or
      $xml.SelectSingleNode('//t:Principal/t:LogonType',$ns).InnerText -ne 'InteractiveToken' -or
      $xml.SelectSingleNode('//t:Settings/t:MultipleInstancesPolicy',$ns).InnerText -ne 'IgnoreNew' -or
      $xml.SelectSingleNode('//t:Settings/t:StartWhenAvailable',$ns).InnerText -ne 'true' -or
      -not $registered.Settings.Enabled) { throw 'MAINTENANCE_TASK_DEFINITION_MISMATCH' }
  $info = Get-ScheduledTaskInfo -TaskPath '\' -TaskName $name
  $definitions += [PSCustomObject]@{taskName=$name;runLevel='Limited';logon='Interactive';hiddenWindow=$true;nextRunTime=$info.NextRunTime.ToString('o')}
}
$runs = @()
foreach ($mode in @('health','health','collect','backup')) {
  $name = 'BLUEDEAL-Maintenance-' + $mode
  $recordPath = Join-Path $Directory ('scheduler\last-' + $mode + '.local.json')
  $previous = ''
  if (Test-Path -LiteralPath $recordPath) { $previous = (Get-Content -LiteralPath $recordPath -Raw -Encoding UTF8 | ConvertFrom-Json).run_id }
  Start-ScheduledTask -TaskPath '\' -TaskName $name
  $deadline = [DateTimeOffset]::UtcNow.AddMinutes(3)
  $record = $null
  do {
    Start-Sleep -Milliseconds 500
    if (Test-Path -LiteralPath $recordPath) {
      $candidate = Get-Content -LiteralPath $recordPath -Raw -Encoding UTF8 | ConvertFrom-Json
      $task = Get-ScheduledTask -TaskPath '\' -TaskName $name
      if ($candidate.run_id -ne $previous -and [int]$task.State -ne 4) { $record = $candidate; break }
    }
  } while ([DateTimeOffset]::UtcNow -lt $deadline)
  if ($null -eq $record) { throw ('MAINTENANCE_TASK_TIMEOUT_' + $mode) }
  $info = Get-ScheduledTaskInfo -TaskPath '\' -TaskName $name
  if ($info.LastTaskResult -ne 0 -or $record.state -notin @('ok','attention') -or $record.ai_calls -ne 0) { throw ('MAINTENANCE_TASK_VERIFICATION_FAILED_' + $mode) }
  $runs += [PSCustomObject]@{mode=$mode;runId=$record.run_id;state=$record.state;completedAt=$record.completed_at;lastTaskResult=$info.LastTaskResult;aiCalls=$record.ai_calls}
}
$result = [PSCustomObject]@{verifiedAt=[DateTimeOffset]::Now.ToString('o');status='verified';method='manual Start-ScheduledTask through the registered OS action';definitions=$definitions;runs=$runs;timerFiringObserved=$false;primaryDataChanged=$false}
[IO.File]::WriteAllText((Join-Path $Directory 'scheduled-migration-verification.local.json'), ($result | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
$result | ConvertTo-Json -Depth 8
