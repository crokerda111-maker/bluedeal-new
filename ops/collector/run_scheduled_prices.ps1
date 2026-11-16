param([switch]$ValidateOnly)
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ConfigPath = Join-Path $RepoRoot "ops\private\price-feed.local.json"
$PreviousUrl = $env:BLUEDEAL_PRICE_FEED_URL
$PreviousToken = $env:BLUEDEAL_PRICE_FEED_TOKEN
try {
  if (-not (Test-Path -LiteralPath $ConfigPath)) { throw "MISSING_CONFIG" }
  $Config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
  $FeedUri = [Uri]$Config.url
  if ($FeedUri.Scheme -ne "https" -or -not $FeedUri.Host -or $FeedUri.UserInfo -or $FeedUri.Host.EndsWith(".invalid")) { throw "INVALID_CONFIG" }
  $env:BLUEDEAL_PRICE_FEED_URL = $Config.url
  $env:BLUEDEAL_PRICE_FEED_TOKEN = $Config.token
  Push-Location -LiteralPath $RepoRoot
  try {
    if ($ValidateOnly) {
      python (Join-Path $PSScriptRoot "ingest_snapshot.py") --from-feed --dry-run
    } else {
      & (Join-Path $PSScriptRoot "publish_prices.ps1") -FromFeed -Publish
    }
    $RunExit = $LASTEXITCODE
  } finally { Pop-Location }
  if ($RunExit -ne 0) { throw "RUN_FAILED" }
} catch {
  Write-Host "[ERROR] 예약 가격 작업을 완료하지 못했습니다. 비공개 원본 설정·권한·실행 기록을 확인하세요. 기존 운영 배포를 유지합니다."
  exit 1
} finally {
  $env:BLUEDEAL_PRICE_FEED_URL = $PreviousUrl
  $env:BLUEDEAL_PRICE_FEED_TOKEN = $PreviousToken
}
