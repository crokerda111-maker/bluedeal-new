# BLUEDEAL PC 가격 수집기

VPS 없이 Windows PC에서 가격 데이터를 만들고 GitHub/Vercel로 배포하는 도구입니다.

## 흐름

1. 다나와 수집기가 공개하지 않는 후보 목록을 만듭니다.
2. 후보 상품의 실제 판매처 가격·조건·확인 시각과 원본 판매처 주소를 `products.csv`에 입력합니다. 공식 발급 제휴 주소는 원본을 바꾸지 않고 서버의 `AFFILIATE_LINKS_JSON`에 따로 연결합니다(`ops/ENV_MAP.md` 참고).
3. `build_prices.py`가 URL 허용 목록을 검사하고 안정적인 `/go/{code}`를 생성합니다.
4. 공개 가격 파일에는 원본 URL 대신 `goCode`만 저장합니다.
5. `publish_prices.ps1 -Publish`가 가격 파일만 빌드·커밋해 GitHub에 올립니다.
6. GitHub와 연결된 Vercel이 홈페이지를 다시 배포합니다. 게시 도구는 운영 커밋과 가격 스냅샷이 일치할 때까지 확인한 뒤 성공으로 기록합니다.

## 준비

- Python 3.10 이상
- Git
- Google Chrome
- 이 저장소를 내려받은 Windows PC
- GitHub 로그인 또는 SSH 인증

최초 한 번 다나와 수집용 모듈을 설치합니다.

```powershell
python -m pip install -r .\ops\collector\requirements.txt
```

`ops/collector/input/products.example.csv`를 복사해 아래 파일을 만드세요.

```text
ops/collector/input/products.csv
```

필수 열은 `category,id,name,price,url,checkedAt`입니다. `checkedAt`은 실제 가격 확인 시각이며 `2026-11-16T17:38:27+09:00`처럼 시간대를 포함해야 합니다. 실행 시각보다 미래인 값은 거부합니다.

선택 열은 `spec,source,seller,shippingFee,shippingNote,priceNote,officialUrl`입니다. 상품 등록 시에는 판매자, 옵션, 배송비와 주요 할인 조건도 확인해 입력하세요. `shippingFee`는 기본 배송비(0은 무료, 빈칸은 미확인)이며 지역별 추가비는 `shippingNote`에 씁니다. `price`는 상품가이고 화면에서 기본 배송비 포함 금액을 별도로 계산합니다. 쿠폰·회원·카드 가격을 일반 판매가와 혼동하지 마세요. `officialUrl`은 공식 사양의 HTTPS 출처입니다.

지원 category:

```text
ram, cpu, ssd, motherboard, gpu, cooler, halfpc, fullpc
```

현재 허용 판매처는 쿠팡, AliExpress, 11번가, G마켓, 네이버 스마트스토어·브랜드스토어·쇼핑입니다. 다나와 주소와 다른 도메인은 구매 링크로 등록할 수 없습니다.

## 실행

입력 검증만 (가격 파일·이력·확인 시각을 변경하지 않음):

```powershell
python .\ops\collector\build_prices.py --dry-run
```

`products.csv`에는 실제로 확인한 상품만 입력하세요. 예제 파일의 가격과 주소는 테스트용이며 게시용 데이터가 아닙니다. 현재 생성기는 CSV 전체를 스냅샷으로 취급하므로, 입력에서 빠진 상품은 생성 결과에서도 빠집니다. 기존 상품을 유지하려면 전체 목록을 포함해야 합니다.

상품의 `checkedAt`과 `updatedAt`은 실제 확인 시각이며, 카테고리·메타의 `updatedAt`은 가장 최근 상품 확인 시각입니다. `generatedAt`은 파일 생성 시각입니다. 같은 CSV를 다시 생성해도 확인 시각과 관측 횟수는 늘어나지 않습니다. 실제 Vercel 게시 시각은 배포 기록으로 확인합니다.

처음 등록한 가격을 과거 최저가로 취급하지 않습니다. 24시간 변동은 24~26시간 전 비교 기록이 있을 때, 7일·30일 관측 최저는 해당 기간을 채운 기록이 있을 때만 제공합니다. 기록 사이의 가격은 알 수 없으므로 전체 시장 최저가를 의미하지 않습니다. 현재는 수동 확인 단계이며 자동 가격 수집·정시 배포는 아직 준비 중입니다.

파일 생성만:

```powershell
powershell -NoProfile -File .\ops\collector\publish_prices.ps1
```

GitHub 업로드와 Vercel 배포까지:

```powershell
powershell -NoProfile -File .\ops\collector\publish_prices.ps1 -Publish
```

다나와에서 후보 목록만 수집하려면:

```powershell
powershell -NoProfile -File .\ops\collector\publish_prices.ps1 -CollectDanawa
```

결과는 비공개 파일 `ops/collector/input/danawa-candidates.csv`에 저장됩니다. 이 파일의 상품을 보고 실제 판매처 가격과 원본 상품 주소를 `products.csv`에 입력해야 합니다. 공식 발급 제휴 주소는 별도로 연결합니다. `-CollectDanawa -Publish` 동시 실행은 다나와 주소가 실수로 구매 버튼에 들어가지 않도록 차단됩니다.

수집 대상은 `ops/collector/watchlist.json`에 고정되어 있습니다. 현재 CPU 4종, DDR5 24GB×2·16GB×2 국내 유통 인기상품 각 10개, 데스크톱 GeForce RTX 50 시리즈를 수집합니다. RAM은 해외·병행수입·노트북용·CUDIMM을 제외합니다.

`-Publish`는 안전을 위해 기본적으로 `main` 브랜치에서만 동작합니다. 입력 CSV와 31일 가격 기록은 `.gitignore`에 포함되어 GitHub에 올라가지 않습니다.

## 제휴 주소 변환 범위

- 판매처 주소의 제휴 추적 파라미터와 쿼리 순서를 보존합니다.
- 쿠팡 등은 공식 계정에서 발급한 완성된 주소를 등록하며, 일반 상품 주소에 태그를 임의로 붙이지 않습니다.
- 11번가·G마켓 등은 우선 공식 제휴 시스템에서 발급한 주소를 직접 입력합니다.
- 제휴 중간 도메인을 사용하는 링크는 실제 예시 주소를 검증한 뒤 허용 목록에 추가합니다.
- 임의의 제휴 파라미터를 추측해서 붙이지 않습니다.

## Windows 작업 스케줄러

수집 원본 CSV를 자동으로 갱신하는 프로그램이 준비된 뒤 위 PowerShell 명령을 작업 스케줄러에 등록하면 됩니다. PC가 꺼져 있거나 절전 상태면 실행되지 않으므로, 처음에는 수동 실행으로 데이터와 링크를 확인하는 것을 권장합니다.

## 상품 속성과 필터

- RAM: `memoryType`(DDR4/DDR5), `capacityGB`(키트 총용량), `moduleCapacityGB`, `moduleCount`를 확인해 입력합니다. 모듈 용량과 개수를 입력하면 총용량과 일치해야 합니다. 상품명에서 추정하지 않습니다.
- SSD: `capacityGB`는 판매자가 표기한 용량(1TB=1000GB)이며 `ssdDram`은 `present`/`absent`/`unknown`입니다. DRAM 정보 미입력은 `unknown`으로 보존합니다. HMB 지원을 DRAM 탑재로 바꾸지 마세요.
- GPU: `capacityGB`는 확인한 그래픽 메모리 용량입니다. 판매 상품과 공식 GPU 사양을 확인해 입력하며, 같은 GPU의 8GB·16GB 모델을 구분해 카탈로그에도 고정합니다. 상품명에서 자동 추정하지 않습니다.
- `availability`는 `in-stock`/`out-of-stock`/`unknown`입니다. 재고를 직접 확인하지 않았으면 `unknown`을 사용합니다.
- 화면은 실제 확인 시각으로 24시간 경과 여부를 판단합니다. 과거 CSV 재생성은 이 표시를 새 가격으로 바꾸지 않습니다.
- 검색·용량·메모리 규격·SSD DRAM·정렬은 주소의 GET 매개변수로 보존됩니다. 배송비 미확인 상품은 배송비 포함 정렬에서 뒤에 표시합니다.

## 검증된 원본과 배포 보호

실제 자동 수집 원본은 아직 연결하지 않았습니다. `ingest_snapshot.py`는 승인된 공급자의 정규화된 CSV/JSON을 받는 도구이며 G마켓 페이지를 직접 수집하는 프로그램이 아닙니다.

`catalog.json`에 운영자가 확인한 상품 ID·카테고리·판매 주소·판매자·옵션을 등록합니다. 전체 카탈로그가 빠짐없이 들어와야 하며, 원화(KRW), 실제 확인 시각, 26시간 이내 원본, 이전 확인 시각보다 새 원본을 검사합니다. 상품가가 이전 값보다 35% 넘게 달라지면 수동 검토를 요구합니다. 이 기준은 오류 감지 기준이며 할인·가격 변동의 진위를 자동 보장하지 않습니다.

```powershell
python ops/collector/ingest_snapshot.py --dry-run
python ops/collector/ingest_snapshot.py
```

다른 옵션·판매 주소로 바뀌면 카탈로그를 먼저 재검토하세요. 실제로 큰 가격 변동을 확인한 경우에만 `--accept-price-change`를 사용합니다. 다른 모델이나 통화 오류는 이 옵션으로 통과시킬 수 없습니다.

생성기는 빈 입력을 거부하고, 동시에 실행하지 못하도록 잠금을 사용합니다. 파일을 모두 임시 생성한 뒤 교체하며 일반적인 쓰기 실패에는 앞서 교체한 파일을 복구합니다. 강제 종료나 저장 장치 자체 고장은 Git의 이전 소스·데이터와 별도 백업으로 복구해야 합니다. `state/build.lock`이 남으면 해당 작업이 종료됐는지 확인한 후 처리하세요.

같은 확인 데이터를 다시 실행하면 생성 시각까지 그대로 유지하며 새 데이터 커밋을 만들지 않습니다. 실행 결과는 Git에서 제외한 `state/last-run.json`에 남깁니다. `--dry-run`도 이 비공개 실행 상태는 기록하지만 공개 가격과 가격 이력은 바꾸지 않습니다.

`publish_prices.ps1 -Publish`는 소스 변경·기존 스테이징·미등록 파일·원격 커밋 차이를 발견하면 생성 전에 멈춥니다. 빌드 성공 후 고정된 가격 파일만 커밋하며 강제 push나 자동 병합을 하지 않습니다. Git 인증이 안 되면 업로드를 중단하고 로컬 가격 커밋을 보존합니다. GitHub Desktop에서 검토할 수 있습니다.

빌드 중 편집기에서 가격 외 소스를 저장하거나 새 파일을 만들었으면 스테이징 전에 다시 감지해 배포를 중단합니다. 생성된 가격과 사용자 변경은 로컬에 남겨 검토할 수 있습니다.

원본 확인·빌드 중 커밋이나 브랜치가 바뀌어도 중단합니다. 전체 게시 과정은 프로세스 단독 잠금을 사용합니다. Git 인증은 비대화형으로 사전 확인하고, 실행 뒤 기존 환경변수를 복원합니다. 변경 없는 입력도 현재 운영 배포를 확인합니다.

`/api/prices/status`는 배포 커밋·버전·상품 수·확인 시각·공개 데이터의 SHA-256 지문만 반환합니다. 상품 옵션·가격·판매자·배송 조건과 원본 이동 주소를 지문에 포함하되, 원본 URL·제휴 설정·계정·피드 값은 응답에 싣지 않습니다. `verify_deployment.py`는 작업 폴더의 최신 편집 내용 대신 지정한 커밋의 Git 원본과 비교합니다. 서로 다른 요청이 배포 전환 중 다른 커밋에 도착하는 경우에도 같은 커밋으로 확인되기 전에는 성공하지 않습니다.

```powershell
python ops/collector/verify_deployment.py --commit 실제_40자리_커밋
powershell -NoProfile -File ops/collector/publish_prices.ps1 -FromFeed -ValidateOnly
```

운영 확인은 최대 10분입니다. 인증 보호 응답은 우회하지 않습니다. 업로드가 끝났으나 운영 확인이 실패하면 `uploaded-unverified`로 남기며, 자동 재게시·되돌리기는 하지 않습니다. `state/last-publish.json`, `state/last-successful-publish.json`, `state/last-deployment-check.json`에서 원본 검증·업로드·운영 검증을 구분해 확인합니다. 이 기록은 Git에서 제외하며 원본 피드 URL·토큰·응답 본문을 포함하지 않습니다.

## 09:00 / 17:00 예약 실행 준비

실제 승인된 가격 원본과 Git 인증을 확인하기 전에는 예약 작업을 활성화하지 않습니다. 현재 예약 작업은 등록하지 않았습니다.

1. 승인된 원본이 위 CSV/JSON 구조를 제공하도록 실제 공급자 연동을 완료합니다. 확인 시각을 생성 시각으로 바꾸면 안 됩니다.
2. `price-feed.example.json`을 참고해 `ops/private/price-feed.local.json`에 실제 HTTPS URL과 선택적인 bearer token을 보관합니다. 파일 권한을 사용자 전용으로 제한하고 비밀값을 Git·채팅에 올리지 마세요.
3. `run_scheduled_prices.ps1 -ValidateOnly`로 Git 인증과 실제 원본을 검증합니다. 리다이렉트·로그인 HTML·누락·통화·모델·오래된 데이터 오류는 거부합니다. URL·토큰·응답 본문은 오류 로그에 출력하지 않습니다.
4. 같은 실제 피드로 `run_scheduled_prices.ps1`을 직접 한 번 실행해 GitHub 업로드와 운영 커밋·가격 일치까지 완료해야 합니다. 수동 CSV 게시 성공이나 dry-run만으로는 활성화할 수 없습니다. 성공한 피드 실행이 현재 HEAD와 일치하고 26시간 이내여야 합니다.
5. `register_price_task.ps1`은 계획만 표시합니다. `-Install`은 비활성 등록, `-Install -Enable`은 위 실배포 이력과 최신 사전 검증을 모두 통과했을 때 활성 등록합니다. 기존 동일 작업을 덮어쓰지 않습니다.
6. 등록 시 설치된 Node·npm.cmd·Python·Git과 Windows 기본 PowerShell의 절대 경로를 비공개 `ops/private/task-runtime.local.json`에 기록합니다. Codex 버전에 종속된 WindowsApps 실행 파일이나 Windows 앱 별칭을 예약 작업 경로로 사용하지 않습니다. 기존 경로 설정은 자동 덮어쓰지 않으며 실행 파일이 없어지면 중단합니다. PC의 실행 정책도 변경하지 않습니다.
7. 한국 표준시 PC에서 현재 사용자로 09:00/17:00 실행합니다. 로그인·네트워크·Python·Node·Git 인증이 필요합니다. PC가 꺼져 있거나 절전 상태면 실행되지 않으며 정확한 시각의 배포 완료를 보장하지 않습니다. 숨김 창·일반 사용자 권한으로 실행하며 중복 실행을 건너뜁니다.
8. 활성화 후 첫 실제 예약 실행에서 입력→생성→GitHub→Vercel READY→운영 커밋·가격 확인까지 검증해야 완료입니다. 예약 실행 기록은 `state/last-scheduled-run.json`입니다. 현재는 원본 연결 전 준비 단계입니다.
