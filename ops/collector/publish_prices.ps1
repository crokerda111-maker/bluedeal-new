param(
  [string]$InputPath = "",
  [switch]$CollectDanawa,
  [switch]$Publish,
  [switch]$AllowCurrentBranch
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $InputPath) {
  $InputPath = Join-Path $PSScriptRoot "input\products.csv"
}

if ($CollectDanawa) {
  if ($Publish) {
    throw "다나와 후보 주소는 구매 링크로 배포할 수 없습니다. products.csv에 판매처 제휴링크를 입력한 뒤 -Publish를 실행하세요."
  }
  $CandidatePath = Join-Path $PSScriptRoot "input\danawa-candidates.csv"
  python (Join-Path $PSScriptRoot "collect_danawa.py") --out $CandidatePath
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "다나와 후보 목록만 생성했습니다. 판매처 가격과 제휴링크를 products.csv에 입력하세요."
  exit 0
}

python (Join-Path $PSScriptRoot "build_prices.py") --root $RepoRoot --input $InputPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $Publish) {
  Write-Host "검증 및 파일 생성 완료. GitHub에 올리려면 -Publish 옵션을 사용하세요."
  exit 0
}

$Branch = (git -C $RepoRoot branch --show-current).Trim()
if ($Branch -ne "main" -and -not $AllowCurrentBranch) {
  throw "현재 브랜치는 '$Branch'입니다. main에서 실행하거나 -AllowCurrentBranch를 명시하세요."
}

git -C $RepoRoot add src/content/prices src/content/outbound.generated.json
git -C $RepoRoot diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "가격 데이터 변경이 없어 커밋하지 않았습니다."
  exit 0
}

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git -C $RepoRoot commit -m "data: refresh prices $Timestamp"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
git -C $RepoRoot push origin $Branch
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "GitHub 업로드 완료. 연결된 Vercel 배포가 자동으로 시작됩니다."
