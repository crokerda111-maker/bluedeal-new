# BLUEDEAL 환경변수

가격 데이터는 `ops/collector`가 생성한 Git 파일을 사용하므로 가격 API나 VPS 환경변수가 필요하지 않습니다.

| 변수 | 필수 | 용도 |
|---|---:|---|
| `ADMIN_PASSWORD` | 운영 필수 | `/admin` 로그인 |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | 동적 글 사용 시 | 게시판, 관리자 블로그, 동적 `/go` 저장 |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | 위 변수의 대안 | Upstash REST 직접 연결 |
| `OUTBOUND_INGEST_SECRET` | 내부 등록 API 사용 시 | `/api/internal/outbound/register` 인증 |

## 저장 위치

쿠팡 등 제휴 링크는 공식 계정에서 발급한 완성된 주소를 등록합니다. 일반 상품 주소에 임의 태그를 붙여 수익 귀속이 보장된 것으로 처리하지 않습니다. `COUPANG_LPTAG`는 사용하지 않습니다.

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
