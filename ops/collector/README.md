# BLUEDEAL PC 가격 수집기

VPS 없이 Windows PC에서 가격 데이터를 만들고 GitHub/Vercel로 배포하는 도구입니다.

## 흐름

1. 다나와 수집기가 공개하지 않는 후보 목록을 만듭니다.
2. 후보 상품의 실제 판매처 가격과 공식 제휴링크를 `products.csv`에 입력합니다.
3. `build_prices.py`가 URL 허용 목록을 검사하고 안정적인 `/go/{code}`를 생성합니다.
4. 공개 가격 파일에는 원본 URL 대신 `goCode`만 저장합니다.
5. `publish_prices.ps1 -Publish`가 변경 파일만 GitHub에 올립니다.
6. GitHub와 연결된 Vercel이 홈페이지를 다시 배포합니다.

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

필수 열은 `category,id,name,price,url`입니다. 선택 열은 `spec,source`입니다.

지원 category:

```text
ram, cpu, ssd, motherboard, gpu, cooler, halfpc, fullpc
```

현재 허용 판매처는 쿠팡, AliExpress, 11번가, G마켓, 네이버 스마트스토어·브랜드스토어·쇼핑입니다. 다나와 주소와 다른 도메인은 구매 링크로 등록할 수 없습니다.

## 실행

파일 생성만:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\collector\publish_prices.ps1
```

GitHub 업로드와 Vercel 배포까지:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\collector\publish_prices.ps1 -Publish
```

다나와에서 후보 목록만 수집하려면:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\collector\publish_prices.ps1 -CollectDanawa
```

결과는 비공개 파일 `ops/collector/input/danawa-candidates.csv`에 저장됩니다. 이 파일의 상품을 보고 실제 판매처 가격과 공식 제휴링크를 `products.csv`에 입력해야 합니다. `-CollectDanawa -Publish` 동시 실행은 다나와 주소가 실수로 구매 버튼에 들어가지 않도록 차단됩니다.

수집 대상은 `ops/collector/watchlist.json`에 고정되어 있습니다. 현재 CPU 4종, DDR5 24GB×2·16GB×2 국내 유통 인기상품 각 10개, 데스크톱 GeForce RTX 50 시리즈를 수집합니다. RAM은 해외·병행수입·노트북용·CUDIMM을 제외합니다.

`-Publish`는 안전을 위해 기본적으로 `main` 브랜치에서만 동작합니다. 입력 CSV와 31일 가격 기록은 `.gitignore`에 포함되어 GitHub에 올라가지 않습니다.

## 제휴 주소 변환 범위

- 판매처 주소의 제휴 추적 파라미터와 쿼리 순서를 보존합니다.
- 쿠팡 일반 상품 주소는 Vercel의 `COUPANG_LPTAG`가 설정된 경우 클릭 시 제휴 파라미터를 붙입니다.
- 11번가·G마켓 등은 우선 공식 제휴 시스템에서 발급한 주소를 직접 입력합니다.
- 제휴 중간 도메인을 사용하는 링크는 실제 예시 주소를 검증한 뒤 허용 목록에 추가합니다.
- 임의의 제휴 파라미터를 추측해서 붙이지 않습니다.

## Windows 작업 스케줄러

수집 원본 CSV를 자동으로 갱신하는 프로그램이 준비된 뒤 위 PowerShell 명령을 작업 스케줄러에 등록하면 됩니다. PC가 꺼져 있거나 절전 상태면 실행되지 않으므로, 처음에는 수동 실행으로 데이터와 링크를 확인하는 것을 권장합니다.
