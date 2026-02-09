# BLUEDEAL 최종본: 운영자가 직접 만질 부분(필수/선택)

이 프로젝트는 **UI(MVP)** 를 빠르게 확인할 수 있도록 일부 데이터를 **샘플(mock) / localStorage**로 구성했습니다.
운영자는 아래 항목만 바꾸면 “일단 배포해서 굴러가는 상태”까지 바로 갈 수 있습니다.

---

## 1) 배포 전에 꼭 수정/설정 (필수)

### A. 가격현황 API 연결
- **Vercel(또는 로컬) 환경변수**
  - `PRICE_API_BASE=https://api.YOURDOMAIN.com` (예: `https://api.bluedeal.co.kr`)

파일 위치:
- `.env.local` (로컬)
- Vercel Project → Settings → Environment Variables (운영)

VPS가 제공해야 하는 파일(정적 JSON):
- `GET /meta.json`
- `GET /prices/{category}.json`  (category 목록은 `src/lib/priceCategories.ts` 참고)

VPS 가이드:
- `ops/vps/README.md`
- 샘플 생성기: `ops/vps/bin/update_prices.py`

---

### B. /go 리다이렉트 매핑(제휴 링크)
**핫딜/가격현황에서 구매 버튼을 누르면 `/go/{code}`로 이동**합니다.
운영 전에는 최소 1개라도 실제 상품 URL로 채워 넣어야 합니다.

수정 파일:
- `src/lib/outbound.ts`

수정 포인트:
- `OUTBOUND_LINKS`에 코드 추가/수정
- 각 코드에 대해
  - `merchant`: coupang/aliexpress/naver/11st/gmarket
  - `originalUrl`: 실제 상품 URL

주의:
- `src/lib/affiliate.ts`의 **허용 도메인(whitelist)** 에 없는 도메인은 차단됩니다.
  - 새로운 쇼핑몰을 쓰면 whitelist에 도메인 정규식을 추가해야 합니다.

---

### C. 쿠팡 lptag (선택이지만, 쿠팡 쓰면 사실상 필수)
- 환경변수:
  - `COUPANG_LPTAG=YOUR_TAG_HERE`

적용 위치:
- `src/lib/affiliate.ts` (쿠팡 URL에 `lptag`, `subid`를 붙이는 로직)

---

## 2) 운영자가 자주 바꾸는 곳(선택)

### A. 사이트명/메타/브랜딩
- SEO 기본 메타:
  - `src/app/layout.tsx` → `metadata.title`, `metadata.description`
- 헤더 로고/문구:
  - `src/app/_components/SiteHeader.tsx`
- 푸터 문구/고지:
  - `src/app/_components/SiteFooter.tsx`

---

### B. 핫딜(샘플 데이터 교체)
현재 핫딜은 **mock 데이터**로 렌더링됩니다.

수정 파일:
- `src/lib/mockDeals.ts`

수정 포인트:
- `DEALS`: 실제 핫딜 목록으로 교체 가능
- `CATEGORIES`: 카테고리 구성
- 각 딜의 `goUrl`은 `/go/{code}` 형태 권장

---

### C. 게시판(IT/커뮤니티/문의) 샘플 글
현재 게시판은 **seed 글(mock) + localStorage 글**을 합쳐 보여줍니다.

수정 파일:
- `src/lib/mockPosts.ts`

---

### D. 커뮤니티 게시판 구성(메뉴/추가 필드)
게시판 목록, 글쓰기 폼의 추가 필드(예: 리뷰는 제품명/만족도 등)는 여기서 바꿉니다.

수정 파일:
- `src/lib/boardConfig.ts`

---

### E. 가격현황 카테고리 구성
카테고리명/설명/표시 순서는 여기서 바꿉니다.

수정 파일:
- `src/lib/priceCategories.ts`

주의:
- 카테고리를 추가/삭제하면 **VPS JSON 파일도 동일하게 추가/삭제**해야 합니다.

---

## 3) “만지면 꼬이기 쉬운 곳”(되도록 손대지 말 것)

- `src/app/*` 라우트 폴더 구조
  - 예전에 `src/app/contact/[visibility]` 같은 폴더가 남아있으면 라우트 충돌이 납니다.
  - 업데이트할 때는 **덮어쓰기 후 '삭제'가 필요한 폴더가 남지 않았는지** 꼭 확인하세요.
- `/go` 보안 로직
  - `affiliate.ts`의 whitelist를 제거하면 오픈리다이렉트 취약점이 생길 수 있습니다.

---

## 4) 다음 단계(운영용으로 바꾸려면)

- localStorage → VPS DB/API로 전환
  - 대상: IT/커뮤니티/문의/핫딜 작성/수정
- `/go` 매핑(outbound_links) + 클릭로그(outbound_clicks) DB 저장
- 핫딜 수집 자동화(또는 관리자 수동 등록 어드민)

