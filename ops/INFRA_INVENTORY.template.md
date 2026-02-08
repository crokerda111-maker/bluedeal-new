# BLUEDEAL 운영 정보 인벤토리 (템플릿)

> 목적: **도메인/DNS, Vercel, KV(Upstash/Vercel KV), VPS(가격 API)** 같은 운영 정보를 한 곳에 모아서
> - 현재 구조를 빠르게 파악하고
> - 설정 실수(특히 DNS/ENV)로 생기는 장애를 줄이고
> - 인수인계/확장/이전 시 속도를 올리는 것

⚠️ 보안 원칙
- **토큰/비밀번호/SSH 개인키**는 이 문서에 직접 적지 말고 **Vercel Environment Variables** 또는 **비밀번호 관리자**에 저장하세요.
- 이 파일은 템플릿입니다. 실제 값은 아래 중 하나로 관리 권장:
  - `ops/INFRA_INVENTORY.private.md`를 만들고 `.gitignore`에 추가
  - 또는 사내 문서/노션/1Password Secure Notes 등 별도 저장

---

## 1) 서비스 구성(요약)

- 프론트(Next.js): **Vercel**
- 가격 API(정적 JSON 서빙): **카페24 VPS** + `nginx`
- 게시판 저장소(온라인): **Vercel KV 또는 Upstash Redis REST**
- 도메인/DNS: (예: 카페24)

---

## 2) 도메인 & 라우팅

| 구분 | 값(예시) | 실제 값 | 비고 |
|---|---|---|---|
| 메인 도메인 | `bluedeal.co.kr` |  | Vercel에 연결 (Primary 추천) |
| www | `www.bluedeal.co.kr` |  | 보통 Vercel로 CNAME |
| VPS 도메인(apex) | `blusedeal.co.kr` |  | 카페24 VPS로 연결 후 **301 → bluedeal.co.kr** (혼동 방지) |
| VPS 도메인(www) | `www.blusedeal.co.kr` |  | 카페24 VPS로 연결 후 **301 → bluedeal.co.kr** |
| 가격 API 서브도메인 | `api.blusedeal.co.kr` |  | 카페24 VPS로 A 레코드 (가격 JSON 서빙) |
| (선택) 가격 API 별칭 | `api.bluedeal.co.kr` |  | 필요 시 추가(같은 VPS IP). 없으면 생략 |

---

## 3) DNS 레코드(체크리스트)

> ⚠️ 정확한 값은 **Vercel Domains 설정 화면이 안내하는 값**을 우선으로 합니다.

### A) Vercel(프론트)
- [ ] `bluedeal.co.kr` (apex/root) 레코드 설정
- [ ] `www` 레코드 설정
- [ ] SSL 활성화/리다이렉트(가능하면 www→apex 또는 apex→www 일관성)

### B) VPS(API)
- [ ] `api.blusedeal.co.kr` → A 레코드: `<VPS 공인 IP>`
- [ ] `blusedeal.co.kr` → A 레코드: `<VPS 공인 IP>` (리다이렉트용)
- [ ] `www.blusedeal.co.kr` → A 레코드: `<VPS 공인 IP>` (리다이렉트용)

---

## 4) Vercel 프로젝트 정보

| 항목 | 값 |
|---|---|
| Vercel Project Name |  |
| Production URL |  |
| GitHub Repo |  |
| Preview 배포 사용 여부 | Y/N |

### Vercel 환경변수 목록(이름만)

> 값은 Vercel에만 저장하고, 여기엔 **존재 여부/용도만** 적는 걸 권장합니다.

| 환경변수 | 용도 | 설정 위치 |
|---|---|---|
| `PRICE_API_BASE` | 가격현황 JSON API base | Vercel Env / `.env.local` |
| `KV_REST_API_URL` | 게시판 온라인 저장(KV) | Vercel Env |
| `KV_REST_API_TOKEN` | 게시판 온라인 저장(KV) | Vercel Env |
| `COUPANG_LPTAG` | 쿠팡 제휴 파라미터 | Vercel Env / `.env.local` |

---

## 5) KV(게시판 온라인 저장) 정보

| 항목 | 값 |
|---|---|
| 제공자 | Vercel KV / Upstash |
| Region |  |
| REST URL | (Vercel Env에 저장) |
| REST TOKEN | (Vercel Env에 저장) |

### 데이터 키(요약)
- `posts:{boardKey}`: 게시판별 post id 목록
- `post:{id}`: 단일 글 데이터

---

## 6) VPS(가격 API) 정보

| 항목 | 값 |
|---|---|
| 제공자 | 카페24 VPS |
| 공인 IP |  |
| OS |  |
| SSH 접속 | `ssh <user>@<ip>` |
| 방화벽/보안그룹 |  |

### nginx 설정
- server_name(가격 API): `api.blusedeal.co.kr`
- server_name(리다이렉트): `blusedeal.co.kr`, `www.blusedeal.co.kr`
- root: `/srv/bluedeal-api/public`
- 캐시: `Cache-Control: public, max-age=60`

### JSON 엔드포인트(필수)
- `GET /meta.json`
- `GET /prices/{category}.json`

### 파일 경로(권장)
- JSON 루트: `/srv/bluedeal-api/public/`
- 카테고리 폴더: `/srv/bluedeal-api/public/prices/`

### 갱신 스케줄
- 목표: **매일 09:00 / 17:00 (2회)**
- 크론 로그(예시): `/var/log/bluedeal-prices.log`

---

## 7) 운영 체크(런북 요약)

### 가격현황이 안 뜰 때
1. Vercel Env의 `PRICE_API_BASE` 확인
2. 브라우저에서 `https://api.blusedeal.co.kr/meta.json` 직접 열어 200인지 확인
3. VPS nginx access/error log 확인
4. 크론/갱신 스크립트 로그 확인

### 게시판 저장이 안 될 때
1. Vercel Env에 `KV_REST_API_URL`, `KV_REST_API_TOKEN` 존재 확인
2. Vercel Functions 로그에서 `/api/posts` 에러 확인
3. Upstash/Vercel KV 대시보드에서 요청/에러 확인

---

## 8) TODO / 결정해야 할 것

- [ ] 문의 게시판도 온라인 저장으로 옮길지 여부
- [ ] 홈 “실시간 게시글”을 온라인 API(`/api/posts`) 기반으로 전환
- [ ] `/contact/public` 같은 라우트 정리(링크/라우트 일치)
