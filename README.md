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
