# BLUEDEAL 환경변수

가격 데이터는 `ops/collector`가 생성한 Git 파일을 사용하므로 가격 API나 VPS 환경변수가 필요하지 않습니다.

| 변수 | 필수 | 용도 |
|---|---:|---|
| `ADMIN_PASSWORD` | 운영 필수 | `/admin` 로그인 |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | 인증·동적 글 사용 시 | 관리자 로그인·비공개 암호 확인의 시도 제한, 게시판, 관리자 블로그, 동적 `/go` 저장. 쓰기 가능한 서버 전용 토큰 필요 |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | 위 변수의 대안 | Upstash REST 직접 연결 |
| `OUTBOUND_INGEST_SECRET` | 내부 등록 API 사용 시 | `/api/internal/outbound/register` 인증 |
| `AFFILIATE_LINKS_JSON` | 기존 발급 링크 이관·복구 시 | 기존 서버 전용 매핑. 같은 원본 주소의 온라인 매핑을 읽지 못했을 때 사용하며 공개 접두사를 붙이지 않음 |

## 저장 위치

쿠팡 등 제휴 링크는 공식 계정에서 발급한 완성된 주소를 등록합니다. 일반 상품 주소에 임의 태그를 붙여 수익 귀속이 보장된 것으로 처리하지 않습니다. `COUPANG_LPTAG`는 사용하지 않습니다.

관리자 세션 또는 내부 등록용 Bearer 인증으로 `POST /api/internal/affiliate/import`에 JSON을 전송합니다. `{"source":"legacy"}`는 현재 환경변수의 항목을 온라인 저장소로 이관합니다. 새 링크는 공식 발급·목적지 확인 후 `{"mappings":[{"merchant":"gmarket","provider":"linkprice","originalUrl":"https://item.gmarket.co.kr/Item?goodsCode=EXAMPLE","affiliateUrl":"https://app.ac/EXAMPLE01"}]}` 형식으로 최대 100건씩 등록합니다. 같은 매핑의 재실행은 안전하며, 다른 목적지로 충돌한 기존 기록은 덮어쓰지 않습니다. 배포 환경별 키를 사용합니다.

쿠팡·알리는 `provider`도 각각 `coupang`·`aliexpress`로 쓰고 각 서비스의 공식 제휴 호스트만 허용합니다. 링크프라이스는 G마켓·11번가의 검증한 `app.ac` 단축 주소와 `click.linkprice.com/click.php` 발급 주소를 지원합니다. 긴 주소는 `m` 광고주와 `tu` 원본 상품이 매핑과 일치하고 매개변수가 중복되지 않아야 합니다. 현재 확인한 `m,a,l,l_cd1,l_cd2,tu` 외의 매개변수·다른 경로는 거부하며 발급 추적값과 순서를 보존합니다. 공유 제휴 호스트는 사용자 입력 허용 목록에 추가하지 않습니다. 주소 형식 지원과 광고주의 상품별 실적 인정은 별개이므로 제외 카테고리·등록 사이트 조건을 발급 전에 확인하세요.

원본 CSV·가격·확인 시각·가격 이력·기존 `/go` 코드는 변경하지 않습니다. 설정이 없거나 잘못됐거나 같은 원본이 중복되면 기존 판매처 주소로 이동합니다. 제휴 고지는 구매 버튼보다 먼저 표시합니다. 리디렉션 검증은 상품 도착 확인이며 실제 매출 귀속은 각 제휴처 리포트에서 별도로 확인해야 합니다. 새 API 키 발급은 단순 링크 발급과 별개의 작업입니다.

선택 필드 `code`를 지정하면 수동 발급 링크도 `/go/{code}`로 등록합니다(영문·숫자·밑줄·하이픈 2~64자, 설정 안에서 고유해야 함). 이 등록은 상품명·가격·재고·리뷰의 검증이나 상품 카드의 게시를 의미하지 않습니다. 사용자가 전달한 공식 알리 단축 링크는 원본과 발급 주소에 같은 값을 쓸 수 있습니다. 링크 전달용 주소를 글에 사용할 때도 해당 플랫폼의 제휴 고지를 먼저 표시해야 합니다.

- Production: Vercel Project → Settings → Environment Variables
- 로컬 개발: 저장소 루트의 `.env.local`
- 실제 비밀번호와 토큰은 Git에 커밋하지 않습니다.

## 가격 데이터

- 입력 CSV: `ops/collector/input/products.csv` (Git 제외)
- 공개 가격: `src/content/prices/*.json`
- 서버 이동주소: `src/content/outbound.generated.json`
- 갱신 명령: `ops/collector/publish_prices.ps1 -Publish`

## KV가 없을 때

정적 블로그 글과 Git으로 배포한 가격·이동주소는 계속 동작합니다. 게시판 작성과 관리자 블로그 저장 같은 동적 기능만 사용할 수 없습니다.
