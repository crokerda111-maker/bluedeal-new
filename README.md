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
- /go 매핑: `src/lib/outbound.ts`
- 제휴 변환/화이트리스트: `src/lib/affiliate.ts`

## 3) /go 리다이렉트 테스트
현재는 `src/lib/outbound.ts`의 `originalUrl`이 샘플입니다.
원하는 상품 URL로 바꾸면 `/go/d1` 같은 링크가 실제로 리다이렉트 됩니다.

예) `OUTBOUND_LINKS.d1.originalUrl = "https://www.coupang.com/vp/products/..."`

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
가격현황 페이지가 추가되었습니다.

- 허브: `src/app/prices/page.tsx`
- 카테고리(동적 라우트): `src/app/prices/[category]/page.tsx`
- 카테고리 목록: `src/lib/priceCategories.ts`
- 데이터 fetch: `src/lib/prices.ts`
- (임시) 샘플 데이터: `src/lib/mockPrices.ts`

### 데이터 연동(권장)
Vercel(프론트)에서 VPS(가격 API)의 JSON을 읽어옵니다.

`.env.local` 또는 Vercel Environment Variables에 아래를 설정하세요.
```env
PRICE_API_BASE=https://api.bluedeal.co.kr
```

VPS에서는 다음 파일을 제공하면 됩니다.
- `GET /meta.json`
- `GET /prices/ram.json`
- `GET /prices/cpu.json`
- `GET /prices/motherboard.json`
- `GET /prices/gpu.json`
- `GET /prices/cooler.json`
- `GET /prices/halfpc.json`
- `GET /prices/fullpc.json`

예시(JSON)
```json
{
  "category": "ram",
  "updatedAt": "2026-02-06T09:00:00+09:00",
  "items": [
    {
      "id": "ram-1",
      "name": "제품명",
      "spec": "스펙 요약",
      "price": 129000,
      "low7d": 125000,
      "low30d": 119000,
      "change24hPct": -0.8,
      "url": "https://example.com",
      "goCode": "d1",
      "source": "sample"
    }
  ]
}
```

### 갱신 주기
현재 사이트 가정: **매일 09:00 / 17:00 (2회 갱신)**

VPS 크론 예시:
```bash
0 9,17 * * * /usr/bin/python3 /srv/bluedeal-api/bin/update_prices.py >> /var/log/bluedeal-prices.log 2>&1
```

---

## 9) 게시판 온라인 저장(/community, /it)

게시판 글이 **브라우저(localStorage)**가 아니라 **온라인 DB(Vercel KV/Upstash Redis)**에 저장되도록 연동되었습니다.

### 필요한 환경변수

Vercel KV를 연결하면 아래 값이 보통 자동으로 설정됩니다.

```env
KV_REST_API_URL=https://<your-upstash-endpoint>
KV_REST_API_TOKEN=<your-token>
```

### 동작 방식

- 프론트(UI)는 `/api/posts`로 글 목록/작성/상세를 요청
- `/api/posts`는 KV에 저장/조회

KV 설정이 없으면 게시판은 샘플 글(MOCK_POSTS)만 보이도록 fallback 됩니다.
