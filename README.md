# BLUEDEAL MVP (Next.js + Tailwind)

핫딜 큐레이션 UI + `/go/{code}` 리다이렉트(블루딜) 뼈대가 포함된 MVP입니다.

## 0) 요구 사항
- Node.js 18.17+ (권장: Node 20)
- npm (또는 pnpm/yarn)

## 1) 로컬 실행 (압축 풀고 바로)
```bash
# 1) 압축 해제 후 폴더로 이동
cd bluedeal-mvp

# 2) 의존성 설치
npm install

# 3) 개발 서버 실행
npm run dev
```

브라우저에서:
- http://localhost:3000

## 2) 중요한 파일 위치
- 홈(UI): `src/app/page.tsx`
- 딜 상세: `src/app/deals/[id]/page.tsx`
- /go 리다이렉트: `src/app/go/[code]/route.ts`
- 더미 딜: `src/lib/mockDeals.ts`
- /go 매핑(데모 fallback): `src/lib/outbound.ts`
- /go 매핑(운영/KV): `src/lib/onlineOutbound.ts`
- 제휴 변환/화이트리스트: `src/lib/affiliate.ts`

## 3) /go 리다이렉트 테스트

### A) 데모(로컬/초기) 방식
`src/lib/outbound.ts`의 `originalUrl`이 샘플입니다.
원하는 상품 URL로 바꾸면 `/go/d1` 같은 링크가 실제로 리다이렉트 됩니다.

예) `OUTBOUND_LINKS.d1.originalUrl = "https://www.coupang.com/vp/products/..."`

### B) 운영 방식(KV, 자동 코드 생성)
게시판 글쓰기에서 URL(예: 핫딜의 구매 링크)을 입력하면,
서버에서 allowlist에 해당하는 링크만 자동으로 `/go/{code}`로 변환해 저장합니다.

- `/go/{code}`는 KV에 저장된 원본 URL로 리다이렉트
- (선택) 제휴 파라미터(예: 쿠팡 lptag) 부착
- 클릭 카운트는 best-effort로 KV에 누적

## 4) (선택) 쿠팡 lptag
`.env.local`을 만들어 아래처럼 넣으면 쿠팡 URL에 파라미터가 추가됩니다.

```env
COUPANG_LPTAG=YOUR_TAG_HERE
```

## 5) 바로 웹에 올리기 (추천: Vercel)
Next.js는 Vercel이 가장 간단합니다.

### A) GitHub에 올리기
```bash
git init
git add .
git commit -m "init bluedeal mvp"
git branch -M main
git remote add origin https://github.com/<YOU>/<REPO>.git
git push -u origin main
```

### B) Vercel 배포
1. Vercel 로그인 → **New Project**
2. GitHub repo 선택 → Import
3. Framework: Next.js 자동 감지
4. Environment Variables (선택):
   - `COUPANG_LPTAG` 등
5. Deploy

배포되면 `https://<project>.vercel.app`로 바로 확인 가능합니다.

## 6) 도메인 연결(커스텀 도메인)
**추천 흐름**
- 먼저 Vercel 기본 도메인(`*.vercel.app`)으로 배포/확인
- 이후 커스텀 도메인 연결 (문제 생기면 롤백/재배포 쉬움)

### Vercel에서 도메인 추가
1. Vercel 프로젝트 → Settings → Domains
2. 구매한 도메인 입력 후 Add
3. Vercel이 안내하는 DNS 레코드(A/CNAME)를 도메인 구매처 DNS에 그대로 추가

DNS 반영이 지연될 수 있으니, 배포 도메인과 별개로 운영 중단 없이 붙이는 방식이 안전합니다.

## 7) 운영 시 권장 사항(초기부터)
- 핫딜 게시판에는 **제휴 고지 문구를 항상 노출**
- /go는 반드시 **도메인 whitelist** 유지(오픈리다이렉트 방지)
- 출처 표기/삭제 요청 대응 플로우는 초기부터 고정

---

다음 단계(추천):
- 핫딜 “작성/수정 폼(구조화)”을 실제 페이지로 붙이기
- outbound_links/outbound_clicks DB 테이블로 교체
- 포인트/레벨 시스템 붙이기


## 8) 가격현황(/prices)
가격현황은 VPS 없이 GitHub에 포함된 JSON을 읽습니다.

- 허브: `src/app/prices/page.tsx`
- 카테고리(동적 라우트): `src/app/prices/[category]/page.tsx`
- 카테고리 목록: `src/lib/priceCategories.ts`
- 데이터 로더: `src/lib/prices.ts`, `src/lib/localPrices.ts`
- 실제 데이터: `src/content/prices/*.json`
- 이동주소 표: `src/content/outbound.generated.json`
- PC 수집기: `ops/collector/`

### PC에서 갱신

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\collector\publish_prices.ps1 -Publish
```

수집기는 CSV/JSON의 상품 URL을 허용 목록으로 검사하고 `/go/{code}`로 변환합니다. 가격 파일에는 원본 URL이 들어가지 않습니다. GitHub에 push되면 연결된 Vercel 배포가 자동으로 시작됩니다. 입력 형식과 Windows 작업 스케줄러 설정은 `ops/collector/README.md`를 참고하세요.

---

## 9) 게시판 온라인 저장(/community, /it)

게시판 글이 **브라우저(localStorage)**가 아니라 **온라인 DB(Vercel KV/Upstash Redis)**에 저장되도록 연동되었습니다.

### 필요한 환경변수

Vercel KV를 연결하면 아래 값이 보통 자동으로 설정됩니다.

```env
KV_REST_API_URL=https://<your-upstash-endpoint>
KV_REST_API_TOKEN=<your-token>
```

Upstash를 직접 쓴다면 아래 환경변수도 지원합니다.

```env
UPSTASH_REDIS_REST_URL=https://<your-upstash-endpoint>
UPSTASH_REDIS_REST_TOKEN=<your-token>
```

> Vercel에서 배포한다면 **Production / Preview 둘 다** 환경변수를 설정하는 것을 권장합니다.

### 동작 방식

- 프론트(UI)는 `/api/posts`로 글 목록/작성/상세를 요청
- `/api/posts`는 KV에 저장/조회

KV 설정이 없으면 게시판은 샘플 글(MOCK_POSTS)만 보이도록 fallback 됩니다.

---

## 10) 관리자 페이지 (/admin)

- 사이트 내 링크는 제공하지 않습니다. URL로 직접 접근합니다.
- 환경변수 `ADMIN_PASSWORD` 설정이 필수입니다. 코드에 기본 비밀번호는 포함하지 않습니다.
  - Vercel 배포 시 **Production / Preview** 모두 설정 권장

관리자 로그인 시:
- 게시글 수정/삭제 가능
- 비공개 문의는 **비밀번호 없이** 열람 가능

가격현황 페이지의 "추가요청/제보/문의"는 `/contact/write?from=prices&cat=<카테고리명>`로 연결되며,
운영자 확인용 **비공개 문의**로 자동 등록됩니다.
