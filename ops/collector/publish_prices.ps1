param(
  [string]$InputPath = "",
  [switch]$FromFeed,
  [switch]$CollectDanawa,
  [switch]$Publish,
  [switch]$ValidateOnly,
  [string]$NpmCommand = 'npm',
  [switch]$AllowCurrentBranch
)

$ErrorActionPreference = "Stop"
if ($FromFeed -and $InputPath) { throw "원본 피드와 로컬 입력을 동시에 선택할 수 없습니다." }
if ($ValidateOnly -and $Publish) { throw "검증만 실행하거나 배포 중 하나를 선택하세요." }
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $InputPath) { $InputPath = Join-Path $PSScriptRoot "input\products.csv" }
$OutputPaths = @("src/content/outbound.generated.json", "src/content/prices/meta.json") +
  (@("ram","cpu","ssd","motherboard","gpu","cooler","halfpc","fullpc","psu","case","hdd") | ForEach-Object { "src/content/prices/$_.json" })

if ($CollectDanawa) {
  if ($Publish -or $FromFeed -or $ValidateOnly) { throw "다나와 후보 목록은 가격 스냅샷으로 배포할 수 없습니다." }
  python (Join-Path $PSScriptRoot "collect_danawa.py") --out (Join-Path $PSScriptRoot "input\danawa-candidates.csv")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "후보 목록만 생성했습니다. 실제 판매처 가격과 조건을 확인하세요."
  exit 0
}

$StateDirectory = Join-Path $PSScriptRoot 'state'
$ReportPath = Join-Path $StateDirectory 'last-publish.json'
$SuccessReportPath = Join-Path $StateDirectory 'last-successful-publish.json'
$script:PublishReport = [ordered]@{
  version=1; runId=[Guid]::NewGuid().ToString('N'); attemptedAt=[DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(9)).ToString('o')
  mode=$(if ($FromFeed) { 'feed' } else { 'manual' }); status='running'; stage='starting'; sourceValidated=$false
  sourceCommit=$null; priceCommit=$null; uploadAttempted=$false; uploadSucceeded=$false; uploadSkipped=$false
  deploymentVerified=$false; reasonCode=$null; verifiedAt=$null; completedAt=$null
}
$script:FailureCode = 'UNEXPECTED_FAILURE'
$script:FailureMessage = '실행 기록에서 실패 단계를 확인하세요.'
$PublishLock = $null
$PreviousGitPrompt = $env:GIT_TERMINAL_PROMPT
$PreviousGcmInteractive = $env:GCM_INTERACTIVE

function Save-PublishReport {
  $destinations = @($ReportPath)
  if ($script:PublishReport.status -eq 'verified' -and $script:PublishReport.deploymentVerified) { $destinations += $SuccessReportPath }
  foreach ($destination in $destinations) {
    $temp = Join-Path $StateDirectory ([Guid]::NewGuid().ToString('N') + '.tmp')
    try {
      [IO.File]::WriteAllText($temp, ($script:PublishReport | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding($false)))
      if ([IO.File]::Exists($destination)) { [IO.File]::Replace($temp, $destination, [NullString]::Value) }
      else { [IO.File]::Move($temp, $destination) }
    } finally { if ([IO.File]::Exists($temp)) { [IO.File]::Delete($temp) } }
  }
}
function Set-PublishStage([string]$Stage, [string]$Status='running') {
  $script:PublishReport.stage = $Stage
  $script:PublishReport.status = $Status
  Save-PublishReport
}
function Stop-PricePublish([string]$Code, [string]$Message) {
  $script:FailureCode = $Code
  $script:FailureMessage = $Message
  throw 'PRICE_PUBLISH_STOPPED'
}
function Confirm-PriceDeployment {
  Set-PublishStage 'verifying-deployment'
  python (Join-Path $PSScriptRoot 'verify_deployment.py') --root $RepoRoot --commit $script:PublishReport.priceCommit
  if ($LASTEXITCODE -eq 2) { Stop-PricePublish 'DEPLOYMENT_PENDING' '업로드된 커밋의 운영 반영 확인이 아직 끝나지 않았습니다.' }
  if ($LASTEXITCODE -ne 0) { Stop-PricePublish 'DEPLOYMENT_VERIFICATION_FAILED' '운영 커밋과 가격 데이터를 확인하지 못했습니다.' }
  $script:PublishReport.deploymentVerified = $true
  $script:PublishReport.verifiedAt = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(9)).ToString('o')
  Set-PublishStage 'complete' 'verified'
  Write-Host '[OK] 운영 커밋과 가격 반영 확인까지 완료했습니다.'
}

try {
  [void][IO.Directory]::CreateDirectory($StateDirectory)
  try { $PublishLock = [IO.File]::Open((Join-Path $StateDirectory 'publish.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
  catch { Stop-PricePublish 'PUBLISH_BUSY' '다른 가격 작업이 실행 중입니다.' }
  Set-PublishStage 'preflight'
  $env:GIT_TERMINAL_PROMPT = '0'
  $env:GCM_INTERACTIVE = 'Never'

  if ($Publish -or $ValidateOnly) {
    $ActualRoot = (git -C $RepoRoot rev-parse --show-toplevel).Trim()
    if ($LASTEXITCODE -ne 0 -or (Resolve-Path -LiteralPath $ActualRoot).Path -ne $RepoRoot) { Stop-PricePublish 'WRONG_REPOSITORY' '저장소 루트가 일치하지 않습니다.' }
    $Branch = (git -C $RepoRoot branch --show-current).Trim()
    if (-not $Branch) { Stop-PricePublish 'BRANCH_UNAVAILABLE' '브랜치를 확인할 수 없습니다.' }
    if ($Branch -ne "main" -and -not $AllowCurrentBranch) { Stop-PricePublish 'WRONG_BRANCH' '가격 배포는 main에서 실행하세요.' }
    git -C $RepoRoot diff --cached --quiet
    if ($LASTEXITCODE -ne 0) { Stop-PricePublish 'STAGED_USER_CHANGES' '이미 스테이징한 변경이 있습니다. 먼저 확인하세요.' }
    $OtherChanges = @(git -C $RepoRoot diff --name-only) | Where-Object { $_ -notin $OutputPaths }
    $Untracked = @(git -C $RepoRoot ls-files --others --exclude-standard)
    if ($OtherChanges.Count -or $Untracked.Count) { Stop-PricePublish 'UNSTAGED_USER_CHANGES' '가격 파일 외 변경이 있습니다. 소스 작업을 먼저 정리하세요.' }
    Set-PublishStage 'checking-git-access'
    git -C $RepoRoot -c credential.interactive=never fetch origin $Branch
    if ($LASTEXITCODE -ne 0) { Stop-PricePublish 'GIT_FETCH_FAILED' '원격 확인에 실패했습니다. 인증과 네트워크를 확인하세요.' }
    $InitialHead = (git -C $RepoRoot rev-parse HEAD).Trim()
    if ($InitialHead -ne (git -C $RepoRoot rev-parse "origin/$Branch").Trim()) { Stop-PricePublish 'GIT_HEAD_DIVERGED' '로컬과 원격 커밋이 다릅니다. 먼저 확인하세요.' }
    $script:PublishReport.sourceCommit = $InitialHead
    git -C $RepoRoot -c credential.interactive=never push --dry-run origin $Branch
    if ($LASTEXITCODE -ne 0) { Stop-PricePublish 'GIT_PUSH_PREFLIGHT_FAILED' '비대화형 업로드 사전 점검에 실패했습니다.' }
  }

  $Arguments = @((Join-Path $PSScriptRoot "ingest_snapshot.py"))
  if ($FromFeed) { $Arguments += "--from-feed" } else { $Arguments += @("--input", $InputPath) }
  if ($ValidateOnly) { $Arguments += '--dry-run' }
  Set-PublishStage 'validating-source'
  python @Arguments
  if ($LASTEXITCODE -ne 0) { Stop-PricePublish 'SOURCE_REJECTED' '원본 검증 또는 가격 생성에 실패했습니다.' }
  $script:PublishReport.sourceValidated = $true
  if ($ValidateOnly) { Set-PublishStage 'complete' 'validated'; Write-Host '[OK] 원본·Git 인증 사전 점검 완료.'; exit 0 }
  if (-not $Publish) { Set-PublishStage 'complete' 'generated'; Write-Host '[OK] 검증 및 가격 파일 생성 완료.'; exit 0 }

  if ((git -C $RepoRoot rev-parse HEAD).Trim() -ne $InitialHead -or (git -C $RepoRoot branch --show-current).Trim() -ne $Branch) {
    Stop-PricePublish 'GIT_CHANGED_DURING_INGEST' '원본 확인 중 커밋이나 브랜치가 바뀌었습니다. 사용자 작업을 보존하고 중단합니다.'
  }
  git -C $RepoRoot diff --quiet -- @OutputPaths
  if ($LASTEXITCODE -eq 0) {
    $script:PublishReport.priceCommit = (git -C $RepoRoot rev-parse HEAD).Trim()
    $script:PublishReport.uploadSkipped = $true
    Confirm-PriceDeployment
    exit 0
  }

  Set-PublishStage 'building'
  Push-Location -LiteralPath $RepoRoot
  try {
    & $NpmCommand run build
    if ($LASTEXITCODE -ne 0) { Stop-PricePublish 'BUILD_FAILED' '운영 빌드에 실패했습니다.' }
  } finally { Pop-Location }

  # A scheduled build can overlap with an editor saving a source file.
  # Recheck before staging so the published source is the source we verified.
  Set-PublishStage 'checking-editor-changes'
  if ((git -C $RepoRoot rev-parse HEAD).Trim() -ne $InitialHead -or (git -C $RepoRoot branch --show-current).Trim() -ne $Branch) {
    Stop-PricePublish 'GIT_CHANGED_DURING_BUILD' '검증 중 커밋이나 브랜치가 바뀌었습니다. 사용자 작업을 보존하고 중단합니다.'
  }
  $OtherChanges = @(git -C $RepoRoot diff --name-only) | Where-Object { $_ -notin $OutputPaths }
  $Untracked = @(git -C $RepoRoot ls-files --others --exclude-standard)
  if ($OtherChanges.Count -or $Untracked.Count) { Stop-PricePublish 'SOURCE_CHANGED_DURING_BUILD' '빌드 중 소스 변경이 생겼습니다. 사용자 작업을 보존하고 중단합니다.' }

  git -C $RepoRoot diff --cached --quiet
  if ($LASTEXITCODE -ne 0) { Stop-PricePublish 'STAGING_CHANGED_DURING_BUILD' '검증 중 새로 스테이징한 변경이 있습니다.' }
  Set-PublishStage 'staging-prices'
  git -C $RepoRoot add -- @OutputPaths
  if ($LASTEXITCODE -ne 0) { Stop-PricePublish 'STAGING_FAILED' '가격 파일 스테이징에 실패했습니다.' }
  $Unexpected = @(git -C $RepoRoot diff --cached --name-only) | Where-Object { $_ -notin $OutputPaths }
  if ($Unexpected.Count) { Stop-PricePublish 'UNEXPECTED_STAGED_FILES' '가격 외 파일이 스테이징되어 중단합니다.' }
  git -C $RepoRoot diff --cached --check
  if ($LASTEXITCODE -ne 0) { Stop-PricePublish 'STAGED_DIFF_INVALID' '스테이징 검증에 실패했습니다.' }

  $Timestamp = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, "Korea Standard Time").ToString("yyyy-MM-dd HH:mm")
  Set-PublishStage 'committing-prices'
  git -C $RepoRoot commit -m "data: refresh verified prices $Timestamp KST" --only -- @OutputPaths
  if ($LASTEXITCODE -ne 0) { Stop-PricePublish 'COMMIT_FAILED' '가격 커밋 생성에 실패했습니다.' }
  $script:PublishReport.priceCommit = (git -C $RepoRoot rev-parse HEAD).Trim()
  Set-PublishStage 'uploading'
  $script:PublishReport.uploadAttempted = $true
  git -C $RepoRoot -c credential.interactive=never push origin $Branch
  if ($LASTEXITCODE -ne 0) { Stop-PricePublish 'PUSH_UNCONFIRMED' '업로드 결과를 확인하지 못했습니다. 가격 커밋은 로컬에 보존했습니다.' }
  $script:PublishReport.uploadSucceeded = $true
  Confirm-PriceDeployment
} catch {
  $script:PublishReport.reasonCode = $script:FailureCode
  $script:PublishReport.status = $(if ($script:PublishReport.uploadSucceeded -or $script:PublishReport.uploadSkipped) { 'uploaded-unverified' } else { 'failed' })
  Write-Host "[ERROR] $script:FailureCode : $script:FailureMessage"
  exit 1
} finally {
  if ($PublishLock) {
    $script:PublishReport.completedAt = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(9)).ToString('o')
    try { Save-PublishReport } catch { Write-Host '[ERROR] 실행 상태 기록을 저장하지 못했습니다.' }
    $PublishLock.Dispose()
  }
  $env:GIT_TERMINAL_PROMPT = $PreviousGitPrompt
  $env:GCM_INTERACTIVE = $PreviousGcmInteractive
}
