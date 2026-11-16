param([switch]$ValidateOnly)
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ConfigPath = Join-Path $RepoRoot "ops\private\price-feed.local.json"
$PreviousUrl = $env:BLUEDEAL_PRICE_FEED_URL
$PreviousToken = $env:BLUEDEAL_PRICE_FEED_TOKEN
$PreviousPath = $env:PATH
$StateDirectory = Join-Path $PSScriptRoot 'state'
$ReportPath = Join-Path $StateDirectory 'last-scheduled-run.json'
$PublishReportPath = Join-Path $StateDirectory 'last-publish.json'
$PreviousRunId = $null
$FailureCode = 'TASK_RUN_FAILED'
$Report = [ordered]@{
  version=1; attemptedAt=[DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(9)).ToString('o')
  mode=$(if ($ValidateOnly) { 'validate' } else { 'publish' }); status='running'; stage='starting'
  publisherRunId=$null; reasonCode=$null; completedAt=$null
}
try {
  Import-Module (Join-Path $PSScriptRoot 'PriceTaskRuntime.psm1') -Force
  $Report.stage = 'checking-runtime'
  $FailureCode = 'TASK_RUNTIME_UNAVAILABLE'
  $Runtime = Get-PriceTaskRuntime -RepoRoot $RepoRoot
  $env:PATH = Get-PriceRuntimePath -Runtime $Runtime -PreviousPath $PreviousPath
  $Report.stage = 'checking-config'
  $FailureCode = 'TASK_CONFIG_INVALID'
  if (-not (Test-Path -LiteralPath $ConfigPath)) { $FailureCode = 'TASK_CONFIG_MISSING'; throw 'TASK_STOPPED' }
  $Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $FeedUri = $null
  if (-not ($Config.url -is [string]) -or -not [Uri]::TryCreate($Config.url, [UriKind]::Absolute, [ref]$FeedUri) -or
      $FeedUri.Scheme -ne 'https' -or -not $FeedUri.Host -or $FeedUri.UserInfo -or $FeedUri.Fragment -or
      -not $FeedUri.IsDefaultPort -or $FeedUri.Host.EndsWith('.invalid') -or $FeedUri.Host -eq 'localhost' -or
      $FeedUri.HostNameType -ne [UriHostNameType]::Dns -or
      ($null -ne $Config.token -and -not ($Config.token -is [string]))) { throw 'TASK_STOPPED' }
  $env:BLUEDEAL_PRICE_FEED_URL = $Config.url
  $env:BLUEDEAL_PRICE_FEED_TOKEN = $Config.token
  if (Test-Path -LiteralPath $PublishReportPath) {
    $PreviousRunId = (Get-Content -LiteralPath $PublishReportPath -Raw -Encoding UTF8 | ConvertFrom-Json).runId
  }
  $Report.stage = 'running-publisher'
  $FailureCode = 'TASK_PUBLISH_FAILED'
  Push-Location -LiteralPath $RepoRoot
  try {
    if ($ValidateOnly) {
      & (Join-Path $PSScriptRoot 'publish_prices.ps1') -FromFeed -ValidateOnly -NpmCommand $Runtime.npm
    } else {
      & (Join-Path $PSScriptRoot 'publish_prices.ps1') -FromFeed -Publish -NpmCommand $Runtime.npm
    }
    $RunExit = $LASTEXITCODE
  } finally { Pop-Location }
  $PublishReport = Get-Content -LiteralPath $PublishReportPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not $PublishReport.runId -or $PublishReport.runId -eq $PreviousRunId) { $FailureCode = 'TASK_PUBLISH_STATUS_UNAVAILABLE'; throw 'TASK_STOPPED' }
  $Report.publisherRunId = $PublishReport.runId
  if ($RunExit -ne 0) {
    $Report.status = $(if ($PublishReport.status -eq 'uploaded-unverified') { 'uploaded-unverified' } else { 'failed' })
    throw 'TASK_STOPPED'
  }
  $ExpectedStatus = $(if ($ValidateOnly) { 'validated' } else { 'verified' })
  if ($PublishReport.status -ne $ExpectedStatus -or (-not $ValidateOnly -and -not $PublishReport.deploymentVerified)) {
    $FailureCode = 'TASK_PUBLISH_STATUS_UNAVAILABLE'; throw 'TASK_STOPPED'
  }
  $Report.status = $ExpectedStatus
  $Report.stage = 'complete'
} catch {
  if ($Report.status -eq 'running') { $Report.status = 'failed' }
  $Report.reasonCode = $FailureCode
  Write-Host '[ERROR] 예약 가격 작업을 완료하지 못했습니다. 비공개 실행 기록에서 실패 단계와 업로드·운영 검증 상태를 확인하세요.'
  exit 1
} finally {
  $env:BLUEDEAL_PRICE_FEED_URL = $PreviousUrl
  $env:BLUEDEAL_PRICE_FEED_TOKEN = $PreviousToken
  $env:PATH = $PreviousPath
  $Report.completedAt = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(9)).ToString('o')
  $TempPath = Join-Path $StateDirectory ([Guid]::NewGuid().ToString('N') + '.tmp')
  try {
    [void][IO.Directory]::CreateDirectory($StateDirectory)
    [IO.File]::WriteAllText($TempPath, ($Report | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))
    if ([IO.File]::Exists($ReportPath)) { [IO.File]::Replace($TempPath, $ReportPath, [NullString]::Value) }
    else { [IO.File]::Move($TempPath, $ReportPath) }
  } catch { Write-Host '[ERROR] 예약 실행 상태 기록을 저장하지 못했습니다.' }
  finally { if ([IO.File]::Exists($TempPath)) { [IO.File]::Delete($TempPath) } }
}
