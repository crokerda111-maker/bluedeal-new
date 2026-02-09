# 환경변수 맵 (Vercel / 로컬)

이 문서는 “어떤 환경변수를 어디에 넣어야 사이트가 정상 동작하는지”를 한 장으로 정리합니다.

> 원칙
> - **운영(Production)**: Vercel Project → Settings → Environment Variables
> - **로컬 개발**: 프로젝트 루트에 `.env.local` (gitignore 처리됨)

---

## 1) 가격현황(VPS JSON) 연동

| 변수 | 예시 | 필수 | 영향 범위 |
|---|---|---:|---|
| `PRICE_API_BASE` | `https://blusedeal.co.kr` | 🟡 권장 | `/prices` 전체 |

권장 운영 규칙:
- `blusedeal.co.kr`처럼 **가격 JSON을 실제로 서빙하는 도메인**을 한 번 정하면 되도록 유지합니다.
- 나중에 VPS를 다른 곳으로 옮기더라도, 프론트는 `PRICE_API_BASE`만 바꾸거나(또는 DNS만 바꾸고) 그대로 유지할 수 있습니다.

> 참고
> - `api.blusedeal.co.kr` 같은 전용 서브도메인 분리는 “가능하면” 좋지만,
>   카페24 관리형/워드프레스 VPS 환경에서는 vhost 제약으로 403이 나는 경우가 있어
>   **현재는 `blusedeal.co.kr` 하나로 `/meta.json`, `/prices/*.json`을 서빙하는 구성이 가장 안정적**입니다.

### 동작
- 설정됨: VPS의 JSON을 fetch해서 가격현황 표시
- 미설정: 샘플 데이터(목업)로 표시

---

## 2) 게시판 온라인 저장(KV)

| 변수 | 예시 | 필수 | 영향 범위 |
|---|---|---:|---|
| `KV_REST_API_URL` | `https://<endpoint>` | ✅ | `/community`, `/it` 게시판 저장/조회 |
| `KV_REST_API_TOKEN` | `<token>` | ✅ | 동일 |

### 동작
- 설정됨: `/api/posts`가 KV에 저장/조회
- 미설정: 목록은 샘플 글 fallback, 글 작성은 실패(저장 오류)

---

## 3) 쿠팡 제휴 파라미터

| 변수 | 예시 | 필수 | 영향 |
|---|---|---:|---|
| `COUPANG_LPTAG` | `AF123456` | ❌ | 쿠팡 outbound URL에 lptag 추가 |

---

## 4) 운영 체크(문제 발생 시)

### A) 가격현황이 안 뜸
1. `PRICE_API_BASE`가 존재하는지
2. `PRICE_API_BASE/meta.json`이 200인지
3. VPS nginx/certbot 상태

### B) 게시판 저장 실패
1. `KV_REST_API_URL`, `KV_REST_API_TOKEN` 존재 여부
2. Vercel Functions 로그에서 `/api/posts` 에러 확인