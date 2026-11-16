param(
  [string]$InputPath = "",
  [switch]$FromFeed,
  [switch]$CollectDanawa,
  [switch]$Publish,
  [switch]$AllowCurrentBranch
)

$ErrorActionPreference = "Stop"
if ($FromFeed -and $InputPath) { throw "원본 피드와 로컬 입력을 동시에 선택할 수 없습니다." }
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $InputPath) { $InputPath = Join-Path $PSScriptRoot "input\products.csv" }
$OutputPaths = @("src/content/outbound.generated.json", "src/content/prices/meta.json") +
  (@("ram","cpu","ssd","motherboard","gpu","cooler","halfpc","fullpc") | ForEach-Object { "src/content/prices/$_.json" })

if ($CollectDanawa) {
  if ($Publish -or $FromFeed) { throw "다나와 후보 목록은 가격 스냅샷으로 배포할 수 없습니다." }
  python (Join-Path $PSScriptRoot "collect_danawa.py") --out (Join-Path $PSScriptRoot "input\danawa-candidates.csv")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "후보 목록만 생성했습니다. 실제 판매처 가격과 조건을 확인하세요."
  exit 0
}

if ($Publish) {
  $ActualRoot = (git -C $RepoRoot rev-parse --show-toplevel).Trim()
  if ($LASTEXITCODE -ne 0 -or (Resolve-Path -LiteralPath $ActualRoot).Path -ne $RepoRoot) { throw "저장소 루트가 일치하지 않습니다." }
  $Branch = (git -C $RepoRoot branch --show-current).Trim()
  if (-not $Branch) { throw "브랜치를 확인할 수 없습니다. 배포를 중단합니다." }
  if ($Branch -ne "main" -and -not $AllowCurrentBranch) { throw "가격 배포는 main에서 실행하세요." }
  git -C $RepoRoot diff --cached --quiet
  if ($LASTEXITCODE -ne 0) { throw "이미 스테이징한 변경이 있습니다. 가격 배포 전에 직접 확인하세요." }
  $OtherChanges = @(git -C $RepoRoot diff --name-only) | Where-Object { $_ -notin $OutputPaths }
  $Untracked = @(git -C $RepoRoot ls-files --others --exclude-standard)
  if ($OtherChanges.Count -or $Untracked.Count) { throw "가격 파일 외 변경이 있습니다. 소스 작업을 먼저 정리하세요." }
  git -C $RepoRoot -c credential.interactive=never fetch origin $Branch
  if ($LASTEXITCODE -ne 0) { throw "원격 확인 실패. 인증과 네트워크를 확인하세요." }
  if ((git -C $RepoRoot rev-parse HEAD) -ne (git -C $RepoRoot rev-parse "origin/$Branch")) { throw "로컬과 원격 커밋이 다릅니다. 먼저 변경 내용을 검토하세요." }
}

$Arguments = @((Join-Path $PSScriptRoot "ingest_snapshot.py"))
if ($FromFeed) { $Arguments += "--from-feed" } else { $Arguments += @("--input", $InputPath) }
python @Arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (-not $Publish) { Write-Host "검증 및 생성 완료. 운영 배포는 실행하지 않았습니다."; exit 0 }

git -C $RepoRoot diff --quiet -- @OutputPaths
if ($LASTEXITCODE -eq 0) { Write-Host "변경된 가격 데이터가 없습니다."; exit 0 }

Push-Location -LiteralPath $RepoRoot
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "빌드 실패. 기존 운영 배포를 유지합니다." }
} finally { Pop-Location }

# A scheduled build can overlap with an editor saving a source file.
# Recheck before staging so the published source is the source we verified.
$OtherChanges = @(git -C $RepoRoot diff --name-only) | Where-Object { $_ -notin $OutputPaths }
$Untracked = @(git -C $RepoRoot ls-files --others --exclude-standard)
if ($OtherChanges.Count -or $Untracked.Count) { throw "빌드 중 가격 파일 외 변경이 생겼습니다. 사용자 작업을 보존하고 배포를 중단합니다." }

git -C $RepoRoot diff --cached --quiet
if ($LASTEXITCODE -ne 0) { throw "검증 중 새로 스테이징한 변경이 있습니다. 배포를 중단합니다." }
git -C $RepoRoot add -- @OutputPaths
if ($LASTEXITCODE -ne 0) { throw "가격 파일 스테이징 실패." }
$Unexpected = @(git -C $RepoRoot diff --cached --name-only) | Where-Object { $_ -notin $OutputPaths }
if ($Unexpected.Count) { throw "가격 외 파일이 스테이징되어 배포를 중단합니다." }
git -C $RepoRoot diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "스테이징 검증 실패." }

$Timestamp = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, "Korea Standard Time").ToString("yyyy-MM-dd HH:mm")
git -C $RepoRoot commit -m "data: refresh verified prices $Timestamp KST" --only -- @OutputPaths
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
git -C $RepoRoot -c credential.interactive=never push origin $Branch
if ($LASTEXITCODE -ne 0) { throw "업로드 실패. 가격 커밋은 로컬에 보존했습니다. GitHub Desktop에서 상태를 확인하세요." }
Write-Host "업로드 완료. 연결된 Vercel 배포와 운영 커밋을 확인하세요."
