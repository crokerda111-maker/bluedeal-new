param([switch]$Install, [switch]$Enable)
$ErrorActionPreference = "Stop"
$TaskName = "BLUEDEAL-Verified-Prices"
$TaskPath = "\"
$Runner = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "run_scheduled_prices.ps1")).Path
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Import-Module (Join-Path $PSScriptRoot 'PriceTaskRuntime.psm1') -Force
$Runtime = Get-PriceTaskRuntime -RepoRoot $RepoRoot
$PowerShellPath = $Runtime.powershell
if ((Get-TimeZone).Id -ne "Korea Standard Time") { throw "PC 시간대를 한국 표준시로 확인한 뒤 등록하세요. 시스템 시간대를 자동 변경하지 않습니다." }
if (-not $Install) {
  Write-Host "계획: 현재 사용자로 매일 09:00 / 17:00 KST 실행. 기본 비활성, PC 로그인·네트워크 연결 필요."
  Write-Host "등록하려면 -Install, 검증 후 활성화하려면 -Install -Enable을 사용하세요."
  exit 0
}
if (Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue) { throw "동일한 예약 작업이 있습니다. 기존 설정을 직접 검토하세요." }
if ($Enable) {
  # A dry run cannot prove that a real feed reached the production website.
  [void](Test-PriceTaskActivation -RepoRoot $RepoRoot)
  & $PowerShellPath -NoProfile -File $Runner -ValidateOnly
  if ($LASTEXITCODE -ne 0) { throw "실제 원본 검증에 실패하여 예약 작업을 활성화하지 않았습니다." }
}
Save-PriceTaskRuntime -RepoRoot $RepoRoot -Runtime $Runtime
$Action = New-ScheduledTaskAction -Execute $PowerShellPath -Argument ("-NoProfile -WindowStyle Hidden -File `"" + $Runner + "`"")
$Triggers = @((New-ScheduledTaskTrigger -Daily -At "09:00"), (New-ScheduledTaskTrigger -Daily -At "17:00"))
$UserId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$Principal = New-ScheduledTaskPrincipal -UserId $UserId -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
if (-not $Enable) { $Settings.Enabled = $false }
$Task = New-ScheduledTask -Action $Action -Trigger $Triggers -Principal $Principal -Settings $Settings -Description "검증된 원본 가격을 GitHub/Vercel에 배포하고 운영 커밋·가격 해시를 확인합니다."
Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -InputObject $Task | Out-Null
Write-Host "예약 작업 등록 완료. 활성 상태: $([bool]$Enable)"
